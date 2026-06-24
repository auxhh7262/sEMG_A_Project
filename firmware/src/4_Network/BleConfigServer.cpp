// BleConfigServer.cpp
#include "BleConfigServer.h"
#include "0_Base/Logger.h"
#include <WiFiS3.h>

// 静态成员初始化
BleConfigServer* BleConfigServer::_instance = nullptr;
BleConfigServer::WiFiInfoCallback_t BleConfigServer::_wifiInfoCb = nullptr;

BleConfigServer::BleConfigServer() 
    : _state(BLE_STATE_DISCONNECTED)
    , _hasNewCredentials(false)
    , _shouldAdvertise(true)
    , _deviceConnected(false)
    , _bleDeviceJustConnected(false)
    , _lastNotifyMs(0)
    , _ipPushedThisConnection(false) {
    strcpy(_currentSSID, "");
    strcpy(_currentPASS, "");
    _instance = this;
}

void BleConfigServer::init() {
    LOG("[BLE] Initializing BLE server...\n");
    if (!BLE.begin()) {
        LOG("[BLE] Init failed!\n");
        return;
    }

    BLE.setDeviceName("sEMG_Monitor");
    BLE.setLocalName("sEMG_0000"); 
    BLE.setAdvertisedServiceUuid("19b10000-e8f2-537e-4f6c-d104768a1214");
    BLE.setAdvertisedService(_bleService);

    _wifiSsidChar.addDescriptor(_wifiSsidDesc);
    _wifiSsidChar.setValue("");
    _bleService.addCharacteristic(_wifiSsidChar);

    _wifiPassChar.addDescriptor(_wifiPassDesc);
    _wifiPassChar.setValue("");
    _bleService.addCharacteristic(_wifiPassChar);

    _ipAddressChar.addDescriptor(_ipAddressDesc);
    _ipAddressChar.setValue("0.0.0.0");
    _bleService.addCharacteristic(_ipAddressChar);

    BLE.addService(_bleService);

    BLE.setEventHandler(BLEConnected, [](BLEDevice device) {
        LOG("[BLE] Device connected: %s\n", device.address().c_str());
        // [P0-FIX] 不再 delay(500)，改为设置标志位，由 tick() 在主循环中安全处理
        // delay() 在 BLE 事件回调中会阻塞主循环，导致 1kHz 中断累积 500+ 采样，
        // 主循环恢复后大量 Flash 写入 + 堆操作可能触发 hardfault
        if (_instance) {
            _instance->_bleDeviceJustConnected = true;
        }
    });
    BLE.setEventHandler(BLEDisconnected, [](BLEDevice device) {
        LOG("[BLE] Device disconnected\n");
    });

    _wifiSsidChar.setEventHandler(BLEWritten, onSsidWritten);
    _wifiPassChar.setEventHandler(BLEWritten, onPassWritten);

    BLE.advertise();
    _shouldAdvertise = true;
    LOG("[BLE] Server init done\n");
}

void BleConfigServer::onSsidWritten(BLEDevice device, BLECharacteristic characteristic) {
    BleConfigServer* instance = getInstance();
    if (!instance) return;
    
    String value = instance->_wifiSsidChar.value();
    LOG("[BLE] SSID received: %s\n", value.c_str());
    strncpy(instance->_currentSSID, value.c_str(), sizeof(instance->_currentSSID) - 1);
    instance->_currentSSID[sizeof(instance->_currentSSID) - 1] = '\0';
}

void BleConfigServer::onPassWritten(BLEDevice device, BLECharacteristic characteristic) {
    BleConfigServer* instance = getInstance();
    if (!instance) return;
    
    String value = instance->_wifiPassChar.value();
    LOG("[BLE] PASS received: %s\n", value.length() > 0 ? "[hidden]" : "[empty]");
    strncpy(instance->_currentPASS, value.c_str(), sizeof(instance->_currentPASS) - 1);
    instance->_currentPASS[sizeof(instance->_currentPASS) - 1] = '\0';
    
    if (strlen(instance->_currentSSID) > 0 && strlen(instance->_currentPASS) > 0) {
        LOG("[BLE] Full WiFi credentials received\n");
        instance->_hasNewCredentials = true;
        instance->_shouldAdvertise = false;
        BLE.stopAdvertise();
    }
}

