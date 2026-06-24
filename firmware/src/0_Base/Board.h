#ifndef BOARD_H
#define BOARD_H
#include <Arduino.h>

// =============== 输入引脚 ===============
#define PIN_EMG_ADC A0 // sEMG 传感器模拟输入

// =============== SPI Flash (W25Q128) 引脚 ===============
// 【致命红线警告】UNO R4 WiFi 的 SPI 引脚为 5V，
// W25Q128FV 最高承受 3.6V，物理直连必烧毁 Flash！
//
// 【电平转换】使用 4 路 BSS138 MOSFET 双向电平转换模块：
//   Flash 侧（LV=3.3V）←电平转换→ Arduino 侧（HV=5V）
//   CS#  → LV2-HV2 → D10  (Arduino→Flash)
//   DI    → LV3-HV3 → D11  (Arduino→Flash, MOSI)
//   DO    → LV1-HV1 → D12  (Flash→Arduino, MISO，最关键！)
//   SCK  → LV4-HV4 → D13  (Arduino→Flash, SCK)
//   LV 引脚必须接 3.3V，HV 引脚必须接 5V，GND 共地
//
#define PIN_SPI_FLASH_CS 10 // 硬件 SPI CS  → 电平转换 LV2-HV2
#define PIN_SPI_MOSI 11     // 硬件 SPI MOSI (DI) → 电平转换 LV3-HV3
#define PIN_SPI_MISO 12     // 硬件 SPI MISO (DO) → 电平转换 LV1-HV1
#define PIN_SPI_SCK 13      // 硬件 SPI SCK (CLK) → 电平转换 LV4-HV4


// =============== 板载指示灯 ===============
#define PIN_LED_BUILTIN LED_BUILTIN

// =============== 串口定义 ===============
#define SERIAL_COMM Serial  // USB 调试串口
#define SERIAL_ESP32 Serial1 // 与 ESP32 通信的硬件 UART
#define ESP_BAUDRATE 115200

// =============== ADC 参数（RA4M1 14-bit） ===============
#define ADC_REF_MV 5000.0f   // 默认使用板载 5V 参考电压
#define ADC_MAX_VALUE 16383  // 2^14 - 1

// =============== 校准流程参数 ===============
#define CALIB_RELAX_SEC 10    // 放松采集时长（秒）
#define CALIB_ACTIVE_SEC 15     // 最大收缩采集时长（秒）
#define LOOP_INTERVAL_MS 100 // 主循环时序：10Hz

// 针对 Uno R4 WiFi 高频采样死锁的硬件级修复宏 (14-bit 管道清空版)
#define FAST_ADC_READ(pin) (analogRead(pin), analogRead(pin))

#endif // BOARD_H
