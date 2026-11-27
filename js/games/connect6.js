/* ==========================================================================
   js/games/connect6.js — 六子棋（Connect6）· 框架的第一个真实玩法
   --------------------------------------------------------------------------
   挂载方式：catalog.js 中 entry = { type:'canvas', module:'./games/connect6.js' }
           由 js/views/play.js 的 GameMount.mount() 动态加载并调用
           window.Games.connect6.mount(el, { game }) -> { destroy }。

   规则（默认实现，与需求一致）：
     · 棋盘 19×19；
     · 黑先手，首回合只落 1 子；此后双方轮流，每回合各落 2 子；
     · 横 / 竖 / 斜任一方向连成 6 子即胜；
     · 判胜时机：该回合「任一子落下的瞬间」即判定（不需要等两子落完）；
     · 棋盘填满且无六连 -> 平局。

   文件内部分为五段：规则内核 / AI / 联机传输 / 画布渲染 / 界面控制器。
   全部状态挂在 mount() 的闭包里，destroy() 后不留任何监听、定时器或对局数据。
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'connect6';
  var BLACK = 1;
  var WHITE = 2;
  var SIZE = 19;
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  var STARS = [3, 9, 15];

  /* ==========================================================================
     1. 规则内核
     ========================================================================== */

  function createMatch(size) {
    var n = size || SIZE;
    return {
      size: n,
      board: new Int8Array(n * n),
      turn: BLACK,
      stonesLeft: 1,            // 黑方首回合 1 子
      counts: { 1: 0, 2: 0 },
      over: false,
      result: null,             // { winner: 0|1|2, reason, line }
      last: null                // 最后一手 { r, c }，用于高亮
    };
  }

  function idx(size, r, c) { return r * size + c; }

  /* 返回包含 (r,c) 的六连格子（含超过 6 的部分），无则 null */
  function lineAt(board, size, r, c, color) {
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      var run = [[r, c]];
      var s, rr, cc;
      for (s = 1; s <= 5; s++) {
        rr = r + dr * s; cc = c + dc * s;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) break;
        if (board[rr * size + cc] !== color) break;
        run.push([rr, cc]);
      }
      for (s = 1; s <= 5; s++) {
        rr = r - dr * s; cc = c - dc * s;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) break;
        if (board[rr * size + cc] !== color) break;
        run.unshift([rr, cc]);
      }
      if (run.length >= 6) return run;
    }
    return null;
  }

  function boardFull(board) {
    for (var i = 0; i < board.length; i++) if (!board[i]) return false;
    return true;
  }

  /* 落一子并推进回合。返回 true 表示落子成功（含直接终局） */
  function commit(m, r, c, color) {
    var size = m.size;
    if (m.over) return false;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    var i = idx(size, r, c);
    if (m.board[i]) return false;

    var side = color || m.turn;
    m.board[i] = side;
    m.counts[side]++;
    m.last = { r: r, c: c };

    /* 判定时机：任一子落下即检查六连 */
    var line = lineAt(m.board, size, r, c, side);
    if (line) {
      m.over = true;
      m.result = { winner: side, reason: 'six', line: line };
      return true;
    }
    if (boardFull(m.board)) {
      m.over = true;
      m.result = { winner: 0, reason: 'draw', line: null };
      return true;
    }

    m.stonesLeft--;
    if (m.stonesLeft <= 0) {
      m.turn = 3 - side;
      m.stonesLeft = 2;
    }
    return true;
  }

  function forfeit(m, winner) {
    m.over = true;
    m.result = { winner: winner, reason: 'resign', line: null };
  }

  function lineDirection(line) {
    if (!line || line.length < 2) return '';
    var a = line[0], b = line[line.length - 1];
    if (a[0] === b[0]) return '横向';
    if (a[1] === b[1]) return '纵向';
    return '斜向';
  }

  /* ==========================================================================
     2. AI —— 三档难度，参数不同 -> 强度不同（不是换皮）
     --------------------------------------------------------------------------
     easy   单点启发式（攻 1.0 / 防 0.45），候选前 6 中随机取，不做对手应手推演
     normal 单点启发式 + 先手必胜/必堵检测 + 2 层（对手最佳应手 70 候选）
     hard   候选前 10 的全部配子推演 + 对手 110 候选应手 + 防守权重 1.0
     ========================================================================== */

  /* 六格窗口内己方子数 -> 价值；下标 6 表示已连成 */
  var PATTERN = [0, 3, 18, 110, 900, 22000, 1000000];

  var LEVELS = {
    easy:   { key: 'easy',   name: '入门', topN: 6,  defW: 0.45, pairs: false, oppTop: 0,   randTop: 3 },
    normal: { key: 'normal', name: '普通', topN: 6,  defW: 0.85, pairs: true,  oppTop: 70,  randTop: 0 },
    hard:   { key: 'hard',   name: '困难', topN: 10, defW: 1.00, pairs: true,  oppTop: 110, randTop: 0 }
  };

  /* 一个空点对某一方的价值：穿过它的所有 6 格窗口打分之和 */
  function dirScore(board, size, r, c, color) {
    var opp = 3 - color;
    var total = 0;
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      for (var start = -5; start <= 0; start++) {
        var own = 0, ok = true;
        for (var k = 0; k < 6; k++) {
          var rr = r + dr * (start + k), cc = c + dc * (start + k);
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) { ok = false; break; }
          var v = board[rr * size + cc];
          if (v === opp) { ok = false; break; }
          if (v === color) own++;
        }
        if (ok) total += PATTERN[own];
      }
    }
    return total;
  }

  function cellValue(board, size, r, c, side, defW) {
    return dirScore(board, size, r, c, side) + defW * dirScore(board, size, r, c, 3 - side);
  }

  /* 已有棋子周围 2 格内的空点（含棋盘为空时返回天元） */
  function neighbours(board, size) {
    var near = new Uint8Array(size * size);
    var any = false, i, dr, dc, rr, cc;
    for (i = 0; i < board.length; i++) {
      if (!board[i]) continue;
      any = true;
      var r = (i / size) | 0, c = i % size;
      for (dr = -2; dr <= 2; dr++) {
        for (dc = -2; dc <= 2; dc++) {
          rr = r + dr; cc = c + dc;
          if (rr >= 0 && rr < size && cc >= 0 && cc < size && !board[rr * size + cc]) {
            near[rr * size + cc] = 1;
          }
        }
      }
    }
    if (!any) return [[(size - 1) >> 1, (size - 1) >> 1]];
    var out = [];
    for (i = 0; i < near.length; i++) if (near[i]) out.push([(i / size) | 0, i % size]);
    return out;
  }

  /* 某一方“下一子就能连六”的点 */
  function winningPoints(board, size, color, cands) {
    var out = [];
    for (var i = 0; i < cands.length; i++) {
      var r = cands[i][0], c = cands[i][1], id = idx(size, r, c);
      board[id] = color;
      if (lineAt(board, size, r, c, color)) out.push([r, c]);
      board[id] = 0;
    }
    return out;
  }

  /* 对手单回合的最大威胁值；能连六则返回极大值 */
  function maxThreat(board, size, color, limit, defW) {
    var cands = neighbours(board, size);
    var best = 0, n = 0;
    for (var i = 0; i < cands.length && n < limit; i++, n++) {
      var r = cands[i][0], c = cands[i][1], id = idx(size, r, c);
      board[id] = color;
      if (lineAt(board, size, r, c, color)) { board[id] = 0; return 1e9; }
      board[id] = 0;
      var v = cellValue(board, size, r, c, color, defW);
      if (v > best) best = v;
    }
    return best;
  }

  function scoredList(board, size, side, lv) {
    var cands = neighbours(board, size);
    var list = [];
    for (var i = 0; i < cands.length; i++) {
      var r = cands[i][0], c = cands[i][1];
      list.push({ r: r, c: c, v: cellValue(board, size, r, c, side, lv.defW) });
    }
    list.sort(function (a, b) { return b.v - a.v; });
    return list;
  }

  /* 挑出本回合要落的 1~2 个点 */
  function chooseMove(m, side, levelKey) {
    var lv = LEVELS[levelKey] || LEVELS.normal;
    var size = m.size, board = m.board;
    var need = m.stonesLeft;
    var cands = neighbours(board, size);

    /* ① 自己能立刻连六 -> 直接赢 */
    var mine = winningPoints(board, size, side, cands);
    if (mine.length) {
      var win = [mine[0]];
      if (need > 1) {
        if (mine[1]) win.push(mine[1]);
        else win.push(pickBest(scoredList(board, size, side, lv), win));
      }
      return win;
    }

    /* ② 对手能立刻连六 -> 普通/困难会去堵（入门只靠启发式，可能漏） */
    if (lv.pairs) {
      var danger = winningPoints(board, size, 3 - side, cands);
      if (danger.length) {
        var block = danger.slice(0, need);
        var list0 = scoredList(board, size, side, lv);
        while (block.length < need) {
          var add = pickBest(list0, block);
          if (!add) break;
          block.push(add);
        }
        return block;
      }
    }

    var list = scoredList(board, size, side, lv);

    /* ③ 入门：前几名里随机挑，不做配子推演 */
    if (!lv.pairs) {
      var pool = list.slice(0, lv.topN);
      var first = pool[Math.floor(Math.random() * Math.min(lv.randTop, pool.length))];
      var picks = first ? [[first.r, first.c]] : [[(size - 1) >> 1, (size - 1) >> 1]];
      if (need > 1) {
        var second = pickBest(pool, picks);
        picks.push(second || picks[0]);
      }
      return picks;
    }

    /* ④ 普通 / 困难：候选配对评估，含对手最佳应手（2 层） */
    var top = list.slice(0, lv.topN);
    if (need === 1) {
      var b1 = top[0] || { r: (size - 1) >> 1, c: (size - 1) >> 1 };
      return [[b1.r, b1.c]];
    }
    if (top.length < 2) {
      var b2 = top[0] || { r: (size - 1) >> 1, c: (size - 1) >> 1 };
      return [[b2.r, b2.c]];
    }

    var bestValue = -Infinity, bestPair = null;
    for (var i = 0; i < top.length; i++) {
      for (var j = i + 1; j < top.length; j++) {
        var a = top[i], b = top[j];
        var ia = idx(size, a.r, a.c), ib = idx(size, b.r, b.c);

        board[ia] = side;
        var instant = lineAt(board, size, a.r, a.c, side);
        board[ib] = side;
        if (!instant) instant = lineAt(board, size, b.r, b.c, side);

        if (instant) { board[ib] = 0; board[ia] = 0; return [[a.r, a.c], [b.r, b.c]]; }

        var attack = dirScore(board, size, a.r, a.c, side) + dirScore(board, size, b.r, b.c, side);
        var threat = maxThreat(board, size, 3 - side, lv.oppTop, lv.defW);

        board[ib] = 0;
        board[ia] = 0;

        /* 对手下回合能连六 —— 这一对基本不可取 */
        var value = attack - lv.defW * threat - (threat >= 1e9 ? 1e9 : 0);
        if (value > bestValue) { bestValue = value; bestPair = [[a.r, a.c], [b.r, b.c]]; }
      }
    }
    return bestPair || [[top[0].r, top[0].c]];
  }

  function pickBest(list, used) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i], taken = false;
      for (var j = 0; j < used.length; j++) {
        if (used[j][0] === p.r && used[j][1] === p.c) { taken = true; break; }
      }
      if (!taken) return [p.r, p.c];
    }
    return null;
  }

  /* ==========================================================================
     4. 画布渲染
     --------------------------------------------------------------------------
     坐标映射与绘制共用同一套 layout（origin / cell），所以视觉交叉点与触摸点
     不会出现偏差；缩放只改变 canvas 的 CSS 尺寸，映射随之重算。
     ========================================================================== */

  function readPalette(el) {
    var cs = window.getComputedStyle(el);
    function t(name, fallback) {
      var v = (cs.getPropertyValue(name) || '').trim();
      return v || fallback;
    }
    return {
      board: t('--surface-3', '#dde1ee'),
      line: t('--line-strong', 'rgba(20,22,29,.2)'),
      star: t('--text-faint', '#8b93a3'),
      edge: t('--line', 'rgba(20,22,29,.09)'),
      accent: t('--accent', '#4f46e5'),
      warm: t('--warm', '#ff7a45'),
      text: t('--text', '#14161d')
    };
  }

  function isDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /* 计算画布尺寸与网格布局 */
  function layout(view) {
    var wrap = view.wrap;
    var rect = wrap.getBoundingClientRect();
    var base = Math.floor(Math.min(rect.width, rect.height));
    if (base < 40) base = 40;                       // 布局尚未稳定时的兜底

    var side = Math.round(base * view.zoom);
    var dpr = window.devicePixelRatio || 1;
    if (side > 700) dpr = Math.min(dpr, 2);         // 大画布限制内存占用

    var px = Math.round(side * dpr);
    if (view.canvas.width !== px || view.canvas.height !== px) {
      view.canvas.width = px;
      view.canvas.height = px;
    }
    view.canvas.style.width = side + 'px';
    view.canvas.style.height = side + 'px';

    view.side = side;
    view.dpr = dpr;
    /* 边距随尺寸变化，保证边缘棋子不被裁切 */
    view.margin = Math.max(8, side * 0.036);
    view.cell = (side - view.margin * 2) / (view.size - 1);
    view.palette = readPalette(view.host);
  }

  function xy(view, r, c) {
    return {
      x: view.margin + c * view.cell,
      y: view.margin + r * view.cell
    };
  }

  function paint(view) {
    var ctx = view.ctx;
    var side = view.side;
    var cell = view.cell;
    var size = view.size;
    var pal = view.palette;
    var m = view.match;
    if (!ctx || !side) return;

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, side, side);

    /* 棋盘底色 */
    ctx.fillStyle = pal.board;
    ctx.fillRect(0, 0, side, side);

    /* 网格 */
    var last = view.margin + (size - 1) * cell;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, cell * 0.055);
    ctx.beginPath();
    for (var i = 0; i < size; i++) {
      var p = view.margin + i * cell;
      ctx.moveTo(view.margin, p + 0.5);
      ctx.lineTo(last, p + 0.5);
      ctx.moveTo(p + 0.5, view.margin);
      ctx.lineTo(p + 0.5, last);
    }
    ctx.stroke();

    /* 星位 */
    ctx.fillStyle = pal.star;
    for (var s = 0; s < STARS.length; s++) {
      for (var s2 = 0; s2 < STARS.length; s2++) {
        var sp = xy(view, STARS[s], STARS[s2]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, Math.max(1.4, cell * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var radius = cell * 0.43;
    var winLine = (m.result && m.result.line) ? m.result.line : null;

    /* 胜利连线走在棋子下方：只从子与子的缝隙露出，不把棋子染色 */
    if (winLine && winLine.length > 1) {
      var wa = xy(view, winLine[0][0], winLine[0][1]);
      var wb = xy(view, winLine[winLine.length - 1][0], winLine[winLine.length - 1][1]);
      ctx.save();
      ctx.strokeStyle = pal.warm;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(3, cell * 0.3);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wa.x, wa.y);
      ctx.lineTo(wb.x, wb.y);
      ctx.stroke();
      ctx.restore();
    }

    /* 棋子 */
    for (var j = 0; j < m.board.length; j++) {
      var v = m.board[j];
      if (!v) continue;
      drawStone(ctx, view, (j / size) | 0, j % size, v, radius, 1);
    }

    /* 获胜六子各加一圈提示环 */
    if (winLine) {
      ctx.save();
      ctx.strokeStyle = pal.warm;
      ctx.lineWidth = Math.max(2, cell * 0.1);
      for (var w = 0; w < winLine.length; w++) {
        var wp = xy(view, winLine[w][0], winLine[w][1]);
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, radius * 1.06, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 最后一手标记 */
    if (m.last) {
      var lm = xy(view, m.last.r, m.last.c);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = Math.max(1.4, cell * 0.09);
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, radius * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* 落点预览（按下即出现，抬手前就能看清落点） */
    if (view.pending && !m.over) {
      var pv = xy(view, view.pending.r, view.pending.c);
      drawStone(ctx, view, view.pending.r, view.pending.c, m.turn, radius, 0.42);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = Math.max(1.6, cell * 0.1);
      ctx.beginPath();
      ctx.arc(pv.x, pv.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawStone(ctx, view, r, c, color, radius, alpha) {
    var pt = xy(view, r, c);
    var dark = view.darkMode;
    var grad = ctx.createRadialGradient(
      pt.x - radius * 0.3, pt.y - radius * 0.34, radius * 0.3,
      pt.x, pt.y, radius * 1.02
    );
    if (color === BLACK) {
      grad.addColorStop(0, dark ? '#454c5c' : '#3f4553');
      grad.addColorStop(1, '#090b10');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, dark ? '#ccd2e0' : '#d9dfec');
    }

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    /* 深色模式下黑子、浅色模式下白子各需要一圈描边才够对比 */
    ctx.lineWidth = Math.max(1, radius * 0.1);
    ctx.strokeStyle = color === BLACK
      ? (dark ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.16)')
      : (dark ? 'rgba(12,14,19,.6)' : 'rgba(20,22,29,.34)');
    ctx.stroke();
    ctx.restore();
  }

  /* 触摸/点击 -> 最近的交叉点；空白区域返回 null */
  function hitTest(view, clientX, clientY) {
    var rect = view.canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var c = Math.round((x - view.margin) / view.cell);
    var r = Math.round((y - view.margin) / view.cell);
    if (r < 0 || r >= view.size || c < 0 || c >= view.size) return null;
    var pt = xy(view, r, c);
    /* 距最近交点超过 0.72 格视为点偏了（棋盘外的边角） */
    var dx = x - pt.x, dy = y - pt.y;
    if (Math.sqrt(dx * dx + dy * dy) > view.cell * 0.72) return null;
    return { r: r, c: c };
  }

  /* ==========================================================================
     5. 样式（注入到 <head>，全部走 tokens 令牌；不改框架 CSS 文件）
     ========================================================================== */

  var STYLE_ID = 'c6-styles';
  var CSS = [
    '.c6-host{position:absolute;inset:0;display:flex;justify-content:center}',
    '.c6{position:relative;width:100%;max-width:640px;height:100%;display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:var(--surface);color:var(--text);font-family:inherit;text-align:left;overflow:hidden}',
    '.c6__seg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:4px;border-radius:14px;background:var(--surface-2)}',
    '.c6__seg--sub{grid-template-columns:repeat(3,minmax(0,1fr));background:transparent;padding:0;gap:6px}',
    '.c6__segbtn{min-height:44px;border-radius:11px;font-size:13px;font-weight:600;color:var(--text-dim);display:flex;align-items:center;justify-content:center;touch-action:manipulation;transition:background .16s,color .16s}',
    '.c6__segbtn[aria-pressed="true"]{background:var(--surface);color:var(--text);box-shadow:var(--shadow-1)}',
    '.c6__seg--sub .c6__segbtn{border:1px solid var(--line);background:var(--surface)}',
    '.c6__seg--sub .c6__segbtn[aria-pressed="true"]{border-color:transparent;background:var(--accent-soft);color:var(--accent-text);box-shadow:none}',
    '.c6__status{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:22px;font-size:12px;color:var(--text-dim)}',
    '.c6__turn{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.c6__dot{width:13px;height:13px;border-radius:50%;flex:0 0 auto;background:#0b0d12;box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)}',
    '.c6__dot[data-color="white"]{background:#f7f8fb;box-shadow:inset 0 0 0 1px rgba(20,22,29,.3)}',
    '.c6__counts{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text-faint)}',
    '.c6__wrap{position:relative;flex:1;min-height:0;display:flex;overflow:auto;overscroll-behavior:contain;border-radius:var(--r-md);-webkit-overflow-scrolling:touch}',
    '.c6__canvas{display:block;margin:auto;border-radius:var(--r-md);touch-action:pan-x pan-y;-webkit-tap-highlight-color:transparent;cursor:pointer}',
    '.c6__actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.c6__btn{min-height:44px;border-radius:12px;background:var(--surface-2);color:var(--text);font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;touch-action:manipulation;transition:transform .12s}',
    '.c6__btn:active{transform:scale(.97)}',
    '.c6__btn--primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff}',
    '.c6__over{position:absolute;inset:0;z-index:5;display:grid;place-items:center;padding:20px;background:rgba(10,12,18,.26);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}',
    '.c6__overcard{width:100%;max-width:282px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px 18px;border-radius:18px;background:var(--surface);box-shadow:var(--shadow-2);text-align:center}',
    '.c6__overtitle{font-size:20px;font-weight:750;letter-spacing:.02em}',
    '.c6__oversub{font-size:12.5px;color:var(--text-dim)}',
    '.c6__overbtns{display:flex;gap:8px;margin-top:14px}',
    '.c6__overbtns .c6__btn{min-width:116px;padding:0 16px}',
    /* 横屏：棋盘在左、控制在右，避免棋盘被高度压扁 */
    '@media (orientation:landscape) and (max-height:520px){',
    '  .c6{display:grid;grid-template-columns:minmax(0,1fr) minmax(196px,32%);grid-template-rows:auto auto auto 1fr;grid-template-areas:"board modes" "board levels" "board status" "board actions";gap:6px 10px;align-items:stretch}',
    '  .c6__wrap{grid-area:board;height:100%}',
    '  .c6__seg{grid-area:modes}',
    '  .c6__seg--sub{grid-area:levels}',
    '  .c6__status{grid-area:status}',
    '  .c6__actions{grid-area:actions;align-self:end}',
    '}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ==========================================================================
     6. 界面模板与控制器
     ========================================================================== */

  function template() {
    return '' +
      '<div class="c6">' +
        '<div class="c6__seg" role="group" aria-label="对战模式">' +
          '<button class="c6__segbtn" type="button" data-mode="local" aria-pressed="true">本地双人</button>' +
          '<button class="c6__segbtn" type="button" data-mode="ai" aria-pressed="false">人机</button>' +
        '</div>' +
        '<div class="c6__seg c6__seg--sub" data-row="ai" hidden role="group" aria-label="难度">' +
          '<button class="c6__segbtn" type="button" data-level="easy" aria-pressed="false">入门</button>' +
          '<button class="c6__segbtn" type="button" data-level="normal" aria-pressed="true">普通</button>' +
          '<button class="c6__segbtn" type="button" data-level="hard" aria-pressed="false">困难</button>' +
        '</div>' +
        '<div class="c6__status">' +
          '<span class="c6__turn"><i class="c6__dot" data-dot aria-hidden="true"></i>' +
            '<span data-turn aria-live="polite">黑方行动 · 剩 1 子</span></span>' +
          '<span class="c6__counts" data-counts>黑 0 · 白 0</span>' +
        '</div>' +
        '<div class="c6__wrap" data-wrap>' +
          '<canvas class="c6__canvas" data-canvas role="application"' +
            ' aria-label="六子棋棋盘，19 路，点击交叉点落子"></canvas>' +
        '</div>' +
        '<div class="c6__actions">' +
          '<button class="c6__btn" type="button" data-act="restart">重新开始</button>' +
          '<button class="c6__btn" type="button" data-act="resign">认输</button>' +
          '<button class="c6__btn" type="button" data-act="zoom">放大</button>' +
          '<button class="c6__btn" type="button" data-act="exit">退出</button>' +
        '</div>' +
        '<div class="c6__over" data-over hidden aria-live="assertive">' +
          '<div class="c6__overcard">' +
            '<p class="c6__overtitle" data-overtitle></p>' +
            '<p class="c6__oversub" data-oversub></p>' +
            '<div class="c6__overbtns">' +
              '<button class="c6__btn c6__btn--primary" type="button" data-act="restart">再来一局</button>' +
              '<button class="c6__btn" type="button" data-act="exit">返回详情</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function mount(rootEl, opts) {
    injectStyles();

    var game = (opts && opts.game) || { id: '', title: '六子棋' };
    var host = document.createElement('div');
    host.className = 'c6-host';
    host.innerHTML = template();
    rootEl.appendChild(host);
    rootEl.style.pointerEvents = 'auto';

    var el = host.querySelector('.c6');
    var canvas = el.querySelector('[data-canvas]');
    var wrap = el.querySelector('[data-wrap]');
    var turnEl = el.querySelector('[data-turn]');
    var dotEl = el.querySelector('[data-dot]');
    var countsEl = el.querySelector('[data-counts]');
    var overEl = el.querySelector('[data-over]');
    var overTitle = el.querySelector('[data-overtitle]');
    var overSub = el.querySelector('[data-oversub]');
    var zoomBtn = el.querySelector('[data-act="zoom"]');

    var S = {
      mode: 'local',
      level: 'normal',
      match: createMatch(SIZE),
      destroyed: false,
      aiTimer: null,
      aiBusy: false,
      endedAt: 0
    };

    var view = {
      host: el,
      wrap: wrap,
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      size: SIZE,
      zoom: 1,
      side: 0,
      cell: 0,
      margin: 0,
      dpr: 1,
      darkMode: isDark(),
      palette: null,
      match: S.match,
      pending: null
    };

    /* ---------- 通用 ---------- */
    function flash(msg) {
      if (window.UI && window.UI.toast) window.UI.toast(msg);
    }

    function canPlay() {
      var m = S.match;
      if (!m || m.over) return false;
      if (S.mode === 'ai') return m.turn === BLACK;
      return true;
    }

    /* 单一出口：任何改动对局的动作都走这里。
       先同步界面、再重绘 —— 保证即使绘制出问题，终局卡片也一定出现。 */
    function afterChange() {
      if (S.destroyed) return;
      if (view.match !== S.match) view.match = S.match;
      if (S.match.over && S.aiTimer) {
        clearTimeout(S.aiTimer);
        S.aiTimer = null;
      }
      syncChrome();
      try {
        paint(view);
      } catch (err) {
        console.error('[connect6] 绘制失败', err);
      }
      maybeAI();
    }

    /* ---------- 界面同步 ---------- */
    function syncChrome() {
      var m = S.match;

      Array.prototype.forEach.call(el.querySelectorAll('[data-mode]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === S.mode));
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-level]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-level') === S.level));
      });
      el.querySelector('[data-row="ai"]').hidden = S.mode !== 'ai';

      var thinking = S.mode === 'ai' && !m.over && m.turn === WHITE;
      var text;
      if (m.over) text = resultText(m) + ' · ' + resultSub(m);
      else if (thinking) text = '对手思考中…';
      else text = (m.turn === BLACK ? '黑方' : '白方') + '行动 · 本回合剩 ' + m.stonesLeft + ' 子';

      turnEl.textContent = text;
      dotEl.setAttribute('data-color', m.turn === WHITE ? 'white' : 'black');
      countsEl.textContent = '黑 ' + m.counts[1] + ' · 白 ' + m.counts[2];
      zoomBtn.textContent = view.zoom === 1 ? '放大' : '×' + view.zoom;

      if (m.over) {
        if (!S.endedAt) S.endedAt = Date.now();
        overTitle.textContent = resultText(m);
        overSub.textContent = resultSub(m);
        overEl.hidden = false;
      } else {
        S.endedAt = 0;
        overEl.hidden = true;
        overTitle.textContent = '';
        overSub.textContent = '';
      }
    }

    function resultText(m) {
      if (!m.result) return '';
      if (!m.result.winner) return '平局';
      return (m.result.winner === BLACK ? '黑方' : '白方') + '获胜';
    }

    function resultSub(m) {
      var r = m.result;
      if (!r) return '';
      if (r.reason === 'six') return lineDirection(r.line) + '六连';
      if (r.reason === 'draw') return '棋盘已满';
      if (r.reason === 'resign') return '认输';
      return '';
    }

    /* ---------- 布局与重绘 ---------- */
    function relayout() {
      if (S.destroyed) return;
      view.darkMode = isDark();
      layout(view);
      try {
        paint(view);
      } catch (err) {
        console.error('[connect6] 绘制失败', err);
      }
    }

    /* ---------- 落子 ---------- */
    function localPlace(r, c) {
      if (!canPlay()) return;
      if (!commit(S.match, r, c)) return;
      afterChange();
    }

    /* ---------- 人机 ---------- */
    function maybeAI() {
      if (S.aiBusy) return;                 /* AI 回合进行中，不要重复调度 */
      if (S.mode !== 'ai' || S.match.over) return;
      if (S.match.turn !== WHITE) return;
      if (S.aiTimer) return;
      S.aiTimer = setTimeout(aiTurn, 320);
    }

    function aiTurn() {
      S.aiTimer = null;
      if (S.destroyed || S.mode !== 'ai' || S.match.over || S.match.turn !== WHITE) return;

      var plan;
      try {
        plan = chooseMove(S.match, WHITE, S.level);
      } catch (err) {
        console.error('[connect6] AI 计算失败', err);
        return;
      }

      S.aiBusy = true;
      var step = function (i) {
        if (S.destroyed || S.mode !== 'ai' || S.match.over) { S.aiBusy = false; return; }
        if (i >= plan.length) { S.aiBusy = false; syncChrome(); return; }
        commit(S.match, plan[i][0], plan[i][1]);
        afterChange();                       /* 走同一出口：界面先于绘制更新 */
        if (S.match.over) { S.aiBusy = false; return; }
        if (i + 1 < plan.length) {
          S.aiTimer = setTimeout(function () { step(i + 1); }, 220);
        } else {
          S.aiTimer = null;
          S.aiBusy = false;
        }
      };
      step(0);
    }

    /* ---------- 操作 ---------- */
    function doRestart() {
      S.match = createMatch(SIZE);
      S.endedAt = 0;
      view.pending = null;
      afterChange();
    }

    function doResign() {
      var m = S.match;
      if (m.over) return;
      forfeit(m, m.turn === BLACK ? WHITE : BLACK);
      afterChange();
    }

    function doExit() {
      if (history.length > 1) history.back();
      else location.hash = '#/game/' + encodeURIComponent(game.id || '');
    }

    function setMode(mode) {
      if (S.mode === mode) return;
      S.mode = mode;
      S.match = createMatch(SIZE);
      S.endedAt = 0;
      view.pending = null;
      afterChange();
    }

    function setLevel(level) {
      if (!LEVELS[level]) return;
      S.level = level;
      syncChrome();
    }

    function cycleZoom() {
      view.zoom = view.zoom === 1 ? 2 : (view.zoom === 2 ? 3 : 1);
      layout(view);
      if (view.zoom > 1) {
        wrap.scrollLeft = Math.max(0, (canvas.offsetWidth - wrap.clientWidth) / 2);
        wrap.scrollTop = Math.max(0, (canvas.offsetHeight - wrap.clientHeight) / 2);
      } else {
        wrap.scrollLeft = 0;
        wrap.scrollTop = 0;
      }
      try { paint(view); } catch (err) { console.error('[connect6] 绘制失败', err); }
      syncChrome();
      flash(view.zoom === 1 ? '适应屏幕' : '放大 ×' + view.zoom + '，可拖动查看局部');
    }

    /* ---------- 指针交互 ---------- */
    var press = null;

    function onDown(e) {
      if (!canPlay()) return;
      var hit = hitTest(view, e.clientX, e.clientY);
      press = { x: e.clientX, y: e.clientY, hit: hit };
      if (hit) {
        view.pending = hit;
        paint(view);
      }
    }

    function onUp(e) {
      var start = press;
      press = null;
      if (view.pending) { view.pending = null; paint(view); }
      if (!start || !start.hit) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (dx * dx + dy * dy > 144) return;
      var hit = hitTest(view, e.clientX, e.clientY);
      if (!hit || hit.r !== start.hit.r || hit.c !== start.hit.c) return;
      localPlace(hit.r, hit.c);
    }

    function onCancel() {
      press = null;
      if (view.pending) { view.pending = null; paint(view); }
    }

    function onMove(e) {
      if (e.pointerType !== 'mouse' || press || !canPlay()) return;
      var hit = hitTest(view, e.clientX, e.clientY);
      var cur = view.pending;
      if ((hit && (!cur || cur.r !== hit.r || cur.c !== hit.c)) || (!hit && cur)) {
        view.pending = hit;
        paint(view);
      }
    }

    /* ---------- 事件绑定 ---------- */
    function onClick(e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var modeBtn = t.closest('[data-mode]');
      if (modeBtn) { setMode(modeBtn.getAttribute('data-mode')); return; }

      var levelBtn = t.closest('[data-level]');
      if (levelBtn) { setLevel(levelBtn.getAttribute('data-level')); return; }

      var act = t.closest('[data-act]');
      if (!act) return;
      var name = act.getAttribute('data-act');

      /* 终局瞬间的同一次触摸可能穿透到刚出现的「再来一局」上，
         400ms 内的重开一律忽略，避免结束卡片一闪而过。 */
      if (name === 'restart' && S.endedAt && Date.now() - S.endedAt < 400) return;

      if (name === 'restart') doRestart();
      else if (name === 'resign') doResign();
      else if (name === 'zoom') cycleZoom();
      else if (name === 'exit') doExit();
    }

    el.addEventListener('click', onClick);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onCancel);
    canvas.addEventListener('pointermove', onMove);

    function onStageResize() { relayout(); }
    window.addEventListener('gamehub:resize', onStageResize);
    window.addEventListener('gamehub:stage', onStageResize);
    window.addEventListener('orientationchange', onStageResize);

    var themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function onTheme() { relayout(); }
    if (themeMedia) {
      if (themeMedia.addEventListener) themeMedia.addEventListener('change', onTheme);
      else if (themeMedia.addListener) themeMedia.addListener(onTheme);
    }

    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { relayout(); });
      ro.observe(wrap);
    }

    /* 首帧 */
    relayout();
    afterChange();

    /* ---------- 销毁 ---------- */
    function destroy() {
      if (S.destroyed) return;
      S.destroyed = true;
      if (S.aiTimer) { clearTimeout(S.aiTimer); S.aiTimer = null; }
      S.aiBusy = false;
      window.removeEventListener('gamehub:resize', onStageResize);
      window.removeEventListener('gamehub:stage', onStageResize);
      window.removeEventListener('orientationchange', onStageResize);
      if (themeMedia) {
        if (themeMedia.removeEventListener) themeMedia.removeEventListener('change', onTheme);
        else if (themeMedia.removeListener) themeMedia.removeListener(onTheme);
      }
      if (ro) { try { ro.disconnect(); } catch (e) { /* 忽略 */ } ro = null; }
      if (host.parentNode) host.parentNode.removeChild(host);
      rootEl.style.pointerEvents = '';
    }

    return { destroy: destroy, key: KEY, state: S };
  }

  /* debug 只暴露纯函数，供自动化验证与调参使用，不参与任何对局流程 */
  window.Games = window.Games || {};
  window.Games[KEY] = {
    mount: mount,
    levels: LEVELS,
    debug: { createMatch: createMatch, commit: commit, chooseMove: chooseMove, lineAt: lineAt }
  };
})();
