# GAME HUB · 小游戏聚合站前端框架（占位版）

移动端优先的小游戏聚合站**前端框架**。只包含页面结构、组件、路由、占位数据与接入点，
**不含任何具体游戏内容、玩法、后端、账号、支付或排行榜**。

---

## 0. 假设清单（未指定项，按此实现，均可替换）

| 编号 | 项目 | 采用的假设 | 替换方式 |
|---|---|---|---|
| A1 | 技术栈 | 原生 HTML/CSS/JS，零依赖、零构建；classic script + 命名空间（`window.UI` / `window.Views` / `window.GameRepo`） | 迁到 Vue/React 时，只需重写 `js/core/router.js` 与 `js/core/ui.js`，`catalog.js` 的配置结构可直接复用 |
| A2 | 横竖屏策略 | **竖屏优先，不锁定方向**；横屏走紧凑模式（压缩顶栏/导航高度）；游戏页按 `entry`/`orientation` 给出提示，但不强制 `screen.lock` | 需要锁屏时在 `js/views/play.js` 里调用 Screen Orientation API（需全屏上下文） |
| A3 | 后端/账号/支付/排行榜 | 全部不实现。数据全部来自本地 `catalog.js`，`stats` 字段为 `null`，UI 显示「—」 | 替换 `js/core/repository.js` 内部实现为 `fetch` |
| A4 | 品牌 | `GAME HUB` / `GH` 为占位标识 | 改 `catalog.js` 的 `site` + `tokens.css` 品牌色 |
| A5 | 图片 | 不引用任何外部图片；封面用**由 `order` 或 `accent` 派生的色块 + 网点纹理**，视觉上明确是占位。六子棋的棋盘与棋子全部由 Canvas 代码绘制 | 给 `cover` 填 URL 即自动切换为 `loading="lazy"` 的 `<img>` |
| A6 | 网络延迟 | `GameRepo.config.latency = 320ms` 是**人为延迟**，只为展示骨架屏/加载态 | 接真实接口后设为 `0` 或删除 |
| A7 | 数据规模 | 11 条占位条目 + 1 个真实玩法、5 个分类、3 个推荐位 | 直接在配置里增删 |

---

## 1. 项目目录结构

```
站点根目录/
├─ index.html                 # 唯一页面外壳：顶栏 / 视图容器 / 底部导航 / Toast
├─ README.md
├─ css/
│  ├─ tokens.css              # 设计令牌：颜色、圆角、间距、触控尺寸、安全区
│  ├─ base.css                # 重置 + 排版基线 + 可访问性（focus-visible / 减动效）
│  ├─ layout.css              # 应用外壳：吸顶栏、底部导航、CTA 条、全屏容器
│  └─ components.css          # 组件样式：卡片、chips、按钮、骨架屏、空/错误态、启动舞台
└─ js/
   ├─ app.js                  # 启动入口：路由表、全局动作委托、滚动状态
   ├─ data/
   │  └─ catalog.js           # ★ 唯一数据源（游戏/分类/排序/推荐位占位配置）
   ├─ core/
   │  ├─ utils.js             # 转义、色相散列、防抖、事件委托
   │  ├─ repository.js        # ★ 数据访问层（唯一数据出口，接后端只改这里）
   │  ├─ ui.js                # 无状态组件渲染函数（数据 -> HTML）
   │  └─ router.js            # hash 路由 + 骨架屏/错误态调度 + 视图生命周期
   ├─ views/
   │  ├─ home.js              # 首页
   │  ├─ list.js              # 分类/列表页
   │  ├─ search.js            # 搜索页
   │  ├─ detail.js            # 详情/启动入口页
   │  └─ play.js              # 游戏启动页（★ 玩法挂载点 GameMount）
   └─ games/
      └─ connect6.js          # 第一个真实玩法：六子棋（规则/AI/渲染/界面，自包含）
```

依赖方向单向：`views → repository → data`，`views → ui → utils`。视图之间零耦合。

---

## 2. 页面 / 组件清单与职责

### 页面（路由）

