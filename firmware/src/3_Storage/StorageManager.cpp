#include "StorageManager.h"
#include "FlashDriver.h"
#include "0_Base/Logger.h"
#include <EEPROM.h>
#include <string.h>

// Flash 驱动单例快捷引用
static FlashDriver& flash = FlashDriver::instance();

// WiFi凭证存RA4M1板载Data Flash（通过EEPROM库访问，真实Flash非模拟）
// RA4M1 Data Flash 8KB，WiFi凭证仅用97字节，与SPI Flash外存完全隔离
#define EEPROM_WIFI_SSID_ADDR  0x00   // 32 bytes
#define EEPROM_WIFI_PASS_ADDR  0x20   // 64 bytes (offset 32)
#define EEPROM_WIFI_VALID_ADDR 0x60   // 1 byte  (offset 96)
#define EEPROM_WIFI_MAGIC      0xA5   // 有效标记

// ==================== 私有全局变量 ====================
static AZone_Sector_t g_workBuf;            // 4KB工作缓冲：兼作A区镜像和CRC计算缓冲区
// 注意：g_aZoneTmpBuf 已移除，所有操作复用 g_workBuf，避免RAM溢出
// 注意：与 g_asyncEraseState 状态机配合使用
static PersonalCalibData_t g_currentCalibData;
static bool g_isCalibDataValid = false;


// CZone 相关
static uint8_t g_czone_ram_cache[256];          // 单页写缓冲
static uint16_t g_czone_cache_write_pos = 0;     // cache内写入偏移
static uint32_t g_czone_current_block_addr = 0;  // 当前C区64KB块起始地址
static uint16_t g_czone_block_write_offset = 0;  // 当前块内偏移(含header)
static bool g_czone_initialized = false;
static uint32_t g_czone_total_writes = 0;       // 总写入计数（诊断用）

// [C0-4/C0-5-fix] 异步擦除状态机
enum AsyncEraseState_t {
    ASYNC_ERASE_IDLE = 0,
    ASYNC_ERASE_CZONE_BLOCK     // C区64KB块擦除（_czone_initFromScratch / _allocateNewBlock）
};

static volatile AsyncEraseState_t g_asyncEraseState = ASYNC_ERASE_IDLE;
static uint32_t g_asyncEraseAddr = 0;              // 当前擦除地址



// ==================== 私有辅助函数声明 ====================
static uint16_t _calcCRC16(const uint8_t* data, uint32_t length, uint16_t init);
static bool _validateAZoneSector(const AZone_Sector_t* sector);
static bool _writeMultiPage(uint32_t addr, const void* data, uint32_t len);
static bool _czone_initFromScratch(void);
static bool _czone_loadStateFromAZone(void);
static bool _czone_flushCache(void);
static bool _czone_allocateNewBlock(void);
static void _czone_finalizeCurrentBlock(void);
static bool _czone_updateAZoneAnchor(void);  // 发起锚点更新（异步擦除）
static void _czone_pollAnchorUpdate(void);    // 轮询锚点更新状态

// ==================== StorageManager 类方法实现 ====================

int StorageManager::Init() {
    LOG("[STORAGE] Init: step1 flash.Init()...\n");
    if (!flash.Init()) {
        LOG("[STORAGE] Init: flash.Init() FAILED!\n");
        return -1;
    }
    LOG("[STORAGE] Init: step2 ReadBytes...\n");

    // 读取唯一扇区
    flash.ReadBytes(ZONE_A_BASE_ADDR, &g_workBuf, sizeof(AZone_Sector_t));
    LOG("[STORAGE] Init: step3 validate...\n");
    bool valid = _validateAZoneSector(&g_workBuf);

    if (!valid) {
        LOG("[STORAGE] Init: AZone invalid, erasing...\n");
        memset(&g_workBuf, 0xFF, sizeof(AZone_Sector_t));
        flash.EraseSector(ZONE_A_BASE_ADDR);
        LOG("[STORAGE] Init: AZone erased\n");
    }

    // 加载校准数据到RAM
    LOG("[STORAGE] Init: step4 load calib...\n");
    g_currentCalibData.relax_rms_mv = g_workBuf.relax_rms_mv;
    g_currentCalibData.active_rms_mv = g_workBuf.active_rms_mv;
    g_currentCalibData.calib_timestamp_sec = g_workBuf.calib_timestamp_sec;
    g_currentCalibData.calib_timestamp_ms = g_workBuf.calib_timestamp_ms;
    g_currentCalibData.relax_mdf_hz = g_workBuf.relax_mdf_hz;
    g_currentCalibData.active_mdf_hz = g_workBuf.active_mdf_hz;
    g_currentCalibData.end_mdf_hz = g_workBuf.end_mdf_hz;
    g_isCalibDataValid = (g_workBuf.magic == 0xA55AA55A && g_currentCalibData.calib_timestamp_sec > 0);

    // C区初始化
    LOG("[STORAGE] Init: step5 CZone init...\n");
    if (!_czone_loadStateFromAZone()) {
        LOG("[STORAGE] Init: CZone load failed, init from scratch...\n");
        _czone_initFromScratch();
    }

    LOG("[STORAGE] Manager Initialized. Calib valid: %s\n", g_isCalibDataValid ? "YES" : "NO");
    // [v3.9.32] 提示：CZone cache每2秒自动刷盘，硬断电最多丢失~2秒数据
    LOG("[STORAGE] CZone: auto-flush every 2s, max data loss on hard power-off ≈ 2s\n");
    return 0;
}

