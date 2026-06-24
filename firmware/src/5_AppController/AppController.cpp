#include "AppController.h"
#include "0_Base/Logger.h"
#include "0_Base/Board.h"
#include "3_Storage/StorageManager.h"
#include "4_Network/NetManager.h"
#include <ArduinoJson.h>
#include <new>  // for std::nothrow

// 外部引用
extern NetManager gNetManager;

AppController::AppController(
    StateManager* stateMgr,
    SignalProcessor* signalProc,
    StorageManager* storageMgr,
    NetManager* netMgr,
    BleConfigServer* bleServer
) : _stateMgr(stateMgr),
    _signalProc(signalProc),
    _storageMgr(storageMgr),
    _netMgr(netMgr),
    _bleServer(bleServer)
{
}

void AppController::init(void)
{
    PersonalCalibData_t calib = {0};
    if (_storageMgr->GetPersonalCalib(&calib) && calib.calib_timestamp_sec > 0) {
        _signalProc->setCalibration(calib.relax_rms_mv, calib.active_rms_mv, calib.relax_mdf_hz);
        _signalProc->setRelaxBaseline(calib.relax_rms_mv, calib.relax_mdf_hz);
        LOG("[CTRL] Boot: loaded calib relax_mdf=%.1f\n", calib.relax_mdf_hz);
    } else {
        LOG("[CTRL] Boot: no calib in A zone\n");
    }

    _stateMgr->transitionTo(ST_RUNNING);
    LOG("[CTRL] Boot: entering RUNNING, background processing enabled\n");
    LOG("[CTRL] AppController initialized.\n");
}

