// pages/realtime/index.js
const app = getApp();
const { log, warn, error } = require('../../utils/logger');
const wifiClient = require('../../utils/wifiClient');

const MAX_HISTORY = 5;

Page({
  data: {
    connected: false,
    quality: '--',
    timeStr: '--:--:--',
    isReconnecting: false,
    connectionLost: false,
    historyRows: [],
    algorithm: '--',
    scrollIntoId: 'row-0',  // 滚动到最新数据（索引0=最新）
  },

  _historyRows: [],
  _relaxRms: null,
  _activeRms: null,
  _relaxMdf: null,
  _activeMdf: null,
  _realtimeHandler: null,
  _tabVisible: false,
  _algorithmState: 'idle',
  _isResuming: false,
  _lastRenderTime: 0,
  _statusChangeHandler: null,

  onLoad() {
    log('[realtime] onLoad()');
    this.setData({ algorithm: '无校准' }); // 【修复】默认显示第三档状态
    this._loadCalibFromCache();
    this._realtimeHandler = (d) => { this._onSample(d); };
    this._statusChangeHandler = (status, data) => {
      if (status === 'connected') {
        this.setData({ connected: true, isReconnecting: false, connectionLost: false });
        setTimeout(() => { this._resumeStream(); }, 100);
      } else if (status === 'connecting') {
        this.setData({ isReconnecting: true });
      } else {
        this.setData({ connected: false, isReconnecting: false, connectionLost: true });
        this._stopStream();
      }
    };
    wifiClient.onRealtimeData(this._realtimeHandler);
    wifiClient.onStatusChange(this._statusChangeHandler);
  },

  onShow() {
    log('[realtime] onShow()');
    this._tabVisible = true;
    this._algorithmState = 'idle';
    const cachedIp = wx.getStorageSync('device_ip');
    wifiClient.offRealtimeData(this._realtimeHandler);
    wifiClient.onRealtimeData(this._realtimeHandler);
    if (!cachedIp) {
      this.setData({ connected: false, connectionLost: true });
      return;
    }
    if (wifiClient.isConnected()) {
      this.setData({ connected: true, connectionLost: false });
      this._resumeStream();
    } else {
      // [v10.4] 不再主动连接，由 app.js onShow 统一管理连接流程
      // 页面只需设置重连状态，等 statusChange 回调通知连接成功
      this.setData({ isReconnecting: true });
    }
  },

  onHide() {
    this._tabVisible = false;
    this._stopStream();
    // [v3.9.27] 页面隐藏后注销实时回调，避免不可见时 setData 排队堆积
    if (this._realtimeHandler) wifiClient.offRealtimeData(this._realtimeHandler);
  },

  onUnload() {
    this._stopStream();
    if (this._realtimeHandler) {
      wifiClient.offRealtimeData(this._realtimeHandler);
      this._realtimeHandler = null;
    }
    if (this._statusChangeHandler) {
      wifiClient.offStatusChange(this._statusChangeHandler);
      this._statusChangeHandler = null;
    }
  },

  _stopStream() {
    this._isResuming = false;
    this._lastRenderTime = 0;
    this._historyRows = [];
    this.setData({ historyRows: [], scrollIntoId: 'row-0' });
    log('[realtime] sending stop...');
    // [v3.9.33 FIX] stop 命令固件无 ACK，用 send() 而非 sendQuery()，避免 8 秒超时报错
    wifiClient.send({ cmd: 'stop' }).catch(() => {});
  },

  async _resumeStream() {
    if (this._isResuming) return;
    this._isResuming = true;
    try {
      log('[realtime] sending start_stream...');
      // [v3.9.33 FIX] 使用 send() 而非 sendQuery()。
      // 固件 start_stream ACK 经 _routeTypedMessage 走 push 路由（seq 不匹配 pendingCmds），
      // sendQuery 会 8 秒后超时 → 触发 connectionLost + Toast 误报。
      // start_stream ACK 通过 onPush 监听，此处只需无等待地发送。
      const ok = await wifiClient.send({ cmd: 'start_stream', seq: String(Date.now()) });
      if (ok) {
        log('[realtime] start_stream sent OK');
      } else {
        warn('[realtime] start_stream send failed (not connected?)');
      }
      this.setData({ quality: '--', timeStr: '--:--:--', connectionLost: false });
    } catch (e) {
      warn('[realtime] start_stream 发送异常:', e);
    }

    if (this._algorithmState === 'idle') {
      this._algorithmState = 'loading';
      // [v3.9.27] 读 _relaxRms（已由 _loadCalibFromCache 从 calib_data key 加载）而非 current_user
      if (this._relaxRms && this._relaxRms > 0) {
        this.setData({ algorithm: '已校准' });
      } else {
        this.setData({ algorithm: '无校准' });
      }
      this._algorithmState = 'done';
    }

    this._isResuming = false;
  },

  _loadCalibFromCache() {
    try {
      const c = wx.getStorageSync('calib_data');
      if (c?.relax_rms) {
        this._relaxRms = c.relax_rms;
        this._activeRms = c.active_rms;
      }
    } catch (_) {}
  },

  _onSample(d) {
    try {
      const { ts, rms, mdf, fatigue, quality, activation } = d;
      if (rms == null) { log('[realtime] _onSample: rms is null, d=' + JSON.stringify(d)); return; }

      let timeStr = '--';
      if (ts != null) {
        const date = new Date(ts);
        timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
      } else {
        const now = new Date();
        timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      }

      const actPct = activation != null ? Math.max(0, Math.min(100, activation)) : null;
      const fatPct = fatigue != null ? Math.max(0, Math.min(100, fatigue)) : null;

      // [v3.9.26] 日志格式统一: ts(ms),rms(mV,3dp),activation(%,1dp),mdf(Hz,1dp),fatigue(%,1dp),quality
      const tsStr = ts != null ? String(ts) : '--';
      log('[realtime] ts=' + tsStr + ' rms=' + rms.toFixed(3) + ' activation=' + (actPct != null ? actPct.toFixed(1) + '%' : '--') + ' mdf=' + mdf.toFixed(1) + ' fatigue=' + (fatPct != null ? fatPct.toFixed(1) + '%' : '--') + ' quality=' + (quality != null ? quality + '%' : '--'));

      const histRow = {
        time: timeStr,
        rms: rms.toFixed(3),
        act: actPct != null ? actPct.toFixed(1) + '%' : '--',
        mdf: mdf != null ? mdf.toFixed(1) : '--',
        fat: fatPct != null ? fatPct.toFixed(1) + '%' : '--',
        q: quality != null ? quality + '%' : '--'
      };

      // 新数据始终放在数组头部 (索引0=最新)
      this._historyRows.unshift(histRow); 
      
      // 超过 5 条，把最老的（尾部）删掉
      if (this._historyRows.length > MAX_HISTORY) this._historyRows.pop();

      const now = Date.now();
      // 限频500ms：列表和状态栏都限频，避免10Hz setData导致微信渲染卡死
      if (now - this._lastRenderTime >= 500) {
        this._lastRenderTime = now;
        this.setData({ 
          historyRows: this._historyRows.slice(), // slice() 拷贝新数组触发脏检查
          scrollIntoId: 'row-0', // 滚动到最新数据
          quality: quality != null ? quality + '%' : '--',
          timeStr,
          connectionLost: !wifiClient.isConnected()
        });
      }
    } catch (e) {
      error('[realtime] _onSample 内部崩溃:', e);
    }
  },

  // ===================== 疲劳度反馈 (已移除 scale_factor 自适应学习) =====================
});