bool StorageManager::GetPersonalCalib(PersonalCalibData_t* data) {
    if (!data || !g_isCalibDataValid)
        return false;
    *data = g_currentCalibData;
    return true;
}


// [v3.9.25] SetUserProfile: 写个人信息到g_workBuf RAM，不做Flash操作
// 与UpdatePersonalCalib配合使用：先调SetUserProfile再调UpdatePersonalCalib，一次Flash写入完成全部持久化
bool StorageManager::SetUserProfile(const UserProfileData_t* profile) {
    if (!profile) return false;

    strncpy(g_workBuf.name, profile->name, 31);
    g_workBuf.name[31] = '\0';
    g_workBuf.age = profile->age;
    g_workBuf.gender = profile->gender;
    g_workBuf.handedness = profile->handedness;

    LOG("[STORAGE] Profile set in RAM: name='%s' age=%d gender=%d hand=%d\n",
        g_workBuf.name, g_workBuf.age, g_workBuf.gender, g_workBuf.handedness);
    return true;
}

// [v3.9.25] FlushAZone: 将g_workBuf完整擦写到Flash（不修改字段内容）
// 用于profile-only更新场景（无校准数据变更）
bool StorageManager::FlushAZone() {
    // 确保magic有效
    g_workBuf.magic = 0xA55AA55A;
    if (g_workBuf.struct_version == 0xFFFF) {
        g_workBuf.struct_version = PACK_VERSION(2, 1);
    }

    // 重算CRC
    uint32_t payload_offset = offsetof(AZone_Sector_t, name);
    uint32_t payload_len = offsetof(AZone_Sector_t, reserved) - payload_offset;
    g_workBuf.header_crc16 = _calcCRC16((const uint8_t*)&g_workBuf + payload_offset, payload_len, CRC16_INIT);

    // 擦除+写入
    flash.EraseSector(ZONE_A_BASE_ADDR);
    bool ok = _writeMultiPage(ZONE_A_BASE_ADDR, &g_workBuf, sizeof(AZone_Sector_t));

    // 回读验证
    if (ok) {
        AZone_Sector_t verifyBuf;
        flash.ReadBytes(ZONE_A_BASE_ADDR, &verifyBuf, sizeof(AZone_Sector_t));
        ok = _validateAZoneSector(&verifyBuf);
        if (ok) memcpy(&g_workBuf, &verifyBuf, sizeof(AZone_Sector_t));
    }

    LOG("[STORAGE] AZone flushed (CRC=0x%04X): %s\n", g_workBuf.header_crc16, ok ? "OK" : "FAIL");
    return ok;
}

bool StorageManager::UpdatePersonalCalib(const PersonalCalibData_t* data) {
    if (!data) return false;

    // [FIX] NaN防御：拒绝写入NaN值（NaN!=NaN是唯一true的情况）
    if (data->relax_rms_mv != data->relax_rms_mv ||
        data->active_rms_mv != data->active_rms_mv ||
        data->relax_mdf_hz != data->relax_mdf_hz ||
        data->active_mdf_hz != data->active_mdf_hz) {
        LOG("[STORAGE] UpdatePersonalCalib REJECTED: NaN detected in input data\n");
        return false;
    }

    // 在g_workBuf上更新字段
    g_workBuf.magic = 0xA55AA55A;
    g_workBuf.struct_version = PACK_VERSION(2, 3);
    g_workBuf.relax_rms_mv = data->relax_rms_mv;
    g_workBuf.active_rms_mv = data->active_rms_mv;
    g_workBuf.calib_timestamp_sec = data->calib_timestamp_sec;
    g_workBuf.calib_timestamp_ms = data->calib_timestamp_ms;
    g_workBuf.relax_mdf_hz = data->relax_mdf_hz;
    g_workBuf.active_mdf_hz = data->active_mdf_hz;
    g_workBuf.end_mdf_hz = data->end_mdf_hz;

    // 计算CRC
    uint32_t payload_offset = offsetof(AZone_Sector_t, name);
    uint32_t payload_len = offsetof(AZone_Sector_t, reserved) - payload_offset;
    g_workBuf.header_crc16 = _calcCRC16((const uint8_t*)&g_workBuf + payload_offset, payload_len, CRC16_INIT);

    // 同步擦除+写入（4KB擦除~100ms）
    flash.EraseSector(ZONE_A_BASE_ADDR);
    bool ok = _writeMultiPage(ZONE_A_BASE_ADDR, &g_workBuf, sizeof(AZone_Sector_t));

    // 回读验证
    if (ok) {
        flash.ReadBytes(ZONE_A_BASE_ADDR, &g_workBuf, sizeof(AZone_Sector_t));
        ok = _validateAZoneSector(&g_workBuf);
    }

    // 更新RAM缓存
    memcpy(&g_currentCalibData, data, sizeof(PersonalCalibData_t));
    g_isCalibDataValid = true;

    LOG("[STORAGE] Calib saved (CRC=0x%04X): %s\n", g_workBuf.header_crc16, ok ? "OK" : "FAIL");
    return ok;
}


// ==================== C区操作实现 ====================

void StorageManager::CZone_FlushCache() {
    LOG("[CZQ] FlushCache enter\n");
    _czone_flushCache();
    LOG("[CZQ] FlushCache done\n");
}