void AppController::tick(void)
{
    // ===== [v3.9.33] Async query_cz: one batch per tick, never blocks signal pipeline =====
    _tickQueryCz();

    // ===== Deferred query_cz: initialize async send =====
    if (_pendingQueryCZ) {
        _pendingQueryCZ = false;
        LOG("[CTRL] Processing deferred query_cz\n");
        _startQueryCz(_pendingQueryCZClientNum, _pendingQueryStartTs, _pendingQueryEndTs, -1);
    }

    // ===== Background: signal processing (all states) =====
    float rms = _signalProc->update();
    float mdf = _signalProc->getMDF();
    float fatigue = _signalProc->getFatigue();
    float activation = _signalProc->getActivation();
    uint8_t quality = (uint8_t)_signalProc->getSignalQuality();

    // ===== Calibration phase: firmware-side timed accumulation (using fresh signal values) =====
    if (_calibPhase == CALIB_RELAX) {
        _calibAccumSum1 += rms;
        _calibAccumSum2 += mdf;
        _calibSampleCount++;
        if (rms < _calibMinRms) _calibMinRms = rms;
        if (rms > _calibRelaxMaxRms) _calibRelaxMaxRms = rms;
        if (mdf < _calibMinMdf) _calibMinMdf = mdf;
        if (mdf > _calibRelaxMaxMdf) _calibRelaxMaxMdf = mdf;
        if (millis() - _calibStartMs >= _calibTargetMs) {
            _calibPhase = CALIB_NONE;
            // Trimmed mean: subtract min and max (remove 2 outliers)
            if (_calibSampleCount > 2) {
                _calibAccumSum1 -= (_calibMinRms + _calibRelaxMaxRms);
                _calibAccumSum2 -= (_calibMinMdf + _calibRelaxMaxMdf);
                _calibSampleCount -= 2;
            }
            float relaxRms = _calibAccumSum1 / _calibSampleCount;
            float relaxMdf = _calibAccumSum2 / _calibSampleCount;
            _signalProc->setRelaxBaseline(relaxRms, relaxMdf);
            _signalProc->resetEMA();
            _calibRelaxMdf = relaxMdf;
            LOG("[CTRL] <<< CALIB RELAX done: rms=%.3f mdf=%.1f (%u samples, %lu ms) <<<\n", relaxRms, relaxMdf, _calibSampleCount, (unsigned long)(millis()-_calibStartMs));
            char buf[160];
            snprintf(buf, sizeof(buf), "{\"cmd\":\"relax_done\",\"relax_rms\":%.3f,\"relax_mdf\":%.1f}", relaxRms, relaxMdf);
            _netMgr->deferSendJson(_calibAccumClient, buf);
        }
    }
    else if (_calibPhase == CALIB_ACTIVE) {
        if (rms > _calibAccumSum1) _calibAccumSum1 = rms;  // peak-hold
        _signalProc->recordCalibMdf(mdf);
        _calibSampleCount++;
        if (millis() - _calibStartMs >= _calibTargetMs) {
            _calibPhase = CALIB_NONE;
            _signalProc->finalizeCalibMdf();
            float activeRms = _calibAccumSum1;  // peak value
            _calibActiveMdf = _signalProc->getCalibMdfPeak();
            _calibEndMdf = _signalProc->getCalibMdfEnd();
            _signalProc->setActiveReference(activeRms);
            LOG("[CTRL] <<< CALIB ACTIVE done: rms=%.3f activeMdf=%.1f endMdf=%.1f (%u samples, %lu ms) <<<\n", activeRms, _calibActiveMdf, _calibEndMdf, _calibSampleCount, (unsigned long)(millis()-_calibStartMs));
            char buf[200];
            snprintf(buf, sizeof(buf), "{\"cmd\":\"active_done\",\"active_rms\":%.3f,\"active_mdf\":%.1f,\"end_mdf\":%.1f}",
                activeRms, _calibActiveMdf, _calibEndMdf);
            _netMgr->deferSendJson(_calibAccumClient, buf);
        }
    }

    

    // ===== Background: C-zone storage (RUNNING only) =====
    SystemState_t curState = _stateMgr->getState();
    // [v3.9.30] 移除 isNtpSynced() 限制，纯局域网环境也写入 CZone（时间戳基于 millis）
    // NTP 同步后新数据自动使用真实时间戳
    if (rms > 0.0f && curState == ST_RUNNING) {
        CZone_DataPoint_t pt;
        memset(&pt, 0, sizeof(pt));
        // [v3.9.27] 真实毫秒精度: 拆分为 sec + ms
        uint64_t tsMs = _netMgr->getCurrentTimestampMs();
        pt.timestamp_sec = (uint32_t)(tsMs / 1000ULL);
        pt.timestamp_ms = (uint16_t)(tsMs % 1000ULL);
        pt.rms = (uint16_t)(rms * 100.0f);        // mV×100, max 655.35mV safe
        pt.activation = (uint16_t)(activation * 10.0f); // 80.0% → 800
        pt.mdf = (uint16_t)(mdf * 10.0f);         // 84.9 Hz → 849
        pt.fatigue = (uint16_t)(fatigue * 10.0f); // 22.3% → 223
        pt.quality = quality;
        _storageMgr->CZone_AppendDataPoint(&pt);

        // [v3.9.38] 串口LOG字段: phaseTag HH:MM:SS.mmm(北京时间) rms(mV) activation(%) mdf(Hz) fatigue(%) quality
        // [v3.9.38] ts_sec已+28800转为北京时间，拆分为时:分:秒.毫秒显示
        const char* phaseTag = "";
        if (_calibPhase == CALIB_RELAX) phaseTag = " [CALIB:RELAX]";
        else if (_calibPhase == CALIB_ACTIVE) phaseTag = " [CALIB:ACTIVE]";
        unsigned long ts_beijing = (unsigned long)(tsMs / 1000ULL) + 28800UL;
        unsigned int  ts_msec    = (unsigned int)(tsMs % 1000ULL);
        unsigned int  hh = (ts_beijing % 86400UL) / 3600;
        unsigned int  mm = (ts_beijing % 3600) / 60;
        unsigned int  ss = ts_beijing % 60;
        // [v3.9.39] 限频: 每60帧(~6s)输出一次DATA日志，减轻串口TX缓冲压力和newlib stdio竞争
        // [NTP-FIX] 只有 NTP 等待完成（或超时）后才打印，避免未完成前误导
        static uint16_t _dataLogCounter = 0;
        if (_netMgr->isNtpWaitDone() && ++_dataLogCounter >= 60) {
            _dataLogCounter = 0;
            LOG("[DATA]%s %02u:%02u:%02u.%03u rms=%.3f activation=%.1f%% mdf=%.1f fatigue=%.1f%% quality=%u\n",
                phaseTag, hh, mm, ss, ts_msec, rms, activation, mdf, fatigue, quality);
        }

        // [v3.9.30] 无NTP时时间戳基于millis（相对time），首次写入时提醒
        static bool _czNoNtpWarn = false;
        if (!_czNoNtpWarn && !_netMgr->isNtpSynced()) {
            LOG("[CZ] WARNING: writing without NTP — timestamps are relative to boot\n");
            _czNoNtpWarn = true;
        }

        // 第一次NTP后写入时打日志
        static bool _czFirstNtpLog = false;
        if (!_czFirstNtpLog && pt.timestamp_sec > 100000) {
            LOG("[CZ] first NTP timestamp write: ts=%lu.%03u\n", (unsigned long)pt.timestamp_sec, pt.timestamp_ms);
            _czFirstNtpLog = true;
        }
    }

    // ===== State-specific logic =====
    switch (curState) {
        case ST_RUNNING:
            _handleRunningState(rms, mdf, fatigue, quality, activation);
            break;


        case ST_ERROR:
        default:
            _handleErrorState();
            break;
    }
}

