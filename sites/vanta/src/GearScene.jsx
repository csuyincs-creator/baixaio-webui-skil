import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  BoxGeometry, CubicBezierCurve3, DataTexture, DoubleSide, EdgesGeometry, ExtrudeGeometry,
  LinearFilter, MathUtils, MeshPhysicalMaterial, MeshStandardMaterial, Object3D,
  RepeatWrapping, RGBAFormat, Shape, TubeGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const val = value => typeof value === 'number' ? value : value?.current ?? 0;
const clamp = MathUtils.clamp;

class GearBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function shellShape() {
  const shape = new Shape();
  shape.moveTo(-0.54, -0.9);
  shape.bezierCurveTo(-0.76, -0.86, -0.78, -0.54, -0.68, -0.06);
  shape.lineTo(-0.38, 1.00);
  shape.quadraticCurveTo(-0.29, 1.24, -0.14, 1.02);
  shape.lineTo(0.71, -0.46);
  shape.quadraticCurveTo(0.90, -0.78, 0.66, -0.90);
  shape.quadraticCurveTo(0.03, -1.02, -0.54, -0.90);
  return shape;
}

function pocketShape() {
  const shape = new Shape();
  shape.moveTo(-0.50, -0.77);
  shape.quadraticCurveTo(-0.63, -0.72, -0.59, -0.41);
  shape.lineTo(-0.51, 0.21);
  shape.quadraticCurveTo(-0.50, 0.34, -0.38, 0.27);
  shape.lineTo(0.56, -0.19);
  shape.quadraticCurveTo(0.69, -0.26, 0.69, -0.55);
  shape.quadraticCurveTo(0.70, -0.76, 0.49, -0.79);
  shape.quadraticCurveTo(0.02, -0.89, -0.50, -0.77);
  return shape;
}

function bevel(shape, depth, amount = 0.06) {
  const geometry = new ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelThickness: amount,
    bevelSize: amount, bevelSegments: 4, curveSegments: 16,
  });
  geometry.computeVertexNormals();
  return geometry;
}

function roundedBox(width, height, depth, radius = 0.018) {
  const s = new Shape();
  const x = -width / 2, y = -height / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y); s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius); s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height); s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius); s.quadraticCurveTo(x, y, x + radius, y);
  return bevel(s, depth, radius * 0.34);
}

function merged(geometries) {
  const result = mergeGeometries(geometries.map(g => g.index ? g.toNonIndexed() : g), false);
  geometries.forEach(g => g.dispose());
  return result;
}