// NTP同步后立即更新当前活跃块的start_timestamp，避免块头时间戳为0
void StorageManager::CZone_UpdateBlockTimestamp(uint32_t unixSec, uint16_t ms) {
    if (!g_czone_initialized || g_czone_current_block_addr == 0) return;
    CZone_BlockHeader_t hdr;
    flash.ReadBytes(g_czone_current_block_addr, &hdr, sizeof(hdr));
    if (hdr.magic != 0x435A424C) return;  // 无效块
    if (hdr.start_timestamp_sec != unixSec || hdr.start_timestamp_ms != ms) {
        hdr.start_timestamp_sec = unixSec;
        hdr.start_timestamp_ms = ms;
        uint16_t crc = _calcCRC16((const uint8_t*)&hdr,
                                   offsetof(CZone_BlockHeader_t, block_crc16), CRC16_INIT);
        hdr.block_crc16 = crc;
        _writeMultiPage(g_czone_current_block_addr, &hdr, sizeof(hdr));
        LOG("[STORAGE] CZone: NTP sync → block start_ts=%lu.%03u\n", (unsigned long)unixSec, ms);
    }
}

bool StorageManager::CZone_AppendDataPoint(const CZone_DataPoint_t* dataPoint) {
    if (!dataPoint) return false;

    // [C0-5-fix] 异步擦除期间拒绝写入，避免数据丢失
    if (g_asyncEraseState == ASYNC_ERASE_CZONE_BLOCK) {
        return false;  // 擦除进行中，丢弃本帧（信号管线不阻塞）
    }

    // 检查当前块是否已满
    // C区64KB块: header 32字节 + 最多 (65536-32)/16 = 4094 个数据点
    static const uint16_t C_MAX_POINTS_PER_BLOCK = 4094;

    if (!g_czone_initialized || g_czone_current_block_addr == 0) {
        if (!_czone_allocateNewBlock()) {
            LOG("[STORAGE] CZone: failed to allocate new block\n");
            return false;
        }
    }

    // 检查块内偏移是否超出（header 32字节 + N*13字节）
    uint16_t dataOffset = g_czone_block_write_offset;
    uint16_t pointIndex = (dataOffset - sizeof(CZone_BlockHeader_t)) / sizeof(CZone_DataPoint_t);

    if (pointIndex >= C_MAX_POINTS_PER_BLOCK) {
        // 当前块已满，提交并分配新块
        // 更新块头的num_points和CRC
        _czone_flushCache();  // 先刷cache
        _czone_finalizeCurrentBlock();
        if (!_czone_allocateNewBlock()) {
            return false;
        }
        pointIndex = 0;
    }

    // 将数据点写入RAM cache
    uint16_t cacheRemaining = 256 - g_czone_cache_write_pos;
    uint16_t pointSize = sizeof(CZone_DataPoint_t);

    if (g_czone_cache_write_pos + pointSize > 256) {
        // cache满了，先刷到Flash
        if (!_czone_flushCache()) return false;
    }

    memcpy(g_czone_ram_cache + g_czone_cache_write_pos, dataPoint, pointSize);
    g_czone_cache_write_pos += pointSize;
    g_czone_block_write_offset += pointSize;
    g_czone_total_writes++;

    // [FIX] 第一个数据点写入时，更新块头start_timestamp为真实毫秒
    if (g_czone_block_write_offset == sizeof(CZone_BlockHeader_t) + sizeof(CZone_DataPoint_t)) {
        CZone_BlockHeader_t hdr;
        flash.ReadBytes(g_czone_current_block_addr, &hdr, sizeof(hdr));
        hdr.start_timestamp_sec = dataPoint->timestamp_sec;
        hdr.start_timestamp_ms = dataPoint->timestamp_ms;
        hdr.block_crc16 = _calcCRC16((const uint8_t*)&hdr, offsetof(CZone_BlockHeader_t, block_crc16), CRC16_INIT);
        _writeMultiPage(g_czone_current_block_addr, &hdr, sizeof(hdr));
        LOG("[STORAGE] CZone: set block start_ts=%lu.%03u\n", (unsigned long)dataPoint->timestamp_sec, dataPoint->timestamp_ms);
    }

    // cache接近满时自动刷盘（剩余不足一个数据点时）
    // 每100次写入或cache满前打诊断日志
    if (g_czone_total_writes % 100 == 0) {
        uint16_t pts = (g_czone_block_write_offset - sizeof(CZone_BlockHeader_t)) / sizeof(CZone_DataPoint_t);
        LOG("[CZ] writes=%lu block=0x%06X pts=%d cache=%d\n",
            (unsigned long)g_czone_total_writes,
            (unsigned long)g_czone_current_block_addr, pts, g_czone_cache_write_pos);
    }

    if (g_czone_cache_write_pos + pointSize > 256) {
        _czone_flushCache();
    }

    return true;
}

