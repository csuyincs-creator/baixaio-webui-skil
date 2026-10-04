/* ============================================================
   BURNCLUB FX CORE — 共享 WebGL 特效引擎
   噪声库(gl-noise 风格 simplex) / FXImage 图像着色器 /
   后处理管线(ACES+LUT+色差+颗粒+暗角+丁达尔+眩光+景深) /
   Leva 风格调试面板
   ============================================================ */
(function () {
  'use strict';

  const FX = (window.FX = { params: null, panels: [], dpr: 1 });
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  FX.reduced = REDUCED;

  /* ---------- 全局可调参数（Leva 风格面板绑定） ---------- */
  FX.params = {
    heat: 0.5,        // 热浪扭曲强度
    grain: 0.35,      // 胶片颗粒
    aberration: 0.4,  // 色差
    vignette: 0.55,   // 暗角
    rayIntensity: 0.6,// 丁达尔光
    flare: 0.5,       // 镜头眩光
    bloom: 0.35,      // 泛光
    emberCount: 220,  // 余烬粒子数
    audio: false,
  };

  /* ---------- gl-noise 风格共享噪声 GLSL ---------- */
  FX.GLSL_NOISE = `
  vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<5;i++){ v += a*snoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  `;

  /* ---------- ACES 色调映射 + 暖调 LUT 级别调色 ---------- */
  FX.GLSL_GRADE = `
  vec3 aces(vec3 x){
    float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
  }
  vec3 warmGrade(vec3 c, float amt){
    // 电影级暖调分级：压冷部、提火部（LUT 近似）
    float l = dot(c, vec3(0.299,0.587,0.114));
    vec3 shadow = vec3(0.98,0.99,1.04);          // 阴影微冷
    vec3 high   = vec3(1.06,1.01,0.94);          // 高光偏暖
    vec3 g = c * mix(vec3(1.0), mix(shadow, high, smoothstep(0.1,0.9,l)), amt);
    g += vec3(0.035,0.012,-0.01) * amt * smoothstep(0.4,1.0,l); // 火橙偏移
    return g;
  }
  `;

  /* ---------- 后处理全屏着色器 ----------
     丁达尔光柱 / 镜头眩光 / 色差 / 颗粒 / 动态暗角 / ACES / LUT / 景深近似 / 曝光闪白 */
  FX.POST_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2  uRes;
  uniform float uTime, uGrain, uAberr, uVig, uRays, uFlare, uBloom, uFlash, uDoF;
  uniform vec2  uLight;      // 光源屏幕坐标(0-1)
  varying vec2 vUv;
  ${'${NOISE}'}
  ${'${GRADE}'}
  void main(){
    vec2 uv = vUv;
    vec2 c = uv - 0.5;
    float r2 = dot(c,c);

    // ---- 镜头色差：边缘径向 RGB 分离 ----
    float ab = uAberr * 0.004 * (0.4 + r2*2.2);
    vec3 col;
    col.r = texture2D(tDiffuse, uv + c*ab).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - c*ab).b;

    // ---- 景深近似：边缘径向模糊 ----
    if(uDoF > 0.001){
      vec3 blur = vec3(0.0);
      for(int i=0;i<6;i++){
        float a = float(i) * 1.0472;
        blur += texture2D(tDiffuse, uv + vec2(cos(a),sin(a)) * uDoF * 0.006 * r2 * 4.0).rgb;
      }
      blur /= 6.0;
      col = mix(col, blur, smoothstep(0.06, 0.30, r2) * 0.8);
    }

    // ---- 体积丁达尔光：沿光源方向径向采样衰减 ----
    if(uRays > 0.001){
      vec2 dir = (uLight - uv) * 0.12;
      vec2 p = uv;
      float illum = 1.0;
      vec3 rays = vec3(0.0);
      for(int i=0;i<12;i++){
        p += dir;
        vec3 s = texture2D(tDiffuse, p).rgb;
        float l = dot(s, vec3(0.299,0.587,0.114));
        rays += s * illum * smoothstep(0.25, 1.0, l);
        illum *= 0.82;
      }
      rays /= 12.0;
      float fall = smoothstep(0.9, 0.0, distance(uv, uLight));
      col += rays * uRays * 1.6 * fall;
    }

    // ---- 镜头眩光：光源处水平拉伸条纹 + 光晕 ----
    if(uFlare > 0.001){
      float d = distance(uv, uLight);
      vec3 s1 = texture2D(tDiffuse, mix(uv, uLight, 0.94)).rgb;
      float bright = smoothstep(0.6,1.0,dot(s1,vec3(0.299,0.587,0.114)));
      float streak = exp(-abs((uv.y-uLight.y))*90.0) * exp(-abs((uv.x-uLight.x))*3.5);
      float halo   = exp(-d*5.5);
      float ghost  = exp(-distance(uv, 1.0-uLight)*7.0)*0.35; // 鬼影
      col += (streak*1.2 + halo*0.9 + ghost) * bright * uFlare * vec3(1.0,0.72,0.45);
    }

    // ---- ACES + 暖调 LUT ----
    col = aces(col * 1.25);
    col = warmGrade(col, 0.75);

    // ---- 胶片颗粒 ----
    float g = snoise(uv * uRes * 0.5 + uTime*60.0) * 0.5 + 0.5;
    col += (g - 0.5) * uGrain * 0.16;

    // ---- 动态暗角（呼吸） ----
    float vig = 1.0 - uVig * (0.55 + 0.1*sin(uTime*0.6)) * smoothstep(0.15, 0.62, r2);
    col *= vig;

    // ---- 曝光闪白（转场） ----
    col += uFlash * vec3(1.0, 0.97, 0.92);
    gl_FragColor = vec4(col, 1.0);
  }
  `
    .replace('${NOISE}', FX.GLSL_NOISE)
    .replace('${GRADE}', FX.GLSL_GRADE);

  FX.POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  /* ---------- FXImage：单图全特效着色器 ----------
     流体置换/热浪扭曲/光标扰动/鼠标波纹/切片分割/玻璃色散/
     动态像素化/半色调网点/噪点流动蒙版显影/颗粒 */
  FX.IMAGE_FRAG = `
  uniform sampler2D uTex;
  uniform vec2  uRes, uImgRes, uMouse;
  uniform float uTime, uHeat, uHover, uReveal, uSlices, uPix, uHalftone, uMouseWarp, uRipple, uGrain, uCover, uGray;
  varying vec2 vUv;
  ${'${NOISE}'}
  void main(){
    vec2 uv = vUv;

    // ---- 流体置换 + 热浪扭曲（底部上浮热气） ----
    if(uHeat > 0.001){
      float band = smoothstep(0.15, 1.0, uv.y); // 越靠上热气越弱
      float t = uTime * 0.55;
      uv.x += snoise(vec2(uv.y*4.0 - t*2.0, uv.x*3.0)) * 0.012 * uHeat * (1.2-band);
      uv.y += snoise(vec2(uv.x*5.0 + t*1.6, uv.y*4.0)) * 0.006 * uHeat;
      uv += vec2(fbm(uv*3.0 + t*0.2), fbm(uv*3.0 - t*0.2)) * 0.004 * uHeat;
    }

    // ---- 光标扰动：局部磁吸式扭曲 ----
    float md = distance(uv * uRes/uRes.y, uMouse * uRes/uRes.y);
    if(uMouseWarp > 0.001){
      float influence = exp(-md*md*22.0) * uMouseWarp;
      uv += normalize(uv - uMouse + 1e-6) * influence * 0.05;
    }
    // ---- 鼠标波纹（水面反射） ----
    if(uRipple > 0.001){
      float rip = sin(md*38.0 - uTime*5.0) * exp(-md*7.0) * uRipple;
      uv += normalize(uv - uMouse + 1e-6) * rip * 0.012;
    }

    // ---- 鼠标切片分割 ----
    if(uSlices > 0.001){
      float row = floor(uv.y * 24.0);
      float h = hash21(vec2(row, floor(uTime*9.0)));
      float trigger = step(0.6, h) * uSlices;
      uv.x += (h-0.5) * 0.14 * trigger * exp(-md*md*9.0);
    }

    // ---- 动态像素化 ----
    if(uPix > 0.001){
      float px = mix(220.0, 14.0, uPix);
      uv = floor(uv * px)/px + 0.5/px * mix(0.0,1.0,uPix);
    }

    // ---- cover 映射 ----
    vec2 s = uRes / uImgRes;
    float sc = max(s.x, s.y);
    vec2 sz = uImgRes * sc;
    vec2 cuv = (uv - 0.5) * (uRes / sz) + 0.5;

    // ---- 玻璃色散折射（hover 时 RGB 分层折射） ----
    vec3 col;
    if(uHover > 0.001){
      vec2 off = (cuv - 0.5) * 0.012 * uHover;
      col.r = texture2D(uTex, cuv + off*1.15).r;
      col.g = texture2D(uTex, cuv + off).g;
      col.b = texture2D(uTex, cuv + off*0.85).b;
    } else {
      col = texture2D(uTex, cuv).rgb;
    }

    // ---- 半色调网点 ----
    if(uHalftone > 0.001){
      float l = dot(col, vec3(0.299,0.587,0.114));
      float cell = mix(14.0, 3.0, uHalftone);
      vec2 hp = fract(vUv * uRes / cell) - 0.5;
      float dot_ = smoothstep(l*0.85, l*0.85+0.08, 1.0-length(hp)*1.4);
      col = mix(col, vec3(dot_) * max(col*1.6, vec3(0.06)), uHalftone);
    }

    // ---- 渐变噪点流动蒙版显影（reveal） ----
    if(uReveal < 0.999){
      float n = fbm(vUv*3.0 + uTime*0.15) * 0.5 + 0.5;
      float edge = smoothstep(uReveal - 0.18, uReveal + 0.02, n * 0.72 + vUv.y * 0.38);
      if(edge > 0.5) discard;
      col += vec3(1.0,0.35,0.1) * smoothstep(0.5,0.0,abs(edge-0.5)) * 0.5; // 显影火橙边缘
    }

    // ---- 暗部微颗粒 ----
    col += (snoise(vUv*uRes*0.4 + uTime*30.0)) * 0.012 * uGrain;

    // ---- 灰度纪律：默认黑白，光标距离 md 内局部恢复彩色（md 已无条件计算） ----
    if(uGray > 0.5){
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l)*vec3(1.02,1.0,0.96), col, exp(-md*md*30.0));
    }
    gl_FragColor = vec4(col, 1.0);
  }
  `
    .replace('${NOISE}', FX.GLSL_NOISE);

  /* ---------- FXImage 类：小型渲染器，离屏自动暂停 ---------- */
  class FXImage {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = Object.assign({ heat: 0, hoverDispersion: true, mouseWarp: 0.35, ripple: 0, halftoneOnScroll: false, reveal: false, pixelateOnScroll: false, grade: true }, opts);
      this.img = el.querySelector('img');
      if (!this.img) return;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'fx-canvas';
      el.insertBefore(this.canvas, el.firstChild);
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
      } catch (e) { this.canvas.remove(); return; }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
      this.camera.position.z = 1;
      this.uniforms = {
        uTex: { value: null }, uRes: { value: new THREE.Vector2(1,1) }, uImgRes: { value: new THREE.Vector2(1,1) },
        uMouse: { value: new THREE.Vector2(-1, -1) }, // 初始置屏外：光标未进入前保持全灰度（见 uGray）
        uTime: { value: 0 }, uHeat: { value: this.opts.heat },
        uHover: { value: 0 }, uReveal: { value: this.opts.reveal ? 0 : 1 }, uSlices: { value: 0 },
        uPix: { value: 0 }, uHalftone: { value: 0 }, uMouseWarp: { value: this.opts.mouseWarp },
        uRipple: { value: this.opts.ripple }, uGrain: { value: 1 }, uCover: { value: 1 },
        uGray: { value: 1 },
      };
      this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, fragmentShader: FX.IMAGE_FRAG, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }' });
      // NDC 顶点着色器：quad 必须 2x2 才能铺满 -1..1，否则画面只显示中心 50%
      this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
      this.visible = false;
      this.hover = 0; this.hoverTarget = 0; this.slices = 0;
      this.tex = new THREE.TextureLoader().load(this.img.src, () => {
        this.tex.minFilter = THREE.LinearFilter;
        this.uniforms.uTex.value = this.tex;
        this.uniforms.uImgRes.value.set(this.tex.image.width, this.tex.image.height);
        this.resize();
      });
      this.tex.colorSpace = THREE.SRGBColorSpace;

      el.addEventListener('mouseenter', () => { this.hoverTarget = 1; });
      el.addEventListener('mouseleave', () => { this.hoverTarget = 0; this.slices = 0; });
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        this.uniforms.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      });

      new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; this.canvas.style.visibility = this.visible ? 'visible' : 'hidden'; }, { rootMargin: '120px' }).observe(el);
      this.resize(); FX.images.push(this);
    }
    resize() {
      const r = this.el.getBoundingClientRect();
      if (r.width < 2) return;
      this.renderer.setSize(r.width, r.height, false);
      this.uniforms.uRes.value.set(r.width, r.height);
    }
    tick(t) {
      if (!this.visible || !this.uniforms.uTex.value) return;
      this.hover += (this.hoverTarget - this.hover) * 0.08;
      this.uniforms.uTime.value = t;
      this.uniforms.uHover.value = this.hover;
      this.uniforms.uSlices.value = this.slices;
      if (this.img && getComputedStyle(this.img).display !== 'none') this.img.style.opacity = 0;
      this.renderer.render(this.scene, this.camera);
    }
  }
  FX.images = [];
  FX.FXImage = FXImage;

  /* ---------- 后处理管线：场景 → RT → 全屏 post ---------- */
  class PostPipeline {
    constructor(renderer, scene, camera, opts = {}) {
      this.renderer = renderer; this.scene = scene; this.camera = camera;
      this.rt = new THREE.WebGLRenderTarget(2, 2, { samples: 0 });
      this.postScene = new THREE.Scene();
      this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.uniforms = {
        tDiffuse: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(2,2) },
        uTime: { value: 0 }, uGrain: { value: FX.params.grain }, uAberr: { value: FX.params.aberration },
        uVig: { value: FX.params.vignette }, uRays: { value: FX.params.rayIntensity },
        uFlare: { value: FX.params.flare }, uBloom: { value: FX.params.bloom },
        uFlash: { value: 0 }, uDoF: { value: 1 }, uLight: { value: new THREE.Vector2(0.72, 0.72) },
      };
      this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: FX.POST_VERT, fragmentShader: FX.POST_FRAG })));
      this.flash = 0;
    }
    setSize(w, h) {
      this.rt.setSize(Math.floor(w * FX.dpr), Math.floor(h * FX.dpr));
      this.uniforms.uRes.value.set(w, h);
    }
    render(t) {
      this.uniforms.uTime.value = t;
      this.uniforms.uGrain.value = FX.params.grain;
      this.uniforms.uAberr.value = FX.params.aberration;
      this.uniforms.uVig.value = FX.params.vignette;
      this.uniforms.uRays.value = FX.params.rayIntensity;
      this.uniforms.uFlare.value = FX.params.flare;
      this.flash += (0 - this.flash) * 0.09;
      this.uniforms.uFlash.value = this.flash;
      this.renderer.setRenderTarget(this.rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCam);
    }
    doFlash(v) { this.flash = Math.max(this.flash, v); }
  }
  FX.PostPipeline = PostPipeline;

  /* ---------- Leva 风格调参面板 ---------- */
  FX.initPanel = function () {
    if (FX._panelBuilt) return; FX._panelBuilt = true;
    const p = document.createElement('div');
    p.className = 'fx-panel';
    p.innerHTML = '<div class="fx-panel-head"><span>BURNCLUB / FX</span><button class="fx-panel-close" aria-label="关闭">×</button></div>';
    const defs = [
      ['heat', '热浪扭曲', 0, 1.5], ['grain', '胶片颗粒', 0, 1], ['aberration', '色差', 0, 1],
      ['vignette', '动态暗角', 0, 1], ['rayIntensity', '丁达尔光', 0, 1.2], ['flare', '镜头眩光', 0, 1.2],
      ['emberCount', '余烬粒子', 0, 400, 10], ['audio', '音效'],
    ];
    defs.forEach(([key, label, min, max, step]) => {
      const row = document.createElement('div'); row.className = 'fx-row';
      if (typeof FX.params[key] === 'boolean') {
        row.innerHTML = `<label>${label}</label><button class="fx-toggle" data-key="${key}">${FX.params[key] ? 'ON' : 'OFF'}</button>`;
        row.querySelector('button').addEventListener('click', (e) => {
          FX.params[key] = !FX.params[key];
          e.target.textContent = FX.params[key] ? 'ON' : 'OFF';
          e.target.classList.toggle('on', FX.params[key]);
          if (key === 'audio' && window.APP) window.APP.setAudio(FX.params.audio);
        });
      } else {
        row.innerHTML = `<label>${label}<em>${FX.params[key]}</em></label><input type="range" min="${min}" max="${max}" step="${step || 0.01}" value="${FX.params[key]}" data-key="${key}">`;
        const em = row.querySelector('em'), inp = row.querySelector('input');
        inp.addEventListener('input', () => { FX.params[key] = parseFloat(inp.value); em.textContent = inp.value; if (key === 'emberCount' && window.HERO) window.HERO.setEmbers(FX.params.emberCount); });
      }
      p.appendChild(row);
    });
    document.body.appendChild(p);
    const btn = document.createElement('button');
    btn.className = 'fx-panel-btn';
    btn.textContent = 'FX';
    btn.title = '特效调参面板 (H)';
    document.body.appendChild(btn);
    const toggle = () => p.classList.toggle('open');
    btn.addEventListener('click', toggle);
    p.querySelector('.fx-panel-close').addEventListener('click', toggle);
    window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) toggle(); });
  };

  /* ---------- 全局 tick ---------- */
  let _t = 0, _last = 0, _running = true;
  document.addEventListener('visibilitychange', () => { _running = !document.hidden; });
  function loop(now) {
    requestAnimationFrame(loop);
    if (!_running) return;
    const t = now * 0.001;
    _t = t;
    if (t - _last < 1 / 125) return; // 上限 125fps，省电
    _last = t;
    for (const im of FX.images) { try { im.tick(t); } catch (e) {} }
    if (FX._extraTicks) for (const f of FX._extraTicks) { try { f(t); } catch (e) {} }
  }
  FX.onTick = (f) => { (FX._extraTicks = FX._extraTicks || []).push(f); };
  requestAnimationFrame(loop);
})();