void AppController::onCommandReceived(AppCommand_t cmd, uint8_t clientNum)
{
    switch (cmd) {
        case CMD_STOP: {
            // RUNNING状态下STOP无操作
            LOG("[CTRL] STOP received, no action needed in RUNNING\n");
            break;
        }
        case CMD_START_STREAM: {
            // [FIX] 如果状态机在 ERROR，恢复到 RUNNING（确保数据流恢复）
            if (_stateMgr->getState() != ST_RUNNING) {
                _stateMgr->transitionTo(ST_RUNNING);
                LOG("[CTRL] start_stream: recovered state to RUNNING\n");
            } else {
                LOG("[CTRL] Already in RUNNING, stream always active\n");
            }
            break;
        }
        default: {
            break;
        }
    }
}

// ===== State handlers (receive pre-computed values from tick()) =====

void AppController::_handleRunningState(float rms, float mdf, float fatigue, uint8_t quality, float activation)
{
    // RUNNING: 开机即采集即推送，无需状态切换
    if (rms > 0.0f) {
        _netMgr->sendData(rms, mdf, fatigue, quality, activation);
    }
}

void AppController::_handleErrorState(void)
{
}

// ==================== JSON command handlers ====================

void AppController::handleQueryCZ(uint8_t clientNum, uint32_t startTs, uint32_t endTs, int seq)
{
    // [v3.9.33] Thin wrapper: delegate to async path (called from tick context, not WS callback)
    _startQueryCz(clientNum, startTs, endTs, seq);
}

