// utils/storage.js - 用户profile本地存储工具（单用户版）
// [v3.9.25] localStorage 为快照缓存（快速UI展示），固件A区Flash为权威数据源
// 校准数据存储在 wx.storage: 'user_profile', 'current_user', 'calib_data'

function getCurrentUser() {
  return wx.getStorageSync('current_user') || null;
}

function setCurrentUser(user) {
  if (!user) return;
  wx.setStorageSync('current_user', user);
}

function saveCurrentUser(user) {
  if (!user) return;
  wx.setStorageSync('user_profile', user);
  wx.setStorageSync('current_user', user);
}

function loadUserProfile() {
  return wx.getStorageSync('user_profile') || null;
}

function clearUserProfile() {
  wx.removeStorageSync('user_profile');
  wx.removeStorageSync('current_user');
}

function getAgeGroup(age) {
  if (age < 18) return 0;  // <18
  if (age <= 35) return 1; // 18-35
  if (age <= 55) return 2; // 36-55
  return 3;                 // 56+
}

module.exports = {
  getCurrentUser,
  setCurrentUser,
  saveCurrentUser,
  loadUserProfile,
  clearUserProfile,
  getAgeGroup,
};