| 路 由 | 视图 | 职责 | 关键状态 |
|---|---|---|---|
| `#/` | `views/home.js` | 推荐位横滑、分类入口、推荐游戏网格 | 骨架屏 → 内容 / 错误态 |
| `#/categories?c=&sort=` | `views/list.js` | 分类筛选、排序、分页加载更多 | 筛选只重绘列表区；URL 静默同步；空分类 → 空状态 |
| `#/search?q=` | `views/search.js` | 输入防抖搜索、结果网格、无结果态 | 空输入 → 引导；有输入 → 结果/空结果/失败 |
| `#/game/:id` | `views/detail.js` | 封面、标签、元信息、简介、画面占位、相关推荐、底部 CTA | 不显示底部 tab，只留 CTA；id 无效 → 空状态 |
| `#/play/:id` | `views/play.js` | 全屏游戏容器占位、尺寸广播、挂载点 | 沉浸模式（隐藏全局导航） |

### 组件（`js/core/ui.js`，纯函数，返回 HTML 字符串）

| 组件 | 说明 |
|---|---|
| `appbar(desc)` | 两种形态：首页（品牌 + 搜索入口）/ 内页（返回 + 标题 + 右侧数据） |
| `tabbar(el, active, tabs)` | 三格底部导航，`aria-current` 标记当前页 |
| `gameCard(game)` | 游戏卡片：4:3 封面（色块占位或懒加载图）、占位徽标、两行标题、主分类 · 屏向 |
| `banner(b)` | 首页推荐位卡片，配合 `scroll-snap` 横滑 |
| `coverMarkup(game)` | 封面占位生成器：`cover` 为空产出确定性色块，否则产出 `loading="lazy"` 图片 |
| `gridSkeleton / homeSkeleton / filterSkeleton / detailSkeleton` | 四种骨架屏，形状与真实内容一致以减小跳动 |
| `emptyState / errorState` | 空状态（含行动按钮）、错误状态（含「重新加载」） |
| `loadingRow / loadMore` | 行内加载、加载更多按钮 / 到底提示 |
| `toast(msg)` | 轻提示，用于占位操作反馈 |

### 核心模块

| 模块 | 职责 |
|---|---|
| `core/router.js` | hash 解析、`:id` 参数、渲染令牌（防慢请求覆盖新页面）、骨架 → 内容/错误调度、`after()` 清理钩子、tabbar 显隐 |
| `core/repository.js` | `list / byId / related / banners / meta`，内部分类过滤、排序、分页；**唯一替换点** |
| `core/utils.js` | HTML 转义、FNV-1a 色相、防抖、事件委托 |
| `app.js` | 路由表注册、全局 `data-action` 委托（返回/重试/占位提示）、顶栏滚动分隔线、异常兜底 |

---

## 3. 占位游戏数据结构示例

```js
{
  id: 'g-001',                 // 必填，唯一；也用于占位配色与路由
  title: '占位游戏 01',         // 必填
  subtitle: '副标题占位',
  categories: ['puzzle'],      // 分类 id 数组，第一个为主分类
  tags: ['标签 A', '标签 B'],   // 参与搜索与详情标签展示
  cover: '',                   // 封面 URL；空 => 色块占位；填 URL => 自动懒加载
  coverAlt: '',                // 封面替代文本
  summary: '一句话简介占位。',
  description: '详情页正文占位……',
  orientation: 'portrait',      // portrait | landscape | any
  accent: 262,                  // 可选：占位封面色相 0-359；不填按 order 黄金角分布
  entry: { type: 'placeholder' }, // 见下方接入方式
  status: 'placeholder',        // placeholder | live
  featured: true,               // 是否进入推荐候选
  order: 1,                     // 排序权重，越小越靠前
  stats: { plays: null, rating: null } // null = 未接入，UI 显示「—」
}
```

`entry` 接入方式（框架预留，当前全部为 `placeholder`）：

```js
{ type: 'placeholder' }                        // 占位：不渲染任何玩法
{ type: 'iframe',  src: 'https://…' }          // 内嵌网页游戏
{ type: 'canvas',  module: './games/x.js' }    // 本地 canvas / WebGL 模块（扩展点）
{ type: 'link',    src: 'https://…' }          // 跳转独立页面
```

---

## 4. 移动端关键布局与交互

**布局**
- 移动优先：单列外壳，内容区 `max-width` 720px（≥900px 时 880px）；卡片网格 2 列 → 520px 起 3 列 → 900px 起 4 列。
- 三段式外壳：吸顶顶栏（毛玻璃）+ 可滚视图 + 固定底部导航；滚动区不包含导航，避免双滚动。
- 所有间距/圆角/颜色来自 `tokens.css`，无散落魔法数。

