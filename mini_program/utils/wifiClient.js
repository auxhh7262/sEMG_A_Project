// Force refresh v10.0 - Ultimate Simplified Edition (No Timeout Ghost)
// ============================================================ 
// WebSocket Client - sEMG肌电监测设备通信模块 V10.0 (极简无超时版) 
// ============================================================ 

console.log('[WS] 🌟 V10.0 ULTIMATE SIMPLIFIED EDITION LOADED 🌟');

let _socketTask = null
let _isConnected = false
let _isConnecting = false
let _reconnectTimer = null
let _reconnectCount = 0
let _maxReconnect = 5  // 最多重连5次，失败后 emit reconnect_failed
// [v10.2] 路由未就绪标志：code 113 时设为 true，第一次重试等 10 秒
let _routeNotReady = false
let _reconnectInterval = 2000  // 初始重连间隔 2 秒（指数退避基数）
let _noRouteCount = 0          // [v10.3] 连续 No route to host 次数
let _noRouteMaxRetries = 5     // [v10.3] 最多允许 5 次 No route to host/End of File 后停止自动重连
let _suspendReconnect = false  // [v10.4] reset()后挂起重连，等 onShow 统一流程完成
let _onMessageCallback = null
let _onStatusChangeCallback = null
let _currentIP = ''
let _currentPort = 8888
let _messageListeners = []
let _connectResolve = null
let _connectReject = null
let _pageStatusListeners = []

function _updateStatus(status, message) {
  _isConnected = status === 'connected'
  _isConnecting = status === 'connecting'
  // [v10.1] 补全 reconnect_failed 状态分发
  _pageStatusListeners.forEach(fn => {
    try { fn(status, message) } catch (e) {}
  })
  if (_onStatusChangeCallback && typeof _onStatusChangeCallback === 'function') {
    try { _onStatusChangeCallback(status, message) } catch (e) {}
  }
}

function _cleanup() {
  if (_socketTask) { try { _socketTask.close() } catch (e) {} _socketTask = null }
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
  _isConnecting = false; _connectResolve = null; _connectReject = null
}

let _notifyListeners = function(rawData) {
  _messageListeners.forEach(fn => { try { fn(rawData) } catch (e) {} });
  if (_onMessageCallback) { try { _onMessageCallback(rawData) } catch (e) {} }
}

function _bindSocketEvents() {
  _socketTask.onOpen(() => {
    console.log('[WS] onOpen — WebSocket 连接成功 ws://' + _currentIP + ':' + _currentPort)
    _isConnecting = false; _isConnected = true
    _reconnectCount = 0       // 连接成功后重置重连计数
    _reconnectDelay = 2000    // 重置重连延迟为初始值
    _routeNotReady = false    // [v10.3] 重置路由未就绪标记
    _noRouteCount = 0         // [v10.3] 重置 No route 计数
    _suspendReconnect = false // [v10.4] 连接成功，恢复自动重连能力
    _updateStatus('connected', '连接成功')
    if (_connectResolve) { _connectResolve(true); _connectResolve = null; _connectReject = null }
  })

  _socketTask.onMessage((res) => {
    try {
      let rawData = '';
      if (typeof res.data === 'string') {
        rawData = res.data;
      } else if (res.data instanceof ArrayBuffer) {
        try { rawData = String.fromCharCode.apply(null, new Uint8Array(res.data)); } catch (e) { return; }
      } else { return; }

      if (!rawData) return;

      const packages = rawData.split('\n');
      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i].trim();
        if (!pkg) continue;
        _notifyListeners(pkg);
        _routeTypedMessage(pkg);
      }
    } catch (e) {
      console.error('[WS] onMessage 解析异常:', e)
    }
  })

  _socketTask.onClose((res) => {
    console.log('[WS] onClose — WebSocket 关闭, code=' + (res ? res.code : '?') + ' reason=' + (res ? (res.reason || '') : ''));
    if (_isConnecting && _connectReject) {
      _connectReject(new Error('Connection closed'));
      _connectResolve = null; _connectReject = null
    }
    _handleDisconnect()
  })

  _socketTask.onError((err) => {
    console.error('[WS] onError — WebSocket 错误:', err)
    // [v10.4] 检测不可恢复的连接错误
    if (err && err.errMsg) {
      if (err.errMsg.indexOf('No route to host') !== -1) {
        console.log('[WS] 检测到 No route to host，路由未就绪')
        _routeNotReady = true
        // [v10.7] 诊断日志：输出手机自身网络状态
        wx.getNetworkType({
          success(res) {
            console.log('[WS][DIAG] 手机网络类型:', res.networkType)
            if (res.networkType === 'wifi') {
              wx.startWifi({
                success() {
                  wx.getConnectedWifi({
                    success(wifiRes) {
                      console.log('[WS][DIAG] 手机WiFi详情: SSID=' + wifiRes.wifi.SSID + ' BSSID=' + wifiRes.wifi.BSSID + ' secure=' + wifiRes.wifi.secure)
                    },
                    fail() { console.log('[WS][DIAG] 无法获取WiFi详情(可能iOS)') }
                  })
                },
                fail() { console.log('[WS][DIAG] startWifi失败') }
              })
            }
          }
        })
      } else if (err.errMsg.indexOf('End of File') !== -1 || (err.errCode === 1004 && err.errMsg.indexOf('_code:7') !== -1)) {
        console.log('[WS] 检测到 End of File，固件已有客户端占用，停止自动重连')
        _routeNotReady = true
      }
    }
    if (_connectReject) { _connectReject(err); _connectResolve = null; _connectReject = null }
    _handleDisconnect()
  })
}

