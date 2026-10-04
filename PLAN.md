# BURNCLUB 燃社 — 执行计划与设计契约（唯一事实源）

品牌：**燃社 BURNCLUB** — 家庭小家电潮牌。硬核外壳 + 生活内核，心理态 = 产品人格身份。
纯静态站，禁止构建工具。所有依赖已本地化于 `assets/`。

## 1. 文件清单
- `index.html` 首页
- `product-coffee.html / product-pressure.html / product-blender.html / product-night.html` 详情页 ×4
- `assets/css/main.css` 唯一样式表
- `assets/js/fx-core.js`（共享 GLSL + FXImage + 后处理 + 调参面板，已完成，勿改）
- `assets/js/gl.js`（首屏场景/余烬物理/焦散/转场，已完成，勿改）
- `assets/js/app.js`（Lenis/光标/SplitText/Barba/音频/粒子，已完成，勿改）
- 三方库（本地，按此顺序引入）：`assets/js/three.min.js`、`assets/js/cannon.min.js`、`assets/js/gsap.min.js`、`assets/js/ScrollTrigger.min.js`、`assets/js/SplitText.min.js`、`assets/js/lenis.min.js`、`assets/js/howler.min.js`、`assets/js/barba.umd.js`，之后 `fx-core.js`、`gl.js`、`app.js`
- 图片：`assets/img/`（hero.jpg, p-coffee.jpg, p-pressure.jpg, p-juice.jpg, p-night.jpg, col-morning.jpg, col-night.jpg, col-weekend.jpg, scene-01.jpg, scene-02.jpg, scene-03.jpg, g-beans.jpg, g-espresso.jpg, g-dalgona.jpg, g-iced.jpg）
- 音效：`assets/sfx/`（hover/click/whoosh/ambient/ember.wav，路径写 `assets/sfx/xxx.wav`）

## 2. 设计令牌（CSS 变量，main.css 必须以此为准）
```css
--bone:#F2EFE9;   /* 主底 骨白 */
--bone-2:#E9E4DA; /* 次底 */
--ink:#1C1915;    /* 主字 暖炭 */
--coffee:#241F19; /* 深色区块底 */
--ash:#8A857C;    /* 灰字 */
--line:rgba(28,25,21,.16); /* 细线 */
--ember:#FF4D00;  /* 火橙 唯一强调色：CTA/小红星/编号 */
--ember-soft:#FF6A1F;
字体: 'Noto Sans SC'（本地可变字体 assets/fonts/NotoSansSC.ttf，weight 100-900，@font-face 需声明 font-weight:100 900; font-display:swap）
display 字重 900；正文 400/500。
巨字: clamp(96px, 24vw, 340px)；区块标题 clamp(40px,7vw,120px)；行高 0.95-1.05。
```

## 3. 类名/数据属性契约（JS 已依赖，HTML/CSS 必须一致）
- `.preloader`（含 `.pre-num` 000-100 计数、`.pre-char`×2 「燃」「社」、底部「BURNCLUB · 点火中」）
- `.cursor-dot / .cursor-ring / .cursor-label`（光标，app.js 动态创建）
- `.grain-overlay / .vignette-overlay`（app.js 动态创建，fixed 全屏）
- `.fx-panel / .fx-panel-btn`（调参面板样式，H 键切换）
- `.fx-canvas`（FXImage 注入的画布，absolute inset-0，img 绝对定位其上）
- `.fx-transition`（转场画布，fixed inset-0 z 最高 pointer-events:none）
- `[data-hero-gl][data-src="assets/img/hero.jpg"]` 首屏 GL 容器（内放 `<h1>` 巨字等 HTML 层，canvas 由 gl.js 注入，z-index 在文字之下）
- `[data-caustics]` 焦散水面容器
- `[data-fximg]`（GL 图像卡：内放 `<img>`；可选 data-heat、data-ripple、data-halftone、data-pixelate、data-slices）
- `.reveal-color` + 内部两张 `<img class="bw">` `<img class="color">`（灰度/彩色叠加，光标局部点亮：color 层用 `mask-image:radial-gradient(circle 180px at var(--mx,50%) var(--my,50%), #000 30%, transparent 70%)`）
- `[data-split="chars|words|lines"]`（SplitText 动效，勿手动拆字）
- `[data-reveal]`（入场）、`[data-parallax="0.15"]`（视差）、`[data-wipe]`（图片擦除）
- `[data-snap-track]` + `.col-card`（Collections 吸附）
- `[data-magnetic]`（磁场吸附+弹性挤压，用于按钮）、`[data-cursor="文案"]`（光标放大提示）
- `[data-morph]` SVG 波浪路径（`d` 换成一条形态不同的备选路径）
- `[data-particles]` 页脚粒子文字画布（父容器需相对定位，JS 画「燃社」）
- `.audio-off` 状态由 JS 控制 nav 音效开关

