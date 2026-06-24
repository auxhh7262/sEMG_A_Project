#ifndef LOGGER_H
#define LOGGER_H

#include <Arduino.h>
#include "Board.h"

// 声明：实现在 Logger.cpp
void _log_impl(const char* fmt, ...);

// 统一日志宏
#define LOG(fmt, ...) _log_impl(fmt, ##__VA_ARGS__)

#endif // LOGGER_H
