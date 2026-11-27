/* ==========================================================================
   catalog.js — 唯一的游戏数据源（占位配置）
   --------------------------------------------------------------------------
   这是「新增游戏只改配置」的入口：
     1. 在 games 数组追加一条对象即可出现在首页 / 分类 / 搜索 / 详情 / 启动页；
     2. cover 留空 => 自动使用由 id 派生的色块占位封面（零请求、零流量）；
        填入图片 URL 后自动启用 loading="lazy" 懒加载；
     3. 不在此文件写任何玩法代码；游戏运行产物由 js/views/play.js 挂载。

   字段说明（详细版见 README.md）：
     id          唯一标识，用于路由与占位配色（必填）
     title       标题（必填，占位阶段请保持明显的占位命名）
     subtitle    副标题
     categories  分类 id 数组，取第一个作为主分类
     tags        标签，参与搜索与详情展示
     cover       封面图 URL，留空则用色块占位
     accent      可选，占位封面色相 0-359；不填则按 order 自动分布
     summary     一句话简介（列表/详情摘要）
     description 详情页正文
     orientation portrait | landscape | any（启动页与横竖屏策略提示）
     entry       接入描述，见下方 ENTRY 注释
     status      placeholder（占位） | live（已接入）
     featured    是否进入首页推荐位候选
     order       排序权重，越小越靠前
     stats       统计数据，null 表示「未接入」，UI 显示「—」
   ========================================================================== */
window.Catalog = (function () {
  'use strict';

  var DESC = '这里是游戏简介占位文本。接入真实游戏时，请替换 title / subtitle / description / cover 等字段，玩法本身不在本框架范围内。';

  /* entry 接入方式（框架预留，不实现具体玩法）
     { type: 'placeholder' }                       占位，不渲染任何游戏
     { type: 'iframe', src: 'https://...' }        内嵌网页游戏
     { type: 'canvas', module: './games/xxx.js' }  本地 canvas / WebGL 模块
     { type: 'link', src: 'https://...' }          跳转到独立页面
  */

  var games = [
    /* ---- 第一个真实玩法：六子棋（canvas 挂载）---- */
    { id:'g-c6', title:'六子棋', subtitle:'Connect Six · 连六即胜', categories:['strategy'], tags:['棋类','双人','人机','联机','六连'], cover:'', accent:262,
      summary:'19 路棋盘，黑方先手一子，此后每回合各落两子，先连成六子者胜。',
      description:'六子棋（Connect6）：19 路棋盘，黑方首回合只落 1 子，之后双方每回合各落 2 子；横、竖、斜任一方向先连成 6 子即胜，棋盘填满则为平局。支持本地双人、人机对战（入门 / 普通 / 困难）与房间号联机。',
      orientation:'portrait', entry:{ type:'canvas', module:'./games/connect6.js' }, status:'live',
      featured:true, order:0, stats:{ plays:null, rating:null } },
    { id:'g-001', title:'占位游戏 01', subtitle:'副标题占位', categories:['puzzle'],   tags:['标签 A','标签 B'], cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:true,  order:1,  stats:{ plays:null, rating:null } },
    { id:'g-002', title:'占位游戏 02', subtitle:'副标题占位', categories:['casual'],   tags:['标签 B','标签 C'], cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:true,  order:2,  stats:{ plays:null, rating:null } },
    { id:'g-003', title:'占位游戏 03', subtitle:'副标题占位', categories:['arcade'],   tags:['标签 C'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'landscape', entry:{type:'placeholder'}, status:'placeholder', featured:true,  order:3,  stats:{ plays:null, rating:null } },
    { id:'g-004', title:'占位游戏 04', subtitle:'副标题占位', categories:['strategy'], tags:['标签 D'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:false, order:4,  stats:{ plays:null, rating:null } },
    { id:'g-005', title:'占位游戏 05', subtitle:'副标题占位', categories:['action'],   tags:['标签 A'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'landscape', entry:{type:'placeholder'}, status:'placeholder', featured:false, order:5,  stats:{ plays:null, rating:null } },
    { id:'g-006', title:'占位游戏 06', subtitle:'副标题占位', categories:['puzzle'],   tags:['标签 B'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'any',       entry:{type:'placeholder'}, status:'placeholder', featured:false, order:6,  stats:{ plays:null, rating:null } },
    { id:'g-007', title:'占位游戏 07', subtitle:'副标题占位', categories:['casual'],   tags:['标签 C'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:false, order:7,  stats:{ plays:null, rating:null } },
    { id:'g-008', title:'占位游戏 08', subtitle:'副标题占位', categories:['arcade'],   tags:['标签 D'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:false, order:8,  stats:{ plays:null, rating:null } },
    { id:'g-009', title:'占位游戏 09', subtitle:'副标题占位', categories:['strategy'], tags:['标签 A','标签 D'], cover:'', summary:'一句话简介占位。', description:DESC, orientation:'landscape', entry:{type:'placeholder'}, status:'placeholder', featured:false, order:9,  stats:{ plays:null, rating:null } },
    { id:'g-010', title:'占位游戏 10', subtitle:'副标题占位', categories:['action'],   tags:['标签 B'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:false, order:10, stats:{ plays:null, rating:null } },
    { id:'g-011', title:'占位游戏 11', subtitle:'副标题占位', categories:['puzzle'],   tags:['标签 C'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'portrait',  entry:{type:'placeholder'}, status:'placeholder', featured:false, order:11, stats:{ plays:null, rating:null } },
    { id:'g-012', title:'占位游戏 12', subtitle:'副标题占位', categories:['casual'],   tags:['标签 A'],          cover:'', summary:'一句话简介占位。', description:DESC, orientation:'any',       entry:{type:'placeholder'}, status:'placeholder', featured:false, order:12, stats:{ plays:null, rating:null } }
  ];

  return {
    site: {
      name: 'GAME HUB',       // 品牌占位，替换为实际名称
      mark: 'GH',             // 品牌标识占位
      tagline: '游戏聚合站 · 前端框架占位',
      version: '0.1.0-framework'
    },

    /* 分类：只定义结构，不含任何具体游戏内容 */
    categories: [
      { id:'all',      name:'全部', glyph:'◍' },
      { id:'puzzle',   name:'益智', glyph:'◈' },
      { id:'casual',   name:'休闲', glyph:'◇' },
      { id:'arcade',   name:'街机', glyph:'▲' },
      { id:'strategy', name:'策略', glyph:'▣' },
      { id:'action',   name:'动作', glyph:'✦' }
    ],

    /* 排序项：热门依赖 stats.plays，未接入时按 order 兜底 */
    sorts: [
      { id:'recommended', name:'推荐' },
      { id:'newest',      name:'最新' },
      { id:'popular',     name:'热门（未接入统计）' }
    ],

    /* 首页推荐位占位：href 可指向具体游戏或分类 */
    banners: [
      { id:'b-01', kicker:'推荐位占位', title:'主推游戏标题占位', sub:'用于放置主推游戏或活动入口', glyph:'◍', hue:262, href:'#/game/g-001' },
      { id:'b-02', kicker:'推荐位占位', title:'第二张 Banner 占位', sub:'左右滑动查看，scroll-snap 实现', glyph:'▲', hue:198, href:'#/categories?c=arcade' },
      { id:'b-03', kicker:'推荐位占位', title:'第三张 Banner 占位', sub:'后续可由运营位配置下发', glyph:'✦', hue:22,  href:'#/categories' }
    ],

    games: games
  };
})();