// [v3.9.34] Async analysis query: downsample + array JSON (mdf[]/fatigue[], no per-point ts)
void AppController::_startQueryCz(uint8_t clientNum, uint32_t startTs, uint32_t endTs, int seq)
{
    LOG("[CTRL] _startQueryCz (analysis): startTs=%lu, endTs=%lu\n", startTs, endTs);
    if (startTs == 0) {
        uint32_t nowSec = _netMgr->getCurrentTimestamp();
        startTs = nowSec - 3600UL;
        LOG("[CTRL] _startQueryCz: startTs adjusted to last 1h = %lu\n", startTs);
    }
    if (endTs == 0 || endTs == 0xFFFFFFFF) {
        endTs = _netMgr->getCurrentTimestamp();
    }

    _queryMdf     = new(std::nothrow) float[QUERY_ANALYSIS_MAX];
    _queryFatigue = new(std::nothrow) float[QUERY_ANALYSIS_MAX];
    if (!_queryMdf || !_queryFatigue) {
        delete[] _queryMdf;     _queryMdf = nullptr;
        delete[] _queryFatigue; _queryFatigue = nullptr;
        char buf[128];
        if (seq >= 0) snprintf(buf, sizeof(buf), "{\"cmd\":\"cz_data\",\"error\":\"nomem\",\"seq\":%d}", seq);
        else snprintf(buf, sizeof(buf), "{\"cmd\":\"cz_data\",\"error\":\"nomem\"}");
        gNetManager.deferSendJson(clientNum, buf);
        return;
    }

    uint16_t count = 0;
    uint32_t total = 0;
    uint64_t firstTs = 0, lastTs = 0;
    bool ok = _storageMgr->CZone_QueryForAnalysis(startTs, endTs,
                _queryMdf, _queryFatigue, QUERY_ANALYSIS_MAX,
                &count, &total, &firstTs, &lastTs);

    if (!ok || count == 0) {
        delete[] _queryMdf;     _queryMdf = nullptr;
        delete[] _queryFatigue; _queryFatigue = nullptr;
        char buf[128];
        if (seq >= 0) snprintf(buf, sizeof(buf), "{\"cmd\":\"cz_data\",\"mdf\":[],\"fatigue\":[],\"seq\":%d}", seq);
        else snprintf(buf, sizeof(buf), "{\"cmd\":\"cz_data\",\"mdf\":[],\"fatigue\":[]}");
        gNetManager.deferSendJson(clientNum, buf);
        return;
    }

    _queryTotal        = count;
    _queryCursor       = 0;
    _queryClient       = clientNum;
    _querySeq          = seq;
    _queryActive       = true;
    _queryTotalMatches = total;
    _queryFirstTsMs    = firstTs;
    _queryLastTsMs     = lastTs;

    LOG("[CTRL] _startQueryCz: %u sampled, %lu total matches, batches of %u\n",
        count, (unsigned long)total, QUERY_ANALYSIS_BATCH);
    _tickQueryCz();
}

void AppController::_tickQueryCz()
{
    if (!_queryActive || !_queryMdf || !_queryFatigue) return;

    uint16_t batchStart = _queryCursor;
    uint16_t batchEnd   = batchStart + QUERY_ANALYSIS_BATCH;
    if (batchEnd > _queryTotal) batchEnd = _queryTotal;

    StaticJsonDocument<1536> doc;
    doc["cmd"]      = "cz_data";
    if (_querySeq >= 0) doc["seq"] = _querySeq;
    doc["start_ts"] = _queryFirstTsMs;
    doc["end_ts"]   = _queryLastTsMs;
    doc["total"]    = _queryTotalMatches;

    JsonArray mdfArr = doc.createNestedArray("mdf");
    JsonArray fatArr = doc.createNestedArray("fatigue");
    for (uint16_t i = batchStart; i < batchEnd; i++) {
        mdfArr.add(_queryMdf[i]);
        fatArr.add(_queryFatigue[i]);
    }

    if (batchEnd < _queryTotal) {
        doc["more"] = true;
    }

    // [v3.9.35] 栈变量（非static），1536匹配StaticJsonDocument上限
    char buf[1536];
    serializeJson(doc, buf, sizeof(buf));
    LOG("[CTRL] cz_data analysis batch: pts %u-%u/%u, more=%s\n",
        batchStart, batchEnd - 1, _queryTotal, (batchEnd < _queryTotal) ? "true" : "false");
    // [v3.9.36] Zero-copy direct TX: bypass deferred queue for large analysis payloads
    size_t jsonLen = strlen(buf);
    _netMgr->sendRawToClient(_queryClient, buf, jsonLen);

    _queryCursor = batchEnd;

    if (_queryCursor >= _queryTotal) {
        delete[] _queryMdf;     _queryMdf = nullptr;
        delete[] _queryFatigue; _queryFatigue = nullptr;
        _queryActive = false;
        LOG("[CTRL] _tickQueryCz: all %u analysis points sent\n", _queryTotal);
    }
}

