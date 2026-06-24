// bleClient.js
// 版本: 2.3.0
// 【关键修复v2.3】适配固件精简版IP推送，兼容原有格式，增强粘包防截断
// 【关键修复v2.2】_connectGATT + scanAndConnect 保留 device.name 和 device.RSSI
// 【关键修复v2.1】BLE IP通知解析：兼容两种格式 {status:"ok",ip:"..."} 和 {ip:"...",deviceId:"sEMG"}
// 【关键修复v2.0】对齐 BleConfigServer.cpp 分段特征值逻辑

const ble = {
  _serviceId: '19b10000-e8f2-537e-4f6c-d104768a1214',
  _writeCharId: '19b10001-e8f2-537e-4f6c-d104768a1214', // SSID 专属 UUID
  _passCharId: '19b10004-e8f2-537e-4f6c-d104768a1214', // 【新增】Password 专属 UUID
  _notifyCharId: '19b10003-e8f2-537e-4f6c-d104768a1214',
  _ipListeners: [],
  _isListening: false,
  _deviceId: null,
  _connected: false,
  _bleBuffer: '',
  _reconnectTimer: null,
  _maxBufferSize: 512,
  _retryCount: 0,
  _maxRetries: 5,
  _bufferTimer: null,
  _lastDataTime: 0,
  _actualNotifyCharId: null,
  _actualWriteCharId: null,
  _dataComplete: false,
  _expectedJsonLength: 0,
  _packetCount: 0,
  _lastPacketContent: '',
  _duplicateCount: 0,
  _maxDuplicates: 3,
  _debugLogs: [],
  _maxDebugLogs: 100,
  _lastDebugTime: 0,
  _debugInterval: 2000,

  _addDebugLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [BLE] ${message}`;
    this._debugLogs.push(logEntry);
    if (this._debugLogs.length > this._maxDebugLogs) {
      this._debugLogs.shift();
    }
    if (message.includes('no such file or directory') || message.includes('not node js file system') || message.includes('wxfile://') || message.includes('backgroundfetch privacy fail') || message.includes('[wxapplib]]')) {
      return;
    }
    console.log(logEntry);
  },

  async scanAndConnect(devicePrefix = 'sEMG_', maxRetries = 2) {
    this._addDebugLog(`开始扫描设备，前缀: ${devicePrefix}`);
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        this._addDebugLog(`BLE连接重试 ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 1000)); // 重试间隔1秒
      }
      try {
        const device = await this._scanOnce(devicePrefix);
        const result = await this._connectGATT(device);
        return result;
      } catch (err) {
        lastError = err;
        this._addDebugLog(`BLE尝试 ${attempt + 1} 失败: ${err.message || err}`);
        // 扫描失败不重试（没设备），连接失败才重试
        if (err.message === 'BLE_SCAN_TIMEOUT' || err.errCode === 10001) throw err;
        try { this.close(); } catch (e) {}
      }
    }
    throw lastError || new Error('BLE_CONNECT_FAILED');
  },

  async _scanOnce(devicePrefix = 'sEMG_') {
    this._resetState();
    return new Promise((resolve, reject) => {
      let foundDevice = null;
      let scanTimer = null;
      wx.onBluetoothDeviceFound((res) => {
        res.devices.forEach(device => {
          if (device.name && device.name.startsWith(devicePrefix)) {
            this._addDebugLog(`发现目标设备: ${device.name} RSSI: ${device.RSSI}`);
            if (!foundDevice || (device.RSSI > (foundDevice.RSSI || -100))) {
              foundDevice = device;
            }
          }
        });
      });
      wx.openBluetoothAdapter({
        success: () => {
          this._addDebugLog('蓝牙适配器打开成功，开始扫描...');
          wx.startBluetoothDevicesDiscovery({
            allowDuplicatesKey: false,
            services: [],
            interval: 0,
            powerLevel: 'high'
          });
          scanTimer = setTimeout(() => {
            if (!foundDevice) {
              clearInterval(checkInterval);
              wx.stopBluetoothDevicesDiscovery();
              this._addDebugLog('❌ 扫描超时，未找到目标设备');
              reject(new Error('BLE_SCAN_TIMEOUT'));
            }
          }, 15000);
          const checkInterval = setInterval(() => {
            if (foundDevice) {
              clearInterval(checkInterval);
              clearTimeout(scanTimer);
              wx.stopBluetoothDevicesDiscovery();
              this._deviceName = foundDevice.name;
              this._deviceRssi = foundDevice.RSSI;
              this._addDebugLog(`🎉 选择设备: ${foundDevice.name}`);
              resolve(foundDevice);
            }
          }, 2000);
        },
        fail: (err) => {
          this._addDebugLog(`❌ 打开蓝牙适配器失败: ${JSON.stringify(err)}`);
          clearTimeout(scanTimer);
          reject(err);
        }
      });
    });
  },

  _resetState() {
    this._bleBuffer = '';
    this._retryCount = 0;
    this._dataComplete = false;
    this._packetCount = 0;
    this._duplicateCount = 0;
    this._lastPacketContent = '';
    this._expectedJsonLength = 0;
    this._deviceName = null;
    this._deviceRssi = 0;
    if (this._bufferTimer) {
      clearTimeout(this._bufferTimer);
      this._bufferTimer = null;
    }
  },

  async _connectGATT(device) {
    this._addDebugLog(`开始连接设备: ${device.deviceId}`);
    this._deviceId = device.deviceId;
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId: device.deviceId,
        timeout: 8000,
        success: () => {
          this._addDebugLog('蓝牙连接成功');
          this._connected = true;
          this._setupConnectionMonitor();
          setTimeout(async () => {
            try {
              await this._setupBLE();
              resolve(device);
            } catch (err) {
              this._addDebugLog(`_setupBLE failed, cleaning up: ${JSON.stringify(err)}`);
              try { wx.closeBLEConnection({ deviceId: device.deviceId }); } catch (e) {}
              this._connected = false;
              this._deviceId = null;
              reject(err);
            }
          }, 500);
        },
        fail: (err) => {
          this._addDebugLog(`❌ 连接失败: ${JSON.stringify(err)}`);
          this._connected = false;
          reject(err);
        }
      });
    });
  },

  async _setupBLE() {
    this._addDebugLog('开始设置BLE服务...');
    this._resetState();
    await this._getServices();
    try {
      await this._negotiateMTU();
    } catch (err) {
      this._addDebugLog('MTU协商失败，使用默认20字节');
    }
    await this._getCharacteristics();
    this._addDebugLog('✅ BLE服务设置完成');
  },

  _getServices() {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId: this._deviceId,
        success: (res) => {
          const targetService = res.services.find(s => s.uuid.toLowerCase() === this._serviceId.toLowerCase());
          if (targetService) {
            this._addDebugLog(`找到目标服务: ${targetService.uuid}`);
            resolve(res.services);
          } else {
            this._addDebugLog(`❌ 未找到目标服务`);
            reject(new Error('SERVICE_NOT_FOUND'));
          }
        },
        fail: reject
      });
    });
  },

  _negotiateMTU() {
    return new Promise((resolve, reject) => {
      if (wx.setBLEMTU) {
        wx.setBLEMTU({
          deviceId: this._deviceId,
          mtu: 247,
          success: (res) => {
            this._addDebugLog(`MTU协商结果: ${res.mtu}`);
            resolve(res.mtu);
          },
          fail: () => { resolve(20); }
        });
      } else {
        resolve(20);
      }
    });
  },

  _getCharacteristics() {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId: this._deviceId,
        serviceId: this._serviceId,
        success: (res) => {
          this._addDebugLog(`特征值列表: ${JSON.stringify(res.characteristics.map(c => ({ uuid: c.uuid, properties: c.properties })))}`);
          const writeChar = res.characteristics.find(c => c.uuid.toLowerCase() === this._writeCharId.toLowerCase() && c.properties.write);
          const notifyChar = res.characteristics.find(c => c.uuid.toLowerCase() === this._notifyCharId.toLowerCase() && c.properties.notify);
          // 【关键新增】提前校验 Password 特征值是否可写，防止发送时静默失败
          const passChar = res.characteristics.find(c => c.uuid.toLowerCase() === this._passCharId.toLowerCase() && c.properties.write);
          if (!writeChar || !notifyChar || !passChar) {
            this._addDebugLog(`❌ 缺少必需特征值: write=${!!writeChar}, pass=${!!passChar}, notify=${!!notifyChar}`);
            reject(new Error('CHARACTERISTIC_MISSING'));
            return;
          }
          this._actualNotifyCharId = notifyChar.uuid;
          this._actualWriteCharId = writeChar.uuid;
          // this._actualPassCharId = passChar.uuid; // 因为发送时直接用的常量 this._passCharId，所以这行其实不用存，但逻辑上找到了
          this._addDebugLog('✅ 所有必需特征值已找到 (包含密码特征值)');
          this.ensureIpListenerBinded();
          resolve();
        },
        fail: reject
      });
    });
  },

  ensureIpListenerBinded() {
    if (this._isListening) return;
    this._isListening = true;
    this._resetState();
    wx.onBLECharacteristicValueChange((res) => {
      const now = Date.now();
      if (now - this._lastDebugTime < this._debugInterval) return;
      this._lastDebugTime = now;
      const receivedUuid = res.characteristicId.toLowerCase();
      const expectedUuid = (this._actualNotifyCharId || this._notifyCharId).toLowerCase();
      if (receivedUuid !== expectedUuid) return;
      this._lastDataTime = Date.now();
      const chunk = this._arrayBufferToString(res.value);
      if (chunk === this._lastPacketContent) {
        this._duplicateCount++;
        if (this._duplicateCount >= this._maxDuplicates) {
          this._tryParseBuffer();
          return;
        }
      } else {
        this._duplicateCount = 0;
        this._lastPacketContent = chunk;
      }
      this._bleBuffer += chunk;
      this._packetCount++;
      if (this._bleBuffer.length > this._maxBufferSize) {
        this._bleBuffer = '';
        this._packetCount = 0;
        return;
      }
      if (this._bufferTimer) clearTimeout(this._bufferTimer);
      this._bufferTimer = setTimeout(() => this._tryParseBuffer(), 300);
      if (chunk.includes('}') || this._bleBuffer.includes('}')) this._tryParseBuffer();
    });
    wx.notifyBLECharacteristicValueChange({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._actualNotifyCharId || this._notifyCharId,
      state: true,
      success: () => {
        this._addDebugLog('✅ Notify订阅成功');
        setTimeout(() => this._readCharacteristicValue(), 500);
      },
      fail: (err) => {
        this._addDebugLog(`❌ 开启Notify失败: ${JSON.stringify(err)}`);
        this._isListening = false;
      }
    });
  },

  _tryParseBuffer() {
    if (!this._bleBuffer || this._bleBuffer.length === 0) {
      if (this._retryCount < this._maxRetries) {
        this._retryCount++;
        setTimeout(() => this._readCharacteristicValue(), 500);
      }
      return;
    }
    if (this._bufferTimer) {
      clearTimeout(this._bufferTimer);
      this._bufferTimer = null;
    }
    if (this._tryParseCompleteJson()) return;
    if (this._tryExtractJsonFragments()) return;
    // [REVIEW-FIX] 优化：只有缓冲区长时间无新数据且不完整时才走正则提取兜底
    if (this._duplicateCount >= 2) {
      if (this._tryExtractFromDuplicates()) return;
    }
    if (this._retryCount < this._maxRetries) {
      this._retryCount++;
      setTimeout(() => this._readCharacteristicValue(), 500);
    } else {
      this._attemptExtractIP();
    }
  },

  _tryParseCompleteJson() {
    const start = this._bleBuffer.indexOf('{'), end = this._bleBuffer.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return false;
    try {
      const data = JSON.parse(this._bleBuffer.substring(start, end + 1));
      // [REVIEW-FIX] 兼容精简版 {ip:"..."} 和原版 {deviceId:"sEMG", ip:"..."}
      if ((data.status === 'ok' || data.deviceId === 'sEMG' || data.ip) && data.ip) {
        this._handleValidIP(data.ip, data.port || 8888, data);
        this._bleBuffer = this._bleBuffer.substring(end + 1);
        return true;
      }
      this._bleBuffer = this._bleBuffer.substring(end + 1);
      return false;
    } catch (e) {
      return false;
    }
  },

  _tryExtractJsonFragments() {
    const starts = [], ends = [];
    for (let i = 0; i < this._bleBuffer.length; i++) {
      if (this._bleBuffer[i] === '{') starts.push(i);
      if (this._bleBuffer[i] === '}') ends.push(i);
    }
    for (let i = starts.length - 1; i >= 0; i--) {
      for (let j = ends.length - 1; j >= 0; j--) {
        if (ends[j] > starts[i]) {
          try {
            const data = JSON.parse(this._bleBuffer.substring(starts[i], ends[j] + 1));
            // [REVIEW-FIX] 兼容精简版
            if ((data.status === 'ok' || data.deviceId === 'sEMG' || data.ip) && data.ip) {
              this._handleValidIP(data.ip, data.port || 8888, data);
              return true;
            }
          } catch (e) {}
        }
      }
    }
    return false;
  },

  _tryExtractFromDuplicates() {
    if (this._duplicateCount >= 2) {
      const match = this._bleBuffer.match(/"ip"\s*:\s*"([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})"/);
      if (match && match[1]) {
        const idM = this._bleBuffer.match(/"id"\s*:\s*"([^"]+)"/);
        this._handleValidIP(match[1], 8888, { status: 'ok', id: idM ? idM[1] : 'unknown', ip: match[1], port: 8888 });
        return true;
      }
    }
    return false;
  },

  _handleValidIP(ip, port, deviceData) {
    this._addDebugLog(`✅ 成功获取设备IP: ${ip} 端口: ${port}`);
    this._dataComplete = true;
    this._retryCount = 0;
    this._duplicateCount = 0;
    this._ipListeners.forEach(fn => {
      try { fn(ip, port, deviceData); } catch (e) {}
    });
  },

  _attemptExtractIP() {
    const match = this._bleBuffer.match(/"ip"\s*:\s*"([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})"/);
    if (match && match[1]) {
      const idM = this._bleBuffer.match(/"id"\s*:\s*"([^"]+)"/);
      this._handleValidIP(match[1], 8888, { status: 'ok', id: idM ? idM[1] : 'unknown', ip: match[1], port: 8888 });
    } else {
      this._resetState();
    }
  },

  _readCharacteristicValue() {
    if (!this._deviceId || !this._connected) return;
    wx.readBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._actualNotifyCharId || this._notifyCharId,
      success: () => {},
      fail: () => {}
    });
  },

  _setupConnectionMonitor() {
    wx.onBLEConnectionStateChange((res) => {
      this._connected = res.connected;
      if (!res.connected) {
        this._isListening = false;
        this._resetState();
        if (this._reconnectTimer) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
        }
      }
    });
  },

  onIpReceived(listener) {
    if (typeof listener === 'function' && !this._ipListeners.includes(listener)) {
      this._ipListeners.push(listener);
    }
  },

  offIpReceived(listener) {
    if (!listener) {
      this._ipListeners = [];
    } else {
      const idx = this._ipListeners.indexOf(listener);
      if (idx !== -1) this._ipListeners.splice(idx, 1);
    }
  },

  // 【关键重构】严格对齐 BleConfigServer.cpp 的分段特征值逻辑
  async sendWifiConfig(ssid, password) {
    if (!this._deviceId || !this._connected) throw new Error('蓝牙未连接');
    this._addDebugLog(`准备分段发送: SSID=${ssid}`);
    const ssidBuffer = this._stringToBuffer(ssid);
    const passBuffer = this._stringToBuffer(password);
    return new Promise((resolve, reject) => {
      // 第一步：向 19b10001 写入 SSID
      wx.writeBLECharacteristicValue({
        deviceId: this._deviceId,
        serviceId: this._serviceId,
        characteristicId: this._actualWriteCharId || this._writeCharId, // 19b10001
        value: ssidBuffer,
        success: () => {
          this._addDebugLog('✅ SSID 写入成功');
          // 第二步：延时 150ms 后向 19b10004 写入 Password
          setTimeout(() => {
            wx.writeBLECharacteristicValue({
              deviceId: this._deviceId,
              serviceId: this._serviceId,
              characteristicId: this._passCharId, // 19b10004
              value: passBuffer,
              success: () => {
                this._addDebugLog('✅ Password 写入成功，等待设备端回调');
                resolve();
              },
              fail: (err) => {
                this._addDebugLog(`❌ Password 写入失败: ${JSON.stringify(err)}`);
                reject(err);
              }
            });
          }, 150);
        },
        fail: (err) => {
          this._addDebugLog(`❌ SSID 写入失败: ${JSON.stringify(err)}`);
          reject(err);
        }
      });
    });
  },

  isConnected() { return this._connected; },
  getDeviceId() { return this._deviceId; },
  getDeviceName() { return this._deviceName || ''; },
  getDeviceRssi() { return this._deviceRssi || 0; },
  readCharacteristicValue() { return this._readCharacteristicValue(); },
  _deviceName: null,

  close() {
    if (this._bufferTimer) clearTimeout(this._bufferTimer);
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._deviceId) {
      try { wx.closeBLEConnection({ deviceId: this._deviceId }); } catch (e) {}
    }
    this._deviceId = null;
    this._connected = false;
    this._isListening = false;
    // Note: _ipListeners are intentionally preserved across close()/reconnect
    // so app.js global onIpReceived callback survives network.js refresh scans
    this._resetState();
    this._actualNotifyCharId = null;
    this._actualWriteCharId = null;
    try { wx.closeBluetoothAdapter(); } catch (e) {}
  },

  _arrayBufferToString(buffer) {
    if (!buffer || buffer.byteLength === 0) return '';
    try {
      const u8 = new Uint8Array(buffer);
      let s = '';
      for (let i = 0; i < u8.length; i++) {
        if (u8[i] >= 32 && u8[i] <= 126) s += String.fromCharCode(u8[i]);
      }
      return s;
    } catch (e) {
      return '';
    }
  },

  _stringToBuffer(str) {
    const buf = new ArrayBuffer(str.length);
    const dv = new DataView(buf);
    for (let i = 0; i < str.length; i++) dv.setUint8(i, str.charCodeAt(i));
    return buf;
  }
};

module.exports = ble;
