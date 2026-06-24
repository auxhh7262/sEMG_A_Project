#include "ProtocolHandler.h"
#include "Logger.h"
#include "Board.h"
#include <ArduinoJson.h>
#include <Arduino.h>
#include "5_AppController/AppController.h"
#include "3_Storage/StorageManager.h"
#include "3_Storage/FlashDriver.h"
#include "4_Network/NetManager.h"
#include "1_Signal/SignalProcessor.h"
#include "0_Base/SystemStateMachine.h"

extern AppController gAppController;
extern StorageManager gStorage;
extern StateManager gState;
extern NetManager gNetManager;
extern SignalProcessor gSignal;

// [FIX] newlib nano 不支持 %lld，手动格式化 long long 为字符串
static void formatLL(char* buf, size_t bufsize, long long val) {
    if (val < 0 || bufsize < 2) { if (bufsize > 0) buf[0] = '0'; if (bufsize > 1) buf[1] = '\0'; return; }
    if (val == 0) { buf[0] = '0'; buf[1] = '\0'; return; }
    char tmp[24];
    int idx = 0;
    while (val > 0 && idx < 23) { tmp[idx++] = '0' + (int)(val % 10); val /= 10; }
    int out = 0;
    while (idx > 0 && out < (int)bufsize - 1) { buf[out++] = tmp[--idx]; }
    buf[out] = '\0';
}

void ProtocolHandler::init() { 
    _debugBufIdx = 0; 
    _hasPendingCommand = false;
    _pendingClientNum = 255;
    _pendingJson[0] = '\0';
    LOG("[PROTO] Init (Serial & BLE bridge).\n"); 
}
void ProtocolHandler::sendStatus(const char* stateName) { LOG("[PROTO] Status: %s\n", stateName); }
void ProtocolHandler::sendStatus(const char* stateName, uint8_t progress) { LOG("[PROTO] Status: %s (%d%%)\n", stateName, progress); }
void ProtocolHandler::sendError(const char* msg) { LOG("[PROTO] Error: %s\n", msg); }

AppCommand_t ProtocolHandler::tickLocalDebug() {
    if (!SERIAL_COMM.available()) return CMD_NONE;
    while (SERIAL_COMM.available() > 0) {
        char c = SERIAL_COMM.read();
        if (c == '\r' || c == '\n') {
            if (_debugBufIdx > 0) {
                _debugBuf[_debugBufIdx] = '\0'; _debugBufIdx = 0;
                char cmd = _debugBuf[0]; if (cmd >= 'A' && cmd <= 'Z') cmd += 32;
                switch (cmd) {
                    case 's': return CMD_STOP;
                    case '?': return CMD_GET_STATUS;
                    case 'w': {
                        char* p = _debugBuf + 1; while (*p == ' ') p++; char* ssidStart = p;
                        while (*p && *p != ' ') p++; char* ssidEnd = p; while (*p == ' ') p++; char* passStart = p; *ssidEnd = '\0';
                        WifiCredentials_t creds; memset(&creds, 0, sizeof(creds));
                        strncpy(creds.ssid, ssidStart, 31); creds.ssid[31] = '\0'; strncpy(creds.pass, passStart, 63); creds.pass[63] = '\0'; creds.isValid = true;
                        gStorage.SaveWifiCredentials(&creds); delay(1000); NVIC_SystemReset(); break;
                    }
                    default:
                    if (_debugBuf[0] == '{') {
                        _handleSerialJson();
                    } else {
                        LOG("[PROTO] Unknown cmd: [%c]\n", cmd);
                    }
                    break;
                }
            }
            return CMD_NONE;
        }
        if (_debugBufIdx < sizeof(_debugBuf) - 1) _debugBuf[_debugBufIdx++] = c;
    }
    return CMD_NONE;
}

