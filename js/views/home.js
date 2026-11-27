/* ==========================================================================
   views/home.js — 首页：推荐位 + 分类入口 + 推荐游戏
   ========================================================================== */
(function () {
  'use strict';
  var U = window.Util, UI = window.UI, Repo = window.GameRepo, C = window.Catalog;

  window.Views = window.Views || {};

  window.Views.Home = {
    tab: 'home',

    appbar: function () { return { type: 'home' }; },

    load: function () {
      return Promise.all([
        Repo.banners(),
        Repo.list({ sort: 'recommended', page: 1, pageSize: 6 })
      ]).then(function (res) {
        return {
          banners: res[0],
          list: res[1],
          cats: C.categories.filter(function (c) { return c.id !== 'all'; })
        };
      });
    },

    skeleton: function () { return UI.homeSkeleton(); },

    render: function (ctx, data) {
      var cats = data.cats;

      var heroHtml = data.banners.map(UI.banner).join('');

      var catHtml = cats.map(function (c) {
        return '<a class="chip" href="#/categories?c=' + encodeURIComponent(c.id) + '">' +
          '<span aria-hidden="true">' + U.esc(c.glyph) + '</span>' + U.esc(c.name) +
        '</a>';
      }).join('');

      var cardsHtml = data.list.items.map(UI.gameCard).join('');

      return '' +
        '<div class="hscroll" aria-label="推荐位（占位）">' + heroHtml + '</div>' +

        '<section class="section">' +
          '<div class="section__head">' +
            '<h2 class="section__title">分类</h2>' +
            '<a class="section__more" href="#/categories">全部' + UI.icon('chevronRight') + '</a>' +
          '</div>' +
          '<div class="hscroll hscroll--chips">' + catHtml + '</div>' +
        '</section>' +

        '<section class="section">' +
          '<div class="section__head">' +
            '<h2 class="section__title">推荐游戏</h2>' +
            '<a class="section__more" href="#/categories">查看全部' + UI.icon('chevronRight') + '</a>' +
          '</div>' +
          '<div class="grid">' + cardsHtml + '</div>' +
          '<p class="hint">以上 ' + data.list.total + ' 条均为占位数据，仅用于验证布局与交互。</p>' +
        '</section>' +

        '<section class="section">' +
          '<div class="notice">' +
            '<strong>框架说明</strong>' +
            '<p>本页不含具体游戏。新增游戏只需在 <code>js/data/catalog.js</code> 追加一条配置，卡片、详情页与启动页会自动可用。</p>' +
          '</div>' +
        '</section>';
    }
  };
})();
