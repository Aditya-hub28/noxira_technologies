import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import iconUrl from '../assets/noxira-icon-roller.svg';
import './JourneyBoard.css';

gsap.registerPlugin(ScrollTrigger);

// Rolling-drum journey board (approved Nov 14 demo). 8 fixed slots, one revolution per change.
const SLOTS = 8;
const RING = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const N = RING.length;
const STEP = 360 / N;
const FH = 50;
const R = FH / 2 / Math.tan(Math.PI / N);
const PER = 3100;

const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeInOutQuad = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

function padded(word) {
  const start = Math.floor((SLOTS - word.length) / 2);
  const out = new Array(SLOTS).fill(' ');
  for (let i = 0; i < word.length; i++) out[start + i] = word[i];
  return out;
}

export default function JourneyBoard({ steps }) {
  const housingRef = useRef(null);
  const stageRef = useRef(null);
  const ctl = useRef({ go: () => {}, sound: () => {} });
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [soundOk, setSoundOk] = useState(true);

  useEffect(() => {
    const housing = housingRef.current;
    const stage = stageRef.current;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const words = steps.map((s) => s.word);
    const drums = [];
    const wins = housing.querySelectorAll('.jb-drum');
    wins.forEach((el) => {
      drums.push({ el, angle: 0, initial: 0 });
    });

    const setAngle = (d, a) => {
      d.angle = a;
      d.el.style.transform = `translateZ(${-R}px) rotateX(${a}deg)`;
    };
    // Show a word instantly (reduced motion and pill jumps while off screen).
    const showWord = (w) => {
      const p = padded(words[w]);
      drums.forEach((d, s) => setAngle(d, RING.indexOf(p[s]) * STEP));
    };

    const fit = () => {
      const avail = stage.clientWidth - 8;
      const s = Math.min(1.3, avail / housing.offsetWidth);
      housing.style.transform = `scale(${s})`;
      stage.style.height = `${housing.offsetHeight * s}px`;
    };
    fit();
    window.addEventListener('resize', fit);

    // Audio (procedural). Default ON, but browsers keep it silent until the first tap/click/key.
    let ctx = null, noise = null, master = null, on = true;
    const setupAudio = () => {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { setSoundOk(false); return false; }
      ctx = new AC();
      const len = Math.floor(ctx.sampleRate * 0.045);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      master = ctx.createGain();
      master.gain.value = 0.34;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 5;
      master.connect(comp); comp.connect(ctx.destination);
      return true;
    };
    const unlock = () => {
      if (!on || !setupAudio()) return;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    };
    const unlockEvents = ['pointerdown', 'touchend', 'keydown', 'click'];
    unlockEvents.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    setupAudio();
    const clack = (strong, slot) => {
      if (!on || !ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const out = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const amp = strong ? 0.13 : 0.038 + Math.random() * 0.018;
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(amp, t + 0.0025);
      out.gain.exponentialRampToValueAtTime(0.0001, t + (strong ? 0.105 : 0.046));
      if (pan) { pan.pan.value = (slot - 3.5) / 5; out.connect(pan); pan.connect(master); } else out.connect(master);
      const n = ctx.createBufferSource(); n.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = strong ? 1150 : 1900 + Math.random() * 900; bp.Q.value = strong ? 3.5 : 5.5;
      n.connect(bp); bp.connect(out); n.start(t); n.stop(t + 0.05);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(strong ? 105 : 145 + Math.random() * 65, t);
      o.frequency.exponentialRampToValueAtTime(strong ? 58 : 82, t + (strong ? 0.085 : 0.038));
      const og = ctx.createGain();
      og.gain.setValueAtTime(strong ? 0.055 : 0.018, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + (strong ? 0.09 : 0.04));
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.11);
    };

    // Timeline: one spin per word change, looping back to word 0.
    const total = words.length;
    const T0 = 600;
    let spins = []; // per drum: [t0, dur, from, to]
    const build = () => {
      spins = drums.map(() => []);
      const ang = drums.map((_, s) => RING.indexOf(padded(words[0])[s]) * STEP);
      drums.forEach((d, s) => { d.initial = ang[s]; });
      for (let w = 1; w <= total; w++) {
        const p = padded(words[w % total]);
        drums.forEach((d, s) => {
          const target = RING.indexOf(p[s]);
          const cur = ((Math.round(ang[s] / STEP) % N) + N) % N;
          const delta = (((target - cur) % N) + N) % N;
          const from = ang[s];
          const to = from + delta * STEP + 360;
          spins[s].push([T0 + (w - 1) * PER + s * 90, 1500 + (s % 3) * 140, from, to]);
          ang[s] = to;
        });
      }
    };
    build();
    const LOOP = T0 + total * PER + 1400;

    // Intro: on every entry the drums roll (same easing as later steps) from a scrambled
    // position and settle on step 1, so APPLY is never shown as a static word.
    const INTRO = 2500;
    const intro = drums.map((_, s) => [s * 90, 1500 + (s % 3) * 140, -(360 + ((s * 7 + 5) % 13 + 4) * STEP)]);
    let introOn = false, introPrev = 0;
    const seekIntro = (ms) => {
      drums.forEach((d, s) => {
        const [i0, dur, off] = intro[s];
        const from = d.initial + off, to = d.initial;
        const t = Math.max(0, Math.min(1, (ms - i0) / dur));
        const OVER = 4;
        const a = t < 0.85
          ? from + (to + OVER - from) * easeInOutCubic(t / 0.85)
          : to + OVER - OVER * easeInOutQuad((t - 0.85) / 0.15);
        setAngle(d, a);
      });
      if (lastIdx !== 0) { lastIdx = 0; setActive(0); }
    };
    const introSound = (ms) => {
      if (!on || !ctx || ctx.state !== 'running') return;
      drums.forEach((d, slot) => {
        const face = Math.floor((d.angle + 0.0001) / STEP);
        const pf = Math.floor(((d.prevAngle ?? d.angle) + 0.0001) / STEP);
        if (face > pf) for (let i = 0, n = Math.min(face - pf, 8); i < n; i++) clack(false, slot);
        d.prevAngle = d.angle;
        const end = intro[slot][0] + intro[slot][1];
        if (introPrev < end && ms >= end) clack(true, slot);
      });
      introPrev = ms;
    };

    let lastIdx = -1;
    const seek = (ms) => {
      drums.forEach((d, s) => {
        let a = d.initial;
        for (const [t0, dur, from, to] of spins[s]) {
          if (ms < t0) break;
          const t = Math.min(1, (ms - t0) / dur);
          const OVER = 4;
          a = t < 0.85
            ? from + (to + OVER - from) * easeInOutCubic(t / 0.85)
            : to + OVER - OVER * easeInOutQuad((t - 0.85) / 0.15);
        }
        setAngle(d, a);
      });
      const cycle = ms < T0 ? -1 : Math.floor((ms - T0) / PER);
      const wi = cycle < 0 ? 0 : cycle >= total ? 0 : (1 + cycle) % total;
      if (wi !== lastIdx) { lastIdx = wi; setActive(wi); }
    };

    let t0 = performance.now(), prev = 0, raf = 0, visible = false;
    const soundFrame = (p, ms) => {
      if (!on || !ctx || ctx.state !== 'running' || ms < p || ms - p > 120) return;
      drums.forEach((d, slot) => {
        const face = Math.floor((d.angle + 0.0001) / STEP);
        const pf = Math.floor(((d.prevAngle ?? d.angle) + 0.0001) / STEP);
        if (face > pf) for (let i = 0, n = Math.min(face - pf, 8); i < n; i++) clack(false, slot);
        d.prevAngle = d.angle;
        for (const [s0, dur] of spins[slot]) {
          const end = s0 + dur;
          if (p < end && ms >= end) clack(true, slot);
        }
      });
    };
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      if (introOn) {
        const e = now - t0;
        if (e < INTRO) { seekIntro(e); introSound(e); return; }
        introOn = false; t0 = now; prev = 0; seek(0);
        return;
      }
      const ms = (now - t0) % LOOP;
      seek(ms);
      soundFrame(prev, ms);
      prev = ms;
    };

    ctl.current.go = (i) => {
      if (reduce) { showWord(i); lastIdx = i; setActive(i); return; }
      introOn = false;
      const start = i === 0 ? T0 + (total - 1) * PER : T0 + (i - 1) * PER;
      t0 = performance.now() - start;
      prev = start;
      seek(start);
    };
    ctl.current.sound = async () => {
      if (!on) {
        if (!setupAudio()) return;
        try { await ctx.resume(); } catch (e) { return; }
        on = true;
      } else on = false;
      setSoundOn(on);
    };

    // GSAP ScrollTrigger: run only while the Journey section is on screen.
    // Every entry (scrolling down or back up) restarts from step 1; leaving stops and resets.
    const begin = () => {
      lastIdx = -1;
      if (reduce) { showWord(0); setActive(0); lastIdx = 0; return; }
      t0 = performance.now(); prev = 0;
      introOn = true; introPrev = 0;
      drums.forEach((d) => { d.prevAngle = undefined; });
      seekIntro(0);
      visible = true;
    };
    const halt = () => {
      visible = false; introOn = false;
      if (reduce) { showWord(0); setActive(0); lastIdx = 0; return; }
      seek(0);
    };
    const section = stage.parentElement || stage;
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 85%',
      end: 'bottom 15%',
      onEnter: begin,
      onEnterBack: begin,
      onLeave: halt,
      onLeaveBack: halt,
    });
    if (reduce) { showWord(0); setActive(0); } else { seek(0); raf = requestAnimationFrame(loop); }
    if (st.isActive) begin();

    return () => {
      cancelAnimationFrame(raf);
      st.kill();
      window.removeEventListener('resize', fit);
      unlockEvents.forEach((e) => window.removeEventListener(e, unlock));
      if (ctx) ctx.close().catch(() => {});
    };
  }, [steps]);

  const cur = steps[active] || steps[0];
  const drumEls = [];
  for (let s = 0; s < SLOTS; s++) {
    const faces = [];
    for (let i = 0; i < N; i++) {
      faces.push(
        <div
          key={i}
          className="jb-face"
          style={{
            height: FH,
            marginTop: -FH / 2,
            fontSize: FH * 0.88,
            transform: `rotateX(${-i * STEP}deg) translateZ(${R}px)`,
          }}
        >
          {RING[i] === ' ' ? '' : RING[i]}
        </div>
      );
    }
    drumEls.push(
      <div className="jb-window" key={s} style={{ perspective: R * 1.05 }}>
        <div className="jb-drum">{faces}</div>
        <div className="jb-shade" />
        <div className="jb-glass" />
      </div>
    );
  }

  return (
    <div className="jb">
      <div className="jb-stage" ref={stageRef}>
        <div className="jb-housing" ref={housingRef} aria-hidden="true">
          <div className="jb-nx"><img src={iconUrl} alt="" /></div>
          {drumEls}
          <div className="jb-nx"><img src={iconUrl} alt="" /></div>
        </div>
      </div>
      <div className="jb-cap" aria-live="polite">
        <small>STEP {cur.step} OF {steps.length}</small>
        <b>{cur.title}</b>
        <span>{cur.desc}</span>
      </div>
      <div className="jb-pills">
        {steps.map((s, i) => (
          <button
            type="button"
            key={s.step}
            className={`jb-pill${i === active ? ' on' : ''}`}
            onClick={() => ctl.current.go(i)}
          >
            {s.word}
          </button>
        ))}
      </div>
      {soundOk && (
        <button type="button" className="jb-sound" aria-pressed={soundOn} onClick={() => ctl.current.sound()}>
          {soundOn ? 'SOUND ON' : 'SOUND OFF'}
        </button>
      )}
    </div>
  );
}