// [B2-2-fix][C0-4/C0-5-fix] StorageManager::tick - 异步擦除状态机轮询 + 定期刷盘 + 锚点更新
void StorageManager::tick() {
    // [v3.9.32] CZone定期刷盘：每2秒检查一次，减少掉电数据丢失窗口（最多~2秒）
    static uint32_t _czLastFlushMs = 0;
    if (g_czone_initialized && g_czone_cache_write_pos > 0) {
        uint32_t now = millis();
        if (now - _czLastFlushMs >= 2000) {
            _czone_flushCache();
            _czLastFlushMs = now;
        }
    }

    // 锚点只由 _czone_allocateNewBlock() 在C区块切换时触发更新
    // 启动恢复代码会扫描C区找到最后一个有效数据点，无需依赖锚点做精确位置
    // 因此取消60秒定时刷写，大幅减少Flash擦写次数
    _czone_pollAnchorUpdate();

    if (g_asyncEraseState == ASYNC_ERASE_IDLE) return;

    // Flash正在忙（擦除进行中），等下次tick
    if (flash.isBusy()) return;

    switch (g_asyncEraseState) {


    // ---- C区64KB块擦除完成 ----
    case ASYNC_ERASE_CZONE_BLOCK: {
        // 写块头
        CZone_BlockHeader_t hdr;
        memset(&hdr, 0, sizeof(hdr));
        hdr.magic = 0x435A424C;  // "CZBL"
        hdr.start_timestamp_sec = 0;  // 首个数据点到达时写入真实时间
        hdr.start_timestamp_ms = 0;
        hdr.num_points = 0;
        hdr.block_status = 1;  // 活跃

        uint16_t hdr_crc = _calcCRC16((const uint8_t*)&hdr,
                                       offsetof(CZone_BlockHeader_t, block_crc16),
                                       CRC16_INIT);
        hdr.block_crc16 = hdr_crc;

        _writeMultiPage(g_asyncEraseAddr, &hdr, sizeof(hdr));
        g_czone_initialized = true;  // [FIX] 异步擦除完成后标记初始化
        g_asyncEraseState = ASYNC_ERASE_IDLE;
        LOG("[STORAGE] tick: CZone block header written at 0x%06X\n", g_asyncEraseAddr);
        break;
    }

    default:
        g_asyncEraseState = ASYNC_ERASE_IDLE;
        break;
    }
}

// ---- C区私有函数实现 ----

// [FIX] 定期将C区锚点持久化到A区，避免重启后丢失写入位置
// 改为异步执行：先擦除，然后在tick()中轮询擦除完成，再写入
enum AnchorUpdateState_t {
    ANCHOR_IDLE = 0,
    ANCHOR_ERASING,
    ANCHOR_WRITING
};

static AnchorUpdateState_t g_anchorUpdateState = ANCHOR_IDLE;

static bool _czone_updateAZoneAnchor(void) {
    // [FIX] 不再检查magic — g_workBuf已由_initFromScratch或上次锚点写入初始化
    // 即使AZone无效，g_workBuf的RAM副本已有正确的锚点数据

    // 检查锚点是否变化（避免频繁擦写Flash）
    if (g_workBuf.cz_active_block_addr == g_czone_current_block_addr &&
        g_workBuf.cz_write_offset == g_czone_block_write_offset) {
        return true;  // 无变化，跳过
    }

    // 如果正在更新，跳过（避免重复触发）
    if (g_anchorUpdateState != ANCHOR_IDLE) {
        LOG("[STORAGE] CZone: anchor update already in progress, skipping\n");
        return false;
    }

    // [FIX] 检查Flash是否空闲，如果busy则跳过本次更新，下次tick再试
    if (flash.isBusy()) {
        LOG("[STORAGE] CZone: anchor update skipped (Flash busy)\n");
        return false;
    }

    // 确保magic和version有效（即使AZone无效，RAM副本也要合法）
    g_workBuf.magic = 0xA55AA55A;
    if (g_workBuf.struct_version == 0xFFFF) {
        g_workBuf.struct_version = PACK_VERSION(2, 1);
    }

    // 更新RAM中的锚点
    g_workBuf.cz_active_block_addr = g_czone_current_block_addr;
    g_workBuf.cz_write_offset = g_czone_block_write_offset;

    // 启动异步更新：先擦除A区扇区
    g_anchorUpdateState = ANCHOR_ERASING;
    flash.sectorEraseAsync(ZONE_A_BASE_ADDR);  // 异步擦除，不等待
    LOG("[STORAGE] CZone: anchor update started (erasing AZone)\n");
    return true;
}

// 在tick()中轮询锚点更新状态
static void _czone_pollAnchorUpdate(void) {
    switch (g_anchorUpdateState) {
        case ANCHOR_ERASING: {
            if (!flash.isBusy()) {
                // 擦除完成，更新RAM中的锚点并写入
                g_workBuf.cz_active_block_addr = g_czone_current_block_addr;
                g_workBuf.cz_write_offset = g_czone_block_write_offset;

                // 重新计算CRC（只计算有效载荷部分）
                uint32_t payload_offset = offsetof(AZone_Sector_t, name);
                uint32_t payload_len = offsetof(AZone_Sector_t, reserved) - payload_offset;
                g_workBuf.header_crc16 = _calcCRC16((const uint8_t*)&g_workBuf + payload_offset,
                                                       payload_len, CRC16_INIT);

                // 写入Flash（不验证，避免读取导致崩溃）
                LOG("[CZ-ANCHOR] writing AZone anchor...\n");
                if (_writeMultiPage(ZONE_A_BASE_ADDR, &g_workBuf, sizeof(AZone_Sector_t))) {
                    LOG("[STORAGE] CZone: anchor updated, block=0x%06X offset=%u\n",
                        g_czone_current_block_addr, g_czone_block_write_offset);
                    g_anchorUpdateState = ANCHOR_IDLE;
                } else {
                    LOG("[STORAGE] CZone: failed to write AZone anchor\n");
                    g_anchorUpdateState = ANCHOR_IDLE;
                }
            }
            break;
        }

        case ANCHOR_WRITING:
            // 写入已完成（_writeMultiPage是同步的）
            g_anchorUpdateState = ANCHOR_IDLE;
            break;

        default:
            break;
    }
}

// ==================== C区查询接口实现 ====================

