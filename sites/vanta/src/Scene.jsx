import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Noise, Vignette, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Body, ContactMaterial, Material as PhysicsMaterial, Sphere, Spring, Vec3, World } from 'cannon-es';
import {
  BufferGeometry, Color, Float32BufferAttribute, LinearFilter, MathUtils,
  SRGBColorSpace, TextureLoader, Vector2,
} from 'three';
import {
  photographVertex, photographFragment, hologramVertex, hologramFragment,
  dustVertex, dustFragment,
} from './shaders.js';

const HERO = '/assets/hero.webp';
const clamp = MathUtils.clamp;
const numberValue = value => typeof value === 'number' ? value : value?.current ?? 0;
const pointerValue = value => value?.current ?? value;

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const changed = () => setMatches(media.matches);
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, [query]);
  return matches;
}

function Photograph({ input, progress, intensity, mobile, onReady, onFailure }) {
  const material = useRef();
  const { size, gl, invalidate } = useThree();
  const [texture, setTexture] = useState(null);
  const smoothed = useRef(new Vector2(0.38, 0.1));
  const previous = useRef(new Vector2(0.38, 0.1));
  const uniforms = useMemo(() => ({
    uPhoto: { value: null },
    uResolution: { value: new Vector2(1536, 1024) },
    uPointer: { value: new Vector2(0.38, 0.1) },
    uVelocity: { value: new Vector2() },
    uAspect: { value: 1.5 },
    uImageAspect: { value: 1.5 },
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uMotion: { value: mobile ? 0.35 : 1 },
    uIntensity: { value: 1 },
    uMobile: { value: mobile ? 1 : 0 },
  }), []);

  useEffect(() => {
    let cancelled = false;
    let ownedTexture;
    new TextureLoader().load(HERO, loaded => {
      ownedTexture = loaded;
      if (cancelled) { loaded.dispose(); return; }
      loaded.colorSpace = SRGBColorSpace;
      loaded.generateMipmaps = false;
      loaded.minFilter = LinearFilter;
      loaded.magFilter = LinearFilter;
      loaded.anisotropy = Math.min(2, gl.capabilities.getMaxAnisotropy());
      uniforms.uPhoto.value = loaded;
      uniforms.uImageAspect.value = loaded.image.width / loaded.image.height;
      uniforms.uResolution.value.set(loaded.image.width, loaded.image.height);
      setTexture(loaded);
      invalidate();
      onReady?.();
    }, undefined, () => { if (!cancelled) onFailure?.(); });
    return () => { cancelled = true; ownedTexture?.dispose(); };
  }, [gl, invalidate, onReady, onFailure, uniforms]);

  useEffect(() => {
    uniforms.uAspect.value = size.width / Math.max(size.height, 1);
    uniforms.uMobile.value = mobile ? 1 : 0;
    uniforms.uMotion.value = mobile ? 0.35 : 1;
    invalidate();
  }, [size.width, size.height, mobile, uniforms, invalidate]);

  useFrame(({ clock }, delta) => {
    if (!material.current) return;
    const current = pointerValue(input.current.external) || input.current.local;
    const px = clamp(current?.x ?? 0.38, -1.0, 1.0);
    const py = clamp(current?.y ?? 0.1, -1.0, 1.0);
    const lerp = 1 - Math.exp(-Math.min(delta, 0.05) * 5.4);
    smoothed.current.x = MathUtils.lerp(smoothed.current.x, px, lerp);
    smoothed.current.y = MathUtils.lerp(smoothed.current.y, py, lerp);
    uniforms.uVelocity.value.subVectors(smoothed.current, previous.current);
    previous.current.copy(smoothed.current);
    uniforms.uPointer.value.copy(smoothed.current);
    uniforms.uProgress.value = clamp(numberValue(progress), 0, 1);
    uniforms.uIntensity.value = clamp(numberValue(intensity) / 0.3, 0, 2);
    uniforms.uTime.value = clock.elapsedTime;
  });

  if (!texture) return null;
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={material} vertexShader={photographVertex} fragmentShader={photographFragment}
        uniforms={uniforms} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

function makeGlobe() {
  const vertices = [];
  const segments = 72;
  const vertex = (lat, lon) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  for (let j = -3; j <= 3; j++) {
    const latitude = j * Math.PI / 8;
    for (let i = 0; i < segments; i++) vertices.push(...vertex(latitude, i / segments * Math.PI * 2), ...vertex(latitude, (i + 1) / segments * Math.PI * 2));
  }
  for (let j = 0; j < 10; j++) {
    const longitude = j * Math.PI / 5;
    for (let i = 0; i < segments / 2; i++) vertices.push(...vertex(-Math.PI / 2 + i / (segments / 2) * Math.PI, longitude), ...vertex(-Math.PI / 2 + (i + 1) / (segments / 2) * Math.PI, longitude));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  return geometry;
}

function OrbitalField({ input, progress, mobile }) {
  const group = useRef();
  const globe = useRef();
  const marker = useRef();
  const material = useRef();
  const { viewport } = useThree();
  const geometry = useMemo(makeGlobe, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 1 }, uGain: { value: 1 } }), []);
  const physics = useMemo(() => {
    const world = new World({ gravity: new Vec3(0, 0, 0) });
    const contact = new PhysicsMaterial('probe-surface');
    world.addContactMaterial(new ContactMaterial(contact, contact, { friction: 0.015, restitution: 0.54 }));
    const core = new Body({ mass: 0, shape: new Sphere(1.04), material: contact });
    const probe = new Body({ mass: 0.04, shape: new Sphere(0.03), material: contact, position: new Vec3(1.23, 0.3, 0) });
    probe.linearDamping = 0.56;
    const target = new Body({ mass: 0, collisionResponse: false, position: new Vec3(1.23, 0.3, 0) });
    const spring = new Spring(probe, target, { restLength: 0, stiffness: 1.6, damping: 0.23 });
    world.addBody(core);
    world.addBody(probe);
    world.addBody(target);
    return { world, core, probe, target, spring };
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => physics.world.bodies.slice().forEach(body => physics.world.removeBody(body)), [physics]);

  useFrame(({ clock }, delta) => {
    if (!group.current || !globe.current) return;
    const scroll = clamp(numberValue(progress), 0, 1);
    const current = pointerValue(input.current.external) || input.current.local;
    const scale = viewport.height * (mobile ? 0.085 : 0.116);
    group.current.position.set(viewport.width * (mobile ? 0.34 : 0.408), -viewport.height * 0.245 + scroll * 0.22, 1);
    group.current.scale.setScalar(scale);
    globe.current.rotation.y = clock.elapsedTime * 0.065 + scroll * 0.36;
    globe.current.rotation.z = -0.24;
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, (current?.y ?? 0) * 0.06, 3, delta);
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, (current?.x ?? 0) * 0.12, 3, delta);
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uOpacity.value = 1 - scroll * 0.62;
    if (marker.current) {
      const angle = clock.elapsedTime * 0.18;
      // A small signal probe grazes the field boundary and physically rebounds.
      // Three bodies and one sphere contact replace a costly particle simulation.
      const orbit = 1.16 + Math.sin(angle * 1.7) * 0.18;
      physics.target.position.set(Math.sin(angle) * orbit, Math.cos(angle) * 0.34, Math.cos(angle) * orbit);
      physics.spring.applyForce();
      physics.world.step(1 / 60, Math.min(delta, 0.05), 3);
      marker.current.position.copy(physics.probe.position);
    }
  });

  return (
    <group ref={group}>
      <group ref={globe}>
        <lineSegments geometry={geometry} renderOrder={2}>
          <lineBasicMaterial color="#e6ecce" transparent opacity={mobile ? 0.16 : 0.22} depthTest={false} depthWrite={false} toneMapped={false} />
        </lineSegments>
        <mesh renderOrder={1}>
          <sphereGeometry args={[1.01, 32, 20]} />
          <shaderMaterial ref={material} uniforms={uniforms} vertexShader={hologramVertex} fragmentShader={hologramFragment}
            transparent depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2 + 0.22, 0, 0]} renderOrder={3}>
        <torusGeometry args={[1.19, 0.0025, 3, 96]} />
        <meshBasicMaterial color="#c4f34b" transparent opacity={0.22} depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={marker} renderOrder={4}>
        <sphereGeometry args={[0.025, 8, 6]} />
        <meshBasicMaterial color="#d0fa62" transparent opacity={0.78} depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Dust({ progress, mobile }) {
  const material = useRef();
  const { viewport, gl } = useThree();
  const count = mobile ? 22 : 52;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    // Deterministic placement avoids flashing on remount and SSR differences.
    for (let i = 0; i < count; i++) {
      const seed = (Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
      const n = Math.abs(seed);
      positions[i * 3] = (n - 0.18) * viewport.width;
      positions[i * 3 + 1] = (Math.abs(Math.sin(i * 13.7)) - 0.5) * viewport.height;
      positions[i * 3 + 2] = 0.4 + n * 0.6;
      seeds[i] = n;
    }
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(positions, 3));
    result.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
    return result;
  }, [count, viewport.width, viewport.height]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uProgress: { value: 0 }, uMotion: { value: 1 }, uDpr: { value: 1 },
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!material.current) return;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uProgress.value = clamp(numberValue(progress), 0, 1);
    uniforms.uDpr.value = gl.getPixelRatio();
  });
  return (
    <points geometry={geometry} renderOrder={5} frustumCulled={false}>
      <shaderMaterial ref={material} vertexShader={dustVertex} fragmentShader={dustFragment} uniforms={uniforms}
        transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </points>
  );
}

