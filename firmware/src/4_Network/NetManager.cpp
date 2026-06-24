// NetManager.cpp — Simplified: no heartbeat, no pauseStreaming, CONNECT=send, DISCONNECT=stop
#include "NetManager.h"
#include "BleConfigServer.h"
#include "3_Storage/StorageManager.h"
#include "0_Base/Logger.h"

const char* NTP_SERVER = "ntp.aliyun.com";
const int NTP_PORT = 123;
const int NTP_PACKET_SIZE = 48;

static NetManager* _netMgrInstance = nullptr;

static void onBleDeviceConnected() {
    if (_netMgrInstance) _netMgrInstance->_pushWifiIp();
}

extern StorageManager gStorage;
static void (*_cmdCallback)(uint8_t, const char*) = nullptr;

NetManager::NetManager()
    : _bleServer(nullptr), _wifiConnected(false), _wifiRetryTimer(0),
      _isNtpSynced(false), _wsServer(8888), _wsServerStarted(false), _wsServerDelayStart(0),
      _wsStreaming(false),
      _currentClient(255), _lastWsRxMs(0), _lastPingMs(0), _wsCooldown(0), _ntpBaseMillis(0), _ntpBaseSeconds(0),
      _wsFirstDataReceived(false),
      _hasDeferredData(false), _deferredDataLen(0),
      _sendJsonPending(false), _sendRawPending(false), _sendRawLen(0),
      _eepromCredsTried(false), _dhcpWaitDone(false), _dhcpGotIp(false),
      _bleIpPushPending(false), _ntpPending(false), _ntpRequestTime(0),
      _lastDisconnectLogMs(0), _dhcpStableStart(0),
      _ntpWaitStart(0), _ntpWaitDone(false), _ntpWaitTimedOut(false),
      _httpsTestDone(false) {
    memset(_ntpPacketBuffer, 0, sizeof(_ntpPacketBuffer));
    memset(_wsJsonBuf, 0, sizeof(_wsJsonBuf));
    memset(_cachedIp, 0, sizeof(_cachedIp));
    memset(_cachedSsid, 0, sizeof(_cachedSsid));
    memset(_sendJsonBuf, 0, sizeof(_sendJsonBuf));
    memset(_sendRawBuf, 0, sizeof(_sendRawBuf));
}

void NetManager::init(BleConfigServer* bleServer) {
    _bleServer = bleServer;
    _netMgrInstance = this;
    BleConfigServer::setWifiInfoCallback(onBleDeviceConnected);

    // [FIX] 不在 init() 中启动 WS 服务器——此时 WiFi 未初始化，WebSocket 资源会处于错误状态
    // WS 服务器改为 WiFi 连接稳定 2 秒后在 tick() 中延迟启动
    _wsServerStarted = false;
    _wsServerDelayStart = 0;  // 延迟启动计时器
    LOG("[NET] WS server deferred (will start after WiFi stable)\n");
    _ntpUdp.begin(8889);

    _wsServer.onEvent([this](uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
        switch (type) {
            case WStype_CONNECTED:
                LOG("[WS] CONNECT: client %d (prev=%d)\n", (int)num, (int)_currentClient);
                if (_currentClient != 255 && _currentClient != num) {
                    LOG("[WS] Forcing disconnect of old client %d\n", (int)_currentClient);
                    _wsServer.disconnect(_currentClient);
                }
                _currentClient = num;
                _wsStreaming = true;
                _lastWsRxMs = millis();       // [v3.9.37] 记录连接时间，用于僵尸检测
                _wsFirstDataReceived = false;  // [v3.9.37] 等待首次应用层数据
                break;

            case WStype_DISCONNECTED: {
                // 旧客户端断开：忽略（固件重启后 WebSocket 服务器里残留的旧连接）
                if (num != _currentClient) break;
                LOG("[WS] DISCONNECT: client %d (was streaming for %lu ms)\n", (int)num, (unsigned long)(millis() - _lastWsRxMs));
                _wsStreaming = false;
                _currentClient = 255;
                // [v3.9.35] 清除所有待发送缓冲区，防止后续tick()向已断开的客户端发送数据
                _sendJsonPending = false;
                _sendRawPending = false;
                _hasDeferredData = false;
                break;
            }

            case WStype_PING:
                LOG("[WS] PING from client %d\n", (int)num);
                break;
            case WStype_PONG:
                LOG("[WS] PONG from client %d\n", (int)num);
                _lastWsRxMs = millis();  // [v3.9.40] PONG is a valid sign of life
                break;

            default:
                LOG("[WS] EVENT type=%d from client %d\n", (int)type, (int)num);
                break;
            case WStype_TEXT:
                if (length > 0) {
                    char* json = (char*)payload;
                    _lastWsRxMs = millis();
                    _wsFirstDataReceived = true;  // [v3.9.37] 标记已收到应用层数据
                    // [FIX] 不在ISR回调中LOG，避免PSP栈溢出崩溃

                    // query_cz ACK removed: ProtocolHandler/handleQueryCZ handles response directly
                    // (removing duplicate ACK from NetManager layer)

                    if (_cmdCallback) {
                        _cmdCallback(num, json);
                    }
                }
                break;
        }
    });

    LOG("[NET] NetManager initialized.\n");
}