function _handleDisconnect() {
  if (!_isConnected && !_isConnecting) return
  // [v10.4] 重连被挂起（onShow 正在执行统一连接流程），不触发自动重连
  if (_suspendReconnect) {
    console.log('[WS] 重连已挂起（onShow 统一连接流程进行中），跳过自动重连')
    _isConnected = false; _isConnecting = false
    if (_socketTask) { try { _socketTask.close() } catch (e) {} _socketTask = null }
    return
  }
  // [v10.3] 跟踪连续 No route to host 次数
  if (_routeNotReady) { _noRouteCount++ }
  console.log('[WS] 连接断开，IP:', _currentIP, '已重连:', _reconnectCount, '次', _routeNotReady ? '(noRoute #' + _noRouteCount + ')' : '')
  _updateStatus('disconnected', '连接断开'); _isConnecting = false
  if (_socketTask) { try { _socketTask.close() } catch (e) {} _socketTask = null }
  // Reject all pending cmds
  Object.keys(_pendingCmds).forEach(seq => {
    clearTimeout(_pendingCmds[seq].timer); _pendingCmds[seq].reject(new Error('连接断开'))
  }); _pendingCmds = {};
  _tryReconnect()
}

function _tryReconnect() {
  // [v10.4] 检查挂起标记（onShow 统一连接流程进行中则不重连）
  if (!_currentIP || _isConnecting || _suspendReconnect) return
  _reconnectCount++
  // [v10.4] 不可恢复错误（No route to host / End of File）超过上限，停止自动重连，等待 onShow 重新触发
  if (_routeNotReady && _noRouteCount > _noRouteMaxRetries) {
    console.log('[WS] 不可恢复错误已达' + _noRouteMaxRetries + '次上限（共' + _noRouteCount + '次），停止自动重连，等待 onShow 触发')
    _updateStatus('reconnect_failed', '不可恢复错误，停止重试')
    return
  }
  // [v10.2] 路由未就绪时首次重试等 10 秒，之后每 5 秒重试一次
  let delay
  if (_routeNotReady && _reconnectCount === 1) {
    delay = 10000
    console.log('[WS] 路由未就绪，第1次重试延迟 10 秒（等待路由就绪）')
  } else if (_routeNotReady) {
    delay = 5000   // 路由未就绪但已过首次等待，每 5 秒探一次
    console.log('[WS] 路由未就绪，第' + _reconnectCount + '次重试（延迟 5 秒探测）')
  } else {
    // 正常指数退避：2000, 4000, 8000, 16000, 32000, 60000(上限)
    delay = Math.min(2000 * Math.pow(2, _reconnectCount - 1), 60000)
  }
  console.log('[WS] 自动重连 第' + _reconnectCount + '次 (延迟 ' + delay + 'ms)')
  _reconnectTimer = setTimeout(() => { connect(_currentIP, _currentPort) }, delay)
}

