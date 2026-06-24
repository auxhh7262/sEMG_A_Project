#ifndef FLASH_DRIVER_H
#define FLASH_DRIVER_H

#include <Arduino.h>
#include <SPI.h>
#include "0_Base/Board.h"

// 页/扇区常量
#define SECTOR_SIZE     4096
#define PAGE_SIZE       256

// ==================== C++ Flash 驱动类 ====================
// 合并原 Hal_FlashDriver + FlashDriver 两层，消除冗余透传
class FlashDriver {
public:
    static FlashDriver& instance();

    void init(bool fullUnlock = false);
    void diagnoseJedec();  // 运行时诊断：重新读取JEDEC并打印完整日志

    void readData(uint32_t addr, uint8_t* buf, uint16_t len);
    bool writeData(uint32_t addr, const uint8_t* buf, uint16_t len);

    // 同步擦除（阻塞，仅限初始化等非实时场景）
    void sectorErase(uint32_t addr);
    void blockErase64K(uint32_t addr);

    // 异步擦除（发起后立即返回，主循环轮询 isBusy）
    void sectorEraseAsync(uint32_t addr);
    void blockErase64KAsync(uint32_t addr);

    bool isBusy();

    // 适配上层的 bool 返回值接口
    bool Init()                { init(true); return _initOk; }  // 返回实际初始化结果
    bool EraseSector(uint32_t addr)       { sectorErase(addr); return true; }
    bool EraseBlock64K(uint32_t addr)     { blockErase64K(addr); return true; }
    bool EraseSectorAsync(uint32_t addr)  { sectorEraseAsync(addr); return true; }
    bool EraseBlock64KAsync(uint32_t addr){ blockErase64KAsync(addr); return true; }
    bool WritePage(uint32_t addr, const void* pData, uint32_t len) { writeData(addr, (const uint8_t*)pData, (uint16_t)len); return true; }
    bool ReadBytes(uint32_t addr, void* pData, uint32_t len)       { readData(addr, (uint8_t*)pData, (uint16_t)len); return true; }

private:
    FlashDriver();
    FlashDriver(const FlashDriver&) = delete;
    FlashDriver& operator=(const FlashDriver&) = delete;
    bool _initOk;  // 记录初始化是否成功

    void csLow();
    void csHigh();
    void writeEnable();
    void executeGoldenThreeSteps();
    void waitBusy();
};

#endif // FLASH_DRIVER_H