void NetManager::tick() {
    // [P0-FIX] 每个 tick 只发送一帧 WebSocket 数据，避免 sendTXT + broadcastTXT + loop()
    // 同一 tick 执行导致 WebSocketsServer 库内部状态冲突挂死
    bool justSent = false;

    // Priority 1: Send pending command response (from sendJsonTo buffer)
    if (_sendJsonPending && _currentClient != 255 && _wsServer.clientIsConnected(_currentClient)) {
        _wsServer.sendTXT(_currentClient, _sendJsonBuf, strlen(_sendJsonBuf));
        _sendJsonPending = false;
        _lastWsRxMs = millis();
        LOG("[TX] %s\n", _sendJsonBuf);
        justSent = true;
    } else if (_sendJsonPending) {
        _sendJsonPending = false;
    }

    // Priority 2: Send pending raw data (only if nothing sent above)
    if (!justSent && _sendRawPending && _currentClient != 255 && _wsServer.clientIsConnected(_currentClient)) {
        _wsServer.sendTXT(_currentClient, _sendRawBuf, _sendRawLen);
        _sendRawPending = false;
        _lastWsRxMs = millis();
        justSent = true;
    } else if (!justSent && _sendRawPending) {
        _sendRawPending = false;
    }

    // Priority 3: Send deferred streaming data broadcast (only if nothing sent above)
    if (!justSent && _hasDeferredData && _deferredDataLen > 0 && _currentClient != 255 && _wsServer.clientIsConnected(_currentClient)) {
        _wsServer.broadcastTXT(_deferredDataBuf, _deferredDataLen);
        _hasDeferredData = false;
        _deferredDataLen = 0;
        justSent = true;
    } else if (!justSent && _hasDeferredData && (_currentClient == 255 || !_wsServer.clientIsConnected(_currentClient))) {
        _hasDeferredData = false;
        _deferredDataLen = 0;
    }
    
    if (_bleServer && _bleServer->hasNewCredentials()) {
        WifiCredentials_t creds = _bleServer->consumeCredentials();
        WiFi.disconnect();
        delay(200);
        gStorage.SaveWifiCredentials(&creds);
        WiFi.begin(creds.ssid, creds.pass);
        _wifiConnected = false;
        _dhcpWaitDone = false;
        _dhcpGotIp = false;
        _eepromCredsTried = true;
        _wifiRetryTimer = millis();
        _dhcpStableStart = 0;
        return;
    }

    if (!_wifiConnected) {
        if (WiFi.status() == WL_CONNECTED) {
            if (!_dhcpWaitDone) {
                _dhcpWaitStart = millis();
                _dhcpWaitDone = true;
                _dhcpGotIp = false;
                _dhcpStableStart = 0;
                LOG("[WIFI] WL_CONNECTED, waiting for DHCP...\n");
            }
            // [FIX] 缓存IP为char数组，消除WiFi.localIP().toString()临时String
            IPAddress lip = WiFi.localIP();
            snprintf(_cachedIp, sizeof(_cachedIp), "%d.%d.%d.%d", lip[0], lip[1], lip[2], lip[3]);
            if (strcmp(_cachedIp, "0.0.0.0") != 0) _dhcpGotIp = true;
            if (_dhcpGotIp) {
                if (_dhcpStableStart == 0) _dhcpStableStart = millis();
                if (millis() - _dhcpStableStart >= 500) {
                    _wifiConnected = true;
                    _eepromCredsTried = true;
                    // [FIX] 缓存SSID避免String临时对象
                    const char* ssid = WiFi.SSID();
                    strncpy(_cachedSsid, ssid, sizeof(_cachedSsid) - 1);
                    _cachedSsid[sizeof(_cachedSsid) - 1] = '\0';
                    LOG("[WIFI] Connected & Stable! IP: %s\n", _cachedIp);
                    if (_bleServer) {
                        char ipJson[96];
                        snprintf(ipJson, sizeof(ipJson), "{\"ip\":\"%s\",\"ssid\":\"%s\"}", _cachedIp, WiFi.SSID());
                        _bleServer->updateIpAddress(ipJson);
                        _bleServer->resumeAdvertising();
                        _bleIpPushPending = false;
                        LOG("[WIFI] IP已通知手机，BLE广播已恢复\n");
                    }
                    // [NTP-FIX] WiFi 稳定后立即启动 NTP 同步（后台进行）
                    _ntpRequestTime = millis();
                    _ntpPending = false;
                    LOG("[NTP] WiFi stable, starting NTP sync (background)...\n");
                    // [v3.9.34] WS 服务器立即启动，不再等 NTP 完成
                    if (!_wsServerStarted) {
                        _wsServer.begin();
                        _wsServerStarted = true;
                        LOG("[WS] Server started on port 8888 (immediately after WiFi stable)\n");
                    }
                    _wsServerDelayStart = 0;
                    _dhcpStableStart = 0;
                }
            } else if (millis() - _dhcpWaitStart >= 5000) {
                WiFi.disconnect();
                _wifiConnected = false;
                _dhcpWaitDone = false;
                _dhcpGotIp = false;
                _wifiRetryTimer = millis();
                _dhcpStableStart = 0;
                if (_bleServer) {
                    _bleServer->startAdvertising();
                    LOG("[WIFI] BLE广播已恢复（DHCP超时）\n");
                }
            }
        } else {
            // [FIX] 统一处理所有非连接状态：WL_CONNECT_FAILED, WL_NO_SSID_AVAIL,
            //       WL_IDLE_STATUS, WL_DISCONNECTED, WL_CONNECTION_LOST
            // 之前遗漏了 WL_DISCONNECTED，导致 WiFi 断开后永不重试
            static uint32_t _lastWifiStatusLog = 0;
            uint8_t curStatus = WiFi.status();
            // 每10秒打印一次 WiFi 状态，帮助调试
            if (millis() - _lastWifiStatusLog > 10000) {
                _lastWifiStatusLog = millis();
                // [FIX] 修复溢出错误：使用 int32_t 计算剩余时间
                int32_t retryRemaining = (int32_t)(WIFI_RETRY_INTERVAL - (millis() - _wifiRetryTimer));
                if (retryRemaining < 0) retryRemaining = 0;
                LOG("[WIFI] status=%d (6=DISCONNECTED,0=IDLE,3=CONNECTED), retrying in %ld ms\n",
                    (int)curStatus, (long)retryRemaining);
            }
            if (millis() - _wifiRetryTimer > WIFI_RETRY_INTERVAL) {
                _wifiRetryTimer = millis();
                _tryConnectWifi();
            }
        }
    } else {
        if (WiFi.status() != WL_CONNECTED) {
            LOG("[WIFI] Connection lost!\n");
            _wifiConnected = false;
            _eepromCredsTried = false;
            _wifiRetryTimer = millis();
            if (_bleServer) {
                _bleServer->startAdvertising();
                LOG("[WIFI] BLE广播已恢复（连接断开）\n");
            }
        } else {
            _handleNtp();

            // [NTP-FIX] NTP 同步成功
            if (_isNtpSynced && !_ntpWaitDone) {
                _ntpWaitDone = true;
                _ntpWaitTimedOut = false;
                LOG("[NTP] Sync successful, WS server can start now\n");
            }

            // [NTP-FIX] NTP 超时（10秒），允许启动 WS 服务器（用相对时间）
            if (!_ntpWaitDone && millis() - _ntpWaitStart > 10000) {
                _ntpWaitDone = true;
                _ntpWaitTimedOut = true;
                LOG("[NTP] Sync timeout (10s), WS server starting with relative time\n");
            }

            // NTP 重试逻辑（保留原有）
            if (_ntpPending && (millis() - _ntpRequestTime > 5000)) {
                _ntpPending = false;
                LOG("[NTP] Sync timeout, will retry in 60s\n");
                _ntpRequestTime = millis();
            }
            if (!_isNtpSynced && !_ntpPending && (millis() - _ntpRequestTime > 60000)) {
                syncTime();
            }
        }
    }
    // [v3.9.40] 统一空闲检测：30s 无 WS 活动（PONG/TEXT）→ 断开
    // PONG 已更新 _lastWsRxMs，持续响应的客户端不会被误判为僵尸
    if (_currentClient != 255) {
        uint32_t now = millis();
        if (now - _lastWsRxMs >= 30000 && _lastWsRxMs > 0) {
            LOG("[WS] Idle %ds, disconnecting stale client %d\n", (int)((now - _lastWsRxMs) / 1000), (int)_currentClient);
            _wsServer.disconnect(_currentClient);
            _currentClient = 255;
            _wsStreaming = false;
        }
    }
    // [FIX] WebSocketsServer会在客户端断开后仍尝试handleClientData()，
    // 但我们已在WStype_DISCONNECTED回调中清理_currentClient=255，
    // 所以这里直接loop()即可
    // [NTP-FIX] NTP 完成（或超时）后日志记录
    if (_isNtpSynced && !_ntpWaitDone) {
        _ntpWaitDone = true;
        LOG("[NTP] Sync successful, timestamps will be accurate\n");
    }
    if (!_ntpWaitDone && millis() - _ntpRequestTime > 10000) {
        _ntpWaitDone = true;
        LOG("[NTP] Sync timeout (10s), using relative time for timestamps\n");
    }

    // [P0-FIX] WS 服务器 loop——仅在已启动且 WiFi 连接且本 tick 未发送数据时调用
    // 避免发送和接收在同一 tick 执行导致 WebSocketsServer 库挂死
    if (!justSent && _wsServerStarted && _wifiConnected) {
        // [v3.9.35→v3.9.36] 冷却期：仍调用 loop() 处理新连接，但延迟处理发送
        // 原因：WS 库 clientDisconnect() 中的 String 赋值可能破坏堆元数据，
        // 立即发送数据可能触发堆损坏崩溃
        // 【修复】冷却期必须调用 loop()，否则新连接的握手不会被处理！
        uint8_t prevClient = _currentClient;
        _wsServer.loop();  // 始终调用，处理新连接/握手/断开
        if (prevClient != _currentClient) {
            // 客户端变化（新连接或断开）
            _sendJsonPending = false;
            _sendRawPending = false;
            _hasDeferredData = false;
            if (_currentClient == 255) {
                // 客户端断开，启动冷却期（延迟发送，但不影响 loop）
                _wsCooldown = 10;  // DISCONNECT 后冷却 10 tick (~1秒)
            }
        }
        // 冷却期内跳过数据发送（但 loop 必须调用）
        if (_wsCooldown > 0) {
            _wsCooldown--;
            justSent = true;  // 阻止后续发送
        }
    }
}

