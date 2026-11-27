/* ==========================================================================
   views/search.js — 搜索页：输入防抖 + 结果 / 空结果状态
   --------------------------------------------------------------------------
   当前在本地占位数据内过滤；接后端时替换 GameRepo.list({q}) 即可。
   ========================================================================== */
(function () {
  'use strict';
  var U = window.Util, UI = window.UI, Repo = window.GameRepo, C = window.Catalog;

  window.Views = window.Views || {};

  function promptHtml() {
    var chips = C.categories.filter(function (c) { return c.id !== 'all'; }).map(function (c) {
      return '<a class="chip" href="#/categories?c=' + encodeURIComponent(c.id) + '">' +
        '<span aria-hidden="true">' + U.esc(c.glyph) + '</span>' + U.esc(c.name) + '</a>';
    }).join('');

    return '<section class="section">' +
      '<div class="hscroll hscroll--chips">' + chips + '</div>' +
      '<p class="hint">输入关键词后，将在本地占位数据中实时过滤（防抖 260ms）。后续可替换为搜索接口。</p>' +
    '</section>';
  }

  window.Views.Search = {
    tab: 'search',

    appbar: function () { return { type: 'page', title: '搜索' }; },

    render: function (ctx) {
      var initial = ctx.query.q || '';
      return '' +
        '<form id="searchForm" role="search">' +
          '<label class="sr-only" for="q">搜索游戏</label>' +
          '<div class="field">' + UI.icon('search') +
            '<input id="q" name="q" type="search" enterkeyhint="search" autocomplete="off"' +
            ' placeholder="输入游戏名 / 标签" value="' + U.esc(initial) + '">' +
          '</div>' +
        '</form>' +
        '<div id="searchBody"></div>';
    },

    after: function (root, ctx) {
      var input = root.querySelector('#q');
      var form = root.querySelector('#searchForm');
      var body = root.querySelector('#searchBody');
      var alive = true;

      function run(keyword) {
        var kw = String(keyword || '').trim();
        if (!kw) { body.innerHTML = promptHtml(); return; }

        body.innerHTML = UI.loadingRow('搜索中…');
        Repo.list({ q: kw, page: 1, pageSize: 24 }).then(function (res) {
          if (!alive) return;
          if (!res.total) {
            body.innerHTML = UI.emptyState({
              title: '没有找到匹配项',
              text: '没有与「' + kw + '」匹配的占位条目，换个关键词试试。',
              action: { label: '返回首页', href: '#/' }
            });
            return;
          }
          body.innerHTML =
            '<p class="resultline">找到 ' + res.total + ' 个占位条目</p>' +
            '<div class="grid">' + res.items.map(UI.gameCard).join('') + '</div>';
        }).catch(function () {
          if (!alive) return;
          body.innerHTML = UI.errorState({
            title: '搜索失败',
            text: '关键词没有查成功，请稍后重试。',
            retry: true
          });
        });
      }

      var debounced = U.debounce(function () { run(input.value); }, 260);

      input.addEventListener('input', debounced);
      input.addEventListener('search', function () { run(input.value); });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        input.blur();
        run(input.value);
      });

      run(ctx.query.q || '');

      return function () { alive = false; };
    }
  };
})();
