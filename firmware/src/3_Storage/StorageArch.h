// File: StorageArch.h
// Description: sEMG设备存储架构V1.0
// Version: 1.0
// Note: 使用兼容的断言宏
#ifndef STORAGE_ARCH_H
#define STORAGE_ARCH_H
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

// ==================== 编译时断言宏 (兼容性处理) ====================
#if defined(__GNUC__) && (__GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 6))
#define STATIC_ASSERT(cond, msg) _Static_assert(cond, msg)
#elif defined(__clang__)
#define STATIC_ASSERT(cond, msg) _Static_assert(cond, msg)
#elif defined(_MSC_VER) && (_MSC_VER >= 1800)
#define STATIC_ASSERT(cond, msg) static_assert(cond, msg)
#else
#define STATIC_ASSERT(cond, msg) typedef char static_assert_##__LINE__[(cond) ? 1 : -1] __attribute__((unused))
#endif

// ==================== 通用常量与宏 ====================
#define FLASH_TOTAL_SIZE (0x1000000UL) // 16 MB
#define FLASH_END_ADDR (0x00FFFFFFUL)  // 16MB W25Q128
#define SECTOR_SIZE (4096UL)
#define BLOCK_SIZE_64K (65536UL)

// 版本打包/解包宏
#define PACK_VERSION(major, minor) ((((uint16_t)(major) & 0xFF) << 8) | ((uint16_t)(minor) & 0xFF))
#define GET_MAJOR_VERSION(ver) (((ver) >> 8) & 0xFF)
#define GET_MINOR_VERSION(ver) ((ver) & 0xFF)

// CRC16 多项式 (强制统一为 Modbus)
#define CRC16_POLYNOMIAL 0xA001
#define CRC16_INIT 0xFFFF

// ==================== A区定义 (个人档案与模型区) ====================
#define ZONE_A_NUM_SECTORS 1
#define ZONE_A_TOTAL_SIZE (ZONE_A_NUM_SECTORS * SECTOR_SIZE) // 0x1000
#define ZONE_A_BASE_ADDR (0x0000000UL)
#define ZONE_A_END_ADDR (ZONE_A_BASE_ADDR + ZONE_A_TOTAL_SIZE - 1) // 0x000FFFF

/* A区扇区数据结构 (AZone_Sector_t) - 严格4096字节 */
#pragma pack(push, 1)
typedef struct {
    /* --- 扇区头 (8字节) --- */
    uint32_t magic;         // 0xA55AA55A
    uint16_t struct_version;// PACK_VERSION(2, 3) rest→relax, max→active 统一命名
    uint16_t header_crc16;  // CRC16(从`name`到`sys_reserved`，不含reserved空闲区

    /* --- 有效数据载荷 (76字节) --- */
    // 1. 个人身份信息 (38字节) 单用户仅需name
    char name[32];
    uint8_t age;
    uint8_t gender;         // 1:男, 2:女
    uint8_t handedness;     // 1:左手, 2:右手
    uint8_t info_reserved[3];

    // 2. 个人校准参数 (22字节) calib_timestamp毫秒精度, relax/active统一命名
    float relax_rms_mv;    // 放松阶段RMS基线
    float active_rms_mv;   // 收缩阶段RMS峰值
    uint32_t calib_timestamp_sec;  // NTP 秒
    uint16_t calib_timestamp_ms;   // 毫秒 (0~999)
    float relax_mdf_hz;    // 放松阶段MDF均值
    float active_mdf_hz;   // 收缩阶段MDF峰值，用于mdf_drop计算
    float end_mdf_hz;      // 收缩阶段末尾MDF均值

    // 4. C区状态锚点 (8字节)
    uint32_t cz_active_block_addr;
    uint16_t cz_write_offset;
    uint8_t cz_wrap_around;
    uint8_t sys_reserved;

    // --- 预留空间 (删除peak_rms_mv释放4B) ---
    uint8_t reserved[4016];
} AZone_Sector_t;
#pragma pack(pop)
STATIC_ASSERT(sizeof(AZone_Sector_t) == 4096, "AZone_Sector_t size must be 4096 bytes");

// ==================== C区定义 (个人实时监控区) ====================
#define C_ZONE_BASE_ADDR  (0x010000UL)              // 64KB对齐，避免块擦除误伤A区
#define C_ZONE_END_ADDR FLASH_END_ADDR // 0x00FFFFFF (16MB W25Q128最大地址)
#define C_ZONE_TOTAL_SIZE (C_ZONE_END_ADDR - C_ZONE_BASE_ADDR + 1)
#define C_BLOCK_SIZE BLOCK_SIZE_64K

/* C区数据点结构 [v3.9.27] 16字节
 * timestamp_sec: NTP秒 | timestamp_ms: 毫秒(0~999) | rms: ×100 | activation: ×10 | mdf: ×10 | fatigue: ×10 | quality: 直接
 * 真实毫秒精度，组合为: ts_ms = (uint64_t)timestamp_sec * 1000ULL + timestamp_ms
 * 16MB @ 10Hz ≈ 29小时 (255块×4094条, 环形覆盖)
 */
#pragma pack(push, 1)
typedef struct {
    uint32_t timestamp_sec;      // 4B: NTP 秒
    uint16_t timestamp_ms;       // 2B: 毫秒部分 (0~999)
    uint16_t rms;               // 2B: RMS mV×100 (如 825 = 8.25 mV)
    uint16_t activation;         // 2B: activation 0.0~100.0% ×10 (如 800 = 80.0%)
    uint16_t mdf;                // 2B: MDF Hz ×10 (如 849 = 84.9 Hz)
    uint16_t fatigue;            // 2B: fatigue 0.0~100.0% ×10 (如 223 = 22.3%)
    uint8_t quality;             // 1B: quality 0~100
    uint8_t padding;             // 1B: 对齐至16字节
} CZone_DataPoint_t; // 16 字节
#pragma pack(pop)
STATIC_ASSERT(sizeof(CZone_DataPoint_t) == 16, "CZone_DataPoint_t must be 16 bytes");

/* C区64KB块头结构 */
#pragma pack(push, 1)
typedef struct {
    uint32_t magic;               // 0x435A424C ("CZBL")
    uint32_t start_timestamp_sec; // NTP 秒
    uint16_t start_timestamp_ms;  // 毫秒部分 (0~999)
    uint16_t num_points;
    uint8_t block_status;
    uint8_t reserved[17];         // 4+4+2+2+1+17+2=32
    uint16_t block_crc16;
} CZone_BlockHeader_t; // 32 字节
#pragma pack(pop)
STATIC_ASSERT(sizeof(CZone_BlockHeader_t) == 32, "CZone_BlockHeader_t must be 32 bytes");

#endif // STORAGE_ARCH_V8_H