function connect(ip, port) {
  const isNewTarget = (ip !== _currentIP || (port || 8888) !== _currentPort)
  if (_isConnecting || _isConnected) return Promise.resolve(_isConnected)
  _cleanup(); _currentIP = ip; _currentPort = port || 8888; _isConnecting = true
  _suspendReconnect = false  // [v10.4] 开始新连接，恢复自动重连能力
  if (isNewTarget) { _reconnectCount = 0 }
  let safeIp = _currentIP.replace(/^ws:\/\/\/?/i, '').replace(/:\d+$/i, '')
  let url = `ws://${safeIp}:${_currentPort}`
  _updateStatus('connecting', `连接到 ${safeIp}:${_currentIP}`)
  _socketTask = wx.connectSocket({ url: url });
  _bindSocketEvents();
  return new Promise((resolve, reject) => { _connectResolve = resolve; _connectReject = reject })
}

function disconnect() {
  console.log('[WS] disconnect() — 手动断开'); _cleanup(); _updateStatus('disconnected', '手动断开'); _currentIP = ''; _currentPort = 8888
}

// 🌟 极简发送：只管发，不管回！用于 start_stream / stop_stream
function send(data) {
  if (!_socketTask || !_isConnected) return Promise.resolve(false);
  const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
  console.log('[WS] send: ' + dataStr);
  return new Promise((resolve) => {
    try {
      _socketTask.send({
        data: dataStr,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    } catch (e) { resolve(false) }
  })
}

// 🌟 查询发送：用于需要等待回复的指令 (如 query_cz)，保留超时机制
let _cmdSeq = 0;
let _pendingCmds = {};
const _CMD_TIMEOUT_MS = 8000

function sendQuery(cmd, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!_socketTask || !_isConnected) { reject(new Error('未连接')); return }
    const seq = String(++_cmdSeq);
    const pkg = { cmd, seq, ...payload };
    console.log('[WS] sendQuery cmd=' + cmd + ' seq=' + seq + ' payload=' + JSON.stringify(payload));
    const timer = setTimeout(() => {
      if (_pendingCmds[seq]) { delete _pendingCmds[seq]; reject(new Error('CMD_TIMEOUT')) }
    }, _CMD_TIMEOUT_MS);
    _pendingCmds[seq] = { resolve, reject, timer };
    _socketTask.send({
      data: JSON.stringify(pkg),
      success: () => {},
      fail: (err) => { clearTimeout(timer); delete _pendingCmds[seq]; reject(err || new Error('SEND_ERROR')) }
    })
  })
}

function isConnected() { return _isConnected };
function isConnecting() { return _isConnecting }
function setCallbacks(onMessage, onStatusChange) { _onMessageCallback = onMessage; _onStatusChangeCallback = onStatusChange }

let _pushListeners = [];
let _realtimeDataListeners = [];

function onPush(fn) { if (!_pushListeners.includes(fn)) _pushListeners.push(fn) };
function offPush(fn) { if (!fn) return; const i = _pushListeners.indexOf(fn); if (i !== -1) _pushListeners.splice(i, 1) }
function onMessage(fn) { if (!_messageListeners.includes(fn)) _messageListeners.push(fn) };
function offMessage(fn) { if (!fn) return; const idx = _messageListeners.indexOf(fn); if (idx !== -1) _messageListeners.splice(idx, 1) }
function onStatusChange(fn) { if (!_pageStatusListeners.includes(fn)) _pageStatusListeners.push(fn) };
function offStatusChange(fn) {
  if (!fn) return;  // [FIX] null不清空，防止误清其他页面的监听器
  const i = _pageStatusListeners.indexOf(fn);
  if (i !== -1) _pageStatusListeners.splice(i, 1)
}
function onRealtimeData(fn) { if (!_realtimeDataListeners.includes(fn)) _realtimeDataListeners.push(fn) };
function offRealtimeData(fn) { if (!fn) return; const i = _realtimeDataListeners.indexOf(fn); if (i !== -1) _realtimeDataListeners.splice(i, 1) }

