import React, { useEffect, useRef, useState } from 'react';
import { currentTheme, toggleTheme } from '../theme.js';

/* Animated snow layer. Flakes fall continuously; CSS fades the layer in/out,
   so the component only draws and snowfall is only VISIBLE in the night state. */
function useSnow(ref, count) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 2;
    let h = 2;
    let raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = canvas.width = Math.max(2, Math.round(r.width * dpr));
      h = canvas.height = Math.max(2, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const flakes = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.3,
      v: 0.35 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2,
    }));
    let t = 0;
    const frame = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      for (const f of flakes) {
        f.y += f.v * 0.02;
        f.x += Math.sin(t + f.ph) * 0.0007;
        if (f.y > 1.06) {
          f.y = -0.06;
          f.x = Math.random();
        }
        ctx.beginPath();
        ctx.arc(f.x * w, f.y * h, f.r * dpr * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ref, count]);
}

/* Pill-shaped Snow Globe theme toggle: circular glass globe knob slides inside a
   miniature day/night landscape. Drives the same theme state + localStorage
   persistence as the rest of the site (theme.js). Dark theme = night globe. */
export default function SnowGlobeToggle() {
  const [t, setT] = useState(currentTheme());
  const [shake, setShake] = useState(false);
  const sceneSnow = useRef(null);
  const globeSnow = useRef(null);
  useSnow(sceneSnow, 16);
  useSnow(globeSnow, 10);

  useEffect(() => {
    const f = () => setT(currentTheme());
    window.addEventListener('nx:theme', f);
    return () => window.removeEventListener('nx:theme', f);
  }, []);

  useEffect(() => {
    if (!shake) return undefined;
    const id = setTimeout(() => setShake(false), 650);
    return () => clearTimeout(id);
  }, [shake]);

  const night = t !== 'light';
  const label = night ? 'Dark theme on - tap for light' : 'Light theme on - tap for dark';

  return (
    <button
      type="button"
      className={`nxtheme nxglobe${night ? ' on' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={night}
      onClick={() => {
        setShake(true);
        toggleTheme();
      }}
    >
      <span className="nxg-scene" aria-hidden="true">
        <span className="nxg-sky nxg-skyday" />
        <span className="nxg-sky nxg-skynight" />
        <svg className="nxg-stars" viewBox="0 0 76 38" preserveAspectRatio="none">
          <g fill="#fff">
            <circle cx="8" cy="6" r="0.9" />
            <circle cx="16" cy="12" r="0.6" />
            <circle cx="24" cy="5" r="0.8" />
            <circle cx="33" cy="10" r="0.6" />
            <circle cx="42" cy="4" r="0.9" />
            <circle cx="52" cy="9" r="0.6" />
            <circle cx="62" cy="5" r="0.8" />
            <circle cx="70" cy="12" r="0.6" />
            <circle cx="12" cy="20" r="0.6" />
            <circle cx="58" cy="18" r="0.7" />
            <circle cx="28" cy="17" r="0.5" />
            <circle cx="68" cy="22" r="0.5" />
          </g>
        </svg>
        <span className="nxg-sun" />
        <span className="nxg-moon" />
        <span className="nxg-cloud" />
        {/* day landscape */}
        <svg className="nxg-land nxg-landday" viewBox="0 0 76 22" preserveAspectRatio="none">
          <path d="M0 13 Q 16 5 32 11 T 76 10 L76 22 L0 22 Z" fill="#7dc95e" />
          <path d="M0 17 Q 20 11 42 16 T 76 15 L76 22 L0 22 Z" fill="#58b047" />
          <path d="M12 14 l4 -9 4 9 Z" fill="#2f7d3f" />
          <path d="M10.5 17 l5.5 -12 5.5 12 Z" fill="#35894a" />
          <rect x="60" y="10" width="9" height="7" fill="#f6ede0" />
          <path d="M59 10.5 L64.5 5.5 L70 10.5 Z" fill="#c95b4d" />
          <rect className="nxg-win" x="62" y="12" width="2.4" height="2.4" fill="#aee2f7" />
          <rect x="65" y="13.4" width="2.2" height="3.6" fill="#8a5a3b" />
        </svg>
        {/* snowy night landscape */}
        <svg className="nxg-land nxg-landsnow" viewBox="0 0 76 22" preserveAspectRatio="none">
          <path d="M0 13 Q 16 5 32 11 T 76 10 L76 22 L0 22 Z" fill="#dfe9f5" />
          <path d="M0 17 Q 20 11 42 16 T 76 15 L76 22 L0 22 Z" fill="#f4f8fd" />
          <path d="M12 14 l4 -9 4 9 Z" fill="#e9f1f9" />
          <path d="M10.5 17 l5.5 -12 5.5 12 Z" fill="#f2f7fc" />
          <rect x="60" y="10" width="9" height="7" fill="#e8e2d8" />
          <path d="M59 10.5 L64.5 5.5 L70 10.5 Z" fill="#f2f6fb" />
          <rect className="nxg-win" x="62" y="12" width="2.4" height="2.4" fill="#ffd76a" />
          <rect x="65" y="13.4" width="2.2" height="3.6" fill="#6d4a33" />
        </svg>
        <canvas ref={sceneSnow} className="nxg-snow" />
      </span>
      <span className={`nxg-knob${shake ? ' nxg-shake' : ''}`} aria-hidden="true">
        <svg className="nxg-gin" viewBox="0 0 32 24" preserveAspectRatio="none">
          <path d="M0 15 Q 8 8 16 13 T 32 12 L32 24 L0 24 Z" fill="#eef4fb" />
          <path d="M7 15 l3.5 -8 3.5 8 Z" fill="#2f6d4f" />
          <path d="M5.5 18 l5 -11 5 11 Z" fill="#35795a" />
          <rect x="20" y="11" width="6" height="4.6" fill="#f6ede0" />
          <path d="M19 11.5 L23 7.8 L27 11.5 Z" fill="#c95b4d" />
          <rect x="21.6" y="12.6" width="1.8" height="1.8" fill="#ffd76a" />
        </svg>
        <canvas ref={globeSnow} className="nxg-snow nxg-gsnow" />
        <span className="nxg-glass" />
      </span>
    </button>
  );
}