bool NetManager::_tryConnectWifi() {
    static uint8_t _retryCnt = 0;
    if (WiFi.status() == WL_CONNECTED) {
        _retryCnt = 0;
        return true;
    }

    if (!_eepromCredsTried) {
        _eepromCredsTried = true;
        WifiCredentials_t savedCreds;
        if (gStorage.LoadWifiCredentials(&savedCreds) && savedCreds.isValid) {
            LOG("[WIFI] Auto-connecting from EEPROM: %s\n", savedCreds.ssid);
            WiFi.begin(savedCreds.ssid, savedCreds.pass);
            LOG("[WIFI] WiFi.begin() returned OK, waiting for connection...\n");
            _dhcpWaitDone = false;
            _dhcpGotIp = false;
            _retryCnt = 0;
            _wifiRetryTimer = millis();
            return true;
        }
        LOG("[WIFI] No saved credentials in EEPROM\n");
    }

    if (_bleServer && _bleServer->hasNewCredentials()) {
        WifiCredentials_t creds = _bleServer->consumeCredentials();
        WiFi.disconnect();
        delay(200);
        gStorage.SaveWifiCredentials(&creds);
        WiFi.begin(creds.ssid, creds.pass);
        _wifiRetryTimer = millis();
        _wifiConnected = false;
        _dhcpWaitDone = false;
        _dhcpGotIp = false;
        _retryCnt = 0;
        return true;
    }

    if (++_retryCnt > 10) {
        _retryCnt = 0;
        LOG("[WIFI] Retry cycle exhausted, resetting counter (will keep retrying every %lu ms)\n", (unsigned long)WIFI_RETRY_INTERVAL);
        if (_bleServer) _bleServer->startAdvertising();
        return false;
    }
    return false;
}

