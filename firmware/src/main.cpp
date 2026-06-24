// 文件: main.cpp
// 描述: sEMG 肌电疲劳监测设备主程序 V1.0
// 原则: main 只做三件事 —— 喂采样、心跳、调用调度器
// ============================================================

#include <Arduino.h>
#include <FspTimer.h>

// 基础驱动
#include "0_Base/Board.h"
#include "0_Base/Logger.h"
#include "0_Base/Globals.h"

// 硬件看门狗 (RA4M1 WDT)
#include "r_wdt.h"

// 自定义WDT实例（BSP未预定义g_wdt0，手动创建）
static wdt_instance_ctrl_t g_wdt_ctrl;
static const wdt_cfg_t g_wdt_cfg = {
    .timeout = WDT_TIMEOUT_16384,
    .clock_division = WDT_CLOCK_DIVISION_2048,
    .window_start = WDT_WINDOW_START_100,
    .window_end = WDT_WINDOW_END_0,
    .reset_control = WDT_RESET_CONTROL_RESET,
    .stop_control = WDT_STOP_CONTROL_DISABLE,  // sleep时继续计数
    .p_callback = NULL,
    .p_context = NULL,
};

// 业务与网络模块
#include "0_Base/SystemStateMachine.h"
#include "1_Signal/SignalProcessor.h"
#include "3_Storage/StorageManager.h"
#include "4_Network/BleConfigServer.h"
#include "4_Network/NetManager.h"

// 调度层
#include "5_AppController/AppController.h"
#include "0_Base/ProtocolHandler.h"

// ============================================================
// 全局实例（仅做“接线”，不做逻辑）
// ============================================================
SignalProcessor gSignal;
StateManager gState;
StorageManager gStorage;
BleConfigServer gBleConfig;
NetManager gNetManager;
ProtocolHandler gProtocol;
AppController gAppController(
    &gState,
    &gSignal,
    &gStorage,
    &gNetManager,
    &gBleConfig
);

// 硬件定时器（原 Board.cpp 已删除，直接在此定义）
FspTimer adc_timer;
volatile bool g_adcTimerFlag = false;
volatile uint32_t g_adcCallbackCount = 0;  // [DEBUG] ISR计数器

// [P0-FIX] 软件看门狗：ISR 检测主循环是否挂死，5 秒无心跳则强制重启
volatile uint32_t g_loopHeartbeat = 0;  // 主循环每次迭代更新此值

// ============================================================
// 定时器中断
// ============================================================
void timer_callback(timer_callback_args_t __attribute((unused)) *args) {
    g_adcTimerFlag = true;
    g_adcCallbackCount++;  // [DEBUG] ISR计数

    // [P0-FIX] 软件看门狗：如果主循环 5 秒未更新心跳，强制重启
    // g_loopHeartbeat 由主循环每次迭代递增，ISR 检测是否停滞
    static uint32_t lastHeartbeat = 0;
    static uint32_t stuckCount = 0;
    if (g_loopHeartbeat != lastHeartbeat) {
        lastHeartbeat = g_loopHeartbeat;
        stuckCount = 0;
    } else {
        stuckCount++;
        if (stuckCount >= 5000) {  // 5 秒 × 1kHz = 5000 次
            // [DIAG] 打印看门狗触发信息，帮助诊断复位原因
            LOG("[WDT] SW watchdog triggered! stuckCount=%lu, lastHb=%lu, now=%lu\n",
                stuckCount, lastHeartbeat, millis());
            // 主循环挂死，强制重启
            NVIC_SystemReset();
        }
    }
}