// [DBG-TEMP] 串口 JSON 命令处理：解析 query_cz 并直接通过串口输出 C 区数据
void ProtocolHandler::_handleSerialJson() {
    if (_debugBuf[0] == '\0') return;
    LOG("[PROTO] Serial JSON: %s\n", _debugBuf);
    
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, _debugBuf);
    if (err) {
        SERIAL_COMM.println("{\"error\":\"json_parse\"}");
        return;
    }
    
    const char* cmd = doc["cmd"];
    if (!cmd) { SERIAL_COMM.println("{\"error\":\"no_cmd\"}"); return; }
    
    if (strcmp(cmd, "query_cz") == 0) {
        uint32_t startTs = doc["start_ts"] | 0;
        uint32_t endTs = doc["end_ts"] | 0;
        uint16_t maxPoints = doc["points"] | 2000;
        if (maxPoints > 2000) maxPoints = 2000;
        
        uint32_t queryEndTs = endTs ? endTs : 0xFFFFFFFF;
        
        // [RAM] 固件仅 32KB RAM (~22KB 已用)，不能 malloc 太大
        // 改用固定 200 点缓冲区分批读取（200×16=3.2KB）
        #define SERIAL_CZ_BATCH 200
        CZone_DataPoint_t buf[SERIAL_CZ_BATCH];
        
        uint16_t totalOut = 0;
        uint32_t curStartTs = startTs;
        bool firstBatch = true;
        
        while (1) {
            uint16_t outCount = 0;
            uint32_t nextTs = 0;
            bool ok = gStorage.CZone_QueryByTimeRange(curStartTs, queryEndTs, buf, SERIAL_CZ_BATCH, &outCount, &nextTs);
            
            if (firstBatch) {
                SERIAL_COMM.print("{\"cmd\":\"query_cz\",\"ok\":");
                SERIAL_COMM.print(ok ? "true" : "false");
                SERIAL_COMM.print(",\"batch_points\":");
                SERIAL_COMM.print(SERIAL_CZ_BATCH);
                SERIAL_COMM.println("}");
                firstBatch = false;
            }
            
            for (uint16_t i = 0; i < outCount; i++) {
                float rms_mv = buf[i].rms / 100.0f;
                float mdf_hz = buf[i].mdf / 10.0f;
                float fat_pct = buf[i].fatigue / 10.0f;
                SERIAL_COMM.print(buf[i].timestamp_sec);
                SERIAL_COMM.print(".");
                if (buf[i].timestamp_ms < 100) SERIAL_COMM.print('0');
                if (buf[i].timestamp_ms < 10) SERIAL_COMM.print('0');
                SERIAL_COMM.print(buf[i].timestamp_ms);
                SERIAL_COMM.print("\t");
                SERIAL_COMM.print(rms_mv, 3); SERIAL_COMM.print("\t");
                SERIAL_COMM.print(buf[i].activation / 10.0f, 1); SERIAL_COMM.print("\t");
                SERIAL_COMM.print(mdf_hz, 1); SERIAL_COMM.print("\t");
                SERIAL_COMM.print(fat_pct, 1); SERIAL_COMM.print("\t");
                SERIAL_COMM.println(buf[i].quality);
            }
            
            totalOut += outCount;
            if (outCount < SERIAL_CZ_BATCH) break;  // 没更多数据了
            if (nextTs == 0 || nextTs >= queryEndTs) break;
            curStartTs = nextTs;
        }
        
        SERIAL_COMM.print("{\"cmd\":\"query_cz\",\"done\":true,\"total\":");
        SERIAL_COMM.print(totalOut);
        SERIAL_COMM.println("}");
    } else {
        SERIAL_COMM.print("{\"error\":\"unknown_cmd\",\"cmd\":\"");
        SERIAL_COMM.print(cmd);
        SERIAL_COMM.println("\"}");
    }
}

void ProtocolHandler::tick() { 
    // [FIX] Process deferred JSON commands in main loop (avoid calling deserializeJson in interrupt context)
    if (_hasPendingCommand) {
        LOG("[PROTO] Processing deferred command from tick()\n");
        handleJsonCommand(_pendingClientNum, _pendingJson);
        _hasPendingCommand = false;
        _pendingClientNum = 255;
    }
}

// [FIX] Deferred JSON command: copy JSON string only, parse in main loop tick()
void ProtocolHandler::deferJsonCommand(uint8_t clientNum, const char* json) {
    if (_hasPendingCommand) {
        LOG("[PROTO] Command queue full, dropping: %s\n", json);
        return;
    }
    strncpy(_pendingJson, json, MAX_JSON_LEN - 1);
    _pendingJson[MAX_JSON_LEN - 1] = '\0';
    _pendingClientNum = clientNum;
    _hasPendingCommand = true;
    LOG("[PROTO] Command deferred: %s\n", json);
}