function FrameBudget({ running, mobile, onDowngrade }) {
  const { invalidate, setDpr, gl } = useThree();
  const sample = useRef({ frames: 0, elapsed: 0, downgraded: false });
  const report = useRef({ frames: 0, elapsed: 0 });
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
  useEffect(() => {
    if (!debug) return;
    gl.info.autoReset = false;
    window.__SEVEN_RENDER_STATS ??= {};
    window.__SEVEN_RENDER_STATS.hero = { ...window.__SEVEN_RENDER_STATS.hero, running };
    return () => { gl.info.autoReset = true; if (window.__SEVEN_RENDER_STATS) delete window.__SEVEN_RENDER_STATS.hero; };
  }, [debug, running]);
  useEffect(() => {
    if (!running) return;
    let raf;
    let last = 0;
    const interval = 1000 / (mobile ? 30 : 60);
    const next = time => {
      if (time - last >= interval - 0.5) {
        last = time - ((time - last) % interval);
        invalidate();
      }
      raf = requestAnimationFrame(next);
    };
    raf = requestAnimationFrame(next);
    return () => cancelAnimationFrame(raf);
  }, [running, mobile, invalidate]);
  useFrame((_, delta) => {
    if (debug && delta < 0.2) {
      report.current.frames++;
      report.current.elapsed += delta;
      if (report.current.frames >= 30) {
        window.__SEVEN_RENDER_STATS ??= {};
        window.__SEVEN_RENDER_STATS.hero = {
          running, fps: Math.round(report.current.frames / report.current.elapsed), dpr: gl.getPixelRatio(),
          calls: gl.info.render.calls, triangles: gl.info.render.triangles, points: gl.info.render.points,
          textures: gl.info.memory.textures, geometries: gl.info.memory.geometries, programs: gl.info.programs?.length ?? 0,
        };
        report.current.frames = 0;
        report.current.elapsed = 0;
      }
    }
    if (debug) gl.info.reset();
    if (!running || mobile || sample.current.downgraded || delta > 0.2) return;
    if (!sample.current.armed) {
      // Skip the shader-compile / texture-upload / intro-animation startup window
      // so a transient dip cannot permanently downgrade the whole scene.
      sample.current.elapsed += delta;
      if (sample.current.elapsed < 1.6) return;
      sample.current.armed = true;
      sample.current.elapsed = 0;
      sample.current.frames = 0;
    }
    sample.current.frames++;
    sample.current.elapsed += delta;
    if (sample.current.frames === 90) {
      if (sample.current.elapsed / sample.current.frames > 1 / 38) {
        setDpr(1);
        onDowngrade?.();
        sample.current.downgraded = true;
      }
      sample.current.frames = 0;
      sample.current.elapsed = 0;
    }
  });
  return null;
}

