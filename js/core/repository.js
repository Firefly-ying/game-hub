/* ==========================================================================
   repository.js — 数据访问层（唯一的「数据出口」）
   --------------------------------------------------------------------------
   所有视图只调用 GameRepo，不直接读 window.Catalog。
   后续接真实后端时，只替换本文件内部实现为 fetch('/api/games?...')，
   视图与组件不需要改动。
   ========================================================================== */
(function () {
  'use strict';

  var C = window.Catalog;

  var config = {
    /* 模拟网络延迟：用于演示骨架屏 / 加载态。
       接入真实接口后设为 0，或删除 sleep 调用。 */
    latency: 320,
    pageSize: 8
  };

  function wait() {
    return config.latency > 0 ? window.Util.sleep(config.latency) : Promise.resolve();
  }

  function byOrder(a, b) { return a.order - b.order; }

  function sortItems(items, sort) {
    var copy = items.slice();
    if (sort === 'newest') {
      // 占位：暂无发布时间字段，按 order 倒序代替
      return copy.sort(function (a, b) { return b.order - a.order; });
    }
    if (sort === 'popular') {
      // 占位：未接入统计，plays 为 null 的一律排在后面，其余按 order 兜底
      return copy.sort(function (a, b) {
        var pa = a.stats && a.stats.plays;
        var pb = b.stats && b.stats.plays;
        if (pa == null && pb == null) return a.order - b.order;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pb - pa;
      });
    }
    return copy.sort(byOrder);
  }

  function matches(game, keyword) {
    var hay = [game.title, game.subtitle, game.summary, game.description]
      .concat(game.tags || [])
      .join(' ')
      .toLowerCase();
    return hay.indexOf(keyword) !== -1;
  }

  var GameRepo = {
    config: config,

    /** 分页列表：分类过滤 + 关键字 + 排序 */
    list: function (opts) {
      opts = opts || {};
      var category = opts.category || 'all';
      var sort = opts.sort || 'recommended';
      var page = opts.page || 1;
      var pageSize = opts.pageSize || config.pageSize;
      var kw = String(opts.q || '').trim().toLowerCase();

      return wait().then(function () {
        var items = C.games.slice();
        if (category && category !== 'all') {
          items = items.filter(function (g) { return (g.categories || []).indexOf(category) !== -1; });
        }
        if (kw) items = items.filter(function (g) { return matches(g, kw); });

        items = sortItems(items, sort);

        var total = items.length;
        var start = (page - 1) * pageSize;
        var slice = items.slice(start, start + pageSize);

        return {
          items: slice,
          total: total,
          page: page,
          pageSize: pageSize,
          hasMore: start + pageSize < total
        };
      });
    },

    /** 单条详情；找不到返回 null（由视图渲染空状态，而不是抛错） */
    byId: function (id) {
      return wait().then(function () {
        var found = null;
        for (var i = 0; i < C.games.length; i++) {
          if (C.games[i].id === id) { found = C.games[i]; break; }
        }
        return found;
      });
    },

    /** 相关推荐：同分类优先，不足则按 order 补齐 */
    related: function (game, limit) {
      limit = limit || 2;
      return wait().then(function () {
        var cats = game.categories || [];
        var same = C.games.filter(function (g) {
          return g.id !== game.id && (g.categories || []).some(function (c) { return cats.indexOf(c) !== -1; });
        });
        var rest = C.games.filter(function (g) {
          return g.id !== game.id && same.indexOf(g) === -1;
        });
        return same.concat(rest).sort(byOrder).slice(0, limit);
      });
    },

    /** 首页推荐位（当前读本地配置，后续可换成运营位接口） */
    banners: function () {
      return wait().then(function () { return C.banners.slice(); });
    },

    /** 分类与排序项（通常静态，保留异步签名以便后续下发） */
    meta: function () {
      return Promise.resolve({
        categories: C.categories,
        sorts: C.sorts
      });
    }
  };

  window.GameRepo = GameRepo;
})();