## 4. 导航/页脚（两页共用结构）
- 导航：左 `燃社<span>BURNCLUB</span>` logo；中链接：人格图鉴 / Collections / 宣言；右：音效开关按钮 `.nav-sound`（示 🔊/🔇，aria-label）+ CTA「立即入社」；fixed，mix-blend-mode:difference，浅色站点上文字白色
- 页脚：`[data-particles]` 粒子巨字「燃社」；四列链接（人格图鉴 4 个单品链接 / 系列 / 社区 / 服务）；订阅表单（input + 火橙按钮「入社」）；底行 © 2026 BURNCLUB 燃社 · 把家变成主场 + ICP 备案占位

## 5. 首页结构（index.html，从上到下）
1. `.preloader`
2. `nav`
3. `#hero`：`[data-hero-gl]` 全屏。层序：canvas → 渐变遮罩 → 内容：小字「家庭小家电 · 火力全开 EST.2026」+ `<h1 data-split="chars">燃社</h1>`（clamp(120px,30vw,420px)）+ 副行「把家变成主场。」+ 双 CTA（`[data-magnetic]` 火橙实心「立即入社」→ index.html#manifesto 区；描边「查看人格图鉴」→ #roster）+ 底部滚动提示「SCROLL ↓」
4. marquee 跑马灯两行反向：内容 `火力全开 ✦ FAMILY APPLIANCES ✦ 燃社 BURNCLUB ✦ 人格主义家电 ✦`（.ember 色星）
5. `#manifesto` 宣言区（深色 --coffee 底）：编号 `01 / 宣言`；大字宣言（data-split="words"）：「家电不该是背景板。它站在你家最烫的地方，替你把日子点火。」+ 两段正文 + 右侧 3D 意图说明位（由 gl.js 线框体在首屏承担，此处放 scene-01.jpg 视差图 + 数据三枚：40+ 城市 / 12 万人社 / 4 条人格线）
6. `#roster` 人格图鉴（骨白底）：编号 `02 / 人格图鉴 ROSTER`；4 张 `.p-card` 编辑感交错网格（2 列，偶数卡下移 120px）：
   - 每卡：旋转编号章（.stamp「NO.001」火橙描边）+ `.reveal-color` 双图 + 人格名巨字 + 品类小字 + 宣言一句 + spec 微行（3 个参数）+ 「认领人格 →」链接（data-magnetic, data-cursor="认领"）
   - NO.001 凌晨四点的瘾者 / 意式咖啡系统 / p-coffee.jpg / 宣言「仪式不是习惯，是戒不掉的瘾。」/ 40档研磨 · ±1℃温控 · 15bar
   - NO.002 灶间暴徒 / 智能压力锅 / p-pressure.jpg / 「暴力，是温柔的成本。」/ 70kPa · 6L · 八重防护
   - NO.003 果园轰炸机 / 高速破壁机 / p-juice.jpg / 「把一整个果园按进杯子。」/ 38000rpm · 8叶精钢 · 1.8L
   - NO.004 深夜罪犯 / 空气炸锅 / p-night.jpg / 「罪恶感？0mg。」/ 200℃热风 · 5.5L · 免翻面
   卡片链接分别指向 4 个详情页