// ============================================================
// setup()
// ============================================================
void setup() {
    // [FIX] 软件看门狗：在 setup() 开始时初始化心跳，避免 ISR 误触发重启
    g_loopHeartbeat = millis();

    delay(3000);  // 等待串口监控连接，确保开机日志不丢失
    SERIAL_COMM.begin(115200);
    while (!SERIAL_COMM && millis() < 3000);

    // 开机分隔线（区分本次启动与上次启动的串口残留）
    LOG("\n\n========== sEMG V1.0 BOOT ==========\n");

    pinMode(PIN_LED_BUILTIN, OUTPUT);
    digitalWrite(PIN_LED_BUILTIN, LOW);

    analogReadResolution(14);
    gSignal.init();

    // [HTTPS-TEST] 提前初始化网络，在定时器/看门狗启动前阻塞式测通 HTTPS
    // 1kHz 定时器和看门狗尚未启动，阻塞操作不会触发复位
    g_loopHeartbeat = millis();
    gStorage.Init();                 // WiFi凭据存在A区，需先初始化存储

    g_loopHeartbeat = millis();
    gNetManager.init(&gBleConfig);   // 注册BLE回调 + 初始化UDP

    g_loopHeartbeat = millis();
    if (gNetManager.waitForWifiBlocking(30000)) {
        g_loopHeartbeat = millis();
        gNetManager.testHttpsBlocking();
    }

    // ===== 以下为定时器启动（HTTPS测试已完成，不再阻塞loop）=====

    // [WDT] HTTPS测试完成后才初始化硬件看门狗，避免阻塞调用触发复位
    {
        fsp_err_t err = R_WDT_Open(&g_wdt_ctrl, &g_wdt_cfg);
        if (err == FSP_SUCCESS) {
            LOG("[WDT] Hardware watchdog initialized\n");
        } else {
            LOG("[WDT] ERROR: Open failed (%d)\n", err);
        }
    }

    // 1kHz ADC 定时器
    uint8_t timer_type = 0;
    int8_t timer_channel = FspTimer::get_available_timer(timer_type);
    if (timer_channel < 0) {
        LOG("[MAIN] ERROR: No available timer, trying force...\n");
        timer_channel = FspTimer::get_available_timer(timer_type, true);
        if (timer_channel < 0) {
            LOG("[MAIN] ERROR: No timer available even with force!\n");
        }
    }
    LOG("[MAIN] Timer type=%d, channel=%d\n", timer_type, timer_channel);
    
    bool begin_ok = adc_timer.begin(
        TIMER_MODE_PERIODIC,
        timer_type,
        (uint8_t)timer_channel,
        1000.0f,
        0.0f,
        timer_callback
    );
    if (!begin_ok) {
        LOG("[MAIN] ERROR: Timer begin failed!\n");
    } else {
        LOG("[MAIN] Timer begin OK\n");
        
        // [P0-fix-v2] 使用FSP标准回调机制
        // 传入nullptr让IRQManager使用默认的gpt_counter_overflow_isr
        // 该ISR会自动调用begin()设置的p_callback（即timer_callback）
        bool irq_ok = adc_timer.setup_overflow_irq(12, nullptr);
        if (!irq_ok) {
            LOG("[MAIN] ERROR: Timer overflow IRQ setup failed!\n");
        } else {
            LOG("[MAIN] Timer overflow IRQ setup OK (using FSP default ISR)\n");
            bool open_ok = adc_timer.open();
            if (!open_ok) {
                LOG("[MAIN] ERROR: Timer open failed!\n");
            } else {
                LOG("[MAIN] Timer opened (R_GPT_Enable called)\n");
                bool start_ok = adc_timer.start();
                if (!start_ok) {
                    LOG("[MAIN] ERROR: Timer start failed!\n");
                } else {
                    LOG("[MAIN] Timer start OK - 1kHz sampling via FSP callback\n");
                    // [FIX] 看门狗：定时器启动后，定期更新心跳避免误触发
                    g_loopHeartbeat = millis();
                }
            }
        }
    }

    // 模块初始化（每个步骤后更新看门狗心跳）
    g_loopHeartbeat = millis();
    gState.init();
    
    g_loopHeartbeat = millis();
    gBleConfig.init();
    
    g_loopHeartbeat = millis();
    gAppController.init();
    
    g_loopHeartbeat = millis();
    delay(500);  // 确保boot LOG被串口监控捕获

    // 注册 JSON 命令回调（使用延迟处理，避免中断上下文中调用deserializeJson）
    gNetManager.setCommandCallback([](uint8_t clientNum, const char* json) {
        gProtocol.deferJsonCommand(clientNum, json);
    });

    // 初始化完成，进入 IDLE 状态
    // [FIX] Removed: gState.transitionTo(ST_IDLE);

    LOG("[MAIN] V1.0 系统初始化完成\n");
}

// ============================================================
// loop()
// ============================================================
void loop() {
    // [P0-FIX] 软件看门狗心跳：每次 loop() 迭代更新
    g_loopHeartbeat++;

    // [WDT] 喂看门狗（每次 loop 刷新，约 100Hz）
    R_WDT_Refresh(&g_wdt_ctrl);

    // 1. 高频采样（1kHz）
    if (g_adcTimerFlag) {
        g_adcTimerFlag = false;
        int raw = FAST_ADC_READ(PIN_EMG_ADC);
        gSignal.isrPushSample(raw);
        gSignal.updateSampleRateStats();  // [P0-fix] 采样率统计从ISR移到loop
    }

    // 2. 10Hz 主调度节拍
    static uint32_t lastTick = 0;
    if (millis() - lastTick < LOOP_INTERVAL_MS) {
        return;
    }
    lastTick = millis();

    // 3. 存储管理
    gStorage.tick();  // [B2-2-fix] 异步擦除轮询

    // 4. 网络心跳
    gNetManager.tick();
    gBleConfig.tick();

    // [FIX] 处理延迟的JSON命令（在主循环处理，避免在中断上下文中调用deserializeJson）
    gProtocol.tick();

    // 5. 串口指令解析
    AppCommand_t cmd = gProtocol.tickLocalDebug();
    if (cmd != CMD_NONE) {
        gAppController.onCommandReceived(cmd);
    }

    // 5. 业务调度（全部交给 AppController）
    gAppController.tick();
    
    // [FIX] 心跳日志：每10秒输出一次，确认 loop() 在运行
    static uint32_t _heartbeatTimer = 0;
    static uint32_t _heartbeatCount = 0;
    if (millis() - _heartbeatTimer > 10000) {
        _heartbeatTimer = millis();
        _heartbeatCount++;
        LOG("[HB] #%lu alive, ADC_cb=%lu, WiFi=%d, buf=%u\n",
            (unsigned long)_heartbeatCount,
            (unsigned long)g_adcCallbackCount,
            (int)WiFi.status(),
            gSignal.getBufferAvailable());
    }
}