bool StorageManager::CZone_QueryByTimeRange(uint32_t startTs, uint32_t endTs,
                                             CZone_DataPoint_t* outBuf, uint16_t maxPoints,
                                             uint16_t* outCount, uint32_t* outNextTs) {
    if (!outBuf || !outCount || !outNextTs || maxPoints == 0) return false;
    
    // C区未初始化或正在擦除时直接返回空（但不去检查首块——数据可能从任意块开始）
    if (!g_czone_initialized ||
        g_asyncEraseState == ASYNC_ERASE_CZONE_BLOCK) {
        *outCount = 0;
        *outNextTs = 0;
        return false;
    }
    
    // [v3.9.27] 查询参数是秒，转为ms范围用于内部比较
    uint64_t startTsMs = (uint64_t)startTs * 1000ULL;
    uint64_t endTsMs = (uint64_t)endTs * 1000ULL + 999ULL;  // 包含末尾秒的完整毫秒范围
    
    *outCount = 0;
    *outNextTs = 0;
    
    // 遍历 C 区块 (最多32块=2MB, 防止SPI遍历阻塞主循环)
    LOG("[CZQ] starting scan, max 32 blocks\n");
    uint32_t queryStartMs = millis();
    for (uint32_t blockAddr = C_ZONE_BASE_ADDR, _scanCount = 0; 
         blockAddr < C_ZONE_BASE_ADDR + C_ZONE_TOTAL_SIZE && _scanCount < 32; 
         blockAddr += C_BLOCK_SIZE, _scanCount++) {
        
        // 超时保护：查询超过3秒强制结束
        if (millis() - queryStartMs > 3000) {
            LOG("[CZQ] timeout after %d blocks, count=%d\n", _scanCount, *outCount);
            break;
        }
        
        // 读块头
        CZone_BlockHeader_t hdr;
        flash.ReadBytes(blockAddr, &hdr, sizeof(hdr));
        
        // 跳过无效块（但当前活跃块即使未finalize也要读取）
        if (hdr.magic != 0x435A424C) continue;
        bool isActiveBlock = (blockAddr == g_czone_current_block_addr);
        if (hdr.block_status == 0 && !isActiveBlock) continue;

        // [v3.9.32] 验证块头CRC，跳过损坏块（活跃块CRC可能未更新，跳过校验）
        if (!isActiveBlock) {
            uint16_t hdr_crc = _calcCRC16((const uint8_t*)&hdr,
                                           offsetof(CZone_BlockHeader_t, block_crc16),
                                           CRC16_INIT);
            if (hdr_crc != hdr.block_crc16) {
                LOG("[CZQ] block at 0x%06X CRC mismatch (calc=0x%04X stored=0x%04X), skip\n",
                    blockAddr, hdr_crc, hdr.block_crc16);
                continue;
            }
        }
        
        // 计算块内数据点数量
        uint16_t numPoints = hdr.num_points;
        // [FIX] 当前活跃块的num_points可能为0（未finalize），用RAM偏移计算实际点数
        if (numPoints == 0 && blockAddr == g_czone_current_block_addr) {
            numPoints = (g_czone_block_write_offset - sizeof(CZone_BlockHeader_t)) / sizeof(CZone_DataPoint_t);
            LOG("[CZQ] active block numPoints=%d from offset=%d\n", numPoints, g_czone_block_write_offset);
        }
        if (numPoints == 0) continue;

        // 遍历块内数据点
        for (uint16_t i = 0; i < numPoints && *outCount < maxPoints; i++) {
            CZone_DataPoint_t pt;
            uint32_t ptAddr = blockAddr + sizeof(CZone_BlockHeader_t) + i * sizeof(CZone_DataPoint_t);
            flash.ReadBytes(ptAddr, &pt, sizeof(pt));
            
            // [v3.9.27] 真实毫秒: timestamp_sec*1000 + timestamp_ms
            uint64_t ptTsMs = (uint64_t)pt.timestamp_sec * 1000ULL + pt.timestamp_ms;
            
            // [DEBUG] 第一个数据点的时间戳
            if (i == 0 && blockAddr == g_czone_current_block_addr) {
                LOG("[CZQ] first pt: sec=%lu ms=%u → tsMs=%lu.%03u startMs=%lu.%03u endMs=%lu.%03u\n",
                    (unsigned long)pt.timestamp_sec, pt.timestamp_ms,
                    (unsigned long)(ptTsMs/1000), (unsigned int)(ptTsMs%1000),
                    (unsigned long)(startTsMs/1000), (unsigned int)(startTsMs%1000),
                    (unsigned long)(endTsMs/1000), (unsigned int)(endTsMs%1000));
            }
            
            // 时间范围过滤
            if (ptTsMs >= startTsMs && ptTsMs <= endTsMs) {
                outBuf[*outCount] = pt;
                (*outCount)++;
            }
        }
        
        // 如果已满，记录下一个块地址用于分页
        if (*outCount >= maxPoints) {
            // [v3.9.33] nextTs = last returned point's timestamp + 1ms (correct pagination resume point)
            // outBuf[maxPoints-1] is the last point written
            *outNextTs = (uint32_t)(outBuf[maxPoints - 1].timestamp_sec + 1);  // +1 second for next query
            uint32_t nextBlockAddr = blockAddr + C_BLOCK_SIZE;
            if (nextBlockAddr >= C_ZONE_BASE_ADDR + C_ZONE_TOTAL_SIZE) {
                *outNextTs = 0;  // no more blocks
            }
            break;
        }
    }
    
    LOG("[CZQ] scan done, count=%d\n", *outCount);
    return (*outCount > 0);
}

