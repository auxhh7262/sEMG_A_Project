#ifndef STORAGE_MANAGER_H
#define STORAGE_MANAGER_H

#include "StorageArch.h"
#include <stdint.h>
#include "0_Base/Globals.h"

// ==================== 公共类型定义 ====================

typedef struct {
    float relax_rms_mv;
    float active_rms_mv;
    uint32_t calib_timestamp_sec;  // NTP 秒
    uint16_t calib_timestamp_ms;   // 毫秒 (0~999)
    float relax_mdf_hz;    // 放松阶段MDF均值
    float active_mdf_hz;   // 收缩阶段MDF峰值
    float end_mdf_hz;      // MAX阶段结束时MDF
} PersonalCalibData_t;

// [v3.9.25] 用户个人信息（写A区，save_calib时与校准数据一起持久化）
typedef struct {
    char name[32];
    uint8_t age;
    uint8_t gender;         // 1:男, 2:女
    uint8_t handedness;     // 1:左手腕, 2:右手腕
} UserProfileData_t;

// ==================== C++ StorageManager 类 ====================
class StorageManager {
public:
    int Init();
    bool GetPersonalCalib(PersonalCalibData_t* data);
    bool UpdatePersonalCalib(const PersonalCalibData_t* data);

    // [v3.9.25] 用户个人信息持久化（写g_workBuf RAM，不含Flash操作）
    bool SetUserProfile(const UserProfileData_t* profile);

    // [v3.9.25] 将g_workBuf完整写入Flash（擦除+写+验证）
    bool FlushAZone();

    // C区接口
    bool CZone_AppendDataPoint(const CZone_DataPoint_t* dataPoint);
    void CZone_FlushCache();

    // NTP同步后更新当前C区块头的start_timestamp
    void CZone_UpdateBlockTimestamp(uint32_t unixSec, uint16_t ms);

    bool CZone_QueryByTimeRange(uint32_t startTs, uint32_t endTs,
                                CZone_DataPoint_t* outBuf, uint16_t maxPoints,
                                uint16_t* outCount, uint32_t* outNextTs);

    // [v3.9.34] 分析页专用：降采样返回 mdf+fatigue 浮点数组，不含 ts
    // maxPoints 目标点数(通常500)；outTotal 返回时间段内实际命中总数（用于小程序 toast）
    // outFirstTsMs/outLastTsMs 首末数据点毫秒时间戳（用于图表横轴起止标签）
    bool CZone_QueryForAnalysis(uint32_t startTsSec, uint32_t endTsSec,
                                float* outMdf, float* outFatigue,
                                uint16_t maxPoints, uint16_t* outCount,
                                uint32_t* outTotal, uint64_t* outFirstTsMs, uint64_t* outLastTsMs);

    void tick();

    // WiFi 接口
    bool LoadWifiCredentials(WifiCredentials_t* outCreds);
    bool SaveWifiCredentials(const WifiCredentials_t* creds);
};

#endif // STORAGE_MANAGER_H
