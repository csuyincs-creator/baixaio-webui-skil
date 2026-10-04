import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { LinearFilter, SRGBColorSpace, TextureLoader } from 'three';

class DissolveBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const dissolveVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99, 1.0);
  }
`;

const dissolveFragment = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform float uDissolve;
  uniform float uTime;
  uniform float uAspect;
  uniform float uImageAspect;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 ratio = vec2(min(uAspect / uImageAspect, 1.0), min(uImageAspect / uAspect, 1.0));
    vec2 uv = (vUv - 0.5) * ratio + 0.5;
    float warp = fbm(uv * 4.0 + uTime * 0.05);
    float n = fbm(uv * 3.1 + warp * 0.35 + vec2(uTime * 0.02, -uTime * 0.015));
    float d = clamp(uDissolve * 1.2 - 0.1, 0.0, 1.0);
    if (n < d) discard;
    vec3 color = texture2D(uPhoto, uv).rgb;
    float band = smoothstep(d - 0.09, d, n) * (1.0 - smoothstep(d, d + 0.02, n));
    color = mix(color, vec3(0.78, 1.0, 0.0), band * 0.85);
    float grain = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 14.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color += grain * 0.02;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function DissolvePlane({ url, instant, onDone }) {
  const uniforms = useMemo(() => ({
    uPhoto: { value: null }, uDissolve: { value: 0 }, uTime: { value: 0 },
    uAspect: { value: 1 }, uImageAspect: { value: 1 },
  }), []);
  const { size } = useThree();
  const [texture, setTexture] = useState(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let cancelled = false, owned = null;
    new TextureLoader().load(url, loaded => {
      if (cancelled) { loaded.dispose(); return; }
      owned = loaded;
      loaded.colorSpace = SRGBColorSpace;
      loaded.generateMipmaps = false;
      loaded.minFilter = LinearFilter;
      loaded.magFilter = LinearFilter;
      uniforms.uPhoto.value = loaded;
      uniforms.uImageAspect.value = loaded.image.width / Math.max(loaded.image.height, 1);
      setTexture(loaded);
    }, undefined, () => { if (!cancelled) done.current?.(); });
    return () => { cancelled = true; owned?.dispose(); };
  }, [url, uniforms]);
  useEffect(() => {
    uniforms.uAspect.value = size.width / Math.max(size.height, 1);
  }, [size.width, size.height, uniforms]);
  useEffect(() => {
    if (!texture) return;
    const tween = gsap.to(uniforms.uDissolve, { value: 1, duration: instant ? 0.01 : 1.15, delay: instant ? 0 : 0.12, ease: 'power2.inOut', onComplete: () => done.current?.() });
    return () => { tween.kill(); };
  }, [texture, uniforms, instant]);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });
  if (!texture) return null;
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={dissolveVertex} fragmentShader={dissolveFragment} uniforms={uniforms} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export default function DissolveReveal({ url, instant, onDone }) {
  return (
    <div className="inspection-dissolve" aria-hidden="true">
      <Canvas frameloop="always" dpr={[1, 1.5]} camera={{ position: [0, 0, 1], fov: 45, near: 0.1, far: 5 }}
        gl={{ antialias: false, alpha: false, stencil: false, depth: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor(0x0c100d, 1)}>
        <DissolveBoundary><DissolvePlane url={url} instant={instant} onDone={onDone} /></DissolveBoundary>
      </Canvas>
    </div>
  );
}
