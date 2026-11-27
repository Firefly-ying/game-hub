/* ==========================================================================
   views/list.js — 分类 / 列表页：分类筛选 + 排序 + 加载更多（占位）
   --------------------------------------------------------------------------
   交互策略：
     · 筛选与排序只重绘列表区域，不整页重新挂载（避免骨架屏闪烁）；
     · URL 用 history.replaceState 静默同步，可复制、可刷新还原；
     · 「加载更多」走同一接口分页，追加渲染。
   ========================================================================== */
(function () {
  'use strict';
  var U = window.Util, UI = window.UI, Repo = window.GameRepo, C = window.Catalog;

  window.Views = window.Views || {};

  function readQuery(query) {
    return {
      c: query.c || 'all',
      sort: query.sort || 'recommended'
    };
  }

  window.Views.List = {
    tab: 'categories',

    appbar: function (ctx) {
      var cat = C.categories.filter(function (x) { return x.id === ctx.query.c; })[0];
      return { type: 'page', title: cat && cat.id !== 'all' ? cat.name : '全部分类' };
    },

    load: function (ctx) {
      var state = readQuery(ctx.query);
      return Repo.list({ category: state.c, sort: state.sort, page: 1 }).then(function (page) {
        return { state: state, page: page };
      });
    },

    skeleton: function () { return UI.filterSkeleton(); },

    render: function (ctx, data) {
      var state = data.state;
      var page = data.page;

      var chips = C.categories.map(function (c) {
        var on = c.id === state.c;
        return '<button class="chip' + (on ? ' is-active' : '') + '" type="button" data-cat="' + c.id + '"' +
          ' aria-pressed="' + on + '">' +
          '<span aria-hidden="true">' + U.esc(c.glyph) + '</span>' + U.esc(c.name) +
        '</button>';
      }).join('');

      var options = C.sorts.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === state.sort ? ' selected' : '') + '>' + U.esc(s.name) + '</option>';
      }).join('');

      var isEmpty = page.items.length === 0;

      return '' +
        '<div class="filters">' +
          '<div class="hscroll hscroll--chips" role="group" aria-label="按分类筛选">' + chips + '</div>' +
          '<div class="filters__row">' +
            '<span class="filters__count">共 <b data-count>' + page.total + '</b> 个占位条目</span>' +
            '<label class="sr-only" for="sortSelect">排序方式</label>' +
            '<select class="select" id="sortSelect">' + options + '</select>' +
          '</div>' +
        '</div>' +
        '<div id="listBody">' +
          '<div class="grid" id="listGrid"' + (isEmpty ? ' hidden' : '') + '>' +
            page.items.map(UI.gameCard).join('') +
          '</div>' +
          '<div id="listEmpty">' +
            (isEmpty ? UI.emptyState({
              title: '这个分类还没有内容',
              text: '当前分类下暂无占位条目，可以切换其他分类或查看全部。',
              action: { label: '查看全部分类', href: '#/categories' }
            }) : '') +
          '</div>' +
          '<div class="loadmore" id="listMore">' + (isEmpty ? '' : UI.loadMore(page.hasMore)) + '</div>' +
        '</div>';
    },

    after: function (root, ctx, data) {
      var state = {
        c: data.state.c,
        sort: data.state.sort,
        page: 1,
        total: data.page.total,
        hasMore: data.page.hasMore
      };

      var grid = root.querySelector('#listGrid');
      var empty = root.querySelector('#listEmpty');
      var more = root.querySelector('#listMore');
      var count = root.querySelector('[data-count]');
      var chips = U.qsa('[data-cat]', root);
      var sortSel = root.querySelector('#sortSelect');

      function syncUrl() {
        var p = new URLSearchParams();
        if (state.c !== 'all') p.set('c', state.c);
        if (state.sort !== 'recommended') p.set('sort', state.sort);
        var s = p.toString();
        try {
          history.replaceState(null, '', '#/categories' + (s ? '?' + s : ''));
        } catch (e) {
          /* file:// 下少数浏览器禁止 replaceState，忽略即可，功能不受影响 */
        }
      }

      function paintChips() {
        chips.forEach(function (ch) {
          var on = ch.getAttribute('data-cat') === state.c;
          ch.classList.toggle('is-active', on);
          ch.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }

      function paintTail() {
        var isEmpty = state.total === 0;
        grid.hidden = isEmpty;
        empty.innerHTML = isEmpty ? UI.emptyState({
          title: '这个分类还没有内容',
          text: '当前分类下暂无占位条目，可以切换其他分类或查看全部。',
          action: { label: '查看全部分类', href: '#/categories' }
        }) : '';
        more.innerHTML = isEmpty ? '' : UI.loadMore(state.hasMore);
      }

      function fetchPage(reset) {
        if (reset) {
          empty.innerHTML = '';
          more.innerHTML = '';
          grid.hidden = false;
          grid.innerHTML = UI.gridSkeleton(4);
        } else {
          more.innerHTML = UI.loadingRow('加载更多…');
        }
        return Repo.list({ category: state.c, sort: state.sort, page: state.page }).then(function (res) {
          state.total = res.total;
          state.hasMore = res.hasMore;
          if (count) count.textContent = String(res.total);

          var html = res.items.map(UI.gameCard).join('');
          if (reset) grid.innerHTML = html;
          else grid.insertAdjacentHTML('beforeend', html);

          paintTail();
        }).catch(function () {
          more.innerHTML = '<p class="endnote">加载失败，请稍后重试。</p>';
        });
      }

      U.on(root, 'click', '[data-cat]', function (e, el) {
        var next = el.getAttribute('data-cat');
        if (next === state.c) return;
        state.c = next;
        state.page = 1;
        paintChips();
        syncUrl();
        fetchPage(true);
      });

      U.on(root, 'click', '[data-loadmore]', function () {
        if (!state.hasMore) return;
        state.page += 1;
        fetchPage(false);
      });

      if (sortSel) {
        sortSel.addEventListener('change', function () {
          state.sort = sortSel.value;
          state.page = 1;
          syncUrl();
          fetchPage(true);
        });
      }
    }
  };
})();