void NetManager::syncTime() {
    if (!_wifiConnected) return;
    // [P0-FIX] WiFi.hostByName() 在 UNO R4 WiFi 上会导致 hardfault
    // 直接使用 NTP 服务器 IP 地址，跳过 DNS 查询
    // ntp.aliyun.com = 203.107.6.88
    IPAddress ntpIp(203, 107, 6, 88);
    _ntpPending = true;
    _ntpRequestTime = millis();
    memset(_ntpPacketBuffer, 0, NTP_PACKET_SIZE);
    _ntpPacketBuffer[0] = 0b11100011;
    _ntpUdp.beginPacket(ntpIp, NTP_PORT);
    _ntpUdp.write(_ntpPacketBuffer, NTP_PACKET_SIZE);
    _ntpUdp.endPacket();
    LOG("[NTP] Request sent to 203.107.6.88\n");
}

void NetManager::_handleNtp() {
    int packetSize = _ntpUdp.parsePacket();
    if (packetSize >= NTP_PACKET_SIZE) {
        _ntpUdp.read(_ntpPacketBuffer, NTP_PACKET_SIZE);
        unsigned long highWord = word(_ntpPacketBuffer[40], _ntpPacketBuffer[41]);
        unsigned long lowWord = word(_ntpPacketBuffer[42], _ntpPacketBuffer[43]);
        unsigned long secsSince1900 = highWord << 16 | lowWord;
        const unsigned long seventyYears = 2208988800UL;
        _ntpBaseSeconds = secsSince1900 - seventyYears;
        _ntpBaseMillis = millis();
        _isNtpSynced = true;
        _ntpPending = false;
        LOG("[NTP] Sync successful. Base time: %lu\n", _ntpBaseSeconds);
        // [FIX] NTP同步后立即更新C区当前块时间戳
        gStorage.CZone_UpdateBlockTimestamp(_ntpBaseSeconds, 0);
    }
}