**触控**
- 统一最小触控目标 `--touch: 44px`：chips、导航项、图标按钮、下拉选择实测 44px；主按钮 46px，详情页 CTA 撑满可用宽度。
- 交互反馈用 `:active`，hover 效果包在 `@media (hover:hover)` 内 —— 不依赖悬停。
- 全局 `touch-action: manipulation`，消除 300ms 点击延迟与双击缩放；`-webkit-tap-highlight-color: transparent`。

**轻量与滚动**
- 首屏零图片请求：封面是 CSS 渐变 + 网点，无网络开销；接入真实图后 `<img loading="lazy" decoding="async" width height>` + `aspect-ratio` 固定占位，避免 CLS。
- 横滑区 `-webkit-overflow-scrolling: touch` + `scroll-snap`，滚动监听为 `passive` + `requestAnimationFrame`。
- 视图切换用 240ms 透明度过渡（刻意不用 transform，见下方「已知约束」）。

**安全区 / 刘海屏**
- `viewport-fit=cover`，四个方向都用 `env(safe-area-inset-*)`：顶栏、底部导航、CTA 条、全屏舞台、横屏左右留白。
- 底部导航与 CTA 条的下内边距包含 `--safe-bottom`，iPhone 指示条不会压住按钮。

**横竖屏**
- 竖屏优先，不锁定；`@media (orientation:landscape) and (max-height:480px)` 收紧顶栏/导航高度，避免横屏只剩一条缝。
- 游戏页按 `orientation` 给出提示文案，并把实测容器尺寸通过 `gamehub:stage` 事件广播给未来的玩法实例。

**状态明确**
- 每种加载都可见：进入页面 → 形状匹配的骨架屏；加载更多 → 行内 spinner；失败 → 错误态 + 重新加载；无数据 → 空状态 + 行动按钮。
- 尊重 `prefers-reduced-motion` 与 `prefers-color-scheme`（含深色主题）。

**已知约束（有意为之）**
- 视图容器只做透明度过渡：`animation-fill-mode: both` + `transform` 会让 `position:fixed` 的子元素（详情页 CTA）以它为包含块，导致 CTA 掉进文档流。修改动画时请保留「不在 `.view` 上做 transform」这条约束。
- 页面切换后回到顶部，未实现「返回列表时恢复滚动位置」（需要 `history.state` 记录，属后续增强）。

---

## 5. 运行 / 预览方式

**方式一：直接打开（最快）**
双击站点根目录下的 `index.html`，或拖进浏览器。全部为 classic script + 相对路径，`file://` 下可正常运行，无需服务器。

**方式二：本地静态服务器（推荐，行为更接近线上）**
```bash
cd <站点根目录>        # 即包含 index.html 的那一层
python3 -m http.server 8080
# 打开 http://localhost:8080
```

**移动端验证**
- 浏览器 DevTools → 设备模拟，选 390×844（iPhone 14）/ 360×800（Android 常见）/ 320×568（小屏兜底）。
- 真机：与电脑同一局域网，手机访问 `http://<电脑IP>:8080`。
- 建议顺手检查：刘海机型底部安全区、横屏、系统深色模式、`prefers-reduced-motion` 开启。

---

## 6. 后续接入具体游戏的扩展点

| # | 目标 | 改哪里 | 是否动框架 |
|---|---|---|---|
| 1 | **新增一个游戏** | `js/data/catalog.js` → `games` 追加一条 | 否，仅配置 |
| 2 | **换成真实封面** | 该条目的 `cover` 填 URL（建议 4:3，≥480px 宽） | 否，自动懒加载 |
| 3 | **接入网页游戏** | `entry: { type:'iframe', src:'…' }` | 否，`play.js` 已实现最小 iframe 挂载 |
| 4 | **接入 canvas/WebGL 玩法** | `play.js` → `GameMount.mount()` 的 `canvas` 分支：动态加载模块，监听 `gamehub:resize` / `gamehub:stage` 重算尺寸 | 只改挂载函数 |
| 5 | **新分类 / 新排序** | `catalog.js` → `categories` / `sorts`（排序需在 `repository.js` 的 `sortItems` 加分支） | 配置 + 1 个分支 |
| 6 | **接真实后端** | `js/core/repository.js` 内部换成 `fetch`，保持返回结构 `{ items, total, page, pageSize, hasMore }` | 只改 1 个文件，视图零改动 |
| 7 | **新增页面** | 新建 `js/views/xxx.js`（实现 `render` 及可选 `load/after`）+ 在 `app.js` 的 `routes` 注册 + `index.html` 引入脚本 | 三处小改动 |
| 8 | **换品牌** | `catalog.js` 的 `site` + `tokens.css` 的 `--accent` | 配置 |
| 9 | **运营位下发** | `repository.js` 的 `banners()` 改为接口，`catalog.js` 的 `banners` 作为兜底 | 单函数 |
| 10 | **未实现、需另接** | 账号 / 收藏 / 支付 / 排行榜 / 评论 / 埋点 / PWA 离线缓存 | 本框架刻意不含 |