void AppController::deferQueryCZ(uint8_t clientNum, uint32_t startTs, uint32_t endTs)
{
    // [v3.9.33] 防重入：已有查询在处理中（pending或active）则拒绝
    if (_pendingQueryCZ || _queryActive) {
        LOG("[CTRL] query_cz rejected: already %s\n", _queryActive ? "active" : "pending");
        return;
    }
    LOG("[CTRL] query_cz deferred to tick\n");
    _pendingQueryCZ = true;
    _pendingQueryCZClientNum = clientNum;
    _pendingQueryStartTs = startTs;
    _pendingQueryEndTs = endTs;
}

void AppController::handleRecordRelax(uint8_t clientNum, int seq)
{
    // [v3.9.32] 状态守卫：校准进行中拒绝重复触发
    if (_calibPhase != CALIB_NONE) {
        LOG("[CTRL] record_relax rejected: phase=%d already active\n", (int)_calibPhase);
        char buf[80];
        snprintf(buf, sizeof(buf), "{\"cmd\":\"record_relax\",\"ok\":false,\"seq\":%d,\"error\":\"busy\"}", seq);
        _netMgr->deferSendJson(clientNum, buf);
        return;
    }
    // Start 10-second RMS/MDF accumulation
    _calibPhase = CALIB_RELAX;
    _calibStartMs = millis();
    _calibTargetMs = 10000;  // 10 seconds
    _calibSampleCount = 0;
    _calibAccumSum1 = 0.0f;
    _calibAccumSum2 = 0.0f;
    _calibMinRms = 1e9f;
    _calibRelaxMaxRms = 0.0f;
    _calibMinMdf = 1e9f;
    _calibRelaxMaxMdf = 0.0f;
    _calibAccumClient = clientNum;
    LOG("[CTRL] >>> CALIB RELAX phase start (10s) <<<\n");
    _signalProc->resetEMA();
    char buf[80];
    snprintf(buf, sizeof(buf), "{\"cmd\":\"record_relax\",\"ok\":true,\"seq\":%d}", seq);
    _netMgr->deferSendJson(clientNum, buf);
}

void AppController::handleRecordActive(uint8_t clientNum, int seq)
{
    // [v3.9.32] 状态守卫：校准进行中拒绝重复触发
    if (_calibPhase != CALIB_NONE) {
        LOG("[CTRL] record_active rejected: phase=%d already active\n", (int)_calibPhase);
        char buf[80];
        snprintf(buf, sizeof(buf), "{\"cmd\":\"record_active\",\"ok\":false,\"seq\":%d,\"error\":\"busy\"}", seq);
        _netMgr->deferSendJson(clientNum, buf);
        return;
    }
    // Start 15-second RMS accumulation + MDF recording
    _calibPhase = CALIB_ACTIVE;
    _calibStartMs = millis();
    _calibTargetMs = 15000;  // 15 seconds
    _calibSampleCount = 0;
    _calibAccumSum1 = 0.0f;
    _calibAccumClient = clientNum;
    _signalProc->resetCalibMdfBuffer();
    LOG("[CTRL] >>> CALIB ACTIVE phase start (15s) <<<\n");
    char buf[80];
    snprintf(buf, sizeof(buf), "{\"cmd\":\"record_active\",\"ok\":true,\"seq\":%d}", seq);
    _netMgr->deferSendJson(clientNum, buf);
}

