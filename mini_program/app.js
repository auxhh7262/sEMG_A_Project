// app.js
const bleClient = require('./utils/bleClient')
const wifiClient = require('./utils/wifiClient')

/* ================= 日志配置 ================= */
const LOG_ENABLED = true
const LOG_SERVER_URL = 'http://192.168.137.1:9876/log'
const LOG_BATCH_SIZE = 10
const LOG_BATCH_INTERVAL = 500
let _logBuffer = []
let _logTimer = null

/* ================= 网络日志 ================= */
function _flushLog() {
  if (_logBuffer.length === 0) return
  const batch = _logBuffer.splice(0, LOG_BATCH_SIZE)
  wx.request({ url: LOG_SERVER_URL, method: 'POST', header: { 'content-type': 'application/json' }, data: { logs: batch }, success(res) { console.log('[LogForward] 发送成功', batch.length, '条, status=', res.statusCode) }, fail(err) { console.error('[LogForward] 发送失败', err.errMsg) } })
}
function _forwardLog(level, args) {
  if (!LOG_ENABLED) return;
  const preview = args[0] ? String(args[0]) : ''
  if (preview.startsWith('[LogForward]')) return
  const msg = args.map(v => { if (v == null) return 'null'; if (typeof v === 'object') { try { return JSON.stringify(v) } catch { return String(v) } } return String(v) }).join(' ')
  _logBuffer.push({ level, msg, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) })
  if (_logBuffer.length >= LOG_BATCH_SIZE) { _flushLog() } else if (!_logTimer) { _logTimer = setTimeout(() => { _logTimer = null; _flushLog() }, LOG_BATCH_INTERVAL) }
}

