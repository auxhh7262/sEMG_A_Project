#ifndef PROTOCOL_HANDLER_H
#define PROTOCOL_HANDLER_H

#include <Arduino.h>
#include "0_Base/Globals.h"
#include "0_Base/Board.h"

class ProtocolHandler {
public:
    void init();
    void tick();

    // 下行指令解析 (本地调试)
    AppCommand_t tickLocalDebug();

    // JSON 命令解析 (WebSocket)
    void handleJsonCommand(uint8_t clientNum, const char* json);
    void deferJsonCommand(uint8_t clientNum, const char* json);  // [FIX] Deferred: copy JSON only, parse in main loop

    // [DBG-TEMP] 串口 JSON 命令处理（debug 工具通过串口发 query_cz）
    void _handleSerialJson();

    // 上行状态发送 (串口透传占位)
    void sendStatus(const char* stateName);
    void sendStatus(const char* stateName, uint8_t progress);
    void sendError(const char* msg);

private:
    char _debugBuf[100];
    uint8_t _debugBufIdx;
    
    // [FIX] Deferred JSON command processing (avoid deserializeJson in interrupt context)
    static const uint16_t MAX_JSON_LEN = 512;
    char _pendingJson[MAX_JSON_LEN];
    uint8_t _pendingClientNum;
    bool _hasPendingCommand;
};

#endif // PROTOCOL_HANDLER_H