7. Collections 横向吸附区（--bone-2 底）：编号 `03 / 系列 COLLECTIONS`；`[data-snap-track]` 横向滚动（overflow-x:auto + scroll-snap-x mandatory），3 张 `.col-card`（min-width 62vw，`[data-fximg][data-halftone]`）：
   - 晨间仪式 MORNING RITUAL / col-morning.jpg / 「用一台咖啡机，叫醒整栋楼。」
   - 深夜厨房 AFTER DARK / col-night.jpg / 「合法的深夜罪恶。」
   - 周末火力全开 WEEKEND WARRIOR / col-weekend.jpg / 「厨房即主场。」
8. 波浪 SVG 分隔（`.wave-divider` 两段 path，主 path data-morph 备选形态）
9. 订阅区 `[data-caustics]`（深底焦散水面，内容叠其上）：「入社通讯」+ 表单 + 小字「每周一封 · 只有火货，没有废话」
10. `footer`（见 §4）
11. 场景橱窗区（#roster 与 Collections 之间，可选顺序）：scene-02/scene-03 `[data-wipe]` 擦除 + `[data-parallax]`，配大字「生活的火力现场」

## 6. 详情页结构（4 页同构，data-barba="container" data-title="…"）
1. `.preloader`、`nav`
2. 详情 hero：左列：返回「← 返回图鉴」（index.html#roster）、编号章 NO.00X、人格名巨字（data-split="chars"）、品类、宣言大字、CTA「认领人格 · ¥xxxx」[data-magnetic]；右列：`[data-fximg][data-heat="0.8"]` 产品图
3. 档案规格 `.spec-archive`（深色底）：档案式表格 6-8 行（参数名/值/备注三列，细线分隔，行 hover 行首出现火橙小星）
4. 人格画像区：左右分栏——左「人格侧写」列表（3 条关键词 + 描述），右 `scene-0X.jpg [data-wipe][data-parallax]`
5. 画廊 3 图 `[data-fximg]`（heat=0.3；中间那张 data-pixelate）交错排布 + 引物大字（data-split="words"）
6. 全息档案卡 `.holo-card`（Fire 橙描边 + CSS 扫描线动画 background:repeating-linear-gradient + 缓慢位移动画）：产口号 + 「限量编号 0001-0400 · 已入社 12,047 人」
7. 订阅区 `[data-caustics]` 同首页
8. footer 同首页（订阅表单可省，链接列保留）
文案见 §5 各人格参数，价格：咖啡 ¥1,299 / 压力锅 ¥899 / 破壁机 ¥749 / 空气炸锅 ¥599。画廊图：咖啡页用 g-espresso/g-beans/g-dalgona；破壁机页 g-iced/g-dalgona/g-espresso（可复用，注明 mood）；压力锅页 scene-01/scene-03/g-beans；深夜页 col-night/p-night/g-espresso。
每页 `<html lang="zh-CN">`，meta title/ description 按「人格名 · 燃社 BURNCLUB」。

## 7. main.css 必含（评审要点）
- 精细版式节奏：编号系统（章节编号/旋转章）、细线网格、大量留白、编辑感交错
- 完整 hover 态：链接下划线滑动、按钮弹性（JS 配合）、卡片浮起
- ::selection 火橙；滚动条细窄炭色；focus-visible 可达性
- 响应式断点 1024/760/480：巨字缩放、图鉴改单列、Collections 改纵向
- @media (prefers-reduced-motion: reduce) 关闭 marquee/扫描线动画
- 性能：只对动画元素用 transform/opacity；canvas 层 will-change 提示适度

## 8. 验收（交叉评审用）
- 首屏巨字压场 + GL 融合无违和；导航 difference 可读
- 图鉴卡编辑感、无破版；Collections 吸附顺滑；焦散区氛围成立
- 详情页档案表格信息层级清晰；全站火橙只出现在 CTA/星标/编号，不滥用
- console 无报错；Lighthouse 性能意识（图 1600w q80、DPR 限 1.5）
