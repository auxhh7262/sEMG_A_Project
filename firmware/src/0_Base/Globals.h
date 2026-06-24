// 文件: 0_Base/Globals.h
#ifndef GLOBALS_H
#define GLOBALS_H

#include <Arduino.h>
#include "Config.h"

// 1. 错误码枚举 (映射协议字典 err_calib_failed 的 msg)
typedef enum {
    ERROR_NONE = 0,
    ERROR_CALIB_INVALID,  // 力度不足
    ERROR_SIGNAL_NOISE,   // 信号干扰
    ERROR_ARM_TIMEOUT,    // 等待超时
    ERROR_BODY_MOVE,      // 肢体乱动
    ERROR_CALIB_DRIFT,    // 佩戴松动
    ERROR_FLASH_FULL,     // 存储已满
    ERROR_FLASH_IO        // 读写故障
} SystemError_t;

// 2. 系统状态枚举 (M3 阶段简化版状态机，为后续完整 SOP 预留扩展)
typedef enum {
    ST_BOOT = 0,
    ST_RUNNING,
    ST_ERROR
} SystemState_t;

// ==========================================
// 【V1.0】网络与云端扩展定义
// ==========================================

// 4. 网络工作模式枚举
typedef enum {
    NET_MODE_IDLE = 0,
    NET_MODE_BLE_CONFIG,    // 蓝牙等待配网中
    NET_MODE_WIFI_CONNECTING,// 正在连接路由器
    NET_MODE_WIFI_ONLINE    // WiFi已连接，业务在线
} NetMode_t;

// 5. 小程序/云端下行 统一指令枚举
typedef enum {
    CMD_NONE = 0,
    CMD_STOP,
    CMD_GET_STATUS,
    CMD_QUERY_CZ,
    CMD_START_STREAM
} AppCommand_t;

// 6. WiFi 凭证结构体
typedef struct {
    char ssid[32];
    char pass[64];
    bool isValid;
} WifiCredentials_t;

// 7. 特征值长度宏 (给 BLE 用)
#define BLE_WIFI_CHAR_MAX_LEN 128

// 8. 【关键防御】全局致命错误状态变量
extern volatile SystemError_t g_systemFatalError;
#endif // GLOBALS_H