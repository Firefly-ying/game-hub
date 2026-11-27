/* ==========================================================================
   views/play.js — 游戏启动页（容器占位 + 挂载扩展点）
   --------------------------------------------------------------------------
   本页只负责：全屏容器、返回、尺寸广播、以及把真实游戏挂到 #gameMount。
   玩法代码不属于本框架；GameMount.mount 是唯一的挂载入口。
   ========================================================================== */
(function () {
  'use strict';
  var U = window.Util, UI = window.UI, Repo = window.GameRepo;

  window.Views = window.Views || {};

  /* ------------------------------------------------------------------
     玩法模块加载器
       · entry.module 相对 js/ 目录解析，例如 './games/connect6.js' -> js/games/connect6.js
       · 文件名即 window.Games 的键（connect6.js -> window.Games.connect6）
       · classic script 注入，file:// 下同样可用；同一模块只加载一次
     ------------------------------------------------------------------ */
  var moduleCache = {};

  function resolveModule(modulePath) {
    var p = String(modulePath || '').replace(/^\.?\//, '');
    return 'js/' + p;
  }

  function moduleKey(modulePath) {
    return String(modulePath || '').split('/').pop().replace(/\.js.*$/, '');
  }

  function loadModule(src) {
    if (moduleCache[src]) return moduleCache[src];
    moduleCache[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(src); };
      s.onerror = function () {
        delete moduleCache[src];
        reject(new Error('玩法模块加载失败：' + src));
      };
      document.head.appendChild(s);
    });
    return moduleCache[src];
  }

  /* ------------------------------------------------------------------
     游戏挂载扩展点
       目前只实现 iframe 的最小骨架；canvas / link 留出明确分支。
       新增玩法时在这里按 entry.type 扩展，无需改动路由与页面结构。
     ------------------------------------------------------------------ */
  var GameMount = {
    mount: function (mountEl, game) {
      if (!mountEl || !game) return null;
      var entry = game.entry || { type: 'placeholder' };

      if (entry.type === 'iframe' && entry.src) {
        var frame = document.createElement('iframe');
        frame.src = entry.src;
        frame.title = game.title + ' 游戏画面';
        frame.setAttribute('allow', 'fullscreen; autoplay; gamepad; accelerometer; gyroscope');
        frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#000';
        mountEl.appendChild(frame);
        mountEl.style.pointerEvents = 'auto';
        return {
          type: 'iframe',
          destroy: function () { frame.remove(); }
        };
      }

      if (entry.type === 'canvas' && entry.module) {
        var src = resolveModule(entry.module);
        var key = moduleKey(entry.module);
        var handle = { type: 'canvas', destroy: function () {} };
        var disposed = false;

        mountEl.style.pointerEvents = 'auto';
        mountEl.innerHTML = '<div class="play-loading"><span class="spinner"></span>正在加载玩法…</div>';

        loadModule(src).then(function () {
          if (disposed) return;
          var mod = window.Games && window.Games[key];
          if (!mod || typeof mod.mount !== 'function') {
            mountEl.innerHTML = '<p class="play-error">模块已加载，但没有导出 window.Games.' + key + '.mount()</p>';
            return;
          }
          mountEl.innerHTML = '';
          var inst = null;
          try {
            inst = mod.mount(mountEl, { game: game });
          } catch (err) {
            console.error('[GameMount] 挂载失败', err);
            mountEl.innerHTML = '<p class="play-error">玩法初始化失败：' + (err && err.message ? err.message : '未知错误') + '</p>';
            return;
          }
          if (inst) handle = inst;
        }).catch(function (err) {
          if (disposed) return;
          mountEl.innerHTML = '<p class="play-error">' + (err && err.message ? err.message : '玩法加载失败') + '</p>';
        });

        return {
          type: 'canvas',
          destroy: function () {
            disposed = true;
            if (handle && typeof handle.destroy === 'function') handle.destroy();
            mountEl.innerHTML = '';
          }
        };
      }

      if (entry.type === 'link' && entry.src) {
        // 外链模式由详情页直接跳转，启动页不做内嵌。
        return null;
      }

      // placeholder：不渲染任何游戏内容
      return null;
    }
  };

  window.GameMount = GameMount;

  window.Views.Play = {
    immersive: true,

    appbar: function () { return { type: 'page', title: '游戏启动' }; },

    load: function (ctx) {
      return Repo.byId(ctx.params.id).then(function (game) { return { game: game }; });
    },

    skeleton: function () {
      return '<div class="play">' +
        '<div class="play__bar"><span class="play__title">游戏启动</span></div>' +
        '<div class="play__stage">' + UI.loadingRow('准备容器…') + '</div>' +
      '</div>';
    },

    render: function (ctx, data) {
      var g = data.game;
      var backBtn = '<button class="iconbtn" type="button" data-action="back" aria-label="返回详情">' +
        UI.icon('chevronLeft') + '</button>';

      if (!g) {
        return '<div class="play">' +
          '<div class="play__bar">' + backBtn + '<span class="play__title">游戏启动</span></div>' +
          '<div class="play__stage">' +
            UI.emptyState({
              title: '没有这个占位条目',
              text: '请从列表重新选择。',
              action: { label: '返回分类', href: '#/categories' }
            }) +
          '</div>' +
        '</div>';
      }

      var entryType = (g.entry && g.entry.type) || 'placeholder';

      /* 已接入真实玩法：舞台只留容器，装饰与说明交给玩法自己 */
      if (entryType !== 'placeholder') {
        return '<div class="play">' +
          '<div class="play__bar">' + backBtn +
            '<span class="play__title">' + U.esc(g.title) + '</span>' +
            '<span class="badge badge--sm">可玩</span>' +
          '</div>' +
          '<div class="play__stage play__stage--live" id="gameStage">' +
            '<div class="stage__mount" id="gameMount" data-game-id="' + U.esc(g.id) + '"></div>' +
          '</div>' +
        '</div>';
      }

      var note = g.orientation === 'landscape'
        ? '该条目配置为横屏，实际玩法接入后请按需锁定方向或提示旋转设备。'
        : g.orientation === 'any'
          ? '该条目允许任意方向，接入后需同时适配横竖屏。'
          : '该条目配置为竖屏，接入后建议保持竖屏体验。';

      return '<div class="play">' +
        '<div class="play__bar">' + backBtn +
          '<span class="play__title">' + U.esc(g.title) + '</span>' +
          '<span class="badge badge--dashed badge--sm">占位</span>' +
        '</div>' +
        '<div class="play__stage" id="gameStage">' +
          '<span class="stage__glyph" aria-hidden="true">' + U.esc(UI.categoryOf(g) ? UI.categoryOf(g).glyph : '◍') + '</span>' +
          '<p class="stage__title">游戏容器占位</p>' +
          '<p class="stage__text">玩法挂载点：<code>#gameMount</code>。当前 entry.type = ' +
            '<code>' + U.esc((g.entry && g.entry.type) || 'placeholder') + '</code>，不加载任何游戏内容。</p>' +
          '<div class="stage__mount" id="gameMount" data-game-id="' + U.esc(g.id) + '"></div>' +
        '</div>' +
        '<p class="play__foot">' + U.esc(note) + '<br>' +
          '接入方式：在 js/views/play.js 的 GameMount.mount() 中扩展，并监听 gamehub:resize 事件重算画布尺寸。</p>' +
      '</div>';
    },

    after: function (root, ctx, data) {
      var stage = root.querySelector('#gameStage');
      var mountEl = root.querySelector('#gameMount');
      var game = data.game;
      var instance = null;

      if (game && mountEl) {
        try {
          instance = GameMount.mount(mountEl, game);
        } catch (err) {
          console.error('[GameMount] 挂载失败', err);
        }
      }

      /* 尺寸广播：真正的游戏实例监听这两个事件做自适应 / 重绘 */
      function broadcast() {
        try {
          window.dispatchEvent(new CustomEvent('gamehub:resize', {
            detail: {
              width: window.innerWidth,
              height: window.innerHeight,
              dpr: window.devicePixelRatio || 1,
              orientation: (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) ? 'landscape' : 'portrait'
            }
          }));
          if (stage) {
            var rect = stage.getBoundingClientRect();
            window.dispatchEvent(new CustomEvent('gamehub:stage', {
              detail: { width: rect.width, height: rect.height }
            }));
          }
        } catch (e) { /* 老环境不支持 CustomEvent 时静默降级 */ }
      }

      broadcast();

      var onResize = U.debounce(broadcast, 120);
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);

      return function () {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        if (instance && typeof instance.destroy === 'function') instance.destroy();
      };
    }
  };
})();
