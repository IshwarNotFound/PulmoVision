"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

const vertex = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;
uniform float time;
uniform vec2 resolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float n = noise(uv * 2.0 + time * 0.05);

  vec3 base = vec3(0.027, 0.041, 0.035);
  vec3 high = vec3(0.047, 0.071, 0.059);
  vec3 color = mix(base, high, n * 0.5 + 0.5);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function WebGLBackground() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: false });
    const gl = renderer.gl;
    gl.clearColor(0.027, 0.041, 0.035, 1);

    const triangle = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        time: { value: 0 },
        resolution: { value: [window.innerWidth, window.innerHeight] },
      },
    });

    const mesh = new Mesh(gl, { geometry: triangle, program });

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      program.uniforms.resolution.value = [window.innerWidth, window.innerHeight];
    };

    let rafId = 0;
    const render = (time: number) => {
      program.uniforms.time.value = time * 0.001;
      renderer.render({ scene: mesh });
      rafId = window.requestAnimationFrame(render);
    };

    const startRaf = () => {
      if (rafId === 0) rafId = window.requestAnimationFrame(render);
    };
    const stopRaf = () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stopRaf();
      else startRaf();
    };

    host.appendChild(gl.canvas);
    resize();
    startRaf();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopRaf();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      gl.canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div ref={ref} className="fixed inset-0 -z-20" aria-hidden="true" />;
}