void ProtocolHandler::handleJsonCommand(uint8_t clientNum, const char* json) {
    LOG("[PROTO] RX JSON: %s\n", json);
    static StaticJsonDocument<512> doc;
    doc.clear();
    DeserializationError err = deserializeJson(doc, json);
    if (err) { LOG("[PROTO] JSON parse error: %s\n", err.c_str()); return; }

    const char* cmd = doc["cmd"];
    if (!cmd) { LOG("[PROTO] No cmd field\n"); return; }
    
    // [FIX] Use long long for seq — mini-program sends Date.now() (13-digit ms timestamp) as string
    long long seq = -1;
    if (doc["seq"].is<int>()) { seq = doc["seq"].as<int>(); }
    else if (doc["seq"].is<const char*>()) { seq = strtoll(doc["seq"].as<const char*>(), nullptr, 10); }
    char seqStr[24];
    formatLL(seqStr, sizeof(seqStr), seq);
    LOG("[PROTO] cmd='%s' seq=%s\n", cmd, seq >= 0 ? seqStr : "(none)");

    if (strcmp(cmd, "start_stream") == 0) {
        char ack[160];
        const char* ntpStr = gNetManager.isNtpSynced() ? "true" : "false";
        snprintf(ack, sizeof(ack), "{\"cmd\":\"start_stream\",\"ok\":true,\"fw_time\":%lu,\"seq\":%s,\"ntp_synced\":%s}", gNetManager.getCurrentTimestamp(), seq >= 0 ? seqStr : "0", ntpStr);
        gNetManager.deferSendJson(clientNum, ack);
        // [NTP-FIX] 恢复状态机到 RUNNING（如果之前因 ERROR 状态导致数据停止）
        gAppController.onCommandReceived(CMD_START_STREAM, clientNum);
    } 
    else if (strcmp(cmd, "stop") == 0) {
        if (seq >= 0) { char ack[64]; snprintf(ack, sizeof(ack), "{\"cmd\":\"stop\",\"ok\":true,\"seq\":%s}", seqStr); gNetManager.deferSendJson(clientNum, ack); }
        gAppController.onCommandReceived(CMD_STOP, clientNum);
    } 
    else if (strcmp(cmd, "query_cz") == 0) {
        uint32_t startTs = doc["start_ts"] | 0; uint32_t endTs = doc["end_ts"] | 0xFFFFFFFF;
        gAppController.deferQueryCZ(clientNum, startTs, endTs);
    }
    else if (strcmp(cmd, "save_calib") == 0) {
        // user_score: 缺省=-1表示"仅写个人信息，不更新校准"
        int userScore = -1;
        if (doc["user_score"].is<int>()) {
            userScore = doc["user_score"].as<int>();
            if (userScore < 1) userScore = 1;
            if (userScore > 10) userScore = 10;
        } else if (doc["user_score"].is<const char*>()) {
            const char* us = doc["user_score"].as<const char*>();
            if (us && us[0]) { userScore = atoi(us); if (userScore < 1) userScore = 1; if (userScore > 10) userScore = 10; }
        }

        // [v3.9.25] 解析可选个人信息字段
        const char* name = doc["name"] | nullptr;
        int age = doc["age"] | 0;
        int gender = doc["gender"] | 0;
        int handedness = doc["handedness"] | 0;

        gAppController.handleSaveCalib(clientNum, (int)seq, userScore, name, age, gender, handedness);
    } 
    else if (strcmp(cmd, "flash_diagnose") == 0) {
        LOG("[PROTO] flash_diagnose command received\n");
        FlashDriver::instance().diagnoseJedec();
        if (seq >= 0) { char ack[64]; snprintf(ack, sizeof(ack), "{\"cmd\":\"flash_diagnose\",\"status\":\"ok\",\"seq\":%s}", seqStr); gNetManager.deferSendJson(clientNum, ack); }
    }
    else if (strcmp(cmd, "record_relax") == 0) {
        LOG("[PROTO] record_relax command received\n");
        gAppController.handleRecordRelax(clientNum, (int)seq);
    }
    else if (strcmp(cmd, "record_active") == 0) {
        LOG("[PROTO] record_active command received\n");
        gAppController.handleRecordActive(clientNum, (int)seq);
    }
    else if (strcmp(cmd, "reset_calib") == 0) {
        LOG("[PROTO] reset_calib command received\n");
        gAppController.handleResetCalib(clientNum);
        if (seq >= 0) {
            char ack[64];
            snprintf(ack, sizeof(ack), "{\"cmd\":\"reset_calib\",\"ok\":true,\"seq\":%s}", seqStr);
            gNetManager.deferSendJson(clientNum, ack);
        }
    }
    else { LOG("[PROTO] Unknown cmd: %s\n", cmd); if (seq >= 0) { char ack[64]; snprintf(ack, sizeof(ack), "{\"cmd\":\"error\",\"err\":\"unknown_cmd\",\"seq\":%s}", seqStr); gNetManager.deferSendJson(clientNum, ack); } }
}
