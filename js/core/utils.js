/* ==========================================================================
   utils.js — 无依赖小工具
   ========================================================================== */
(function () {
  'use strict';

  /** HTML 转义：所有插入模板的数据都要过一遍（数据虽本地，仍按不可信处理） */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 字符串 -> 0..359 的稳定色相：让每个占位游戏拥有专属配色
      用 FNV-1a，相邻 id（g-001 / g-002）也能落到明显不同的色相上 */
  function hueOf(str) {
    var s = String(str || 'x');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 360;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** 事件委托：只在容器上绑一次 */
  function on(root, type, sel, handler) {
    root.addEventListener(type, function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var m = t.closest(sel);
      if (m && root.contains(m)) handler(e, m);
    });
  }

  window.Util = { esc: esc, hueOf: hueOf, sleep: sleep, debounce: debounce, qs: qs, qsa: qsa, on: on };
})();
