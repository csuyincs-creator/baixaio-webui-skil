/* ============================================================
   BURNCLUB APP — Lenis / 光标系统 / SplitText / Barba 转场 /
   音频交互 / 粒子文字 / 滚动动效编排
   ============================================================ */
(function () {
  'use strict';
  const FX = window.FX;
  const REDUCED = FX.reduced;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ================= 音频：Howler ================= */
  const APP = (window.APP = { audio: null });
  APP.initAudio = function () {
    if (!window.Howl) return;
    const sfx = {
      hover: new Howl({ src: ['assets/sfx/hover.wav'], volume: 0.12 }),
      click: new Howl({ src: ['assets/sfx/click.wav'], volume: 0.3 }),
      whoosh: new Howl({ src: ['assets/sfx/whoosh.wav'], volume: 0.4 }),
      ambient: new Howl({ src: ['assets/sfx/ambient.wav'], volume: 0.16, loop: true }),
    };
    APP.sfx = sfx;
    APP.enabled = true;
    APP.ambientOn = false;
    APP.setAudio = function (on) {
      APP.enabled = on;
      if (!on && APP.ambientOn) { sfx.ambient.stop(); APP.ambientOn = false; }
      document.body.classList.toggle('audio-off', !on);
    };
    // 首次交互解锁环境音
    const unlock = () => {
      if (APP.enabled && !APP.ambientOn) { sfx.ambient.play(); APP.ambientOn = true; }
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    // 悬停/点击音
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button, .p-card, [data-magnetic]') && APP.enabled) sfx.hover.play();
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('a, button') && APP.enabled) sfx.click.play();
    });
  };

  /* ================= 自定义光标：磁场吸附 + 弹性挤压 ================= */
  APP.initCursor = function () {
    if (REDUCED || window.matchMedia('(pointer: coarse)').matches) return;
    const dot = document.createElement('div'); dot.className = 'cursor-dot';
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    const label = document.createElement('div'); label.className = 'cursor-label';
    ring.appendChild(label);
    document.body.append(dot, ring);
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      // 首次移动才点亮光标，避免初始 (0,0) 残影（合成事件不激活）
      if (!dot.classList.contains('cursor-active') && (e.clientX > 3 || e.clientY > 3)) {
        dot.classList.add('cursor-active');
        ring.classList.add('cursor-active');
      }
      const t = e.target.closest('[data-cursor]');
      if (t) { ring.classList.add('big'); label.textContent = t.dataset.cursor || ''; }
      else { ring.classList.remove('big'); label.textContent = ''; }
    }, { passive: true });

    // 磁场吸附
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.35);
        my((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', scale: 1, scaleY: 1 }); // 弹性回弹
      });
      el.addEventListener('pointerdown', () => gsap.to(el, { scaleY: 0.82, scaleX: 1.12, duration: 0.18, ease: 'power2.in' })); // 弹性挤压
      el.addEventListener('pointerup', () => gsap.to(el, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,0.4)' }));
    });
  };

  /* ================= Lenis 丝滑滚动 ================= */
  APP.initLenis = function () {
    if (!window.Lenis || REDUCED) return null;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    // 锚点
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); lenis.scrollTo(id, { offset: 0 }); }
      });
    });
    return lenis;
  };

  /* ================= 导航滚动态：>40px 后落地为实底 ================= */
  APP.initNavScroll = function () {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    let last = null;
    const update = () => {
      const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 40;
      if (scrolled !== last) { nav.classList.toggle('scrolled', scrolled); last = scrolled; }
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  };

  /* ================= SplitText 文字动效 ================= */
  APP.initTextAnims = function () {
    if (!hasGSAP || REDUCED) return;
    // 巨字：逐字生长
    document.querySelectorAll('[data-split="chars"]').forEach((el) => {
      const split = new SplitText(el, { type: 'chars', charsClass: 'st-char' });
      gsap.from(split.chars, {
        yPercent: 120, rotateZ: 6, autoAlpha: 0, duration: 1.1, stagger: 0.07,
        ease: 'expo.out', delay: el.dataset.delay ? parseFloat(el.dataset.delay) : 0,
        scrollTrigger: el.closest('[data-hero-gl], #hero') ? null : { trigger: el, start: 'top 85%' },
      });
    });
    // 正文：逐词生长
    document.querySelectorAll('[data-split="words"]').forEach((el) => {
      const split = new SplitText(el, { type: 'words', wordsClass: 'st-word' });
      gsap.from(split.words, {
        yPercent: 60, autoAlpha: 0, scale: 0.86, duration: 0.8, stagger: 0.045, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });
    // 行级上浮
    document.querySelectorAll('[data-split="lines"]').forEach((el) => {
      const split = new SplitText(el, { type: 'lines', linesClass: 'st-line' });
      gsap.from(split.lines, {
        yPercent: 110, duration: 1, stagger: 0.09, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });
  };

  /* ================= 通用滚动动效 ================= */
  APP.initScrollFX = function () {
    if (!hasGSAP) return;
    if (REDUCED) return;
    // 元素入场
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 60, autoAlpha: 0, duration: 1.1, ease: 'expo.out', delay: parseFloat(el.dataset.reveal) || 0,
        scrollTrigger: { trigger: el, start: 'top 96%' },
      });
    });
    // 多层视差
    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.15;
      gsap.to(el, {
        yPercent: -speed * 100, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });
    // 滚动图片擦除
    gsap.utils.toArray('[data-wipe]').forEach((el) => {
      gsap.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, {
        clipPath: 'inset(0 0% 0 0)', ease: 'power2.inOut', duration: 1.4,
        scrollTrigger: { trigger: el, start: 'top 82%' },
      });
    });
    // 半色调网点显影（GL 图像）
    gsap.utils.toArray('[data-halftone]').forEach((el) => {
      const fx = el._fxImage;
      if (!fx) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 95%', end: 'top 35%', scrub: 0.5,
        onUpdate: (st) => { fx.uniforms.uHalftone.value = 1 - st.progress; },
      });
    });
    // 动态像素化（滚动退出）
    gsap.utils.toArray('[data-pixelate]').forEach((el) => {
      const fx = el._fxImage;
      if (!fx) return;
      ScrollTrigger.create({
        trigger: el, start: 'bottom 40%', end: 'bottom 5%', scrub: 0.5,
        onUpdate: (st) => { fx.uniforms.uPix.value = st.progress; },
      });
    });
    // SVG 形状形变（波浪分隔线随滚动起伏）
    gsap.utils.toArray('[data-morph]').forEach((path) => {
      const d1 = path.getAttribute('d');
      const d2 = path.dataset.morph;
      gsap.to(path, {
        attr: { d: d2 }, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1,
      });
    });
    // 滚动吸附机位（Collections 横向区）
    const track = document.querySelector('[data-snap-track]');
    if (track) {
      const cards = track.querySelectorAll('.col-card');
      ScrollTrigger.create({
        trigger: track, start: 'top 55%', end: 'bottom 45%',
        snap: { snapTo: (v) => { const n = cards.length; return Math.round(v * (n - 1)) / (n - 1); }, duration: 0.4, ease: 'power2.inOut' },
      });
    }
    // 卡片 hover 光标扰动（GL 图像切片）
    document.querySelectorAll('[data-fximg][data-slices]').forEach((el) => {
      el.addEventListener('mousemove', () => { if (el._fxImage) el._fxImage.slices = 1; });
      el.addEventListener('mouseleave', () => { if (el._fxImage) el._fxImage.slices = 0; });
    });
  };

  /* ================= 光标局部点亮（灰度图彩色显影） ================= */
  APP.initColorReveal = function () {
    document.querySelectorAll('.reveal-color').forEach((box) => {
      const colorLayer = box.querySelector('img.color');
      if (!colorLayer) return;
      box.addEventListener('pointermove', (e) => {
        const r = box.getBoundingClientRect();
        colorLayer.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        colorLayer.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      }, { passive: true });
    });
  };

  /* ================= 页脚文字粒子：打散重组 ================= */
  APP.initParticles = function () {
    const cv = document.querySelector('[data-particles]');
    if (!cv || REDUCED) return;
    const ctx = cv.getContext('2d');
    let parts = [], W = 0, H = 0, assembled = false;
    const mouse = { x: -999, y: -999 };
    function build() {
      const r = cv.parentElement.getBoundingClientRect();
      W = cv.width = r.width * Math.min(devicePixelRatio, 1.5);
      H = cv.height = r.height * Math.min(devicePixelRatio, 1.5);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#1C1915';
      ctx.font = `900 ${H * 0.52}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('燃社', W / 2, H / 2 + H * 0.04);
      const data = ctx.getImageData(0, 0, W, H).data;
      const gap = Math.max(5, Math.floor(W / 160));
      parts = [];
      for (let y = 0; y < H; y += gap) {
        for (let x = 0; x < W; x += gap) {
          if (data[(y * W + x) * 4 + 3] > 128) {
            parts.push({
              hx: x, hy: y,
              x: Math.random() * W, y: Math.random() * H,
              vx: 0, vy: 0, s: gap * 0.42,
            });
          }
        }
      }
      ctx.clearRect(0, 0, W, H);
    }
    cv.parentElement.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (W / r.width);
      mouse.y = (e.clientY - r.top) * (H / r.height);
    }, { passive: true });
    cv.parentElement.addEventListener('pointerleave', () => { mouse.x = -999; mouse.y = -999; });
    let vis = false;
    new IntersectionObserver((es) => {
      vis = es[0].isIntersecting;
      if (vis && !assembled) {
        assembled = true;
        if (!parts.length) build(); // 字体/布局未就绪导致采样为空时重建一次
        scatter();
      }
    }).observe(cv);
    function scatter() {
      for (const p of parts) {
        const a = Math.random() * Math.PI * 2;
        p.vx += Math.cos(a) * 14; p.vy += Math.sin(a) * 14; // 粒子打散
      }
    }
    FX.onTick(() => {
      if (!vis) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#1C1915';
      for (const p of parts) {
        // 弹簧回位（重组）+ 鼠标斥力
        const sx = (p.hx - p.x) * 0.11, sy = (p.hy - p.y) * 0.11;
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        let rx = 0, ry = 0;
        if (d2 < 3600) { const f = (1 - d2 / 3600) * 3.2 / Math.sqrt(d2 + 1); rx = dx * f; ry = dy * f; }
        p.vx = (p.vx + sx + rx) * 0.8; p.vy = (p.vy + sy + ry) * 0.8;
        p.x += p.vx; p.y += p.vy;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
    });
    window.addEventListener('resize', build, { passive: true });
    // 等字体/布局就绪再采样像素，避免「燃社」粒子空白
    const boot = () => { build(); if (!vis) setTimeout(scatter, 400); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
    else boot();
    window.addEventListener('load', () => { if (!parts.length) build(); }, { once: true });
  };

  /* ================= 颗粒 / 暗角覆盖层 ================= */
  APP.initGrain = function () {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const ctx = c.getContext('2d');
    const d = ctx.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 26; }
    ctx.putImageData(d, 0, 0);
    const div = document.createElement('div'); div.className = 'grain-overlay';
    div.style.backgroundImage = `url(${c.toDataURL()})`;
    document.body.appendChild(div);
    const vig = document.createElement('div'); vig.className = 'vignette-overlay';
    document.body.appendChild(vig);
  };

  /* ================= 预加载器 ================= */
  APP.initPreloader = function () {
    const pre = document.querySelector('.preloader');
    if (!pre) { document.body.classList.add('loaded'); return; }
    if (REDUCED || new URLSearchParams(location.search).has('nopre')) {
      pre.remove(); document.body.classList.add('loaded'); return;
    }
    const num = pre.querySelector('.pre-num');
    const chars = pre.querySelectorAll('.pre-char');
    let v = 0;
    const tick = setInterval(() => {
      v = Math.min(100, v + Math.random() * 16);
      if (num) num.textContent = String(Math.floor(v)).padStart(3, '0');
      if (v >= 100) {
        clearInterval(tick);
        if (hasGSAP) {
          gsap.to(chars, { yPercent: -120, stagger: 0.06, duration: 0.7, ease: 'expo.in' });
          gsap.to(pre, {
            yPercent: -100, duration: 0.9, ease: 'expo.inOut', delay: 0.35,
            onComplete: () => { pre.remove(); document.body.classList.add('loaded'); ScrollTrigger.refresh(); },
          });
        } else { pre.remove(); document.body.classList.add('loaded'); }
      }
    }, 80);
  };

  /* ================= Barba 页面转场 ================= */
  APP.initBarba = function () {
    const transition = FX.initTransition();
    if (!window.Barba || REDUCED || !transition) return;
    barba.init({
      prevent: ({ el }) => el.dataset && el.dataset.transition === 'off',
      timeout: 8000,
      schema: { prefix: 'data-barba', wrapper: 'wrap' },
      transitions: [{
        name: 'ember-wipe',
        async leave() {
          APP.sfx && APP.enabled && APP.sfx.whoosh.play();
          await new Promise((res) => transition(res));
        },
        async enter() {
          window.scrollTo(0, 0);
          if (window.APP._lenis) window.APP._lenis.scrollTo(0, { immediate: true });
          // 销毁旧页面 GL，重建新页面场景
          FX.teardown();
          document.querySelectorAll('[data-fximg]').forEach((el) => {
            const opts = { heat: parseFloat(el.dataset.heat || 0) };
            if (el.dataset.ripple) opts.ripple = 0.6;
            el._fxImage = new FX.FXImage(el, opts);
          });
          FX.boot();
          if (hasGSAP) ScrollTrigger.refresh();
          APP.initColorReveal();
        },
      }],
    });
    // Barba 处理后 GL 场景需重建：转场进入后刷新页面级 FX
    barba.hooks.entered((data) => {
      document.title = data.next.container.dataset.title || document.title;
    });
  };

  /* ================= 启动 ================= */
  document.addEventListener('DOMContentLoaded', () => {
    APP.initPreloader();
    APP.initGrain();
    APP.initAudio();
    APP.initCursor();
    APP._lenis = APP.initLenis();
    APP.initNavScroll();
    // GL 图像实例化
    document.querySelectorAll('[data-fximg]').forEach((el) => {
      const opts = { heat: parseFloat(el.dataset.heat || 0) };
      if (el.dataset.ripple) opts.ripple = 0.6;
      el._fxImage = new FX.FXImage(el, opts);
    });
    APP.initTextAnims();
    APP.initScrollFX();
    APP.initColorReveal();
    APP.initParticles();
    APP.initBarba();
    FX.initPanel();
  });
})();
