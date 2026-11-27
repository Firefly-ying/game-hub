/* ==========================================================================
   router.js — 极简 hash 路由（无依赖）
   --------------------------------------------------------------------------
   路由表由 js/app.js 注入；每个视图只实现下列可选成员：
     appbar(ctx)   -> 顶栏描述 {type:'home'} | {type:'page', title, back, subtitle}
     tab         -> 底部导航高亮 id（null = 不高亮）
     immersive   -> true 时隐藏全局导航（游戏运行页）
     className   -> 追加到视图容器的类名
     skeleton(ctx)      -> 加载态 HTML（可选，缺省用网格骨架）
     load(ctx)          -> Promise<data>（可选，有则自动走「骨架屏 -> 内容 / 错误态」）
     render(ctx, data)  -> HTML 字符串（必填）
     after(root, ctx, data) -> 绑定事件；返回函数作为离开时的清理钩子
   ========================================================================== */
(function () {
  'use strict';

  var U = window.Util;
  var UI = window.UI;

  var options = null;
  var seq = 0;          // 渲染令牌：防止慢请求覆盖新页面
  var dispose = null;   // 上一个视图的清理函数

  function parseHash(hash) {
    var raw = (hash || '').replace(/^#/, '') || '/';
    var i = raw.indexOf('?');
    var path = (i === -1 ? raw : raw.slice(0, i)) || '/';
    var query = {};
    if (i !== -1) {
      new URLSearchParams(raw.slice(i + 1)).forEach(function (v, k) { query[k] = v; });
    }
    if (path.charAt(0) !== '/') path = '/' + path;
    return { path: path, query: query };
  }

  function matchPath(path) {
    for (var i = 0; i < options.routes.length; i++) {
      var r = options.routes[i];
      var keys = [];
      var pattern = r.path.replace(/:([A-Za-z0-9_]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; });
      var m = path.match(new RegExp('^' + pattern + '/?$'));
      if (m) {
        var params = {};
        for (var j = 0; j < keys.length; j++) params[keys[j]] = decodeURIComponent(m[j + 1]);
        return { route: r, params: params };
      }
    }
    return null;
  }

  function runCleanup() {
    if (typeof dispose === 'function') {
      try { dispose(); } catch (e) { /* 清理失败不影响新页面 */ }
    }
    dispose = null;
  }

  function renderNotFound(path) {
    options.appbarEl.innerHTML = UI.appbar({ type: 'page', title: '页面不存在', back: true });
    UI.tabbar(options.tabbarEl, null, options.tabs);
    document.body.classList.remove('is-immersive');
    document.body.classList.remove('is-tabless');
    options.mountEl.className = 'view';
    options.mountEl.innerHTML = UI.emptyState({
      icon: 'alert',
      title: '没有这个页面',
      text: '链接可能已失效：' + path,
      action: { label: '返回首页', href: '#/' }
    });
  }

  function paint(route, ctx) {
    var view = route.view;

    var desc = typeof view.appbar === 'function' ? view.appbar(ctx) : { type: 'page', title: view.title || '' };
    options.appbarEl.innerHTML = UI.appbar(desc);
    document.title = (desc.title ? desc.title + ' · ' : '') + window.Catalog.site.name;

    document.body.classList.toggle('is-immersive', !!view.immersive);
    document.body.classList.toggle('is-tabless', view.tab == null);
    UI.tabbar(options.tabbarEl, view.tab, options.tabs);

    var cls = 'view';
    if (view.className) cls += ' ' + view.className;
    if (view.immersive) cls += ' view--full';
    options.mountEl.className = cls;
  }

  function render() {
    var parsed = parseHash(location.hash);
    var hit = matchPath(parsed.path);
    var token = ++seq;

    runCleanup();

    if (!hit) { renderNotFound(parsed.path); return Promise.resolve(); }

    var route = hit.route;
    var view = route.view;
    var ctx = { path: parsed.path, params: hit.params, query: parsed.query, route: route };

    paint(route, ctx);

    var mount = options.mountEl;

    // 同步视图：直接渲染
    if (typeof view.load !== 'function') {
      mount.innerHTML = view.render(ctx);
      if (view.after) dispose = view.after(mount, ctx) || null;
      window.scrollTo(0, 0);
      return Promise.resolve();
    }

    // 异步视图：骨架屏 -> 内容 / 错误态
    mount.innerHTML = typeof view.skeleton === 'function' ? view.skeleton(ctx) : UI.gridSkeleton(6);

    return view.load(ctx).then(function (data) {
      if (token !== seq) return null;          // 已被新路由替换
      mount.innerHTML = view.render(ctx, data);
      if (view.after) dispose = view.after(mount, ctx, data) || null;
      window.scrollTo(0, 0);
      return null;
    }).catch(function (err) {
      if (token !== seq) return null;
      mount.innerHTML = UI.errorState({
        title: '加载失败',
        text: (err && err.message) || '数据没有返回，请稍后重试。',
        retry: true
      });
      return null;
    });
  }

  window.Router = {
    init: function (opts) {
      options = opts;
      window.addEventListener('hashchange', render);
      if (!location.hash) location.hash = '#/';
      render();
    },
    /** 重新渲染当前路由（错误态「重新加载」按钮用） */
    reload: function () { render(); },
    /** 编程式跳转 */
    go: function (path) { location.hash = '#' + path; }
  };
})();