/* ================= App ================= */
App({
  dataMode: 'idle',
  _lastConnectAttempt: 0,  // 防抖用
  _reconnectStart: 0,    // 重连开始时间（毫秒）
  _connectGen: 0,         // [v10.5] 连接生成计数器，防止过期BLE超时闭包
  
  onLaunch() {
    const _origLog = console.log; const _origWarn = console.warn; const _origError = console.error
    console.log = (...args) => { _origLog.apply(console, args); _forwardLog('log', args) }
    console.warn = (...args) => { _origWarn.apply(console, args); _forwardLog('warn', args) }
    console.error = (...args) => { _origError.apply(console, args); _forwardLog('error', args) }
    _origLog('[App] 小程序启动')
    // [v10.5] 不再从 onLaunch 调用 _connectDevice() — onShow 会统一处理
    // onLaunch 只做日志初始化、监听器注册

    wx.request({ url: LOG_SERVER_URL, method: 'POST', header: { 'content-type': 'application/json' }, data: { logs: [{ level: 'log', msg: '[PING] 真机日志连通性测试', time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) }] }, success(res) { _origLog('[PING] 成功 status=' + res.statusCode) }, fail(err) { _origLog('[PING] 失败 ' + err.errMsg) } })

    bleClient.onIpReceived((ip, port, deviceData) => {
      console.log('[App] 收到设备IP:', ip, port)
      if (!ip || ip === '0.0.0.0') { console.log('[App] 无效IP，不缓存'); return }
      const oldIp = wx.getStorageSync('device_ip')
      wx.setStorageSync('device_ip', ip); wx.setStorageSync('device_port', port || 8888)
      const needReconnect = (ip !== oldIp) || (!wifiClient.isConnected() && !wifiClient.isConnecting())
      if (needReconnect) {
        console.log('[App] IP变更或TCP断开，用HTTP预热网络后再连WS:', ip)
        this._netWarmupThenConnect(ip, port || 8888)
      }
    })

    wifiClient.onStatusChange((status, message) => {
      if (status === 'disconnected') {
        const pages = getCurrentPages(); const curPage = pages[pages.length - 1]; const curRoute = curPage ? curPage.route : ''
        if (curRoute && curRoute.includes('network')) return
        const wasConnected = this._lastTcpStatus === 'connected'
        if (wasConnected) { wx.showToast({ title: '设备连接断开', icon: 'none', duration: 3000 }) }
      }
      if (status === 'reconnect_failed') {
        // [v10.6] 防止death loop: reconnect_failed→BLE读IP→disconnect/connect(同IP)→NoRoute→reconnect_failed...
        // 如果30s内已触发过，说明IP没变、路由仍不可用，跳过BLE重试，等待下一次onShow
        const now = Date.now()
        if (now - this._lastReconnectFailedTs < 30000) {
          console.log('[App] reconnect_failed 过于频繁(<30s)，IP未变路由仍不可用，跳过BLE重试，等待onShow触发')
          return
        }
        this._lastReconnectFailedTs = now
        wx.showToast({ title: 'IP可能变更，正在通过蓝牙同步...', icon: 'none', duration: 3000 })
        if (!bleClient.isConnected()) { console.log('[App] TCP彻底失败，强制启动BLE获取新IP...'); bleClient.scanAndConnect('sEMG_', 1).catch(err => { console.warn('[App] 紧急BLE扫描也失败了:', err); wx.showToast({ title: '连接失败，请到配网页面点刷新重试', icon: 'none', duration: 4000 }) }) } 
        else { console.log('[App] TCP彻底失败，BLE已连接，直接读取IP...'); bleClient.readCharacteristicValue() }
      }
      if (status === 'connected') {
        console.log('[App] TCP连接成功')
        this._reconnectStart = 0  // 清除重连计时
      }
      this._lastTcpStatus = status
    })
  },

  onShow() {
    // [v10.3] 小程序回到前台：取消所有旧重连定时器，延迟3s等待路由恢复后再重连
    // 背景：微信切后台会静默杀WS，切回前台时手机WiFi路由需要时间恢复
    wifiClient.reset()

    if (wifiClient.isConnected()) {
      console.log('[App] onShow: 已连接，无需重连')
      return
    }

    // 延迟3s给手机WiFi路由恢复时间，避免立即连接时 No route to host
    console.log('[App] onShow: 延迟3s等待路由恢复后重连...')
    setTimeout(() => {
      if (wifiClient.isConnected()) {
        console.log('[App] onShow delayed: 已连接，跳过重连')
        return
      }
      this._connectDevice(true)  // force=true 跳过5s防抖
    }, 3000)
  },

  _connectDevice(force) {
    // 防抖：5s 内不重复调用（force=true 跳过）
    const now = Date.now()
    if (!force && now - this._lastConnectAttempt < 5000) {
      console.log('[App] _connectDevice: 5s内已尝试，跳过')
      return
    }
    // WS 正在重连中，不需要BLE扫描
    if (wifiClient.isConnecting()) {
      console.log('[App] _connectDevice: WS正在连接/重连中，跳过BLE扫描')
      return
    }

    // [v10.7] 诊断：输出手机网络状态
    wx.getNetworkType({
      success(res) {
        console.log('[App][DIAG] 手机网络: ' + res.networkType)
        if (res.networkType === 'wifi') {
          wx.startWifi({
            success() {
              wx.getConnectedWifi({
                success(w) { console.log('[App][DIAG] 手机WiFi: SSID=' + w.wifi.SSID + ' BSSID=' + w.wifi.BSSID) },
                fail() { console.log('[App][DIAG] getConnectedWifi失败(可能iOS)') }
              })
            }
          })
        }
      }
    })
    this._lastConnectAttempt = now
    this._reconnectStart = now  // 记录重连开始时间
    const myGen = ++this._connectGen  // [v10.5] 递增代数，标记本次调用

    // 【方案D v2】启动时先BLE获取最新IP再TCP连接，缓存IP仅作BLE超时后的备用
    const BLE_TIMEOUT_MS = 12000
    let bleSucceeded = false

    bleClient.scanAndConnect('sEMG_', 1).then(() => {
      bleSucceeded = true
      console.log('[App] BLE连接成功，等待IP回调...')
    }).catch(err => {
      console.log('[App] BLE失败:', err.message || err)
    })

    // BLE 超时后降级用缓存IP
    setTimeout(() => {
      // [v10.5] 过期检测：如果新连接已发起，此闭包作废
      if (myGen !== this._connectGen) {
        console.log('[App] BLE超时闭包已过期 (gen=' + myGen + ', current=' + this._connectGen + ')，跳过')
        return
      }
      if (bleSucceeded) return
      if (wifiClient.isConnected() || wifiClient.isConnecting()) return
      
      const cachedIP = wx.getStorageSync('device_ip')
      const cachedPort = wx.getStorageSync('device_port') || 8888
      if (cachedIP && cachedIP !== '0.0.0.0') {
        console.log('[App] BLE超时，降级使用缓存IP连接(带预热):', cachedIP)
        this._netWarmupThenConnect(cachedIP, cachedPort)
      } else {
        wx.showToast({ title: '未找到设备，请确认已开机后到配网页面点刷新', icon: 'none', duration: 4000 })
      }
    }, BLE_TIMEOUT_MS)
  },

  // [v10.8] 网络预热：先用HTTP请求激活TCP路由/ARP，再发起WebSocket连接
  // 问题：手机和UNO都连同一热点LT02，但TCP栈有时没建立192.168.137.x的路由
  // 修复：wx.request()会强制手机内核做ARP解析+路由建立，然后再连WS
  _netWarmupThenConnect(ip, port) {
    const p = port || 8888
    console.log('[App] 网络预热开始 → http://' + ip + ':' + p + '/')
    
    const warmupStart = Date.now()
    wx.request({
      url: 'http://' + ip + ':' + p + '/',
      method: 'GET',
      timeout: 3000,
      success(res) {
        console.log('[App] 预热意外成功: status=' + res.statusCode)
      },
      fail(err) {
        const elapsed = Date.now() - warmupStart
        console.log('[App] 预热完成(预期失败): ' + (err.errMsg || '') + ' 耗时=' + elapsed + 'ms')
      },
      complete() {
        // 无论预热成功失败，都发起WebSocket连接
        wifiClient.disconnect()
        setTimeout(() => {
          wifiClient.connect(ip, p).catch(() => {})
        }, 200)
      }
    })
  },

  setDataMode(newMode) {
    const prevMode = this.dataMode; if (prevMode === newMode) return prevMode
    console.log('[App] 数据模式切换:', prevMode, '→', newMode); this.dataMode = newMode
    if (prevMode !== 'idle' && wifiClient.isConnected()) { wifiClient.send('{"cmd":"stop"}').catch(() => {}) }
    return prevMode
  }
})
