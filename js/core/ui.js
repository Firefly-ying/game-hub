/* ==========================================================================
   ui.js — 无状态渲染函数（组件的 HTML 出口）
   --------------------------------------------------------------------------
   这里只负责「数据 -> HTML 字符串」，不含业务状态。
   视图层（js/views/*）负责取数、状态与事件绑定。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.Util;

  var PATHS = {
    home: '<path d="M3.4 10.6 12 3.5l8.6 7.1"/><path d="M5.6 9.6V20h12.8V9.6"/><path d="M9.8 20v-5.4h4.4V20"/>',
    grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="2.2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2.2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2.2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2.2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.3 4.3"/>',
    chevronLeft: '<path d="M14.5 5.2 8 12l6.5 6.8"/>',
    chevronRight: '<path d="M9.5 5.2 16 12l-6.5 6.8"/>',
    play: '<path d="M8.4 5.6v12.8L19 12z"/>',
    alert: '<path d="M12 4.6 21 20H3z"/><path d="M12 10.2v4.2"/><path d="M12 17.1v.1"/>',
    inbox: '<path d="M4 13.4 6.4 5.2h11.2L20 13.4V19.4H4z"/><path d="M4 13.4h4.2l1 2h5.6l1-2H20"/>'
  };
  var FILLED = { play: true };

  function icon(name, cls) {
    var body = PATHS[name] || PATHS.grid;
    var attrs = FILLED[name]
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
    return '<svg viewBox="0 0 24 24" ' + attrs + ' aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</svg>';
  }

  var ORIENT = { portrait: '竖屏', landscape: '横屏', any: '自适应' };
  var ENTRY = { placeholder: '未接入', iframe: '内嵌网页', canvas: '画布模块', link: '外链跳转' };

  /* 占位配色：accent 显式指定 > order 黄金角分布 > id 散列
     黄金角能让连续新增的条目拿到差异明显的色相，避免相邻卡片撞色 */
  function placeholderHue(game) {
    if (game.accent != null && game.accent !== '') return Number(game.accent) % 360;
    if (typeof game.order === 'number') return Math.round((game.order * 137.508) % 360);
    return U.hueOf(game.id);
  }

  function categoryOf(game) {
    var list = window.Catalog.categories;
    var id = (game.categories || [])[0];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ------------------------------------------------------------------
     占位封面：cover 有值走 <img loading="lazy">，否则用 id 派生的色块
     ------------------------------------------------------------------ */
  function coverMarkup(game, opts) {
    opts = opts || {};
    if (game.cover) {
      return '<img src="' + U.esc(game.cover) + '" alt="' + U.esc(game.coverAlt || game.title) + '"' +
        ' loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async" width="480" height="360">';
    }
    var cat = categoryOf(game);
    var h = placeholderHue(game);
    return '<div class="ph' + (opts.large ? ' ph--lg' : '') + '" style="--c1:hsl(' + h + ' 72% 74%);--c2:hsl(' + ((h + 40) % 360) + ' 68% 52%)" aria-hidden="true">' +
      '<span class="ph__glyph">' + U.esc(cat ? cat.glyph : '◍') + '</span></div>';
  }

  /* ---------------- 游戏卡片 ---------------- */
  function gameCard(game) {
    var cat = categoryOf(game);
    var isPlaceholder = game.status !== 'live';
    return '<a class="card" href="#/game/' + encodeURIComponent(game.id) + '">' +
      '<div class="card__cover">' + coverMarkup(game) +
        (isPlaceholder ? '<span class="badge card__badge">占位</span>' : '') +
      '</div>' +
      '<h3 class="card__title">' + U.esc(game.title) + '</h3>' +
      '<p class="card__meta">' +
        '<span>' + U.esc(cat ? cat.name : '未分类') + '</span>' +
        '<i class="dot"></i>' +
        '<span>' + U.esc(ORIENT[game.orientation] || '未定义') + '</span>' +
      '</p>' +
    '</a>';
  }

  /* ---------------- 首页 Banner 占位 ---------------- */
  function banner(b) {
    var hue = b.hue == null ? 262 : b.hue;
    return '<a class="hero" href="' + U.esc(b.href || '#/categories') + '">' +
      '<div class="ph ph--lg" style="--c1:hsl(' + hue + ' 70% 62%);--c2:hsl(' + ((hue + 46) % 360) + ' 66% 44%)" aria-hidden="true">' +
        '<span class="ph__glyph">' + U.esc(b.glyph || '◍') + '</span>' +
      '</div>' +
      '<div class="hero__scrim"></div>' +
      '<div class="hero__text">' +
        '<span class="hero__kicker">' + U.esc(b.kicker || '推荐位') + '</span>' +
        '<strong class="hero__title">' + U.esc(b.title || '') + '</strong>' +
        '<span class="hero__sub">' + U.esc(b.sub || '') + '</span>' +
      '</div>' +
    '</a>';
  }

  /* ---------------- 骨架屏 ---------------- */
  function gridSkeleton(n) {
    var out = '';
    for (var i = 0; i < (n || 6); i++) {
      out += '<div class="sk-card">' +
        '<div class="sk sk--cover"></div>' +
        '<div class="sk sk--line"></div>' +
        '<div class="sk sk--line sk--60"></div>' +
      '</div>';
    }
    return '<div class="grid">' + out + '</div>';
  }

  function chipSkeleton(n) {
    var out = '';
    for (var i = 0; i < (n || 5); i++) out += '<div class="sk sk--chip"></div>';
    return '<div class="hscroll hscroll--chips">' + out + '</div>';
  }

  function homeSkeleton() {
    return '<div class="sk sk--hero"></div>' +
      chipSkeleton(5) +
      '<div class="section"><div class="sk sk--line sk--w70"></div></div>' +
      '<div class="section">' + gridSkeleton(4) + '</div>';
  }

  function filterSkeleton() {
    return '<div class="filters">' + chipSkeleton(5) +
      '<div class="filters__row"><div class="sk sk--line sk--w70"></div><div class="sk sk--pill"></div></div>' +
      '</div>' + gridSkeleton(6);
  }

  function detailSkeleton() {
    return '<div class="sk sk--hero"></div>' +
      '<div class="sk sk--line" style="margin-top:14px"></div>' +
      '<div class="sk sk--line sk--60" style="margin-top:10px"></div>' +
      '<div class="section">' + gridSkeleton(2) + '</div>';
  }

  /* ---------------- 状态块 ---------------- */
  function emptyState(o) {
    o = o || {};
    return '<div class="state">' +
      '<div class="state__icon">' + icon(o.icon || 'inbox') + '</div>' +
      '<p class="state__title">' + U.esc(o.title || '暂无内容') + '</p>' +
      (o.text ? '<p class="state__text">' + U.esc(o.text) + '</p>' : '') +
      (o.action ? '<a class="btn btn--primary" href="' + U.esc(o.action.href || '#/') + '">' + U.esc(o.action.label || '返回首页') + '</a>' : '') +
    '</div>';
  }

  function errorState(o) {
    o = o || {};
    return '<div class="state state--error">' +
      '<div class="state__icon">' + icon('alert') + '</div>' +
      '<p class="state__title">' + U.esc(o.title || '加载失败') + '</p>' +
      '<p class="state__text">' + U.esc(o.text || '请检查网络后重试。') + '</p>' +
      (o.retry ? '<button class="btn btn--primary" type="button" data-action="retry">重新加载</button>' : '') +
    '</div>';
  }

  function loadingRow(text) {
    return '<div class="loading-row"><span class="spinner" aria-hidden="true"></span>' + U.esc(text || '加载中…') + '</div>';
  }

  function loadMore(hasMore) {
    if (!hasMore) return '<p class="endnote">已经到底了 · 以上均为占位数据</p>';
    return '<button class="btn btn--ghost" type="button" data-loadmore>加载更多</button>';
  }

  /* ---------------- 顶栏 / 底栏 ---------------- */
  function appbar(desc) {
    desc = desc || {};
    if (desc.type === 'home') {
      var site = window.Catalog.site;
      return '<div class="appbar__inner">' +
        '<a class="brand" href="#/" aria-label="' + U.esc(site.name) + ' 首页">' +
          '<span class="brand__mark" aria-hidden="true">' + U.esc(site.mark) + '</span>' +
          '<span class="brand__name">' + U.esc(site.name) + '</span>' +
        '</a>' +
        '<a class="searchbar" href="#/search">' + icon('search') + '<span>搜索游戏 / 标签</span></a>' +
      '</div>';
    }
    return '<div class="appbar__inner">' +
      (desc.back ? '<button class="iconbtn" type="button" data-action="back" aria-label="返回">' + icon('chevronLeft') + '</button>' : '') +
      '<h1 class="appbar__title">' + U.esc(desc.title || '') + '</h1>' +
      (desc.subtitle ? '<span class="appbar__sub">' + U.esc(desc.subtitle) + '</span>' : '') +
    '</div>';
  }

  function tabbar(el, active, tabs) {
    if (!el) return;
    el.innerHTML = '<div class="tabbar__inner">' + tabs.map(function (t) {
      var on = t.id === active;
      return '<a class="tab' + (on ? ' is-active' : '') + '" href="#' + t.path + '"' +
        (on ? ' aria-current="page"' : '') + '>' +
        icon(t.icon) + '<span>' + U.esc(t.label) + '</span>' +
      '</a>';
    }).join('') + '</div>';
  }

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null;
  function toast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 1800);
  }

  window.UI = {
    icon: icon,
    gameCard: gameCard,
    banner: banner,
    coverMarkup: coverMarkup,
    categoryOf: categoryOf,
    gridSkeleton: gridSkeleton,
    homeSkeleton: homeSkeleton,
    filterSkeleton: filterSkeleton,
    detailSkeleton: detailSkeleton,
    emptyState: emptyState,
    errorState: errorState,
    loadingRow: loadingRow,
    loadMore: loadMore,
    appbar: appbar,
    tabbar: tabbar,
    toast: toast,
    ORIENT: ORIENT,
    ENTRY: ENTRY
  };
})();
