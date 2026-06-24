const wifiClient = require('../../utils/wifiClient');
const { log, warn } = require('../../utils/logger');

Page({
  data: {
    isConnected: false,
    isLoading: false,
    isEmpty: true,
    algorithm: '--',       // 无校准 / 已校准
    errorMsg: '',

    // 时间筛选
    dateRange: [],
    selectedRange: 'today',
    startDate: '',
    endDate: '',

    // 统计
    summary: { avgMdf: '--', avgFatigue: '--', maxFatigue: '--', duration: '--' },

    // 图表数据
    _chartPoints: [],       // [{mdf, fatigue}] 成对数据点
    _startTsMs: 0,          // 首点毫秒时间戳（横轴左标签）
    _endTsMs: 0,            // 末点毫秒时间戳（横轴右标签）
    totalMatches: 0,        // CZone 命中总数（toast 用）
  },

  _chartCtxMdf: null, _dprMdf: 1, _wMdf: 0, _hMdf: 0,
  _chartCtxFat: null, _dprFat: 1, _wFat: 0, _hFat: 0,
  _tabVisible: false,
  _czTimedOut: false,

  onLoad() { this._initDateRange(); this._initCanvases(); this._pushHandler = null; this._czTimeout = null; this._czTimedOut = false; },
  onUnload() {},

  onShow() {



    console.log('[analysis] onShow');
    this._tabVisible = true;
    // [v10.4] 注册 statusChange 监听，响应 app.js 的统一连接结果
    if (!this._statusHandler) {
      this._statusHandler = (status) => {
        if (status === 'connected') {
          this.setData({ isConnected: true });
        } else if (status === 'disconnected' || status === 'reconnect_failed') {
          this.setData({ isConnected: false });
        }
      };
    }
    wifiClient.onStatusChange(this._statusHandler);
    if (wifiClient.isConnected()) {
      this.setData({ isConnected: true });
    } else {
      this._silentConnect();
    }
  },

  onHide() {
    this._tabVisible = false;
    this._czTimedOut = false;
    if (this._statusHandler) {
      wifiClient.offStatusChange(this._statusHandler);
    }
    // [v3.9.30] 清理 push 监听 & 超时 timer，防止切 Tab 后操作已隐藏页面
    if (this._pushHandler) {
      wifiClient.offPush(this._pushHandler);
      this._pushHandler = null;
    }
    if (this._czTimeout) {
      clearTimeout(this._czTimeout);
      this._czTimeout = null;
    }
  },

  // ──── 连接 ────

  _silentConnect() {
    // [v10.4] 不再主动连接，由 app.js onShow 统一管理连接流程
    const ip = wx.getStorageSync('device_ip');
    if (!ip) { this.setData({ isConnected: false }); return; }
    if (wifiClient.isConnected()) { this.setData({ isConnected: true }); return; }
    // 等待 app.js 的统一连接流程
    this.setData({ isConnected: false });
  },

  // ──── 查询算法类型 + 加载数据 ────

  _queryAlgorithmAndLoad() {
    // [v3.9.27] 读 calib_data key（校准数据存储位置），而非 current_user（用户Profile不包含校准值）
    try {
      const calib = wx.getStorageSync('calib_data');
      if (calib && calib.relax_rms > 0) {
        this.setData({ algorithm: '已校准' });
      } else {
        this.setData({ algorithm: '无校准' });
      }
    } catch (_) {
      this.setData({ algorithm: '无校准' });
    }
  },

  // ──── 日期范围 ────

  _initDateRange() {
    const now = new Date();
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = fmt(now);
    const yesterday = fmt(new Date(now - 864e5));
    const week = fmt(new Date(now - 864e5 * 7));
    const month = fmt(new Date(now - 864e5 * 30));
    this.setData({
      dateRange: [
        { key:'today', label:'今天', start:today, end:today },
        { key:'yesterday', label:'昨天', start:yesterday, end:yesterday },
        { key:'week', label:'最近7天', start:week, end:today },
        { key:'month', label:'最近30天', start:month, end:today },
      ],
      selectedRange: 'today', startDate: today, endDate: today,
    });
  },

  // ──── 数据查询 ────

  async _loadData() {
    if (this.data.isLoading) return;
    const { startDate, endDate } = this.data;
    this.setData({ isLoading: true, errorMsg: '', isEmpty: false });
    this._czTimedOut = false;  // [v3.9.32] 重置超时标记
    try {
      if (!wifiClient.isConnected()) return;
      const startTs = Math.floor(new Date(startDate + 'T00:00:00').getTime() / 1000);
      const endTs = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000);

      // 查询C区历史数据（处理分页响应）
      const records = await this._fetchAllCzData(startTs, endTs);

      if (!records || records.mdf.length === 0) {
        this.setData({ isLoading: false, isEmpty: true, errorMsg: '暂无监测数据', recentRecords: [], totalRecords: 0 });
        return;
      }

      // B区曲线库已在 v3.9.15 删除，A区个人拟合曲线也一并移除
      // 仅保留 C 区数据查询和折线图绘制

      this._processAndRender(records);
    } catch (e) {
      warn('[analysis] _loadData:', e.message);
      this.setData({ isLoading: false, isEmpty: true, errorMsg: e.message });
    }
  },

  async _fetchAllCzData(startTs, endTs) {
    let merged = { mdf: [], fatigue: [], start_ts: 0, end_ts: 0, total: 0 };
    log('[analysis] query_cz (analysis mode) startTs=' + startTs + ' endTs=' + endTs);
    return new Promise((resolve) => {
      let batchCount = 0;
      let resolved = false;

      const pushHandler = (data) => {
        if (data.cmd !== 'cz_data') return;
        const batch = this._parseRecords(data);
        if (batch) {
          merged.mdf = merged.mdf.concat(batch.mdf);
          merged.fatigue = merged.fatigue.concat(batch.fatigue);
          if (batch.start_ts) merged.start_ts = batch.start_ts;
          if (batch.end_ts)   merged.end_ts   = batch.end_ts;
          if (batch.total)    merged.total    = batch.total;
        }
        batchCount++;
        log('[analysis] cz_data batch #' + batchCount + ': +' + (batch ? batch.mdf.length : 0) + ' pts, total=' + merged.mdf.length + ', more=' + (data.more ? 'true' : 'false'));
        if (!data.more) {
          wifiClient.offPush(pushHandler);
          this._pushHandler = null;
          if (!resolved) { resolved = true; resolve(merged); }
        }
      };

      this._pushHandler = pushHandler;
      wifiClient.onPush(pushHandler);

      wifiClient.sendCmd('query_cz', { start_ts: startTs, end_ts: endTs }).then(firstRes => {
        const firstBatch = this._parseRecords(firstRes);
        if (firstBatch) {
          merged.mdf = merged.mdf.concat(firstBatch.mdf);
          merged.fatigue = merged.fatigue.concat(firstBatch.fatigue);
          if (firstBatch.start_ts) merged.start_ts = firstBatch.start_ts;
          if (firstBatch.end_ts)   merged.end_ts   = firstBatch.end_ts;
          if (firstBatch.total)    merged.total    = firstBatch.total;
        }
        batchCount++;
        log('[analysis] cz_data batch #' + batchCount + ' (first): +' + (firstBatch ? firstBatch.mdf.length : 0) + ' pts, total=' + merged.mdf.length);
        if (!firstRes.more) {
          wifiClient.offPush(pushHandler);
          this._pushHandler = null;
          if (!resolved) { resolved = true; resolve(merged); }
        }
      }).catch(() => {
        wifiClient.offPush(pushHandler);
        this._pushHandler = null;
        if (!resolved) { resolved = true; resolve(merged); }
      });

      this._czTimeout = setTimeout(() => {
        if (!resolved) {
          wifiClient.offPush(pushHandler);
          this._pushHandler = null;
          resolved = true;
          this._czTimedOut = true;
          if (this._tabVisible) {
            wx.showToast({ title: '查询超时，数据可能不全', icon: 'none', duration: 2500 });
          }
          resolve(merged);
        }
      }, 8000);
    });
  },

  _parseRecords(res) {
    // [v3.9.34] 分析模式：mdf[] + fatigue[] 数组格式，不含 per-point ts
    if (res && res.cmd === 'cz_data') {
      const mdf = Array.isArray(res.mdf) ? res.mdf : [];
      const fatigue = Array.isArray(res.fatigue) ? res.fatigue : [];
      if (mdf.length > 0) {
        return {
          mdf: mdf,
          fatigue: fatigue,
          start_ts: res.start_ts || 0,
          end_ts: res.end_ts || 0,
          total: res.total || 0,
        };
      }
    }
    return null;
  },

  _processAndRender(merged) {
    if (!merged || merged.mdf.length === 0) {
      this.setData({ isLoading: false, isEmpty: true, errorMsg: '暂无监测数据', recentRecords: [], totalRecords: 0 });
      return;
    }

    const pts = [];
    for (let i = 0; i < merged.mdf.length; i++) {
      pts.push({ mdf: merged.mdf[i], fatigue: merged.fatigue[i] });
    }

    const summary = this._calcSummary(pts);

    this.setData({
      isLoading: false, isEmpty: false,
      summary,
      recentRecords: [],
      totalRecords: merged.total,     // CZone 命中总数
      _chartPoints: pts,
      _startTsMs: merged.start_ts,
      _endTsMs:   merged.end_ts,
      totalMatches: merged.total,
    });

    // [v3.9.34] toast: 显示从设备读取到的数据条数
    if (this._tabVisible) {
      wx.showToast({ title: '共读取到 ' + merged.total + ' 条数据', icon: 'none', duration: 2000 });
    }

    setTimeout(() => {
      this._drawOneChart('mdf');
      this._drawOneChart('fatigue');
    }, 100);
  },

  _calcSummary(pts) {
    if (!pts.length) return { avgMdf: '--', avgFatigue: '--', maxFatigue: '--', duration: '--' };
    const n = pts.length;
    const mdfSum = pts.reduce((s, r) => s + (r.mdf || 0), 0);
    const fatSum = pts.reduce((s, r) => s + (r.fatigue || 0), 0);
    const maxFat = Math.max(...pts.map(r => r.fatigue || 0));
    return {
      avgMdf: (mdfSum / n).toFixed(1),
      avgFatigue: Math.round(fatSum / n),
      maxFatigue: Math.round(maxFat),
      duration: '--',
    };
  },

  // ──── Canvas 初始化 & 绘图 ────

  _initCanvases() {
    const info = wx.getSystemInfoSync();
    ['mdfChart', 'fatigueChart'].forEach(id => {
      const query = wx.createSelectorQuery();
      query.select('#' + id).fields({ node: true, size: true }).exec(res => {
        if (!res[0]?.node) return;
        const c = res[0].node;
        const dpr = info.pixelRatio;
        c.width = res[0].width * dpr;
        c.height = res[0].height * dpr;
        const ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        if (id === 'mdfChart') {
          this._chartCtxMdf = ctx; this._dprMdf = dpr; this._wMdf = res[0].width; this._hMdf = res[0].height;
        } else {
          this._chartCtxFat = ctx; this._dprFat = dpr; this._wFat = res[0].width; this._hFat = res[0].height;
        }
      });
    });
  },

  _drawOneChart(field) {
    const isMdf = field === 'mdf';
    const ctx = isMdf ? this._chartCtxMdf : this._chartCtxFat;
    const w   = isMdf ? this._wMdf : this._wFat;
    const h   = isMdf ? this._hMdf : this._hFat;
    if (!ctx || w === 0) return;

    const pts = this.data._chartPoints;
    if (!pts || pts.length < 2) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#666'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('数据不足，无法绘制', w / 2, h / 2);
      return;
    }

    const values = pts.map(p => p[field]);
    const vMin = Math.floor(Math.min(...values) / 10) * 10;
    const vMax = Math.ceil(Math.max(...values) / 10) * 10;
    const vRange = Math.max(vMax - vMin, 10);
    const n = values.length;

    const pad = { top: 15, right: 12, bottom: 28, left: 45 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const toX = (i) => pad.left + (i / Math.max(n - 1, 1)) * cw;
    const toY = (v) => pad.top + (1 - (v - vMin) / vRange) * ch;

    ctx.clearRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }

    // Y轴刻度
    ctx.fillStyle = '#888'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = vMax - (vRange / 4) * i;
      const y = pad.top + (ch / 4) * i;
      ctx.fillText(isMdf ? val.toFixed(0) : val.toFixed(0), pad.left - 5, y + 4);
    }

    // X轴：仅两端标注精确到ms的起止时间
    ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    const fmtTs = (tsMs) => {
      const d = new Date(tsMs);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      const ms = String(d.getMilliseconds()).padStart(3, '0');
      return hh + ':' + mm + ':' + ss + '.' + ms;
    };
    if (this.data._startTsMs) {
      ctx.fillText(fmtTs(this.data._startTsMs), pad.left, h - 6);
    }
    ctx.textAlign = 'right';
    if (this.data._endTsMs) {
      ctx.fillText(fmtTs(this.data._endTsMs), w - pad.right, h - 6);
    }

    // 折线
    const color = isMdf ? 'rgba(248,113,113,0.7)' : 'rgba(96,165,250,0.7)';
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i), y = toY(values[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 填充区域
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(values[i]));
    ctx.lineTo(toX(n - 1), pad.top + ch);
    ctx.lineTo(toX(0), pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = isMdf ? 'rgba(248,113,113,0.06)' : 'rgba(96,165,250,0.06)';
    ctx.fill();

    // 数据点（稀疏绘制）
    const step = Math.max(1, Math.floor(n / 40));
    const dotFill = isMdf ? '#f87171' : '#60a5fa';
    for (let i = 0; i < n; i += step) {
      const x = toX(i), y = toY(values[i]);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = dotFill; ctx.fill();
    }
    // 末点
    if (n > 1) {
      const lx = toX(n - 1), ly = toY(values[n - 1]);
      ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = dotFill; ctx.lineWidth = 1.5; ctx.stroke();
    }
  },

  // ──── 事件 ────

  onRangeChange(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const item = this.data.dateRange.find(r => r.key === key);
    if (!item) return;
    this.setData({ selectedRange: key, startDate: item.start, endDate: item.end });
  },

  // 点击查询按钮：发指令加载数据
  async onQuery() {
    if (!wifiClient.isConnected()) {
      wx.showToast({ title: '请先连接设备', icon: 'none' });
      return;
    }
    await this._queryAlgorithmAndLoad();
    this._loadData();
  },

  async onRefresh() {
    if (!wifiClient.isConnected()) {
      this._silentConnect();
      return;
    }
    await this._queryAlgorithmAndLoad();
    this._loadData();
  },

  async onExportData() {
    const pts = this.data._chartPoints;
    if (!pts || !pts.length) { wx.showToast({ title: '无数据', icon: 'none' }); return; }
    const header = 'MDF(Hz),Fatigue(%)\n';
    const rows = pts.map(r => `${(r.mdf||0).toFixed(1)},${(r.fatigue||0).toFixed(1)}`).join('\n');
    const csv = header + rows;
    const name = `sEMG_${this.data.startDate}_${this.data.endDate}.csv`;
    const path = `${wx.env.USER_DATA_PATH}/${name}`;
    try {
      wx.getFileSystemManager().writeFileSync(path, csv, 'utf-8');
      wx.shareFileMessage({ filePath: path });
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },
});

