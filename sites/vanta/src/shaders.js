import { Common, Simplex } from 'gl-noise/build/glNoise.m.js';

// All photograph treatment runs in one inexpensive pass. The original apparel
// remains the visual focus; displacement is deliberately local and sub-pixel.
export const photographVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99, 1.0);
  }
`;

export const photographFragment = /* glsl */ `
  ${Common}
  ${Simplex}
  uniform sampler2D uPhoto;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uVelocity;
  uniform float uAspect;
  uniform float uImageAspect;
  uniform float uTime;
  uniform float uProgress;
  uniform float uMotion;
  uniform float uIntensity;
  uniform float uMobile;
  varying vec2 vUv;

  vec2 coverUv(vec2 uv) {
    vec2 ratio = vec2(min(uAspect / uImageAspect, 1.0), min(uImageAspect / uAspect, 1.0));
    // Preserve the model at x=0.72 on narrow screens, as in the static fallback.
    vec2 anchor = vec2(mix(0.5, 0.69, uMobile), 0.56);
    return (uv - 0.5) * ratio + anchor;
  }

  float line(float p, float thickness) {
    return 1.0 - smoothstep(thickness, thickness * 2.5, abs(p));
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uAspect, 1.0);
    vec2 cursor = uPointer * 0.5 + 0.5;
    vec2 delta = (uv - cursor) * aspect;
    float radius = length(delta);
    float lens = exp(-radius * radius * 22.0) * uMotion * uIntensity;
    float energy = min(length(uVelocity) * 3.0, 1.0);

    float flow = gln_simplex(uv * vec2(4.4, 3.0) + vec2(uTime * 0.075, -uTime * 0.045));
    float flow2 = gln_simplex(uv * vec2(7.2, 5.0) + vec2(-uTime * 0.028, 4.9));
    vec2 displacement = vec2(flow, flow2) * lens * (0.0011 + energy * 0.007);
    // Scroll and the DOM text scatter share one clock: as the headline
    // disintegrates, the fluid field amplifies with the same progress.
    displacement *= 1.0 + uProgress * 2.6;
    displacement += uVelocity * lens * 0.007;
    // A quiet heat shimmer follows the far light source, never the typography.
    float farLight = smoothstep(0.62, 1.0, uv.x) * smoothstep(0.12, 0.95, uv.y);
    displacement.y += flow * farLight * 0.00075 * uMotion * uIntensity;
    uv += displacement;
    uv = (uv - 0.5) / (1.015 + uProgress * 0.042) + 0.5;
    uv += vec2(uPointer.x * 0.0035, uPointer.y * 0.0022 + uProgress * 0.015) * uMotion;
    vec2 photoUv = coverUv(uv);

    vec3 color = texture2D(uPhoto, photoUv).rgb;
    // Restrained glass dispersion is visible only while the cursor is moving.
    float dispersion = lens * energy * 0.0007 * (1.0 + uProgress * 2.0);
    color.r = texture2D(uPhoto, photoUv + vec2(dispersion, 0.0)).r;
    color.b = texture2D(uPhoto, photoUv - vec2(dispersion, 0.0)).b;
    color *= vec3(0.99, 1.015, 0.99);

    // Analytical single-scattering shafts, with two low-frequency noise layers.
    // No raymarch, shadow buffer or HDR environment is needed for the image.
    float shaftCoordinate = uv.x + uv.y * 0.23;
    float shaft = exp(-pow((shaftCoordinate - 1.065) * 10.0, 2.0));
    shaft += exp(-pow((shaftCoordinate - 0.945) * 25.0, 2.0)) * 0.42;
    shaft *= smoothstep(0.03, 1.0, uv.y) * (0.8 + flow * 0.2);
    color += vec3(0.76, 0.81, 0.70) * shaft * 0.011;

    // Edge-based local illumination exposes stitching without repainting it.
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    float neighbor = dot(texture2D(uPhoto, photoUv + texel * 1.4).rgb, vec3(0.333));
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float edge = clamp(abs(luminance - neighbor) * 4.0, 0.0, 0.15);
    color += vec3(0.55, 0.79, 0.14) * edge * lens * (0.08 + energy * 0.08);
    color += vec3(0.75, 0.83, 0.61) * lens * 0.005;

    // Fine print language in the shadows, rather than a full-screen CRT filter.
    float darkArea = 1.0 - smoothstep(0.035, 0.17, luminance);
    vec2 dots = fract(gl_FragCoord.xy / 4.0) - 0.5;
    float halftone = 1.0 - smoothstep(0.16, 0.25, length(dots));
    color += vec3(0.009) * halftone * darkArea * 0.18;
    float scan = line(uv.y - fract(uTime * 0.026 + 0.41), 0.00065);
    color += vec3(0.49, 0.62, 0.16) * scan * lens * 0.018;

    // The image gently folds into the next section as the camera withdraws.
    float bottomFade = smoothstep(0.0, 0.24 + uProgress * 0.17, vUv.y);
    float leftShade = mix(0.42, 1.0, smoothstep(0.0, 0.72, vUv.x));
    color *= mix(1.0, leftShade, 0.6 - uMobile * 0.22);
    color *= mix(0.2, 1.0, bottomFade);
    float edgeVignette = 1.0 - dot((vUv - 0.52) * vec2(0.8, 0.5), (vUv - 0.52) * vec2(0.8, 0.5));
    color *= clamp(edgeVignette, 0.78, 1.0);

    // Mobile uses integrated grain and avoids allocating a composer framebuffer.
    float grain = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 12.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color += grain * 0.0015 * uMobile;
    gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const hologramVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPosition;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-view.xyz);
    vPosition = position;
    gl_Position = projectionMatrix * view;
  }
`;

export const hologramFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uGain;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPosition;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.4);
    float scan = pow(0.5 + 0.5 * sin(vPosition.y * 95.0 - uTime * 1.15), 12.0);
    vec3 color = mix(vec3(0.52, 0.59, 0.40), vec3(0.69, 0.84, 0.26), fresnel);
    float alpha = (fresnel * 0.12 + scan * 0.012) * uOpacity * uGain;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uMotion;
  uniform float uDpr;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.12 + aSeed * 9.0) * 0.08 * uMotion;
    p.y += sin(uTime * 0.09 + aSeed * 16.0) * 0.10 * uMotion;
    p.y += uProgress * (0.1 + aSeed * 0.12);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAlpha = 0.09 + aSeed * 0.15;
    gl_PointSize = (0.8 + aSeed * 1.3) * uDpr;
    gl_Position = projectionMatrix * mv;
  }
`;

export const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = (1.0 - smoothstep(0.12, 0.5, d)) * vAlpha;
    gl_FragColor = vec4(vec3(0.74, 0.78, 0.61), alpha);
    #include <colorspace_fragment>
  }
`;