function weaveTextures() {
  const side = 128;
  const normals = new Uint8Array(side * side * 4);
  const heights = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const i = (y * side + x) * 4;
    const phase = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) * Math.PI;
    const nx = Math.sin(x / 4 * Math.PI * 2 + phase) * 0.26;
    const ny = Math.sin(y / 4 * Math.PI * 2 - phase) * 0.26;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    normals[i] = Math.round((nx * 0.5 + 0.5) * 255);
    normals[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    normals[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    normals[i + 3] = 255;
    const height = Math.round(128 + Math.cos(x / 2 * Math.PI + phase) * Math.cos(y / 2 * Math.PI) * 26);
    heights[i] = heights[i + 1] = heights[i + 2] = height;
    heights[i + 3] = 255;
  }
  const make = data => {
    const texture = new DataTexture(data, side, side, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.repeat.set(3.6, 3.6);
    texture.needsUpdate = true;
    return texture;
  };
  return { normal: make(normals), height: make(heights) };
}

function useBagResources() {
  const resources = useMemo(() => {
    const fabric = weaveTextures();
    const body = bevel(shellShape(), 0.24, 0.095);
    body.translate(0, 0, -0.21);
    const liner = bevel(shellShape(), 0.016, 0.013);
    liner.scale(0.935, 0.935, 1);
    const front = bevel(pocketShape(), 0.053, 0.065);
    const strapCurve = new CubicBezierCurve3(
      new Vector3(-0.25, 0.96, -0.11), new Vector3(-1.55, 2.25, -0.47),
      new Vector3(-1.47, -1.42, -0.55), new Vector3(-0.60, -0.80, -0.10),
    );
    const strapShape = new Shape();
    strapShape.moveTo(-0.122, -0.012); strapShape.lineTo(0.122, -0.012);
    strapShape.lineTo(0.122, 0.012); strapShape.lineTo(-0.122, 0.012); strapShape.closePath();
    const strap = new ExtrudeGeometry(strapShape, { steps: 56, bevelEnabled: false, extrudePath: strapCurve });
    strap.computeVertexNormals();
    const upperZip = new CubicBezierCurve3(
      new Vector3(-0.44, 0.32, 0.27), new Vector3(-0.04, 0.20, 0.28),
      new Vector3(0.48, -0.02, 0.24), new Vector3(0.64, -0.23, 0.22),
    );
    const sideZip = new CubicBezierCurve3(
      new Vector3(-0.60, -0.69, 0.08), new Vector3(-0.71, -0.40, 0.10),
      new Vector3(-0.52, 0.24, 0.12), new Vector3(-0.37, 0.61, 0.08),
    );
    const seamCurve = new CubicBezierCurve3(
      new Vector3(-0.47, -0.61, 0.21), new Vector3(-0.20, -0.76, 0.22),
      new Vector3(0.19, -0.78, 0.21), new Vector3(0.49, -0.62, 0.20),
    );
    const zipTrim = merged([new TubeGeometry(upperZip, 40, 0.014, 5, false), new TubeGeometry(sideZip, 44, 0.014, 5, false)]);
    const piping = new TubeGeometry(seamCurve, 32, 0.012, 5, false);

    const buckleParts = [];
    [[0, 0.09, 0.33, 0.045], [0, -0.09, 0.33, 0.045], [-0.135, 0, 0.045, 0.16], [0.135, 0, 0.045, 0.16], [0, 0, 0.23, 0.046]].forEach(([x, y, w, h]) => {
      const g = roundedBox(w, h, 0.022, 0.007);
      g.translate(x - 0.27, y + 0.76, 0.18);
      buckleParts.push(g);
    });
    const buckle = merged(buckleParts);
    const runners = merged([
      roundedBox(0.045, 0.16, 0.027, 0.008).rotateZ(-0.16).translate(-0.32, 0.11, 0.30),
      roundedBox(0.04, 0.17, 0.025, 0.008).rotateZ(-0.03).translate(-0.46, 0.34, 0.15),
    ]);
    const tab = roundedBox(0.056, 0.14, 0.012, 0.005);
    const patch = roundedBox(0.21, 0.085, 0.008, 0.009);
    const wire = new EdgesGeometry(body, 24);

    const textile = new MeshPhysicalMaterial({
      color: '#363d37', roughness: 0.86, metalness: 0.03, clearcoat: 0.08, clearcoatRoughness: 0.85,
      normalMap: fabric.normal, normalScale: new Vector2(0.48, 0.48),
      displacementMap: fabric.height, displacementScale: 0.004, displacementBias: -0.002,
    });
    const frontTextile = textile.clone(); frontTextile.color.set('#252e28'); frontTextile.roughness = 0.79;
    const webbing = new MeshStandardMaterial({ color: '#272f29', roughness: 0.95, normalMap: fabric.normal, normalScale: new Vector2(0.6, 0.6), side: DoubleSide });
    const lining = new MeshStandardMaterial({ color: '#242b27', roughness: 0.77, normalMap: fabric.normal, normalScale: new Vector2(0.15, 0.15) });
    const hardware = new MeshPhysicalMaterial({ color: '#68726a', roughness: 0.28, metalness: 0.78, clearcoat: 0.25 });
    const blackTrim = new MeshStandardMaterial({ color: '#070b09', roughness: 0.7, metalness: 0.1 });
    const lime = new MeshStandardMaterial({ color: '#c9f13f', roughness: 0.89, normalMap: fabric.normal, normalScale: new Vector2(0.22, 0.22) });
    const geometries = { body, liner, front, strap, zipTrim, piping, buckle, runners, tab, patch, wire };
    const materials = { textile, frontTextile, webbing, lining, hardware, blackTrim, lime };
    return { fabric, geometries, materials, upperZip, sideZip };
  }, []);
  useEffect(() => () => {
    Object.values(resources.geometries).forEach(g => g.dispose());
    Object.values(resources.materials).forEach(m => m.dispose());
    resources.fabric.normal.dispose(); resources.fabric.height.dispose();
  }, [resources]);
  return resources;
}

function ZipperTeeth({ curve, metal }) {
  const mesh = useRef();
  const count = 64;
  useEffect(() => {
    const dummy = new Object3D();
    const along = new Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      dummy.position.copy(curve.getPoint(t));
      dummy.position.z += 0.012;
      dummy.quaternion.setFromUnitVectors(along, curve.getTangent(t).normalize());
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [curve]);
  return <instancedMesh ref={mesh} args={[null, metal, count]} frustumCulled={false}><boxGeometry args={[0.022, 0.009, 0.007]} /></instancedMesh>;
}

function Bag({ explode, angle, input, mobile, onReady }) {
  const model = useRef(), frontLayer = useRef(), linerLayer = useRef(), strapLayer = useRef(), wire = useRef();
  const { camera, invalidate } = useThree();
  const bag = useBagResources();
  const { geometries: g, materials: m } = bag;
  const transition = useRef(0);
  useEffect(() => { onReady?.(); invalidate(); }, [onReady, invalidate]);
  useFrame(({ clock }, delta) => {
    if (!model.current) return;
    const target = clamp(val(explode), 0, 1);
    transition.current = MathUtils.damp(transition.current, target, 4.5, Math.min(delta, 0.05));
    const e = transition.current;
    const p = input.current.external?.current ?? input.current.external ?? input.current.local;
    const x = clamp(p?.x ?? 0, -1, 1), y = clamp(p?.y ?? 0, -1, 1);
    model.current.rotation.y = MathUtils.damp(model.current.rotation.y, -0.24 + x * 0.34 + e * 0.35 + val(angle), 3.5, delta);
    model.current.rotation.x = MathUtils.damp(model.current.rotation.x, 0.08 - y * 0.14, 3.5, delta);
    model.current.rotation.z = MathUtils.damp(model.current.rotation.z, -0.055 + Math.sin(clock.elapsedTime * 0.24) * 0.012, 3, delta);
    model.current.position.y = -0.06 + Math.sin(clock.elapsedTime * 0.55) * 0.015;
    frontLayer.current.position.z = 0.16 + e * 0.68;
    frontLayer.current.position.x = e * 0.12;
    linerLayer.current.position.z = 0.065 + e * 0.29;
    strapLayer.current.position.x = e * -0.27;
    strapLayer.current.position.z = e * -0.17;
    wire.current.material.opacity = e * 0.09;
    camera.position.z = MathUtils.damp(camera.position.z, (mobile ? 5.75 : 5.3) + e * 0.5, 3, delta);
    camera.position.x = MathUtils.damp(camera.position.x, -0.10 + e * 0.13, 3, delta);
    camera.lookAt(-0.30, 0.13, 0.05);
  });
  return (
    <group ref={model} position={[0.24, -0.07, 0]} dispose={null}>
      <mesh geometry={g.body} material={m.textile} />
      <group ref={linerLayer} position={[0, 0, 0.065]}><mesh geometry={g.liner} material={m.lining} /></group>
      <group ref={frontLayer} position={[0, 0, 0.16]}>
        <mesh geometry={g.front} material={m.frontTextile} />
        <mesh geometry={g.zipTrim} material={m.blackTrim} />
        <mesh geometry={g.piping} material={m.blackTrim} />
        <mesh geometry={g.runners} material={m.hardware} />
        <ZipperTeeth curve={bag.upperZip} metal={m.hardware} />
        <mesh geometry={g.tab} material={m.lime} position={[-0.50, -0.30, 0.12]} rotation={[0, 0, 0.15]} />
        <mesh geometry={g.patch} material={m.blackTrim} position={[-0.11, -0.65, 0.12]} rotation={[0, 0, -0.13]} />
      </group>
      <group ref={strapLayer}>
        <mesh geometry={g.strap} material={m.webbing} />
        <mesh geometry={g.buckle} material={m.hardware} />
      </group>
      <lineSegments ref={wire} geometry={g.wire}><lineBasicMaterial color="#c9f13f" transparent opacity={0} depthWrite={false} /></lineSegments>
    </group>
  );
}

function InspectionLoop({ running, mobile }) {
  const { invalidate, gl, setDpr } = useThree();
  const sampling = useRef({ frames: 0, seconds: 0, slow: false });
  const debug = new URLSearchParams(window.location.search).has('debug');
  useEffect(() => {
    if (!debug) return;
    gl.info.autoReset = false;
    window.__SEVEN_RENDER_STATS ??= {};
    window.__SEVEN_RENDER_STATS.gear = { ...window.__SEVEN_RENDER_STATS.gear, running };
    return () => { gl.info.autoReset = true; if (window.__SEVEN_RENDER_STATS) delete window.__SEVEN_RENDER_STATS.gear; };
  }, [debug, running, gl]);
  useEffect(() => {
    if (!running) { invalidate(); return; }
    let raf, last = 0;
    const interval = 1000 / (mobile ? 30 : 60);
    const frame = time => {
      if (time - last >= interval - 0.5) {
        last = time - ((time - last) % interval);
        invalidate();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, mobile, invalidate]);
  useFrame((_, delta) => {
    if (delta < 0.2) {
      sampling.current.frames++;
      sampling.current.seconds += delta;
      if (sampling.current.frames >= 60) {
        const fps = sampling.current.frames / sampling.current.seconds;
        if (!mobile && fps < 38 && !sampling.current.slow) { setDpr(1); sampling.current.slow = true; }
        if (debug) {
          window.__SEVEN_RENDER_STATS ??= {};
          window.__SEVEN_RENDER_STATS.gear = {
            running, fps: Math.round(fps), dpr: gl.getPixelRatio(), calls: gl.info.render.calls,
            triangles: gl.info.render.triangles, textures: gl.info.memory.textures,
            geometries: gl.info.memory.geometries, programs: gl.info.programs?.length ?? 0,
          };
        }
        sampling.current.frames = 0; sampling.current.seconds = 0;
      }
    }
    if (debug) gl.info.reset();
  }, -100);
  return null;
}

/** Lazy 3D inspection view; the parent supplies accessible explode controls.
 * explode: 0..1 number/ref. pointer: optional -1..1 object/ref.
 * A dedicated procedural 128px normal/height map and 128px studio capture are
 * owned by this canvas. No external model, texture or HDR request is required.
 */
export default function GearScene({ explode = 0, angle = 0, pointer, reducedMotion = false, active = true, onReady }) {
  const host = useRef();
  const input = useRef({ external: pointer, local: { x: 0.2, y: 0.05 } });
  input.current.external = pointer;
  const callback = useRef(onReady); callback.current = onReady;
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px), (pointer: coarse)').matches);
  const [near, setNear] = useState(false), [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [pageVisible, setPageVisible] = useState(document.visibilityState !== 'hidden');
  const loaded = useCallback(() => { setReady(true); callback.current?.(true); }, []);
  const failure = useCallback(() => { setFailed(true); setReady(false); callback.current?.(false); }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (entry.isIntersecting) setNear(true); }, { rootMargin: '120px' });
    observer.observe(host.current);
    const view = () => setPageVisible(document.visibilityState !== 'hidden');
    const media = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const resize = () => setMobile(media.matches);
    media.addEventListener('change', resize); document.addEventListener('visibilitychange', view);
    return () => { observer.disconnect(); media.removeEventListener('change', resize); document.removeEventListener('visibilitychange', view); };
  }, []);
  useEffect(() => { if (reducedMotion) callback.current?.(false); }, [reducedMotion]);
  const running = near && visible && active && pageVisible && !reducedMotion && !failed;
  const move = event => {
    if (mobile || reducedMotion) return;
    const r = host.current.getBoundingClientRect();
    input.current.local.x = (event.clientX - r.left) / r.width * 2 - 1;
    input.current.local.y = 1 - (event.clientY - r.top) / r.height * 2;
  };
  return (
    <div ref={host} className="seven-gear-scene" aria-hidden="true" data-render-state={failed ? 'fallback' : reducedMotion ? 'static' : ready ? 'ready' : 'loading'} onPointerMove={move}
      onPointerLeave={() => { input.current.local = { x: 0.2, y: 0.05 }; }}
      style={{ position: 'absolute', inset: 0, background: ready && !failed && !reducedMotion ? 'radial-gradient(ellipse at 55% 35%, #202623 0%, #0c100d 65%, #080a09 100%)' : '#101210 url(/assets/accessories.webp) center 58% / cover no-repeat' }}>
      {near && !reducedMotion && !failed && <GearBoundary onFailure={failure}>
        <Canvas frameloop="demand" dpr={mobile ? 1 : [1, 1.5]} camera={{ position: [-0.10, 0.12, mobile ? 5.75 : 5.3], fov: 35, near: 0.1, far: 30 }}
          gl={{ alpha: true, antialias: true, stencil: false, powerPreference: 'high-performance' }}
          resize={{ scroll: false, debounce: { resize: 80, scroll: 80 } }}
          style={{ opacity: ready ? 1 : 0, transition: 'opacity .9s ease' }}
          onCreated={({ gl }) => { gl.setClearColor('#000000', 0); gl.domElement.setAttribute('aria-hidden', 'true'); gl.domElement.addEventListener('webglcontextlost', failure, { once: true }); }}>
          <InspectionLoop running={running} mobile={mobile} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[-3, 4, 4]} intensity={4.8} color="#f0f1df" />
          <directionalLight position={[4, 1, -2]} intensity={3.1} color="#b9c4b3" />
          <Environment frames={1} resolution={128} environmentIntensity={0.8}>
            <Lightformer intensity={3} color="#fbfce8" position={[-3, 3, 4]} scale={[3, 4]} target={[0, 0, 0]} />
            <Lightformer intensity={2} color="#dce6d6" position={[4, 0, 0]} scale={[1, 5]} target={[0, 0, 0]} />
            <Lightformer intensity={1.2} color="#b7c48c" position={[0, 2, -4]} scale={[4, 2]} target={[0, 0, 0]} />
          </Environment>
          <Bag explode={explode} angle={angle} input={input} mobile={mobile} onReady={loaded} />
        </Canvas>
      </GearBoundary>}
    </div>
  );
}
