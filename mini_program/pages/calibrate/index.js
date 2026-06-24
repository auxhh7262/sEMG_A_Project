// pages/calibrate/index.js - 校准页（固件端计时版）
const app = getApp();
const storage = require('../../utils/storage.js');
const { getCurrentUser, setCurrentUser, saveCurrentUser } = storage;
const wifiClient = require('../../utils/wifiClient.js');
const logger = require('../../utils/logger.js');

Page({
  data: {
    phase: 'idle',
    connected: false,
    currentUser: null,
    userMetaStr: '',
    showUserForm: false,
    // 实时数据
    liveRelaxRms: null, liveRelaxMdf: null,
    liveActiveRms: null,  liveActiveMdf:  null,
    // 结果 (来自固件推送)
    relaxRms: null, relaxMdf: null,
    activeRms: null,  activeMdf: null, endMdf: null,
    statusText: '点击下方按钮开始校准',
    validation: null,
    saved: false,
  },

  onLoad() {
    this._refreshUser();
  },

  onShow() {
    logger.log('[calibrate] onShow');
    this.setData({ connected: wifiClient.isConnected() });
    this._refreshUser();
    wifiClient.onStatusChange(this._onStatusChange);
    wifiClient.onPush(this._onPush);
    if (this.data.phase === 'relax' || this.data.phase === 'active_contract') {
      this._registerCallbacks();
    }
  },

  onHide() {
    wifiClient.offStatusChange(this._onStatusChange);
    wifiClient.offPush(this._onPush);
    this._unregisterCallbacks();
    if (this.data.phase === 'relax' || this.data.phase === 'active_contract') {
      this._resetAll();
    }
  },

  onUnload() {
    this._unregisterCallbacks();
    wifiClient.offPush(this._onPush);
    wifiClient.offStatusChange(this._onStatusChange);
  },

  // ===================== 状态变化 =====================
  _onStatusChange(status) {
    this.setData({ connected: status === 'connected' });
    if (status === 'disconnected' || status === 'reconnect_failed') {
      wx.showToast({ title: '设备连接断开', icon: 'none' });
      this._resetAll();
    }
  },

  // ===================== 固件推送事件处理 =====================
  _onPush(data) {
    logger.log('[calibrate] push: ' + JSON.stringify(data));
    if (data.cmd === 'relax_done') {
      // 10秒RELAX结束，固件返回平均结果
      this._onRelaxDone(data);
    } else if (data.cmd === 'active_done') {
      // 15秒ACTIVE结束，固件返回平均结果
      this._onActiveDone(data);
    }
  },

  _onRelaxDone(data) {
    this._unregisterCallbacks();
    const relaxRms = data.relax_rms;
    const relaxMdf = data.relax_mdf;
    this.setData({
      relaxRms, relaxMdf,
      phase: 'active_ready',
      statusText: '请握紧拳头至最大力，准备好了就点击下方按钮',
    });
  },

  _onActiveDone(data) {
    this._unregisterCallbacks();
    const activeRms = data.active_rms;
    const activeMdf = data.active_mdf;
    const endMdf = data.end_mdf;
    this.setData({
      activeRms, activeMdf, endMdf,
      phase: 'result',
    });
    this._validateResult();
  },

  _refreshUser() {
    const user = getCurrentUser();
    this.setData({ currentUser: user, userMetaStr: this._buildUserMeta(user) });
  },

  // ===================== 实时数据回调 =====================
  _registerCallbacks() {
    this._unregisterCallbacks();
    this._dataHandler = (data) => {
      if (this.data.phase === 'relax') {
        this.setData({
          liveRelaxRms: data.rms != null ? data.rms.toFixed(3) : null,
          liveRelaxMdf: data.mdf != null ? data.mdf.toFixed(1) : null,
        });
      }
      else if (this.data.phase === 'active_contract') {
        this.setData({
          liveActiveRms: data.rms != null ? data.rms.toFixed(3) : null,
          liveActiveMdf: data.mdf != null ? data.mdf.toFixed(1) : null,
        });
      }
    };
    wifiClient.onRealtimeData(this._dataHandler);
  },

  _unregisterCallbacks() {
    if (this._dataHandler) {
      wifiClient.offRealtimeData(this._dataHandler);
      this._dataHandler = null;
    }
  },

  // ===================== 工具 =====================
  _checkWifi() {
    if (!wifiClient.isConnected()) {
      wx.showToast({ title: '请先在"网络配置"页连接设备', icon: 'none' });
      return false;
    }
    return true;
  },

  // ===================== 用户profile =====================
  onFirstUseCalibrate() {
    if (!this._checkWifi()) return;
    this.setData({ showUserForm: true });
  },

  onOpenUserForm() {
    const user = this.data.currentUser;
    this.setData({
      showUserForm: true,
      isEditUser: !!user,
      formData: user
        ? { name: user.name, gender: String(user.gender), age: String(user.age), handedness: String(user.handedness) }
        : { name: '', gender: '', age: '', handedness: '' },
    });
  },

  onCloseUserForm() {
    this.setData({ showUserForm: false });
  },

  onStopPropagation() {},

  onUserFormSubmit(e) {
    const form = e.detail.value;
    if (!form.name || !form.gender || !form.age || !form.handedness) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' }); return;
    }
    const age = parseInt(form.age);
    if (isNaN(age) || age < 1 || age > 120) {
      wx.showToast({ title: '年龄无效', icon: 'none' }); return;
    }
    const user = {
      name: form.name,
      gender: parseInt(form.gender),
      age,
      handedness: parseInt(form.handedness),
    };
    setCurrentUser(user);
    if (saveCurrentUser) saveCurrentUser(user);
    this.setData({ currentUser: user, userMetaStr: this._buildUserMeta(user), showUserForm: false });

    // [v3.9.25] 立即持久化个人信息到固件A区（不带user_score=profile-only）
    if (wifiClient.isConnected()) {
      wifiClient.sendQuery('save_calib', {
        name: user.name, age: user.age, gender: user.gender, handedness: user.handedness
      }).then(() => {
        logger.log('[calibrate] profile persisted to A-zone');
      }).catch(e => {
        logger.log('[calibrate] profile persist failed: ' + (e.message || e));
      });
    }
    wx.showToast({ title: '已保存', icon: 'none' });
  },

  // ===================== 校准流程 =====================
  async startCalibration() {
    logger.log('[calibrate] startCalibration');
    const user = getCurrentUser();
    if (!user) { this.onFirstUseCalibrate(); return; }
    if (!this._checkWifi()) return;

    this._resetAll();
    this.setData({
      phase: 'relax',
      statusText: '请保持放松，采集静息态数据中...（10秒）',
    });

    // 固件端计时：record_relax → 固件启动10秒累积 → 推送relax_done
    this._registerCallbacks();
    try {
      const resp = await wifiClient.sendQuery('record_relax');
      logger.log('[calibrate] record_relax ack: ' + JSON.stringify(resp));
      if (!resp || !resp.ok) {
        wx.showToast({ title: '启动校准失败', icon: 'none' }); this._resetAll(); return;
      }
      // 等待固件推送relax_done...
    } catch(e) {
      logger.log('[calibrate] record_relax error: ' + (e.message || e));
      wx.showToast({ title: '网络错误', icon: 'none' }); this._resetAll();
    }
  },

  async onStartActive() {
    logger.log('[calibrate] onStartActive');
    if (!this._checkWifi()) return;
    const user = getCurrentUser();
    if (!user) { wx.showToast({ title: '请先录入用户信息', icon: 'none' }); return; }

    this.setData({
      phase: 'active_contract',
      statusText: '请全力握紧拳头，保持15秒！',
    });

    // 固件端计时：record_active → 固件启动15秒累积 → 推送active_done
    this._registerCallbacks();
    try {
      const resp = await wifiClient.sendQuery('record_active');
      logger.log('[calibrate] record_active ack: ' + JSON.stringify(resp));
      if (!resp || !resp.ok) {
        wx.showToast({ title: '启动收缩采集失败', icon: 'none' }); this._resetAll(); return;
      }
      // 等待固件推送active_done...
    } catch(e) {
      logger.log('[calibrate] record_active error: ' + (e.message || e));
      wx.showToast({ title: '网络错误', icon: 'none' }); this._resetAll();
    }
  },

  // ===================== 结果校验 =====================
  _validateResult() {
    const { relaxRms, activeRms, relaxMdf, activeMdf, endMdf } = this.data;
    if (relaxRms == null || activeRms == null) {
      this.setData({ validation: { ok: false, rms_ok: false, mdf_ok: false }, statusText: '数据不完整，请重新校准' });
      return;
    }
    // RMS: max > 2x rest 且 max >= 0.5mV
    const rms_ok = activeRms > relaxRms * 2.0 && activeRms >= 0.5;
    // MDF: 范围 10-250 Hz
    const mdf_ok = (relaxMdf == null || (relaxMdf >= 10 && relaxMdf <= 250)) &&
                   (activeMdf == null || (activeMdf >= 10 && activeMdf <= 250));
    this.setData({
      validation: { ok: rms_ok && mdf_ok, rms_ok, mdf_ok },
      statusText: rms_ok && mdf_ok ? '校准通过' : '校准未达标',
    });
  },

  // 保存校准数据
  async onConfirmResult() {
    const { validation } = this.data;
    if (!validation.ok) {
      const reasons = [];
      if (!validation.rms_ok) reasons.push('RMS未达标准(需>2倍静息值且>=0.5mV)');
      if (!validation.mdf_ok) reasons.push('MDF超出范围(需10-250Hz)');
      wx.showModal({
        title: '校准数据偏低',
        content: reasons.join('\n') + '\n是否仍要保存？',
        success: (res) => { if (res.confirm) this._doSaveCalib(); }
      });
      return;
    }
    await this._doSaveCalib();
  },

  async _doSaveCalib() {
    const user = this.data.currentUser;
    if (!user) return;
    // [v3.9.30] 检查校准值是否存在，防止覆盖有效数据
    if (this.data.relaxRms == null || this.data.activeRms == null) {
      wx.showToast({ title: '请先完成校准再保存', icon: 'none' });
      return;
    }
    try {
      // [v3.9.25] 附带个人信息 + 默认评分，固件将一起持久化到A区
      const payload = { user_score: 5 };
      if (user.name) payload.name = user.name;
      if (user.age)   payload.age   = user.age;
      if (user.gender) payload.gender = user.gender;
      if (user.handedness) payload.handedness = user.handedness;
      logger.log('[calibrate] save_calib payload: ' + JSON.stringify(payload));
      const res = await wifiClient.sendQuery('save_calib', payload);
      if (res && res.ok) {
        if (res.relax_rms != null && res.active_rms != null) {
          user.relax_rms = res.relax_rms;
          user.active_rms = res.active_rms;
          storage.setCurrentUser(user);
          if (storage.saveCurrentUser) storage.saveCurrentUser(user);
          wx.setStorageSync('calib_data', { relax_rms: res.relax_rms, active_rms: res.active_rms });
          logger.log('[calibrate] calib saved: relax_rms=' + res.relax_rms + ' active_rms=' + res.active_rms);
        }
        wx.showToast({ title: '已保存', icon: 'success' });
        this.setData({ saved: true, statusText: '校准数据已保存' });
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch(e) {
      logger.log('[calibrate] save_calib error: ' + (e.message || e));
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onGoToMonitor() {
    // [FIX] 不在此处发送 start_stream，realtime 页面 onShow() 会自动发送
    // 避免两个快速 start_stream 命令导致固件单槽命令队列溢出
    wx.switchTab({ url: '/pages/realtime/index' });
  },

  onRetryCalib() {
    // 发送 reset_calib 清除固件侧校准基线
    if (wifiClient.isConnected()) {
      wifiClient.send({ cmd: 'reset_calib' });
    }
    this._resetAll();
  },

  // ===================== 清理 =====================
  _resetAll() {
    logger.log('[calibrate] _resetAll');
    this._unregisterCallbacks();
    this.setData({
      phase: 'idle',
      statusText: '点击下方按钮开始校准',
      validation: null,
      saved: false,
      liveRelaxRms: null, liveRelaxMdf: null,
      liveActiveRms: null,  liveActiveMdf:  null,
      relaxRms: null, relaxMdf: null,
      activeRms: null, activeMdf: null, endMdf: null,
    });
  },

  formatGender(v)    { return ['', '男', '女'][v] || '-'; },
  formatHand(v)      { return ['', '左手腕', '右手腕'][v] || '-'; },
  formatAgeGroup(v)  { return ['<18','18-35','36-55','56+'][v] || '-'; },
  _buildUserMeta(u) {
    if (!u) return '';
    return `${u.age}岁 | ${this.formatGender(u.gender)} | ${this.formatHand(u.handedness)}`;
  },
});