void NetManager::_getTimestamp(uint32_t &sec, uint16_t &ms) {
    if (_isNtpSynced) {
        uint32_t elapsed = millis() - _ntpBaseMillis;
        sec = _ntpBaseSeconds + (elapsed / 1000);
        ms = elapsed % 1000;
    } else {
        sec = millis() / 1000;
        ms = millis() % 1000;
    }
}

void NetManager::sendData(float rms, float mdf, float fatigue, uint8_t quality, float activation) {
    // [NTP-FIX] NTP 未完成（或超时）前不发送数据
    if (!_ntpWaitDone) return;
    if (!_wsStreaming) return;

    // [P0-FIX] 限频：最多每 1000ms 发送一次（1Hz），大幅降低 WiFi 负载，防止中断冲突崩溃
    static uint32_t _lastSendMs = 0;
    uint32_t now = millis();
    if (now - _lastSendMs < 1000) return;
    _lastSendMs = now;

    uint32_t sec;
    uint16_t ms;
    _getTimestamp(sec, ms);

    int written = snprintf(_wsJsonBuf, sizeof(_wsJsonBuf), "{\"type\":\"data\",\"ts\":%lu%03u,\"rms\":%.3f,\"activation\":%.1f,\"mdf\":%.1f,\"fatigue\":%.1f,\"quality\":%u}", sec, ms, rms, (double)activation, mdf, (double)fatigue, quality);

    if (written < 0 || (size_t)written >= sizeof(_wsJsonBuf)) {
        LOG("[WS] JSON buffer overflow!\n");
        return;
    }

    size_t bufLen = strlen(_wsJsonBuf);
    if (bufLen + 1 < sizeof(_wsJsonBuf)) {
        _wsJsonBuf[bufLen] = '\n';
        _wsJsonBuf[bufLen + 1] = '\0';
        bufLen++;
    }

    // [FIX] Defer broadcast to tick() to avoid WiFi lib crash
    // Queue for deferred broadcast (only one pending; overwrite is OK)
    _hasDeferredData = true;
    _deferredDataLen = bufLen;
    memcpy(_deferredDataBuf, _wsJsonBuf, bufLen);
    // [v3.9.38] FIX: _lastWsRxMs must ONLY be set on RX, NOT in sendData()
    // Previously this line broke zombie detection: 1kHz sendData() kept
    // refreshing _lastWsRxMs, so the "no data in 10s" check never tripped.
    // Zombie clients (TCP connected but app-level WS dead) were never cleaned.
    // _lastWsRxMs is now only updated in WStype_CONNECTED and WStype_TEXT.
}