// [v3.9.34] 分析页专用查询：单遍扫描 + 步长降采样，仅返回 mdf/fatigue 数组
bool StorageManager::CZone_QueryForAnalysis(
    uint32_t startTsSec, uint32_t endTsSec,
    float* outMdf, float* outFatigue,
    uint16_t maxPoints, uint16_t* outCount,
    uint32_t* outTotal, uint64_t* outFirstTsMs, uint64_t* outLastTsMs)
{
    static const uint16_t SCAN_BLOCK_LIMIT = 64;  // 64块≈10天覆盖
    static const uint16_t TARGET_POINTS = 500;

    *outCount = 0;
    *outTotal = 0;
    *outFirstTsMs = 0;
    *outLastTsMs = 0;

    if (!outMdf || !outFatigue || !outCount || !outTotal) return false;

    uint64_t startTsMs = (uint64_t)startTsSec * 1000ULL;
    uint64_t endTsMs   = (uint64_t)endTsSec * 1000ULL;

    // 根据时间跨度估算总点数，计算步长
    uint32_t rangeSec = (endTsSec > startTsSec) ? (endTsSec - startTsSec) : 0;
    uint32_t estimatedTotal = rangeSec * 10;  // 10Hz 写入速率
    if (estimatedTotal < 1) estimatedTotal = 1;
    if (estimatedTotal > 2000000) estimatedTotal = 2000000;
    uint32_t stride = estimatedTotal / TARGET_POINTS;
    if (stride < 1) stride = 1;

    uint32_t matchIndex = 0;
    uint64_t firstFoundTs = UINT64_MAX;
    uint64_t lastFoundTs  = 0;

    uint32_t queryStartMs = millis();
    LOG("[CZQ-A] analysis scan start, rangeSec=%lu estTotal=%lu stride=%lu\n",
        (unsigned long)rangeSec, (unsigned long)estimatedTotal, (unsigned long)stride);

    for (uint32_t blockAddr = C_ZONE_BASE_ADDR, _scanCount = 0;
         blockAddr < C_ZONE_BASE_ADDR + C_ZONE_TOTAL_SIZE && _scanCount < SCAN_BLOCK_LIMIT;
         blockAddr += C_BLOCK_SIZE, _scanCount++) {

        if (millis() - queryStartMs > 4000) {
            LOG("[CZQ-A] timeout after %d blocks\n", _scanCount);
            break;
        }

        CZone_BlockHeader_t hdr;
        flash.ReadBytes(blockAddr, &hdr, sizeof(hdr));
        if (hdr.magic != 0x435A424C || hdr.block_status == 0) continue;

        uint16_t hdr_crc = _calcCRC16((const uint8_t*)&hdr,
                                       offsetof(CZone_BlockHeader_t, block_crc16), CRC16_INIT);
        if (hdr_crc != hdr.block_crc16) continue;

        uint16_t numPoints = hdr.num_points;
        if (numPoints == 0 && blockAddr == g_czone_current_block_addr) {
            numPoints = (g_czone_block_write_offset - sizeof(CZone_BlockHeader_t)) / sizeof(CZone_DataPoint_t);
        }
        if (numPoints == 0) continue;

        for (uint16_t i = 0; i < numPoints && *outCount < maxPoints; i++) {
            CZone_DataPoint_t pt;
            uint32_t ptAddr = blockAddr + sizeof(CZone_BlockHeader_t) + i * sizeof(CZone_DataPoint_t);
            flash.ReadBytes(ptAddr, &pt, sizeof(pt));

            uint64_t ptTsMs = (uint64_t)pt.timestamp_sec * 1000ULL + pt.timestamp_ms;
            if (ptTsMs < startTsMs || ptTsMs > endTsMs) continue;

            if (ptTsMs < firstFoundTs) firstFoundTs = ptTsMs;
            if (ptTsMs > lastFoundTs)  lastFoundTs  = ptTsMs;

            if (matchIndex % stride == 0) {
                outMdf[*outCount]     = pt.mdf / 10.0f;
                outFatigue[*outCount] = pt.fatigue / 10.0f;
                (*outCount)++;
            }
            matchIndex++;
        }
    }

    *outTotal = matchIndex;
    if (matchIndex > 0) {
        *outFirstTsMs = firstFoundTs;
        *outLastTsMs  = lastFoundTs;
    }

    LOG("[CZQ-A] scan done: sampled=%u total=%lu firstTs=%lu.%03u lastTs=%lu.%03u\n",
        *outCount, (unsigned long)matchIndex,
        (unsigned long)(firstFoundTs/1000), (unsigned int)(firstFoundTs%1000),
        (unsigned long)(lastFoundTs/1000), (unsigned int)(lastFoundTs%1000));
    return (*outCount > 0);
}


// ==================== WiFi 操作（RA4M1 板载 Data Flash / EEPROM） ====================

bool StorageManager::LoadWifiCredentials(WifiCredentials_t* outCreds) {
    if (!outCreds) return false;

    uint8_t magic = EEPROM.read(EEPROM_WIFI_VALID_ADDR);
    if (magic != EEPROM_WIFI_MAGIC) {
        outCreds->isValid = false;
        return false;
    }

    for (uint8_t i = 0; i < 32; i++) {
        outCreds->ssid[i] = (char)EEPROM.read(EEPROM_WIFI_SSID_ADDR + i);
    }
    outCreds->ssid[31] = '\0';

    for (uint8_t i = 0; i < 64; i++) {
        outCreds->pass[i] = (char)EEPROM.read(EEPROM_WIFI_PASS_ADDR + i);
    }
    outCreds->pass[63] = '\0';

    outCreds->isValid = (strlen(outCreds->ssid) > 0);
    LOG("[STORAGE] WiFi creds loaded from EEPROM: SSID='%s'\n", outCreds->ssid);
    return outCreds->isValid;
}

