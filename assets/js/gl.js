/* ============================================================
   BURNCLUB GL — 首屏 3D 场景 / 余烬物理 / 线框体拆解 / 焦散水面
   ============================================================ */
(function () {
  'use strict';
  if (!window.THREE || !window.FX) return;
  const FX = window.FX;
  const REDUCED = FX.reduced;

  /* ============ 首屏 HERO 场景 ============ */
  function initHero() {
    const wrap = document.querySelector('[data-hero-gl]');
    if (!wrap) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    } catch (e) { wrap.classList.add('gl-fallback'); return; }
    FX.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(FX.dpr);
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
    camera.position.set(0, 0, 3.2);

    /* ---- 背景图像平面：流体置换 + 热浪 + 光标扰动 + 波纹 ---- */
    const imgUniforms = {
      uTex: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uImgRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTime: { value: 0 },
      uHeat: { value: 0.9 }, uHover: { value: 0 }, uReveal: { value: 1 }, uSlices: { value: 0 },
      uPix: { value: 0 }, uHalftone: { value: 0 }, uMouseWarp: { value: 0.5 }, uRipple: { value: 0.8 }, uGrain: { value: 1 },
      uGray: { value: 0 }, // 首屏 hero 保持暖调彩色（灰度纪律豁免）
    };
    const imgMat = new THREE.ShaderMaterial({
      uniforms: imgUniforms,
      fragmentShader: FX.IMAGE_FRAG,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imgMat);
    plane.position.z = -0.6;
    scene.add(plane);
    const tex = new THREE.TextureLoader().load(wrap.dataset.src, () => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      imgUniforms.uTex.value = tex;
      imgUniforms.uImgRes.value.set(tex.image.width, tex.image.height);
    });

    /* ---- 线框叠加 + 菲涅尔轮廓光 + 环境反射 + 滚动生长/拆解 ---- */
    const objUniforms = {
      uTime: { value: 0 }, uGrow: { value: 0 }, uExplode: { value: 0 },
      uColor: { value: new THREE.Color(0xff4d00) },
    };
    const objVert = `
      uniform float uGrow, uExplode, uTime;
      varying vec3 vN; varying vec3 vPos; varying float vClip;
      float snoise3(vec3 p){ return sin(p.x*2.1)*0.5 + sin(p.y*1.7)*0.3 + sin(p.z*2.3)*0.2; }
      void main(){
        vec3 pos = position;
        // 滚动模型拆解：沿法线噪声位移
        pos += normal * (snoise3(position*2.0 + uTime*0.2) * 0.5 + 0.5) * uExplode * 0.9;
        vClip = smoothstep(0.0, 0.25, pos.y + 0.9 - (1.0 - uGrow) * 2.4); // 模型生长剥离
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`;
    const objFrag = `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vN; varying vec3 vPos; varying float vClip;
      void main(){
        if(vClip < 0.5) discard;
        vec3 V = normalize(-vPos);
        // 菲涅尔轮廓光
        float fres = pow(1.0 - max(dot(vN, V), 0.0), 2.4);
        // 动态环境反射：程序化渐变环境贴图
        vec3 env = mix(vec3(0.09,0.08,0.07), vec3(0.45,0.28,0.16), vN.y*0.5+0.5);
        env += uColor * 0.22 * max(0.0, vN.z);
        vec3 col = env + fres * uColor * 1.7;
        gl_FragColor = vec4(col, 1.0);
      }`;
    const objGeo = new THREE.IcosahedronGeometry(0.62, 3);
    const objMesh = new THREE.Mesh(objGeo, new THREE.ShaderMaterial({ uniforms: objUniforms, vertexShader: objVert, fragmentShader: objFrag }));
    objMesh.scale.setScalar(0.001);
    scene.add(objMesh);
    const wire = new THREE.Mesh(objGeo, new THREE.ShaderMaterial({
      uniforms: objUniforms, wireframe: true, transparent: true,
      vertexShader: objVert,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying float vClip; varying vec3 vPos;
        void main(){ if(vClip<0.5) discard;
        float scan = 0.5 + 0.5*sin(vPos.y*24.0 - uTime*3.0); // 全息扫描线
        gl_FragColor = vec4(uColor, 0.10 + scan*0.12); }`,
    }));
    wire.scale.set(1.06, 1.06, 1.06);
    scene.add(wire);

    /* ---- 余烬粒子：Cannon-es 轻量物理碰撞 + 光标磁场 ---- */
    let world = null, bodies = [], emberGeo, emberPts, emberVel;
    const emberColor = new THREE.Color(0xff6a1f);
    function buildEmbers(n) {
      if (emberPts) { scene.remove(emberPts); emberGeo.dispose(); }
      bodies = [];
      if (!world) {
        world = new CANNON.World();
        world.gravity.set(0, -0.35, 0); // 微重力悬浮场
        // 左右边界墙
        [[-3.6, Math.PI / 2], [3.6, -Math.PI / 2]].forEach(([x, ry]) => {
          const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
          wall.quaternion.setFromEuler(0, ry, 0);
          wall.position.set(x, 0, 0);
          world.addBody(wall);
        });
      }
      for (let i = 0; i < n; i++) {
        const b = new CANNON.Body({ mass: 0.4, shape: new CANNON.Sphere(0.028), linearDamping: 0.35 });
        b.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.2);
        b.velocity.set((Math.random() - 0.5) * 1.2, Math.random() * 1.6, (Math.random() - 0.5) * 0.6);
        world.addBody(b); bodies.push(b);
      }
      const count = bodies.length;
      emberGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const sz = new Float32Array(count);
      for (let i = 0; i < count; i++) sz[i] = 4 + Math.random() * 14;
      emberGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      emberGeo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      const emberMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: emberColor }, uPixelRatio: { value: FX.dpr } },
        vertexShader: `attribute float aSize; varying float vA;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uPixelRatio * (1.0/-mv.z) * 2.2;
          gl_Position = projectionMatrix * mv; vA = 1.0; }`,
        fragmentShader: `uniform vec3 uColor; varying float vA;
          void main(){ float d = length(gl_PointCoord-0.5);
          float a = smoothstep(0.5,0.0,d);
          vec3 c = mix(uColor, vec3(1.0,0.85,0.6), smoothstep(0.35,0.0,d)); // 白热核心
          gl_FragColor = vec4(c, a*a*0.85); }`,
      });
      emberPts = new THREE.Points(emberGeo, emberMat);
      scene.add(emberPts);
    }
    if (!REDUCED && window.CANNON) buildEmbers(FX.params.emberCount);

    const mouse3 = new THREE.Vector2(0, 0);
    window.addEventListener('pointermove', (e) => {
      mouse3.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      imgUniforms.uMouse.value.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    }, { passive: true });

    /* ---- 尺寸 ---- */
    function fitPlane() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const cam = { fov: 50 * Math.PI / 180 };
      const dist = 3.2 + 0.6;
      const vh = 2 * Math.tan(cam.fov / 2) * dist, vw = vh * (w / h);
      plane.scale.set(vw * 1.12, vh * 1.12, 1);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      pipeline && pipeline.setSize(w, h);
      objMesh.position.set(w > 760 ? vw * 0.26 : 0, 0, 0.4);
      wire.position.copy(objMesh.position);
    }

    /* ---- 后处理管线 ---- */
    const pipeline = new FX.PostPipeline(renderer, scene, camera);
    pipeline.uniforms.uLight.value.set(0.74, 0.78);

    /* ---- 滚动联动相机 + 手持微震 + 拆解驱动 ---- */
    const scroll = { y: 0, prog: 0 };
    if (window.ScrollTrigger) {
      ScrollTrigger.create({
        trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: (st) => { scroll.prog = st.progress; scroll.y = st.progress; },
      });
      ScrollTrigger.create({
        trigger: '#hero', start: 'top top', end: '+=160%', scrub: 0.6,
        onUpdate: (st) => {
          const p = st.progress;
          objUniforms.uGrow.value = THREE.MathUtils.smoothstep(p, 0.05, 0.45);
          objUniforms.uExplode.value = THREE.MathUtils.smoothstep(p, 0.55, 1.0);
          objMesh.rotation.y = p * Math.PI * 1.4;
          wire.rotation.y = objMesh.rotation.y;
        },
      });
    }

    let visible = true;
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '60px' }).observe(wrap);

    FX.onTick((t) => {
      if (!visible) return;
      objUniforms.uTime.value = t;
      imgUniforms.uTime.value = t;
      // 手持微震：多频正弦叠加（极小振幅）
      const shakeX = Math.sin(t * 0.9) * 0.004 + Math.sin(t * 2.3) * 0.0022;
      const shakeY = Math.cos(t * 1.1) * 0.003 + Math.sin(t * 1.9) * 0.0018;
      // 滚动联动相机：上移 + 微缩 + 跟随光标视差
      camera.position.x = shakeX + mouse3.x * 0.05;
      camera.position.y = shakeY + mouse3.y * 0.03 + scroll.y * 0.55;
      camera.position.z = 3.2 + scroll.y * 0.9;
      camera.lookAt(0, scroll.y * 0.3, 0);
      // 物理步进 + 磁场扰动
      if (world && bodies.length) {
        const tmpForce = new CANNON.Vec3();
        const targetCount = Math.min(FX.params.emberCount, bodies.length);
        for (let i = 0; i < targetCount; i++) {
          const b = bodies[i];
          // 光标磁场：吸引 + 紊流
          const px = (mouse3.x * 3.0), py = (mouse3.y * 1.8);
          const dx = px - b.position.x, dy = py - b.position.y;
          const d2 = dx * dx + dy * dy + 0.3;
          tmpForce.set(dx / d2 * 1.6, dy / d2 * 1.6 + Math.sin(t * 2 + i) * 0.35, 0);
          b.applyForce(tmpForce, b.position);
          if (b.position.y < -2.6) { b.position.y = 2.6; b.velocity.set(0, 0.2, 0); } // 循环
        }
        world.step(1 / 60, t, 3);
        const arr = emberGeo.attributes.position.array;
        for (let i = 0; i < targetCount; i++) {
          arr[i * 3] = bodies[i].position.x; arr[i * 3 + 1] = bodies[i].position.y; arr[i * 3 + 2] = bodies[i].position.z;
        }
        emberGeo.setDrawRange(0, targetCount);
        emberGeo.attributes.position.needsUpdate = true;
      }
      pipeline.render(t);
    });

    let rw = () => { FX.dpr = Math.min(window.devicePixelRatio || 1, 1.5); renderer.setPixelRatio(FX.dpr); fitPlane(); };
    window.addEventListener('resize', rw, { passive: true });
    fitPlane();

    window.HERO = {
      setEmbers(n) { if (window.CANNON && !REDUCED) buildEmbers(Math.round(n)); },
      flash: (v) => pipeline.doFlash(v),
    };
  }

  /* ============ 焦散折射 + 波纹水面（订阅区背景） ============ */
  function initCaustics() {
    const wrap = document.querySelector('[data-caustics]');
    if (!wrap) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    wrap.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform vec2 uMouse, uRes;
        ${'' /* 内联简化噪声 */}
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        // 焦散折射：双层 voronoi 网格折射叠加
        float caustic(vec2 uv, float t){
          float v = 0.0;
          for(float i=1.0; i<=3.0; i++){
            vec2 p = uv*i*3.0 + vec2(t*0.3*i, -t*0.22*i);
            vec2 g = fract(p)-0.5;
            vec2 o = vec2(n2(floor(p)), n2(floor(p)+7.7))-0.5;
            float d = length(g-o);
            v += smoothstep(0.24, 0.0, d) / i;
          }
          return v;
        }
        void main(){
          vec2 uv = vUv;
          // 波纹水面：鼠标涟漪
          float md = distance((uv-uMouse)*vec2(uRes.x/uRes.y,1.0), vec2(0.0));
          float rip = sin(md*46.0 - uTime*4.5) * exp(-md*8.0) * 0.012;
          uv += normalize(uv-uMouse+1e-6)*rip;
          float c = caustic(uv*vec2(uRes.x/uRes.y,1.0)*1.4, uTime);
          vec3 base = vec3(0.10, 0.086, 0.072);           // 深咖底
          vec3 fire  = vec3(1.0, 0.42, 0.10);              // 焦散火光
          vec3 col = base + fire * c * 0.34;
          col += fire * 0.05 * exp(-md*3.0);               // 光标局部点亮
          float vig = 1.0 - 0.5*smoothstep(0.2,0.7,dot(uv-0.5,uv-0.5)*2.0);
          gl_FragColor = vec4(col*vig, 1.0);
        }`,
    });
    // NDC 顶点着色器：quad 必须 2x2 才能铺满 -1..1
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    function fit() {
      const r = wrap.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      mat.uniforms.uRes.value.set(r.width, r.height);
    }
    wrap.addEventListener('pointermove', (e) => {
      const r = wrap.getBoundingClientRect();
      mat.uniforms.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    }, { passive: true });
    let vis = false;
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(wrap);
    FX.onTick((t) => { if (!vis) return; mat.uniforms.uTime.value = t; renderer.render(scene, cam); });
    window.addEventListener('resize', fit, { passive: true });
    fit();
  }

  /* ============ 页面转场：波纹溶解 + 像素化 + 曝光闪白 ============ */
  FX.initTransition = function () {
    if (FX._transition || REDUCED || !window.THREE) return () => {};
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); } catch (e) { return () => {}; }
    renderer.setPixelRatio(1);
    const canvas = renderer.domElement;
    canvas.className = 'fx-transition';
    document.body.appendChild(canvas);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = { uTime: { value: 0 }, uProg: { value: 0 }, uDir: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime, uProg, uDir; uniform vec2 uRes;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 uv = vUv;
          // 波纹：从中心扩散的环形扰动
          float d = distance(uv, vec2(0.5));
          float ring = sin(d*30.0 - uProg*14.0) * 0.5 + 0.5;
          // 噪点流动蒙版阈值
          float n = n2(uv*6.0 + ring*0.35) * 0.7 + n2(uv*13.0)*0.3;
          float edge = smoothstep(uProg-0.16, uProg+0.06, n*0.55 + d*0.7);
          // 动态像素化随转场增强
          float px = mix(600.0, 26.0, min(1.0, uProg*1.4));
          vec2 puv = (uDir > 0.5) ? uv : (floor(uv*px)/px + 0.5/px);
          float col = (1.0 - edge);
          vec3 fire = mix(vec3(1.0,0.98,0.94), vec3(1.0,0.30,0.0), ring*0.8);
          float alpha = (uDir > 0.5) ? col : col;
          gl_FragColor = vec4(fire, clamp(alpha,0.0,1.0));
        }`,
      transparent: true,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    function fit() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); uniforms.uRes.value.set(w, h); }
    window.addEventListener('resize', fit, { passive: true }); fit();
    let playing = false, start = 0, dir = 0, dur = 0.9, cb = null;
    FX.onTick((t) => {
      if (!playing) { canvas.style.display = 'none'; return; }
      canvas.style.display = 'block';
      uniforms.uTime.value = t;
      const p = Math.min(1, (t - start) / dur);
      uniforms.uProg.value = dir ? 1 - p : p;
      uniforms.uDir.value = dir;
      if (dir === 0 && p >= 1) { dir = 1; start = t; cb && cb(); }
      else if (dir === 1 && p >= 1) { playing = false; cb = null; }
    });
    FX._transition = (onCovered) => {
      if (REDUCED) { onCovered(); return; }
      cb = onCovered; dir = 0; start = performance.now() * 0.001; playing = true;
    };
    return FX._transition;
  };

  /* ============ 生命周期：跨页面转场销毁/重建 ============ */
  document.addEventListener('DOMContentLoaded', () => { FX.boot && FX.boot(); });

  FX.boot = function () {
    initHero();
    initCaustics();
  };

  FX.teardown = function () {
    FX.images.forEach((im) => { try { im.renderer && im.renderer.forceContextLoss(); } catch (e) {} });
    FX.images = [];
    FX._extraTicks = [];
    document.querySelectorAll('.fx-canvas, [data-hero-gl] canvas, [data-caustics] canvas').forEach((c) => c.remove());
    if (window.HERO) delete window.HERO;
  };

  FX.initHero = initHero;
  FX.initCaustics = initCaustics;
})();