bool NetManager::isWifiConnected() const { return _wifiConnected; }
bool NetManager::isWsClientConnected() const { return _wsStreaming; }

uint32_t NetManager::getCurrentTimestamp() const {
    if (_isNtpSynced) {
        return _ntpBaseSeconds + (millis() - _ntpBaseMillis) / 1000;
    }
    return millis() / 1000;
}

// [v3.9.26] 毫秒级NTP时间戳 — 用于串口LOG/WS推送/cz_data响应等展示面
// CZone存储仍然用秒级（uint32_t，保持向后兼容），展示面统一用ms
uint64_t NetManager::getCurrentTimestampMs() const {
    if (_isNtpSynced) {
        uint32_t elapsed = millis() - _ntpBaseMillis;
        return (uint64_t)_ntpBaseSeconds * 1000ULL + elapsed;
    }
    return (uint64_t)millis();
}
void NetManager::sendJsonTo(uint8_t clientNum, const char* json) {
    if (!json) return;
    if (strlen(json) > 512) return;
    if (_currentClient == 255 || !_wsServer.clientIsConnected(_currentClient)) return;
    
    // [FIX] Buffer only - actual send happens in tick()
    snprintf(_sendJsonBuf, sizeof(_sendJsonBuf), "%s\n", json);
    _sendJsonClient = clientNum;
    _sendJsonPending = true;
}

// [FIX] Defer WiFi TX to next tick() - queue multiple responses
void NetManager::deferSendJson(uint8_t clientNum, const char* json) {
    // Simple approach: treat deferSendJson the same as sendJsonTo (single buffer)
    // For batch responses (query_cz), callers should accumulate and send once
    sendJsonTo(clientNum, json);
}

// [v3.9.36] Buffer for deferred send - actual send happens in tick()
void NetManager::sendRawToClient(uint8_t clientNum, const char* data, size_t len) {
    if (!data || len == 0) return;
    if (len > sizeof(_sendRawBuf)) {
        LOG("[NET] sendRawToClient: data too large (%d > %d)\n", (int)len, (int)sizeof(_sendRawBuf));
        return;
    }
    if (_currentClient == 255 || !_wsServer.clientIsConnected(_currentClient)) return;
    
    // [FIX] Buffer only - actual send happens in tick()
    memcpy(_sendRawBuf, data, len);
    _sendRawLen = len;
    _sendRawClient = clientNum;
    _sendRawPending = true;
}

void NetManager::setCommandCallback(void (*callback)(uint8_t, const char*)) {
    _cmdCallback = callback;
}