function _routeTypedMessage(rawData) {
  let data;
  try {
    data = JSON.parse(rawData)
  } catch (e) {
    return false
  }

  if (data.seq !== undefined) {
    data.seq = String(data.seq);
  }

  if (data.type === 'data' || (data.ts !== undefined && data.rms !== undefined)) {
    // 将 ts (毫秒时间戳) 转换为北京时间 HH:MM:SS.mmm
    let tsStr = '--:--:--.---';
    if (data.ts) {
      const d = new Date(data.ts + 8 * 3600000); // UTC+8
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
      tsStr = hh + ':' + mm + ':' + ss + '.' + ms;
    }
    console.log('[ws] ' + tsStr + ' rms=' + data.rms.toFixed(3) + ' activation=' + (data.activation != null ? data.activation.toFixed(1) + '%' : '--') + ' mdf=' + (data.mdf ? data.mdf.toFixed(1) : '--') + ' fatigue=' + (data.fatigue != null ? data.fatigue.toFixed(1) + '%' : '--') + ' quality=' + (data.quality != null ? data.quality : '--'));
    if (_realtimeDataListeners.length > 0) {
      _realtimeDataListeners.forEach(fn => { try { fn(data) } catch (e) {} });
    }
    return true;
  }

  // CMD response with seq: match pending query (but NOT for firmware-initiated push events)
  if (data.cmd && data.seq !== undefined) {
    const seq = String(data.seq);
    // Firmware-initiated push events (no pending cmd to wait for): always route to push listeners
    const PUSH_ONLY_EVENTS = ['relax_done', 'active_done', 'db_records', 'raw_phase_done', 'start_stream'];
    if (PUSH_ONLY_EVENTS.includes(data.cmd)) {
      // fall through to push listeners
    } else if (_pendingCmds[seq]) {
      clearTimeout(_pendingCmds[seq].timer);
      const { resolve } = _pendingCmds[seq];
      delete _pendingCmds[seq];
      console.log('[WS] query resolved: cmd=' + data.cmd + ' seq=' + seq);
      resolve(data);
      return true;
    } else {
      // [v3.9.28] 未匹配的cmd+seq，记录警告便于调试
      console.warn('[WS] unmatched cmd+seq: cmd=' + data.cmd + ' seq=' + seq + ' (no pending query)');
    }
    // No pending cmd matched, fall through to push
  }

  // Any message with cmd field: route to push listeners
  if (data.cmd) {
    if (_pushListeners.length > 0) {
      _pushListeners.forEach(fn => { try { fn(data) } catch (e) {} });
    }
    return true;
  }
  return false
}

function _cleanupExtended() {
  Object.keys(_pendingCmds).forEach(seq => {
    clearTimeout(_pendingCmds[seq].timer); _pendingCmds[seq].reject(new Error('连接断开'))
  });
  _pendingCmds = {};
}

const _origCleanup = _cleanup;
_cleanup = function() { _cleanupExtended(); _origCleanup() }

// ping: 探测僵尸连接（微信切后台静默杀WS不触发onClose）
function ping() {
  return new Promise((resolve) => {
    if (!_socketTask || !_isConnected) { resolve(false); return }
    try {
      _socketTask.send({
        data: '{"cmd":"ping"}',
        success: () => resolve(true),
        fail: () => { console.log('[WS] ping fail — 僵尸连接，强制断开'); _handleDisconnect(); resolve(false) }
      })
    } catch (e) { console.log('[WS] ping exception — 僵尸连接'); _handleDisconnect(); resolve(false) }
  })
}

function close() { _cleanup(); _updateStatus('disconnected', 'close()'); _currentIP = ''; _currentPort = 8888 }

// [v10.3] reset() — 取消所有重连定时器，重置计数器，保留当前IP
// 用于 onShow 时统一清理状态，避免旧重连定时器与新连接流程竞争
function reset() {
  console.log('[WS] reset() — 取消重连定时器，挂起重连，重置状态')
  _suspendReconnect = true  // [v10.4] 挂起重连，防止异步 onClose 触发 _tryReconnect
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
  _reconnectCount = 0
  _noRouteCount = 0
  _routeNotReady = false
  _isConnecting = false
  _isConnected = false
  if (_socketTask) { try { _socketTask.close() } catch (e) {} _socketTask = null }
  _connectResolve = null; _connectReject = null
  // 不清除 _currentIP，保留用于重连
  _updateStatus('disconnected', 'reset')
}

module.exports = {
  connect, disconnect, send, sendQuery, sendCmd: sendQuery, isConnected, isConnecting, ping, setCallbacks,
  onMessage, offMessage, onRealtimeData, offRealtimeData,
  onPush, offPush, onStatusChange, offStatusChange, close, reset, _currentIP
}
