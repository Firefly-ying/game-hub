/* ==========================================================================
   app.js — 启动入口：路由表、全局动作、滚动状态
   --------------------------------------------------------------------------
   新增页面 = 在这里加一条 route + 一个 js/views/xxx.js，无需改动其他文件。
   ========================================================================== */
(function () {
  'use strict';

  var UI = window.UI;

  var tabs = [
    { id: 'home',       label: '首页', icon: 'home',   path: '/' },
    { id: 'categories', label: '分类', icon: 'grid',   path: '/categories' },
    { id: 'search',     label: '搜索', icon: 'search', path: '/search' }
  ];

  var routes = [
    { path: '/',            view: window.Views.Home },
    { path: '/categories',  view: window.Views.List },
    { path: '/search',      view: window.Views.Search },
    { path: '/game/:id',    view: window.Views.Detail },
    { path: '/play/:id',    view: window.Views.Play }
  ];

  var appbarEl = document.getElementById('appbar');

  window.Router.init({
    routes: routes,
    tabs: tabs,
    mountEl: document.getElementById('view'),
    appbarEl: appbarEl,
    tabbarEl: document.getElementById('tabbar')
  });

  /* ---------- 顶栏滚动分隔线（passive + rAF，避免阻塞滚动） ---------- */
  var ticking = false;
  function syncBar() {
    appbarEl.classList.toggle('is-scrolled', window.scrollY > 4);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(syncBar);
  }, { passive: true });

  /* ---------- 全局动作委托：返回 / 重试 / 占位提示 ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('[data-action="back"]')) {
      e.preventDefault();
      if (history.length > 1) history.back();
      else location.hash = '#/';
      return;
    }

    if (t.closest('[data-action="retry"]')) {
      e.preventDefault();
      window.Router.reload();
      return;
    }

    var toastEl = t.closest('[data-action="toast"]');
    if (toastEl) {
      e.preventDefault();
      UI.toast(toastEl.getAttribute('data-msg') || '该操作尚未实现（框架占位）');
    }
  });

  /* ---------- 兜底：避免异常时白屏无反馈 ---------- */
  window.addEventListener('error', function (e) {
    if (e && e.message) UI.toast('页面出现异常：' + e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var msg = e && e.reason && e.reason.message ? e.reason.message : '未知错误';
    UI.toast('请求异常：' + msg);
  });
})();