void NetManager::_pushWifiIp() {
    if (!_bleServer) return;
    if (!_wifiConnected) {
        _bleIpPushPending = true;
        return;
    }
    char ipJson[96];
    snprintf(ipJson, sizeof(ipJson), "{\"ip\":\"%s\",\"ssid\":\"%s\"}", _cachedIp, _cachedSsid);
    bool ok = _bleServer->updateIpAddress(ipJson);
    if (ok) LOG("[NET] BLE重连 → 已推送IP: %s\n", _cachedIp);
    else LOG("[NET] BLE重连 → IP推送失败\n");
}

// ============================================================
// [HTTPS-TEST] Web-Cloud 门禁测试 — 仅测 connect() 成败
// ============================================================
void NetManager::_testHttpsConnection() {
    LOG("[HTTPS-TEST] Starting...\n");

    WiFiSSLClient ssl;
    ssl.setTimeout(3000);  // 3秒超时，确保在5秒看门狗内返回
    int ret = ssl.connect("www.example.com", 443);
    LOG("[HTTPS-TEST] connect() = %d (elapsed ~%lums)\n", ret, millis() - _dhcpStableStart);

    if (ret) {
        LOG("[HTTPS-TEST] PASS — SSL handshake OK\n");
        ssl.stop();
    } else {
        LOG("[HTTPS-TEST] FAIL — SSL connect returned %d\n", ret);
    }
}

// ============================================================
// [HTTPS-TEST] Setup阶段阻塞式门禁 — 定时器启动前调用，不触发看门狗
// ============================================================
bool NetManager::waitForWifiBlocking(uint32_t timeoutMs) {
    LOG("[HTTPS-TEST] Blocking WiFi connect (timeout %lu ms)...\n", (unsigned long)timeoutMs);

    WifiCredentials_t savedCreds;
    if (gStorage.LoadWifiCredentials(&savedCreds) && savedCreds.isValid) {
        LOG("[HTTPS-TEST] Using saved credentials: %s\n", savedCreds.ssid);
        WiFi.begin(savedCreds.ssid, savedCreds.pass);
    } else {
        LOG("[HTTPS-TEST] No saved WiFi credentials — cannot test HTTPS\n");
        return false;
    }

    uint32_t start = millis();
    while (millis() - start < timeoutMs) {
        if (WiFi.status() == WL_CONNECTED) {
            IPAddress lip = WiFi.localIP();
            if (lip[0] != 0) {
                // 等待 DHCP 稳定
                delay(500);
                lip = WiFi.localIP();
                snprintf(_cachedIp, sizeof(_cachedIp), "%d.%d.%d.%d", lip[0], lip[1], lip[2], lip[3]);
                snprintf(_cachedSsid, sizeof(_cachedSsid), "%s", WiFi.SSID());
                LOG("[HTTPS-TEST] WiFi connected! IP: %s, SSID: %s\n", _cachedIp, _cachedSsid);
                _wifiConnected = true;
                return true;
            }
        }
        delay(500);
    }

    LOG("[HTTPS-TEST] WiFi connect timeout after %lu ms\n", (unsigned long)timeoutMs);
    return false;
}

bool NetManager::testHttpsBlocking() {
    if (!_wifiConnected) {
        LOG("[HTTPS-TEST] SKIP — WiFi not connected\n");
        return false;
    }

    LOG("[HTTPS-TEST] SSL connect to www.example.com:443 ...\n");

    WiFiSSLClient ssl;
    ssl.setTimeout(5000);
    uint32_t t0 = millis();
    int ret = ssl.connect("www.example.com", 443);
    uint32_t elapsed = millis() - t0;

    LOG("[HTTPS-TEST] connect() = %d (elapsed %lu ms)\n", ret, (unsigned long)elapsed);

    if (ret) {
        LOG("[HTTPS-TEST] ✅ PASS — SSL handshake OK in %lu ms\n", (unsigned long)elapsed);
        ssl.stop();
        return true;
    } else {
        LOG("[HTTPS-TEST] ❌ FAIL — SSL connect returned %d after %lu ms\n", ret, (unsigned long)elapsed);
        return false;
    }
}
