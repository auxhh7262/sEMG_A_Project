// pages/network/index.js - 网络配置页：WiFi配网内联
const ble = require('../../utils/bleClient.js')
const wifiClient = require('../../utils/wifiClient.js')
const app = getApp()
const { log, warn, error } = require('../../utils/logger')

const STEP = { IDLE: 0, SCANNING: 1, CONNECTED: 2, SENDING: 3, WAITING_IP: 4, SUCCESS: 5, FAILED: 6 }
const STATUS_TEXT = { [STEP.IDLE]: '未连接', [STEP.SCANNING]: '扫描中', [STEP.CONNECTED]: '已连接', [STEP.SENDING]: '发送中', [STEP.WAITING_IP]: '等待响应', [STEP.SUCCESS]: '配网成功', [STEP.FAILED]: '配网失败' }
const STATUS_CLASS = { [STEP.IDLE]: 'idle', [STEP.SCANNING]: 'scanning', [STEP.CONNECTED]: 'connected', [STEP.SENDING]: 'sending', [STEP.WAITING_IP]: 'waiting', [STEP.SUCCESS]: 'success', [STEP.FAILED]: 'error' }

Page({
  data: {
    currentStep: STEP.IDLE, statusText: STATUS_TEXT[STEP.IDLE], statusClass: STATUS_CLASS[STEP.IDLE],
    deviceName: '', deviceRssi: null, bleConnected: false, deviceIp: '',
    ssid: '', password: '', showPassword: false, isScanning: false, canSend: false,
    deviceSsid: '', phoneWifiSsid: '', resultType: '', resultMessage: ''
  },

  onLoad() {
    const cachedSsid = wx.getStorageSync('device_ssid'); if (cachedSsid) { this.setData({ deviceSsid: cachedSsid }) }
    this._getPhoneNetworkInfo()
    // BLE IP 回调由 app.js 统一管理，network.js 只做 UI 展示
    ble.onIpReceived((ip, port, deviceData) => {
      this._clearIpTimeout();
      log('[网络] 收到设备IP:', ip, 'SSID:', deviceData?.ssid)
      if (!ip || ip === '0.0.0.0') { warn('[网络] 收到无效IP:', ip); return }
      const ssid = deviceData?.ssid || ''; this.setData({ deviceIp: ip, deviceSsid: ssid })
      if (this.data.currentStep === STEP.SUCCESS) { log('[网络] 设备IP已更新（BLE重连）:', ip) } 
      else { this._setStep(STEP.SUCCESS); this._showResult('success', '配网成功！设备 IP: ' + ip) }
      // 存储 + TCP连接由 app.js 统一管理，network.js 不再主动操作
    })
  },

  onShow() {
    const prevMode = app.setDataMode('idle'); if (prevMode !== 'idle') { log('[网络] 数据模式切换:', prevMode, '→ idle'); }
    const cachedIp = wx.getStorageSync('device_ip'); const isValidIp = cachedIp && cachedIp !== '0.0.0.0' && cachedIp !== ''
    if (cachedIp && !isValidIp) { warn('[网络] 清除无效缓存IP:', cachedIp); wx.removeStorageSync('device_ip') }

    if (isValidIp) {
      log('[网络] 有缓存IP:', cachedIp, '，展示连接状态')
      const cachedSsid = wx.getStorageSync('device_ssid') || ''
      this.setData({ deviceIp: cachedIp, deviceSsid: cachedSsid, currentStep: STEP.SUCCESS, statusText: STATUS_TEXT[STEP.SUCCESS], statusClass: STATUS_CLASS[STEP.SUCCESS], bleConnected: false })
      this._getPhoneNetworkInfo()
      // TCP连接由 app.js 统一管理，network.js 只展示状态，不主动连接
    } else {
      const activeSteps = [STEP.SCANNING, STEP.CONNECTED, STEP.SENDING, STEP.WAITING_IP]
      if (activeSteps.includes(this.data.currentStep)) { log('[网络] 配网流程进行中') } 
      else { log('[网络] 无缓存IP，等待用户手动配网'); this._setStep(STEP.IDLE) }
      this._getPhoneNetworkInfo()
    }
  },

  onUnload() { this._cleanup() },
  _startConnectionMonitor() { if (this._connectionTimer) return; this._connectionTimer = setInterval(() => { if (!ble.isConnected()) { this.setData({ bleConnected: false }); clearInterval(this._connectionTimer); this._connectionTimer = null } }, 2000) },
  _cleanup() { if (this._connectionTimer) { clearInterval(this._connectionTimer); this._connectionTimer = null } this._clearIpTimeout() },
  _startIpTimeout() { this._clearIpTimeout(); this._ipTimeout = setTimeout(() => { if (this.data.currentStep !== STEP.WAITING_IP) return; log('[网络] WAITING_IP 超时(30s)，WiFi连接可能失败'); this._setStep(STEP.FAILED); this._showResult('error', '设备WiFi连接超时，请检查密码是否正确或信号是否正常') }, 30000) },
  _clearIpTimeout() { if (this._ipTimeout) { clearTimeout(this._ipTimeout); this._ipTimeout = null } },
  onStartScan() { if (this.data.isScanning || this.data.bleConnected) return; this._setStep(STEP.SCANNING); this.setData({ isScanning: true }); ble.scanAndConnect('sEMG_').then(device => { this._setStep(STEP.CONNECTED); this.setData({ bleConnected: true, deviceName: device.name || '', deviceRssi: device.RSSI || null, isScanning: false }); this._updateCanSend(); this._startConnectionMonitor() }).catch(err => { error('[网络] BLE连接失败:', err); try { ble.close() } catch (e) {}; this._setStep(STEP.FAILED); this.setData({ isScanning: false }); this._showResult('error', '扫描失败: ' + this._getErrorMsg(err)) }) },
  onSsidInput(e) { this.setData({ ssid: e.detail.value }); this._updateCanSend() },
  onPasswordInput(e) { this.setData({ password: e.detail.value }); this._updateCanSend() },
  onTogglePassword() { this.setData({ showPassword: !this.data.showPassword }) },
  async onSendCredentials() { if (!this.data.canSend) return; const { ssid, password } = this.data; if (!ssid) { this._showResult('error', '请输入 WiFi 名称'); return } if (!password) { this._showResult('error', '请输入 WiFi 密码'); return } this._setStep(STEP.SENDING); try { await ble.sendWifiConfig(ssid, password); wx.setStorageSync('device_ssid', ssid); this.setData({ deviceSsid: ssid }); this._setStep(STEP.WAITING_IP); this._startIpTimeout(); this._showResult('success', '凭证已发送，等待设备连接WiFi...') } catch (err) { this._clearIpTimeout(); this._setStep(STEP.FAILED); this._showResult('error', '发送失败: ' + this._getErrorMsg(err)) } },
  async onRefreshIp() {
    this._showResult('success', '正在刷新设备IP...');
    
    if (ble.isConnected()) {
      this._showResult('success', 'BLE已连接，正在获取IP...');
      ble.readCharacteristicValue();
      this.setData({ bleConnected: true });
      this._startConnectionMonitor();
      return;
    }
    
    this.onStartScan();
  },
  onReset() { this._cleanup(); this._clearIpTimeout(); try { ble.close() } catch (e) {} this.setData({ currentStep: STEP.IDLE, statusText: STATUS_TEXT[STEP.IDLE], statusClass: STATUS_CLASS[STEP.IDLE], deviceName: '', deviceRssi: null, bleConnected: false, deviceIp: '', ssid: '', password: '', isScanning: false, canSend: false, resultType: '', resultMessage: '' }); wx.removeStorageSync('device_ip'); wx.removeStorageSync('device_port'); wx.removeStorageSync('device_ssid'); wx.removeStorageSync('config_step') },
  _setStep(step) { this.setData({ currentStep: step, statusText: STATUS_TEXT[step] || '', statusClass: STATUS_CLASS[step] || 'idle' }); wx.setStorageSync('config_step', step) },
  _updateCanSend() { const canSend = this.data.bleConnected && !!this.data.ssid && !!this.data.password; this.setData({ canSend }) },
  _showResult(type, message) { this.setData({ resultType: type, resultMessage: message }); if (type === 'success' || type === 'error') { setTimeout(() => { if (this.data.resultMessage === message) { this.setData({ resultMessage: '' }) } }, 4000) } },
  _getPhoneNetworkInfo() { wx.startWifi({ success: () => { this._doGetPhoneWifi() }, fail: () => { this._doGetPhoneWifi() } }) },
  _doGetPhoneWifi() { wx.getConnectedWifi({ success: (res) => { const ssid = res.wifi.SSID || ''; this.setData({ phoneWifiSsid: ssid }); if (ssid && !this.data.ssid) { this.setData({ ssid }); this._updateCanSend() } }, fail: (err) => { const msg = err.errMsg || ''; if (msg.includes('GPS') || msg.includes('location') || msg.includes('定位')) { wx.showToast({ title: '请开启手机定位', icon: 'none', duration: 3000 }) } this.setData({ phoneWifiSsid: '' }) } }) },
  _getErrorMsg(err) { if (!err) return '未知错误'; if (typeof err === 'string') return err; if (err.message) return err.message; if (err.errMsg) return err.errMsg; return JSON.stringify(err) }
})
