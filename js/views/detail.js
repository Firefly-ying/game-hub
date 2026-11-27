/* ==========================================================================
   views/detail.js — 游戏详情 / 启动入口
   --------------------------------------------------------------------------
   只展示配置里的元信息 + 占位资源，并提供跳转到启动页的主 CTA。
   ========================================================================== */
(function () {
  'use strict';
  var U = window.Util, UI = window.UI, Repo = window.GameRepo, C = window.Catalog;

  window.Views = window.Views || {};

  function stat(value) {
    return value == null
      ? '<dd class="is-empty">—</dd>'
      : '<dd>' + U.esc(value) + '</dd>';
  }

  window.Views.Detail = {
    className: 'view--detail',
    tab: null,                     // 详情页只保留底部 CTA，不显示 tab 导航

    appbar: function () { return { type: 'page', title: '游戏详情', back: true }; },

    load: function (ctx) {
      return Repo.byId(ctx.params.id).then(function (game) {
        if (!game) return { game: null, related: [] };
        return Repo.related(game, 2).then(function (related) {
          return { game: game, related: related };
        });
      });
    },

    skeleton: function () { return UI.detailSkeleton(); },

    render: function (ctx, data) {
      if (!data.game) {
        return UI.emptyState({
          icon: 'alert',
          title: '没有这个占位条目',
          text: '链接可能已失效，或该游戏还没有写入配置。',
          action: { label: '返回全部分类', href: '#/categories' }
        });
      }

      var g = data.game;
      var isPlaceholder = g.status !== 'live';
      var entryType = (g.entry && g.entry.type) || 'placeholder';
      var plays = g.stats ? g.stats.plays : null;
      var rating = g.stats ? g.stats.rating : null;

      var catNames = (g.categories || []).map(function (id) {
        var c = C.categories.filter(function (x) { return x.id === id; })[0];
        return c ? c.name : id;
      });

      var tags = catNames.concat(g.tags || []).map(function (t) {
        return '<span class="tag">' + U.esc(t) + '</span>';
      }).join('');

      var related = data.related.map(UI.gameCard).join('');

      return '' +
        '<div class="detail__cover">' +
          UI.coverMarkup(g, { large: true, eager: true }) +
          (isPlaceholder ? '<span class="badge card__badge">占位</span>' : '') +
        '</div>' +

        '<header class="detail__head">' +
          '<h2 class="detail__title">' + U.esc(g.title) + '</h2>' +
          (g.subtitle ? '<p class="detail__sub">' + U.esc(g.subtitle) + '</p>' : '') +
          '<div class="tagrow">' + tags + '</div>' +
          '<dl class="metagrid">' +
            '<div><dt>屏向</dt><dd>' + U.esc(UI.ORIENT[g.orientation] || '未定义') + '</dd></div>' +
            '<div><dt>接入方式</dt><dd>' + U.esc(UI.ENTRY[entryType] || '未定义') + '</dd></div>' +
            '<div><dt>游玩次数</dt>' + stat(plays) + '</div>' +
            '<div><dt>评分</dt>' + stat(rating) + '</div>' +
          '</dl>' +
        '</header>' +

        '<section class="block">' +
          '<h3>简介</h3>' +
          '<p>' + U.esc(g.description || g.summary || '简介占位。') + '</p>' +
        '</section>' +

        '<section class="block">' +
          '<h3>画面占位</h3>' +
          '<div class="shots">' +
            '<div>画面 1</div><div>画面 2</div><div>画面 3</div>' +
          '</div>' +
        '</section>' +

        '<section class="block">' +
          '<h3>接入说明</h3>' +
          '<p>当前 entry.type = <code>' + U.esc(entryType) + '</code>，启动页只渲染容器占位，不加载任何玩法。' +
          '接入真实游戏时，把 entry 改为 iframe / canvas / link，并在启动页挂载即可。</p>' +
        '</section>' +

        (data.related.length ?
          '<section class="block">' +
            '<h3>相关占位</h3>' +
            '<div class="grid grid--2">' + related + '</div>' +
          '</section>' : '') +

        '<div class="actionbar">' +
          '<div class="actionbar__inner">' +
            '<a class="btn btn--primary btn--grow" href="#/play/' + encodeURIComponent(g.id) + '">' +
              UI.icon('play') + '开始游戏' +
            '</a>' +
            '<button class="btn btn--ghost" type="button" data-action="toast" data-msg="收藏功能未实现（框架占位）">收藏</button>' +
          '</div>' +
        '</div>';
    }
  };
})();