void BleConfigServer::tick() {
    BLE.poll();
    
    // [P0-FIX] 非阻塞处理 BLE 设备连接：等待 500ms 后推送 WiFi IP
    if (_bleDeviceJustConnected) {
        static uint32_t _bleConnStableTimer = 0;
        if (_bleConnStableTimer == 0) {
            _bleConnStableTimer = millis();
        } else if (millis() - _bleConnStableTimer >= 500) {
            _bleDeviceJustConnected = false;
            _bleConnStableTimer = 0;
            // [P0-FIX] 同一连接只推送一次
            if (!_ipPushedThisConnection) {
                _lastNotifyMs = millis();
                _ipPushedThisConnection = true;
                LOG("[BLE] Device connected, triggering WiFi info push\n");
                triggerWifiInfoCb();
            }
        }
    }
    
    if (_deviceConnected != BLE.connected()) {
        _deviceConnected = BLE.connected();
        _state = _deviceConnected ? BLE_STATE_CONNECTED : BLE_STATE_DISCONNECTED;
        LOG("[BLE] State changed: %s\n", _deviceConnected ? "connected" : "disconnected");
        // [P0-FIX] 设备断开后，重置推送标志，允许下次连接推送
        if (!_deviceConnected) {
            _ipPushedThisConnection = false;
            _lastNotifyMs = 0;
        }
        // [B0-1-fix] 设备断开后，如果需要广播则重启广播
        if (!_deviceConnected && _shouldAdvertise) {
            BLE.advertise();
            LOG("[BLE] Device disconnected, restarting advertising\n");
        }
    }

    // 检测 central 刚订阅 IP 通知（用 static 跟踪状态变化）
    // [P0-FIX] 同一连接只推送一次 + 2 秒冷却
    static bool wasSubscribed = false;
    bool isSubscribed = _ipAddressChar.subscribed();
    if (_deviceConnected && isSubscribed && !wasSubscribed) {
        uint32_t now = millis();
        if (!_ipPushedThisConnection && now - _lastNotifyMs >= 2000) {
            LOG("[BLE] IP notify subscribed, pushing IP (once per connection)...\r\n");
            _lastNotifyMs = now;
            _ipPushedThisConnection = true;
            triggerWifiInfoCb();
        } else {
            LOG("[BLE] IP notify subscribed, but already pushed or cooling down (skip)\r\n");
        }
    }
    wasSubscribed = isSubscribed;
}

bool BleConfigServer::hasNewCredentials() {
    bool result = _hasNewCredentials;
    if (result) {
        LOG("[BLE] New WiFi credentials available: SSID='%s'\n", _currentSSID);
    }
    return result;
}

WifiCredentials_t BleConfigServer::consumeCredentials() {
    WifiCredentials_t creds;
    creds.isValid = false;
    if (_hasNewCredentials) {
        strncpy(creds.ssid, _currentSSID, sizeof(creds.ssid) - 1);
        strncpy(creds.pass, _currentPASS, sizeof(creds.pass) - 1);
        creds.ssid[sizeof(creds.ssid) - 1] = '\0';
        creds.pass[sizeof(creds.pass) - 1] = '\0';
        creds.isValid = true;
        LOG("[BLE] Consuming credentials: SSID='%s'\n", creds.ssid);
        _hasNewCredentials = false;
        memset(_currentSSID, 0, sizeof(_currentSSID));
        memset(_currentPASS, 0, sizeof(_currentPASS));
    }
    return creds;
}

bool BleConfigServer::updateIpAddress(const char* ipJson) {
    if (!_deviceConnected) {
        return false;
    }
    _ipAddressChar.setValue(ipJson);
    // BLE.poll() 在 tick() 中调用，会自动发送通知（如果 central 已订阅）
    if (_ipAddressChar.subscribed()) {
        LOG("[BLE] IP updated, notification sent: %s\n", ipJson);
    } else {
        LOG("[BLE] IP updated (central not subscribed, READ available): %s\n", ipJson);
    }
    return true;
}

// [B0-1-fix] pauseAdvertising: BLE.advertise() 是"开始广播"的动作函数，不是查询
// ArduinoBLE 没有 isAdvertising() API，需自行维护 _shouldAdvertise 标志
void BleConfigServer::pauseAdvertising() {
    BLE.stopAdvertise();
    _shouldAdvertise = false;
}

void BleConfigServer::resumeAdvertising() {
    // [v3.9.39] 先 stop 再 advertise，确保干净重启
    // UNO R4 WiFi 的 ArduinoBLE 库在 BLE.advertise() 已运行时
    // 重复调用可能导致广播停止而非重启（取决于库实现）
    if (_shouldAdvertise) {
        BLE.stopAdvertise();
        delay(10);  // 给硬件 10ms 停止广播
        BLE.advertise();
    }
}

void BleConfigServer::startAdvertising() {
    BLE.advertise();
    _shouldAdvertise = true;
}

void BleConfigServer::_onDeviceConnected() {
    LOG("[BLE] Device connected, triggering WiFi info push\n");
    triggerWifiInfoCb();
}

// [B0-2-fix] getState: 不再误用 BLE.advertise()
// ArduinoBLE 无法查询是否正在广播，只能通过 _shouldAdvertise 标志推断
uint8_t BleConfigServer::getState() {
    if (BLE.connected()) {
        return BLE_STATE_CONNECTED;
    }
    if (_shouldAdvertise) {
        return BLE_STATE_ADVERTISING;
    }
    return BLE_STATE_DISCONNECTED;
}