bool StorageManager::SaveWifiCredentials(const WifiCredentials_t* creds) {
    if (!creds) return false;

    // EEPROM.update 只在值变化时写入，减少磨损
    // RA4M1 Data Flash 擦写寿命 > 100,000次
    for (uint8_t i = 0; i < 32; i++) {
        EEPROM.update(EEPROM_WIFI_SSID_ADDR + i, (uint8_t)creds->ssid[i]);
    }
    for (uint8_t i = 0; i < 64; i++) {
        EEPROM.update(EEPROM_WIFI_PASS_ADDR + i, (uint8_t)creds->pass[i]);
    }
    EEPROM.update(EEPROM_WIFI_VALID_ADDR, EEPROM_WIFI_MAGIC);

    LOG("[STORAGE] WiFi creds saved to EEPROM: SSID='%s'\n", creds->ssid);
    return true;
}

// ==================== 私有辅助函数实现 ====================

// [S0-2-fix] CRC16-Modbus 实现（完整，非空壳）
static uint16_t _calcCRC16(const uint8_t* data, uint32_t length, uint16_t init) {
    uint16_t crc = init;
    for (uint32_t i = 0; i < length; i++) {
        crc ^= data[i];
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 1) crc = (crc >> 1) ^ CRC16_POLYNOMIAL;
            else crc >>= 1;
        }
    }
    return crc;
}

// [S0-2-fix] A区扇区校验（完整，非空壳）
static bool _validateAZoneSector(const AZone_Sector_t* sector) {
    if (!sector) return false;
    if (sector->magic != 0xA55AA55A) return false;
    // 校验CRC：从 name 到 sys_reserved（不含 reserved 空闲区）
    uint32_t payload_offset = offsetof(AZone_Sector_t, name);
    uint32_t payload_len = offsetof(AZone_Sector_t, reserved) - payload_offset;
    uint16_t calc_crc = _calcCRC16((const uint8_t*)sector + payload_offset, payload_len, CRC16_INIT);
    if (calc_crc != sector->header_crc16) {
        LOG("[STORAGE] AZone CRC mismatch: calc=0x%04X, stored=0x%04X\n", calc_crc, sector->header_crc16);
        return false;
    }
    return true;
}


static bool _writeMultiPage(uint32_t addr, const void* data, uint32_t len) {
    const uint8_t* p = (const uint8_t*)data;
    uint32_t offset = 0;
    while (offset < len) {
        // W25Q128FV: 页内对齐写入，每页最多256字节
        uint32_t page_remaining = PAGE_SIZE - ((addr + offset) % PAGE_SIZE);
        uint32_t chunk = (len - offset < page_remaining) ? (len - offset) : page_remaining;
        if (chunk > PAGE_SIZE) chunk = PAGE_SIZE;
        if (!flash.WritePage(addr + offset, p + offset, chunk)) {
            LOG("[STORAGE] WritePage failed at 0x%06X\n", addr + offset);
            return false;
        }
        offset += chunk;
    }
    return true;
}

// ---- C区私有函数实现 ----

static bool _czone_initFromScratch(void) {
    LOG("[CZ-DBG] _czone_initFromScratch: start scanning...\n");
    // [v3.9.38] 先扫描C区是否已有有效数据（避免每次boot都擦除历史数据）
    uint32_t lastValidBlock = 0;
    uint16_t resumeOffset = 0;
    bool lastBlockCompleted = false;
    uint32_t scanAddr = C_ZONE_BASE_ADDR;

    while (scanAddr <= C_ZONE_END_ADDR) {
        CZone_BlockHeader_t hdr;
        flash.ReadBytes(scanAddr, &hdr, sizeof(hdr));
        if (hdr.magic != 0x435A424C) break;  // 擦除态(0xFF)，后续全无效

        lastValidBlock = scanAddr;
        if (hdr.block_status == 2) {
            // 已完成块，检查下一个
            scanAddr += C_BLOCK_SIZE;
            if (scanAddr > C_ZONE_END_ADDR) break; // 环形到头
        } else {
            // 正在写入的块，从此处恢复
            resumeOffset = sizeof(CZone_BlockHeader_t) + hdr.num_points * sizeof(CZone_DataPoint_t);
            break;
        }
    }
    lastBlockCompleted = (lastValidBlock != 0 && resumeOffset == 0);
    LOG("[CZ-DBG] _czone_initFromScratch: scan done, lastValidBlock=0x%06X resumeOffset=%u\n",
        lastValidBlock, resumeOffset);

    if (lastValidBlock != 0) {
        // 已有历史数据，恢复状态（不擦除）
        g_czone_current_block_addr = lastValidBlock;
        g_czone_block_write_offset = resumeOffset;
        g_czone_cache_write_pos = 0;

        if (lastBlockCompleted) {
            // 最后一个块已满，标记未初始化让 AppendDataPoint 触发 _czone_allocateNewBlock
            g_czone_initialized = false;
            g_czone_current_block_addr = 0;
        } else {
            g_czone_initialized = true;
        }

        // [FIX] 只更新RAM中的锚点，不在这里同步写Flash（setup()中不可靠）
        // 异步锚点更新机制会在系统稳定后写入
        g_workBuf.magic = 0xA55AA55A;
        g_workBuf.cz_active_block_addr = lastValidBlock;
        g_workBuf.cz_write_offset = resumeOffset;
        g_workBuf.cz_wrap_around = 0;
        if (g_workBuf.struct_version == 0xFFFF) {
            g_workBuf.struct_version = PACK_VERSION(2, 1);
        }

        LOG("[STORAGE] CZone: recovered data, block=0x%06X off=%u %s (anchor will update async)\n",
            lastValidBlock, resumeOffset,
            lastBlockCompleted ? "(full, will alloc new)" : "");
        return true;
    }

    // 完全空白设备，擦除第一个块初始化
    g_czone_current_block_addr = C_ZONE_BASE_ADDR;
    g_czone_block_write_offset = sizeof(CZone_BlockHeader_t);
    g_czone_cache_write_pos = 0;
    // g_czone_initialized 在异步擦除完成后设置（见 _processAsyncErase）

    // [C0-5-fix] 异步擦除第一个块（W25Q128FV: 64KB块擦除 200-1000ms）
    g_asyncEraseState = ASYNC_ERASE_CZONE_BLOCK;
    g_asyncEraseAddr = g_czone_current_block_addr;
    flash.EraseBlock64KAsync(g_czone_current_block_addr);

    LOG("[STORAGE] CZone: empty device, async erase first block at 0x%06X\n", g_czone_current_block_addr);
    return true;
}