**新增游戏的最小改动示例**

```js
// js/data/catalog.js 的 games 数组末尾追加：
{
  id: 'g-013',
  title: '占位游戏 13',
  categories: ['puzzle'],
  tags: ['标签 E'],
  cover: '',                      // 或 'https://…/cover.jpg'
  summary: '一句话简介占位。',
  description: '详情页正文占位。',
  orientation: 'portrait',
  entry: { type: 'placeholder' },
  status: 'placeholder',
  featured: false,
  order: 13,
  stats: { plays: null, rating: null }
}
```

保存刷新即可：首页/分类/搜索出现新卡片，详情页与启动页自动可用，无需改任何视图代码。

---

## 附：与验收标准对照

| 验收项 | 状态 |
|---|---|
| 移动端宽度正常浏览主要页面 | 已实测 390px / 320px / 横屏 / 1024px 宽屏 |
| 卡片与入口用占位数据展示 | 12 条占位条目，5 分类，3 推荐位 |
| 新增游戏只需补配置/资源 | 见扩展点 #1，仅 `catalog.js` |
| 无具体游戏实现、无未标注假设 | 全部假设见第 0 节，页面内亦有「框架说明」提示 |

---

## 7. 已接入玩法：六子棋（Connect Six）

### 7.1 规则实现（含两处默认取值）

| 规则项 | 实现 | 说明 |
|---|---|---|
| 棋盘 | **19 × 19**（`SIZE = 19`） | 需求中标注「待补充」，按默认 19 路实现；改尺寸只需改这一个常量 |
| 先手与落子数 | 黑先手，首回合 **1 子**；此后双方轮流各 **2 子** | `stonesLeft` 初始为 1，之后每回合重置为 2 |
| 胜负 | 横 / 竖 / 斜任一方向 **连成 6 子即胜** | `lineAt()` 四方向延伸计数，≥6 即成立（7 连也算胜） |
| 判胜时机 | **该回合任一子落下的瞬间即判**，不等两子落完 | 需求默认值；如需改成「两子落完再判」，把 `commit()` 里的胜负判定移到回合结束时 |
| 平局 | 棋盘填满且无六连 | 判为平局 |
| 认输 | 任意一方认输，对方获胜 | 认输方判负，立刻结束并弹出结果 |

### 7.2 三种模式

| 模式 | 对手来源 | 输入来源 | 说明 |
|---|---|---|---|
| 本地双人 | 无 | 同一块棋盘轮流点 | 状态行实时显示「黑方/白方行动 · 本回合剩 N 子」 |
| 人机对战 | 内置 AI（三档） | 人类执黑，AI 执白 | AI 落子间隔 320ms / 220ms，先显示「对手思考中…」 |

### 7.3 AI 三档的真实差异

| 档位 | 候选点 | 防守权重 | 配子推演 | 对手应手搜索 | 随机性 |
|---|---|---|---|---|---|
| 入门 | 前 6 | 0.45 | 无（单点贪心） | 不评估 | 前 3 名随机 |
| 普通 | 前 6 | 0.85 | C(6,2)=15 对 | 对手前 70 候选 | 无 |
| 困难 | 前 10 | 1.00 | C(10,2)=45 对 | 对手前 110 候选 | 无 |

三档共用同一套评估函数：以「穿过该点的所有 6 格窗口」计分（窗口内有对方子则该窗口作废），攻击分 + 防守分加权。
实测单次决策耗时约 入门 0ms / 普通 4ms / 困难 10ms（19 路中局），不阻塞交互。

### 7.4 联机功能已移除

最初实现过一版「同浏览器多标签页」的联机（localStorage 信箱 + `storage` 事件），
它只在同一台设备、同一个浏览器内有效，跨设备必须自建服务端，容易造成误解，已整体删除：
模式切换只剩「本地双人 / 人机」，房间号输入、连接状态、传输层代码与相关样式全部移除。

若后续要做**局域网联机**，注意两点（这部分只在需求恢复时再动手）：