void AppController::handleSaveCalib(uint8_t clientNum, int seq, int userScore,
                                     const char* name, int age, int gender, int handedness)
{
    // [v3.9.25] Step 1: 如果有个人信息，先写g_workBuf（RAM only，不操作Flash）
    if (name && name[0]) {
        UserProfileData_t profile;
        strncpy(profile.name, name, 31);
        profile.name[31] = '\0';
        profile.age = (uint8_t)age;
        profile.gender = (uint8_t)gender;
        profile.handedness = (uint8_t)handedness;
        _storageMgr->SetUserProfile(&profile);
    }

    // [v3.9.25] Step 2: 如果只有个人信息（无user_score），仅刷写A区
    if (userScore < 0) {
        bool ok = _storageMgr->FlushAZone();
        char buf[128];
        snprintf(buf, sizeof(buf), "{\"cmd\":\"calib_saved\",\"ok\":%s,\"seq\":%d,\"profile_only\":true}",
            ok ? "true" : "false", seq);
        _netMgr->deferSendJson(clientNum, buf);
        LOG("[CTRL] Profile-only save: %s\n", ok ? "OK" : "FAIL");
        return;
    }

    // [v3.9.25] Step 3: 正常校准保存（userScore >= 0）
    // [v3.9.32] 固件侧防线：检查校准是否实际完成（两阶段都已运行）
    // [FIX] NaN 检测：NaN 与任何值比较都返回 false，必须用 x!=x 检测
    if (_calibRelaxMdf != _calibRelaxMdf || _calibRelaxMdf <= 0.0f ||
        _calibActiveMdf != _calibActiveMdf || _calibActiveMdf <= 0.0f) {
        LOG("[CTRL] save_calib rejected: calib not done (relax_mdf=%.1f active_mdf=%.1f)\n",
            _calibRelaxMdf, _calibActiveMdf);
        char buf[128];
        snprintf(buf, sizeof(buf), "{\"cmd\":\"calib_saved\",\"ok\":false,\"seq\":%d,\"error\":\"not_done\"}", seq);
        _netMgr->deferSendJson(clientNum, buf);
        return;
    }
    // UpdatePersonalCalib 会在 g_workBuf 上写校准字段，然后全量擦写Flash
    // 个人信息已在 Step 1 写入 g_workBuf，不会被覆盖
    float relax_rms = _signalProc->getRelaxRms();
    float active_rms = _signalProc->getActiveRms();

    PersonalCalibData_t pcData = {0};
    pcData.relax_rms_mv = relax_rms;
    pcData.active_rms_mv = active_rms;
    pcData.relax_mdf_hz = _calibRelaxMdf;
    pcData.active_mdf_hz = _calibActiveMdf;
    pcData.end_mdf_hz = _calibEndMdf;
    uint64_t nowMs = _netMgr->getCurrentTimestampMs();
    pcData.calib_timestamp_sec = (uint32_t)(nowMs / 1000ULL);
    pcData.calib_timestamp_ms = (uint16_t)(nowMs % 1000ULL);
    _storageMgr->UpdatePersonalCalib(&pcData);

    _signalProc->setCalibration(relax_rms, active_rms, _calibRelaxMdf);

    char buf[256];
    snprintf(buf, sizeof(buf), "{\"cmd\":\"calib_saved\",\"ok\":true,\"seq\":%d,\"relax_rms\":%.2f,\"active_rms\":%.2f,\"relax_mdf\":%.1f,\"active_mdf\":%.1f,\"end_mdf\":%.1f}",
        seq, relax_rms, active_rms, _calibRelaxMdf, _calibActiveMdf, _calibEndMdf);
    _netMgr->deferSendJson(clientNum, buf);
    LOG("[CTRL] Calib saved: relax_rms=%.2f active_rms=%.2f relax_mdf=%.1f active_mdf=%.1f end_mdf=%.1f\n",
        relax_rms, active_rms, _calibRelaxMdf, _calibActiveMdf, _calibEndMdf);
}

void AppController::handleResetCalib(uint8_t clientNum)
{
    _signalProc->clearCalibration();
    PersonalCalibData_t emptyData = {0};
    _storageMgr->UpdatePersonalCalib(&emptyData);
    // [FIX] 仅当状态不是 RUNNING 时才转换（避免 RUNNING→RUNNING 转换被旧状态机拒绝进入 ERROR）
    if (_stateMgr->getState() != ST_RUNNING) {
        _stateMgr->transitionTo(ST_RUNNING);
    }
    LOG("[CTRL] Calibration reset\n");
}
