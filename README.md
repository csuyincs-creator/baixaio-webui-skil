# BURNCLUB 燃社

家庭小家电潮牌官网 — 硬核外壳 + 生活内核。纯静态站（原生 HTML/CSS/JS + Three.js/GSAP/Lenis），无构建步骤。

## 本地预览

任选其一：

```bash
# Python
python -m http.server 8080
# 或 Node
npx serve .
```

然后打开 http://localhost:8080 。直接双击 index.html 也可以，但建议走本地服务器（音频/WebGL 更稳）。

快捷键：`H` 打开特效调参面板（Leva 风格）。

## 部署到 Vercel（绑定 GitHub）

1. 推送到 GitHub：
   ```bash
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 打开 [vercel.com/new](https://vercel.com/new) → 选择该仓库 Import。
3. Framework Preset 选 **Other**；Build Command 和 Output Directory 全部留空（纯静态）。
4. 点 Deploy。之后每次 `git push` 自动重新部署。

## 结构

```
index.html                  首页
product-*.html              详情页 ×4（咖啡/压力锅/破壁机/空气炸锅）
assets/css/main.css         设计系统（1976 行）
assets/js/fx-core.js        共享 WebGL 特效引擎（噪声/图像着色器/后处理/调参面板）
assets/js/gl.js             首屏 3D 场景/余烬物理/焦散/页面转场
assets/js/app.js            Lenis/光标/SplitText/Barba/音频/粒子文字
assets/img assets/sfx       素材（Unsplash 图库 + 程序化生成音效）
PLAN.md                     设计契约文档
```