export function HoloGlobe({ className }) {
  const wrap = useRef();
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const [failed, setFailed] = useState(false);
  const mobile = useMedia('(max-width: 767px), (pointer: coarse)');
  useEffect(() => {
    const target = wrap.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { rootMargin: '80px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (inView) setSeen(true); }, [inView]);
  return (
    <div ref={wrap} className={className ? `holo-globe ${className}` : 'holo-globe'} aria-hidden="true">
      {seen && !failed && (
        <Canvas frameloop={inView ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, 0, 4.3], fov: 38, near: 0.1, far: 20 }}
          gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
          style={{ visibility: inView ? 'visible' : 'hidden' }}
          onCreated={({ gl }) => { gl.setClearColor(new Color('#121713'), 0); gl.domElement.addEventListener('webglcontextlost', () => setFailed(true), { once: true }); }}>
          <GlobeRig mobile={mobile} />
        </Canvas>
      )}
    </div>
  );
}

function GlobeRig({ mobile }) {
  const group = useRef();
  const inner = useRef();
  const pointerTarget = useRef(0);
  const geometry = useMemo(makeGlobe, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 1 }, uGain: { value: 3.4 } }), []);
  const dots = useMemo(() => {
    const count = mobile ? 130 : 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y * 0.985;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
    }
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return result;
  }, [mobile]);
  const rings = useMemo(() => ([{ r: 1.24, tilt: 0.42, off: 0, lime: false }, { r: 1.36, tilt: 1.12, off: 1.2, lime: true }, { r: 1.47, tilt: 1.85, off: 2.4, lime: false }]), []);
  useEffect(() => () => { geometry.dispose(); dots.dispose(); }, [geometry, dots]);
  useEffect(() => {
    const moved = event => { pointerTarget.current = (event.clientY / innerHeight - 0.5) * -0.3; };
    addEventListener('pointermove', moved, { passive: true });
    return () => removeEventListener('pointermove', moved);
  }, []);
  useFrame(({ clock }, delta) => {
    if (!group.current || !inner.current) return;
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;
    group.current.rotation.y = t * 0.11;
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, pointerTarget.current, 2.5, delta);
    inner.current.rotation.y = -t * 0.045;
  });
  return (
    <group ref={group}>
      <group ref={inner}>
        <lineSegments geometry={geometry}>
          <lineBasicMaterial color="#c2d4a4" transparent opacity={mobile ? 0.45 : 0.62} depthWrite={false} toneMapped={false} />
        </lineSegments>
        <points geometry={dots}>
          <pointsMaterial color="#c7ff00" size={0.034} sizeAttenuation transparent opacity={0.85} depthWrite={false} toneMapped={false} />
        </points>
        <mesh>
          <sphereGeometry args={[0.99, 48, 32]} />
          <shaderMaterial uniforms={uniforms} vertexShader={hologramVertex} fragmentShader={hologramFragment} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {rings.map((ring, i) => (
        <mesh key={i} rotation={[Math.PI / 2 - ring.tilt, ring.off, 0]}>
          <torusGeometry args={[ring.r, ring.lime ? 0.005 : 0.0035, 3, 128]} />
          <meshBasicMaterial color={ring.lime ? '#c7ff00' : '#71825f'} transparent opacity={ring.lime ? 0.8 : 0.42} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Decorative hero renderer. progress: 0..1 number or {current:number}.
 * pointer: {x,y} in -1..1 (positive y up), or a ref to that object.
 * An omitted pointer uses the hero's bounding rectangle automatically.
 * onReady receives true after texture upload; false selects the image fallback.
 */
export default function Scene({ progress = 0, pointer, intensity = 0.3, reducedMotion, onReady, active = true }) {
  const root = useRef();
  const input = useRef({ external: pointer, local: { x: 0.38, y: 0.1 } });
  input.current.external = pointer;
  const mobile = useMedia('(max-width: 767px), (pointer: coarse)');
  const preferredReducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const reduce = reducedMotion ?? preferredReducedMotion;
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lowTier, setLowTier] = useState(false);
  const caOffset = useMemo(() => new Vector2(0.00042, 0.00065), []);
  const callback = useRef(onReady);
  callback.current = onReady;
  const reportReady = useCallback(() => { setReady(true); callback.current?.(true); }, []);
  const reportFailure = useCallback(() => { setFailed(true); setReady(false); callback.current?.(false); }, []);
  const running = active && inView && pageVisible && !reduce && !failed;

  useEffect(() => {
    const target = root.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { rootMargin: '60px' });
    observer.observe(target);
    const visibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    if (reduce || mobile) return;
    let bounds = root.current?.getBoundingClientRect();
    const resize = () => { bounds = root.current?.getBoundingClientRect(); };
    const moved = event => {
      if (!bounds || !inView) return;
      input.current.local.x = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      input.current.local.y = clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1);
    };
    window.addEventListener('pointermove', moved, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', resize, { passive: true });
    return () => {
      window.removeEventListener('pointermove', moved);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', resize);
    };
  }, [inView, reduce, mobile]);

  useEffect(() => {
    if (reduce) callback.current?.(false);
  }, [reduce]);

  return (
    <div ref={root} className="seven-webgl-scene" aria-hidden="true" data-render-state={failed ? 'fallback' : reduce ? 'static' : ready ? 'ready' : 'loading'}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', background: `#080a09 url(${HERO}) ${mobile ? '69%' : 'center'} 44% / cover no-repeat` }}>
      {!reduce && !failed && (
        <SceneBoundary onFailure={reportFailure}>
          <Canvas frameloop="demand" dpr={mobile ? 1 : [1, 1.5]} camera={{ position: [0, 0, 5], fov: 40, near: 0.1, far: 20 }}
            gl={{ antialias: false, alpha: true, stencil: false, depth: true, powerPreference: 'high-performance' }}
            flat resize={{ scroll: false, debounce: { resize: 80, scroll: 80 } }}
            style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.2s ease', pointerEvents: 'none' }}
            onCreated={({ gl }) => {
              gl.setClearColor(new Color('#080a09'), 0);
              gl.domElement.setAttribute('aria-hidden', 'true');
              gl.domElement.addEventListener('webglcontextlost', reportFailure, { once: true });
            }}>
            <FrameBudget running={running} mobile={mobile} onDowngrade={() => setLowTier(true)} />
            <Photograph input={input} progress={progress} intensity={intensity} mobile={mobile} onReady={reportReady} onFailure={reportFailure} />
            <OrbitalField input={input} progress={progress} mobile={mobile} />
            <Dust progress={progress} mobile={mobile} />
            {!mobile && <EffectComposer multisampling={0} enableNormalPass={false}>
              {!lowTier && <Bloom intensity={0.4} luminanceThreshold={0.72} luminanceSmoothing={0.3} mipmapBlur radius={0.66} />}
              <Noise opacity={0.032} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
              <Vignette offset={0.62} darkness={0.34} eskil={false} />
              {!lowTier && <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />}
            </EffectComposer>}
          </Canvas>
        </SceneBoundary>
      )}
    </div>
  );
}