1. 局域网必须从 `http://<内网IP>:端口` 打开站点；公网 https 页面连接 `ws://内网IP` 会被浏览器按混合内容拦截，改代码绕不过。
2. 在 `connect6.js` 里新增一个 `openRoom(room, role, onMessage)` 实现（接口 `{ send, destroy }`），由 `mount()` 内的落子出口调用即可，规则层与渲染层不需要改动。

### 7.5 新增/修改的文件

| 文件 | 动作 | 职责 |
|---|---|---|
| `js/games/connect6.js` | **新增** | 六子棋全部实现，自包含四段：规则内核 / AI / Canvas 渲染 / 界面控制器；对外只暴露 `window.Games.connect6.mount()` |
| `js/data/catalog.js` | 追加一条 | `g-c6` 配置：`entry: { type:'canvas', module:'./games/connect6.js' }`、`status:'live'`、`accent:262`、`order:0`；未改动任何已有条目 |
| `js/views/play.js` | 扩展 canvas 分支 | 真正按 `entry.module` 注入脚本（路径相对 `js/`，文件名即 `window.Games` 的键），调用 `mount()` 并返回 `destroy` 句柄；真实玩法使用 `play__stage--live` 干净舞台 |
| `css/components.css` | 新增样式 | `.play__stage--live`、`.play-loading`、`.play-error`；沉浸页 toast 上移到操作区之上 |

未改动：路由、`repository.js`、其他页面视图、占位游戏数据。

### 7.6 玩法内部的移动端处理

- **坐标映射**：`layout()` 同时产出绘制与点击映射（`margin` / `cell` / `origin`），所以视觉交叉点与触摸点必然重合；缩放只改变 canvas 的 CSS 尺寸并重算映射。
- **落子反馈**：`pointerdown` 即在最近交叉点画出半透明预览子 + 强调环，`pointerup` 且位移 <12px 才落子 —— 抬手前就能确认落点，不依赖 hover。
- **触控目标**：所有控件 ≥44px；19 路棋盘在 320px 屏幕上单元格约 13px，因此提供 **放大 ×2 / ×3**（放大后单元格 ≥44px，棋盘容器可拖动查看），默认「适应屏幕」。
- **重算尺寸**：监听框架广播的 `gamehub:resize` 与 `gamehub:stage`，另有 `orientationchange` 与 `ResizeObserver` 兜底；DPR 随尺寸封顶（>700px 时限制为 2）避免大画布占内存。
- **横屏**：`(orientation:landscape) and (max-height:520px)` 改为左右双栏（棋盘在左占满高度、控制在右），避免棋盘被压成 162px。
- **宽屏**：内容列 `max-width:640px` 居中，棋盘随可用区放大到 578px。
- **安全区**：顶栏由框架负责；舞台外边距含 `safe-left/right`，`play__stage--live` 的底边距含 `safe-bottom`。
- **深色模式**：棋盘色取 `--surface-3`，棋子固定黑白并加对比描边；主题切换时重绘（监听 `prefers-color-scheme`）。
- **减动效**：无动画循环，全部按需重绘；CSS 过渡沿用框架的 `prefers-reduced-motion` 全局降级。
- **清理**：`destroy()` 清除 AI 定时器与重入标记、`window`/媒体查询监听、`ResizeObserver`，并移除 DOM；再次进入是全新对局。

### 7.7 本玩法的验证记录

| 项目 | 结果 |
|---|---|
| 横向 / 纵向 / 斜向六连判胜 | 三种方向均正确触发，方向文案正确 |
| 五连不误判、七连判胜 | `lineAt` 返回 null / 长度 7 |
| 首回合 1 子、之后每回合 2 子 | 状态机与计数一致 |
| 平局 | 由 `boardFull()` 兜底（19×19 未跑到满盘，逻辑同上） |
| 三档 AI | 均能在两点内完成应手，落子贴近既有棋子；困难档在中局实测耗时约 10ms |
| AI 封堵 / 取胜 | 合成局面下三档都能补必胜点、都能在两端封堵 |
| 终局呈现 | 本地双人、人机（玩家胜 / AI 胜）三条路径均弹出结果卡片，重开后文案清空 |
| 390×844、320×568、844×390、1280×800 | 均可落子，无横向溢出；横屏走双栏 |
| 离开再进入 | 计数归零、模式回默认、无残留 DOM |
| 控制台 | 全流程无报错 |