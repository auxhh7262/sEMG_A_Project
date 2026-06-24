#ifndef APP_CONTROLLER_H
#define APP_CONTROLLER_H

#include <stdint.h>
#include <ArduinoJson.h>
#include "0_Base/Globals.h"

// 【关键修正】直接包含 C++ 头文件，而不是使用前向声明
#include "0_Base/SystemStateMachine.h"
#include "1_Signal/SignalProcessor.h"
#include "3_Storage/StorageManager.h" // 这是一个 C 模块，保持指针即可
#include "4_Network/NetManager.h"
#include "4_Network/BleConfigServer.h"

class AppController {
public:
    AppController(
        StateManager* stateMgr,
        SignalProcessor* signalProc,
        StorageManager* storageMgr,
        NetManager* netMgr,
        BleConfigServer* bleServer
    );

    void init(void);
    void tick(void);
    void onCommandReceived(AppCommand_t cmd, uint8_t clientNum = 255);

    // ---- JSON command handlers ----
    void handleQueryCZ(uint8_t clientNum, uint32_t startTs, uint32_t endTs, int seq = -1);    void deferQueryCZ(uint8_t clientNum, uint32_t startTs, uint32_t endTs);

    // ---- Calibration command handlers ----
    void handleSaveCalib(uint8_t clientNum, int seq, int userScore = -1,
                         const char* name = nullptr, int age = 0, int gender = 0, int handedness = 0);
    void handleResetCalib(uint8_t clientNum = 255);
    void handleRecordRelax(uint8_t clientNum, int seq);
    void handleRecordActive(uint8_t clientNum, int seq);

private:
    // [FIX] Deferred query_cz (avoid stack overflow in WS callback)
    volatile bool _pendingQueryCZ = false;
    uint8_t _pendingQueryCZClientNum = 255;
    uint32_t _pendingQueryStartTs = 0;
    uint32_t _pendingQueryEndTs = 0;

    // [v3.9.34] Async analysis query: mdf[] + fatigue[] arrays, no per-point ts
    bool _queryActive = false;
    float* _queryMdf = nullptr;
    float* _queryFatigue = nullptr;
    uint16_t _queryTotal = 0;
    uint16_t _queryCursor = 0;
    uint8_t _queryClient = 255;
    int _querySeq = -1;
    uint32_t _queryTotalMatches = 0;    // 实际命中总数（用于小程序 toast）
    uint64_t _queryFirstTsMs = 0;       // 首个数据点毫秒时间戳
    uint64_t _queryLastTsMs = 0;        // 末个数据点毫秒时间戳
    static const uint16_t QUERY_BATCH_SIZE = 5;       // 保留：实时查询模式（未使用）
    static const uint16_t QUERY_ANALYSIS_BATCH = 100;  // 分析模式每批点数（数组格式更紧凑）
    static const uint16_t QUERY_ANALYSIS_MAX = 500;     // 分析模式总点数上限
    void _startQueryCz(uint8_t clientNum, uint32_t startTs, uint32_t endTs, int seq);
    void _tickQueryCz();
    void _handleRunningState(float rms, float mdf, float fatigue, uint8_t quality, float activation);
    void _handleErrorState(void);

    // Calibration phase tracking (firmware-side timing via millis)
    enum CalibPhase { CALIB_NONE, CALIB_RELAX, CALIB_ACTIVE };
    CalibPhase _calibPhase = CALIB_NONE;
    uint32_t _calibStartMs = 0;       // millis() when phase started
    uint32_t _calibTargetMs = 0;      // 10000=10s REST, 15000=15s MAX
    uint16_t _calibSampleCount = 0;   // actual number of accumulations
    float _calibAccumSum1 = 0.0f;    // RMS accumulator for RELAX/ACTIVE
    float _calibAccumSum2 = 0.0f;    // MDF accumulator for RELAX only
    float _calibMinRms = 1e9f;       // min RMS in RELAX window
    float _calibRelaxMaxRms = 0.0f;  // max RMS in RELAX window (outlier removal)
    float _calibMinMdf = 1e9f;       // min MDF in RELAX window
    float _calibRelaxMaxMdf = 0.0f;  // max MDF in RELAX window (outlier removal)
    uint8_t _calibAccumClient = 255;

    // Calibration results
    float _calibRelaxMdf = 0.0f;    // RELAX phase MDF result
    float _calibActiveMdf = 0.0f;   // ACTIVE phase MDF peak
    float _calibEndMdf = 0.0f;      // ACTIVE phase end MDF

    // Calib debug counters (member vars to reset per-calib)
    // Dependencies
    StateManager* _stateMgr;
    SignalProcessor* _signalProc;
    StorageManager* _storageMgr;
    NetManager* _netMgr;
    BleConfigServer* _bleServer;


};

#endif // APP_CONTROLLER_H
