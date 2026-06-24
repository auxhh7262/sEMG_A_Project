#ifndef NET_MANAGER_H
#define NET_MANAGER_H

#include <Arduino.h>
#include <WiFiS3.h>
#include <WiFiUdp.h>
#include <WebSocketsServer.h>
#include "0_Base/Globals.h"

class BleConfigServer;

class NetManager {
public:
    NetManager();
    void init(BleConfigServer* bleServer);
    void tick();
    void sendData(float rms, float mdf, float fatigue, uint8_t quality, float activation = 0.0f);

    void sendJsonTo(uint8_t clientNum, const char* json);
    void deferSendJson(uint8_t clientNum, const char* json);  // [FIX] Now calls sendJsonTo() (buffered)
    void sendRawToClient(uint8_t clientNum, const char* data, size_t len);  // [v3.9.36] Buffer for deferred send
    
    void setCommandCallback(void (*callback)(uint8_t, const char*));

    bool isWifiConnected() const;
    bool isWsClientConnected() const;
    bool isNtpWaitDone() const { return _ntpWaitDone; }

    // 获取当前NTP时间戳（已同步返回Unix秒，未同步返回millis()/1000）
    uint32_t getCurrentTimestamp() const;
    // [v3.9.26] 获取毫秒级NTP时间戳（用于串口LOG/WS推送/JSON响应等展示面）
    uint64_t getCurrentTimestampMs() const;
    bool isNtpSynced() const { return _isNtpSynced; }  // [FIX] Public NTP sync check

    void _pushWifiIp();
    void syncTime();
    void _testHttpsConnection();

    // [HTTPS-TEST] Setup阶段阻塞式测试 — 定时器启动前调用，不触发看门狗
    bool waitForWifiBlocking(uint32_t timeoutMs = 30000);
    bool testHttpsBlocking();

private:
    bool _tryConnectWifi();
    void _handleNtp();

    BleConfigServer* _bleServer;
    bool _wifiConnected;
    uint32_t _wifiRetryTimer;
    const uint32_t WIFI_RETRY_INTERVAL = 10000;
    bool _eepromCredsTried;
    bool _dhcpWaitDone;
    uint32_t _dhcpWaitStart;
    bool _dhcpGotIp;
    uint32_t _dhcpStableStart;
    bool _bleIpPushPending;
    bool _ntpPending;
    uint32_t _ntpRequestTime;
    uint32_t _lastDisconnectLogMs;

    // [NTP-FIX] NTP 同步守卫：NTP 完成（或超时）后才启动 WS 和传输数据
    uint32_t _ntpWaitStart;       // NTP 等待开始时间
    bool    _ntpWaitDone;          // NTP 完成或超时
    bool    _ntpWaitTimedOut;      // NTP 超时（用相对时间）

    bool _httpsTestDone;         // [HTTPS-TEST] 一次性门禁测通标记

    unsigned long _ntpBaseMillis;
    unsigned long _ntpBaseSeconds;
    bool _isNtpSynced;
    WiFiUDP _ntpUdp;
    byte _ntpPacketBuffer[48];

    WebSocketsServer _wsServer;    // WebSocket 服务器（端口8888）
    bool _wsServerStarted;          // [P0-FIX] WS 服务器延迟到 WiFi 连接成功后启动
    uint32_t _wsServerDelayStart;   // [FIX] 延迟启动计时器（WiFi稳定2秒后）
    bool _wsStreaming;              // 是否有客户端在接收数据流
    uint8_t _currentClient;
    uint32_t _lastWsRxMs;          // 最后一次收到WS消息的时间
    bool _wsFirstDataReceived;     // [v3.9.37] 是否已收到首次应用层数据（区分僵尸连接）
    uint32_t _lastPingMs;
    uint8_t  _wsCooldown;         // [v3.9.35] DISCONNECT后冷却计数，避免WS库堆损坏崩溃
    char _wsJsonBuf[256];          // [FIX] 从224增至256防溢出
    char _cachedIp[16];        // [FIX] 缓存WiFi IP，消除String临时对象
    char _cachedSsid[33];      // [FIX] 缓存WiFi SSID，消除String临时对象

    // [FIX] Single-buffer deferred send - avoid all direct sendTXT() calls
    // Command responses (small JSON): buffered by sendJsonTo(), sent in tick()
    char _sendJsonBuf[512];
    bool _sendJsonPending;
    uint8_t _sendJsonClient;

    // Large payloads (cz_data responses): buffered by sendRawToClient(), sent in tick()
    char _sendRawBuf[512];
    bool _sendRawPending;
    uint16_t _sendRawLen;
    uint8_t _sendRawClient;

    // [FIX] Deferred broadcast buffer - streaming data sent in tick()
    bool _hasDeferredData;
    char _deferredDataBuf[256];
    uint16_t _deferredDataLen;

    void _getTimestamp(uint32_t &sec, uint16_t &ms);
};

#endif