static bool _czone_loadStateFromAZone(void) {
    // 从A区镜像读取C区锚点信息
    if (g_workBuf.magic != 0xA55AA55A) return false;
    if (g_workBuf.cz_active_block_addr == 0 ||
        g_workBuf.cz_active_block_addr < C_ZONE_BASE_ADDR) {
        return false;
    }

    // 验证C区块头
    CZone_BlockHeader_t hdr;
    flash.ReadBytes(g_workBuf.cz_active_block_addr, &hdr, sizeof(hdr));
    if (hdr.magic != 0x435A424C) return false;

    g_czone_current_block_addr = g_workBuf.cz_active_block_addr;
    g_czone_block_write_offset = g_workBuf.cz_write_offset;
    g_czone_initialized = true;
    g_czone_cache_write_pos = 0;

    LOG("[STORAGE] CZone: loaded state from AZone, block=0x%06X, offset=%u\n",
        g_czone_current_block_addr, g_czone_block_write_offset);
    return true;
}

static bool _czone_flushCache(void) {
    if (g_czone_cache_write_pos == 0) return true;

    uint32_t writeAddr = g_czone_current_block_addr + g_czone_block_write_offset - g_czone_cache_write_pos;

    if (!_writeMultiPage(writeAddr, g_czone_ram_cache, g_czone_cache_write_pos)) {
        LOG("[STORAGE] CZone: cache flush failed at 0x%06X\n", writeAddr);
        return false;
    }

    uint16_t flushedBytes = g_czone_cache_write_pos;
    g_czone_cache_write_pos = 0;
    // [FIX] 移除每次flush的日志噪音，每100次有诊断日志足够了
    // LOG("[CZ] cache flushed %uB at 0x%06X (total writes=%lu)\n",
    //     (unsigned)flushedBytes, (unsigned long)writeAddr, (unsigned long)g_czone_total_writes);
    return true;
}

static bool _czone_allocateNewBlock(void) {
    // 计算下一个64KB块地址
    uint32_t nextAddr = g_czone_current_block_addr + C_BLOCK_SIZE;

    // 检查是否超出C区范围
    if (nextAddr > C_ZONE_END_ADDR) {
        nextAddr = C_ZONE_BASE_ADDR;
        LOG("[STORAGE] CZone: circular wrap to 0x%06lX\n", (unsigned long)nextAddr);
    }

    // [C0-5-fix] 异步擦除新块
    g_asyncEraseState = ASYNC_ERASE_CZONE_BLOCK;
    g_asyncEraseAddr = nextAddr;
    flash.EraseBlock64KAsync(nextAddr);

    // 预设新块地址（tick完成后写入header）
    g_czone_current_block_addr = nextAddr;
    g_czone_block_write_offset = sizeof(CZone_BlockHeader_t);
    g_czone_cache_write_pos = 0;
    g_czone_initialized = true;  // [FIX] Mark C-zone as initialized

    // 乐观更新A区锚点
    g_workBuf.cz_active_block_addr = nextAddr;
    g_workBuf.cz_write_offset = g_czone_block_write_offset;
    g_workBuf.cz_wrap_around = (nextAddr == C_ZONE_BASE_ADDR) ? 1 : 0;

    // 立即持久化锚点（分配新块是重要状态变化）
    _czone_updateAZoneAnchor();

    LOG("[STORAGE] CZone: async erase new block at 0x%06X\n", nextAddr);
    return true;
}

static void _czone_finalizeCurrentBlock(void) {
    // 更新当前块的header: num_points和CRC
    CZone_BlockHeader_t hdr;
    flash.ReadBytes(g_czone_current_block_addr, &hdr, sizeof(hdr));

    hdr.num_points = (g_czone_block_write_offset - sizeof(CZone_BlockHeader_t)) / sizeof(CZone_DataPoint_t);
    hdr.block_status = 2;  // 已完成

    // 计算整个块数据的CRC（header不含CRC字段 + 数据区域）
    // 先算header部分的CRC
    uint16_t hdr_crc = _calcCRC16((const uint8_t*)&hdr,
                                   offsetof(CZone_BlockHeader_t, block_crc16),
                                   CRC16_INIT);
    hdr.block_crc16 = hdr_crc;

    // 重写header（在已擦除的块上，需要先读-改-写，但这里header是块开头，单独写一页即可）
    _writeMultiPage(g_czone_current_block_addr, &hdr, sizeof(hdr));
}
