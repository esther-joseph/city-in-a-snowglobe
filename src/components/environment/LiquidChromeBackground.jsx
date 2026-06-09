import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vScreen;
void main() {
  vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vScreen = (pos.xy / pos.w) * 0.5 + 0.5;
  gl_Position = pos.xyww;
}
`

const fragmentShader = `
uniform float time;
uniform vec3 colorSky;
uniform vec3 colorAura;
uniform vec3 colorGround;
uniform float nightFactor;
varying vec2 vScreen;

// Soft radial aura blob
float aura(vec2 uv, vec2 center, float radius) {
  float d = length(uv - center);
  return exp(-d * d / (radius * radius));
}

void main() {
  float t  = time * 0.25;
  vec2  uv = vScreen;

  // Daytime pastel blue palette
  vec3 blue1  = vec3(0.62, 0.82, 1.00); // sky blue
  vec3 blue2  = vec3(0.70, 0.88, 1.00); // ice blue
  vec3 periwi = vec3(0.72, 0.74, 1.00); // periwinkle
  vec3 cyan1  = vec3(0.60, 0.94, 1.00); // pastel cyan
  vec3 lav    = vec3(0.80, 0.76, 1.00); // lavender
  vec3 white  = vec3(0.92, 0.96, 1.00); // icy white

  // Night-time deep aura palette — moody indigo / violet
  vec3 nBlue1  = vec3(0.06, 0.09, 0.24);
  vec3 nBlue2  = vec3(0.10, 0.13, 0.30);
  vec3 nPeri   = vec3(0.16, 0.12, 0.34);
  vec3 nCyan   = vec3(0.05, 0.16, 0.28);
  vec3 nLav    = vec3(0.22, 0.14, 0.38);
  vec3 nWhite  = vec3(0.28, 0.26, 0.44);

  // Blend palette toward night tones
  blue1  = mix(blue1,  nBlue1, nightFactor);
  blue2  = mix(blue2,  nBlue2, nightFactor);
  periwi = mix(periwi, nPeri,  nightFactor);
  cyan1  = mix(cyan1,  nCyan,  nightFactor);
  lav    = mix(lav,    nLav,   nightFactor);
  white  = mix(white,  nWhite, nightFactor);

  // Six colour orbs drifting slowly around the screen
  vec2 p0 = vec2(0.50 + 0.30*sin(t*0.71),       0.50 + 0.28*cos(t*0.59));
  vec2 p1 = vec2(0.20 + 0.18*cos(t*0.83 + 1.0), 0.30 + 0.22*sin(t*0.67 + 0.5));
  vec2 p2 = vec2(0.75 + 0.20*sin(t*0.61 + 2.1), 0.70 + 0.18*cos(t*0.79 + 1.2));
  vec2 p3 = vec2(0.35 + 0.22*cos(t*0.55 + 3.3), 0.75 + 0.20*sin(t*0.91 + 2.0));
  vec2 p4 = vec2(0.80 + 0.15*sin(t*0.77 + 4.1), 0.25 + 0.22*cos(t*0.63 + 3.5));
  vec2 p5 = vec2(0.15 + 0.18*cos(t*0.69 + 5.2), 0.60 + 0.20*sin(t*0.85 + 4.8));

  // Weighted-average blend: every pixel is a smooth mix of its nearest colours
  // Higher power = crisper edges; 4.0 gives smooth but distinct blobs
  float w0 = aura(uv, p0, 0.55);
  float w1 = aura(uv, p1, 0.48);
  float w2 = aura(uv, p2, 0.52);
  float w3 = aura(uv, p3, 0.46);
  float w4 = aura(uv, p4, 0.50);
  float w5 = aura(uv, p5, 0.44);
  float total = w0 + w1 + w2 + w3 + w4 + w5 + 0.001;

  vec3 col = (blue1*w0 + periwi*w1 + cyan1*w2 + lav*w3 + blue2*w4 + white*w5) / total;

  // Subtle time-of-day hue shift (warm day / cool night)
  float vert  = clamp(vScreen.y, 0.0, 1.0);
  vec3  tod   = mix(colorGround, mix(colorAura, colorSky, vert), vert);
  tod = mix(tod, vec3(1.0), 0.88);           // nearly white so it never overpowers
  col = mix(col, col * tod * 1.12, 0.10);    // barely-there tint

  // Night: deepen toward the top (sky) and add a faint vignette for a dark aura
  float vignette = smoothstep(1.05, 0.15, length(uv - vec2(0.5)));
  vec3 nightDeepen = col * mix(0.55, 1.0, vignette); // darker toward edges
  col = mix(col, nightDeepen, nightFactor);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

function LiquidChromeBackground({ colorSky = '#87ceeb', colorAura = '#ffb347', colorGround = '#3b4f3d', isNight = false }) {
  const matRef = useRef()

  const uniforms = useMemo(() => ({
    time:        { value: 0 },
    colorSky:    { value: new THREE.Color(colorSky) },
    colorAura:   { value: new THREE.Color(colorAura) },
    colorGround: { value: new THREE.Color(colorGround) },
    nightFactor: { value: isNight ? 1 : 0 }
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.time.value = clock.getElapsedTime()
    matRef.current.uniforms.colorSky.value.set(colorSky)
    matRef.current.uniforms.colorAura.value.set(colorAura)
    matRef.current.uniforms.colorGround.value.set(colorGround)
    // Smoothly ease toward the night/day target so transitions aren't abrupt
    const target = isNight ? 1 : 0
    const current = matRef.current.uniforms.nightFactor.value
    matRef.current.uniforms.nightFactor.value += (target - current) * 0.05
  })

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[480, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}

export default LiquidChromeBackground
