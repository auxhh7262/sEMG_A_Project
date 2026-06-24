/**
 * 统一日志模块 — 只输出到控制台，不再使用 wx.request 阻塞网络
 */
function log(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

function error(...args) {
  console.error(...args);
}

module.exports = { log, warn, error };
