import gsap from 'gsap';
import Lenis from 'lenis';
import './shell.css';

let lenis = null;

export function makeSmoother() {
  if (lenis) return lenis;
  try {
    lenis = new Lenis({
      lerp: 0.05,
      syncTouch: true,
      autoRaf: true,
    });
    window.nxLenis = lenis;
    return lenis;
  } catch (err) {
    console.warn('Lenis init note:', err);
    return null;
  }
}

export function killSmoother() {
  if (lenis) {
    try {
      lenis.destroy();
    } catch (e) {}
    lenis = null;
    window.nxLenis = null;
  }
}

export function mountShell() {
  const find = (s) => document.querySelector(s);
  const sweep = find('#sweep');
  const front = find('#front-dot');
  const back = find('#back-dot');
  const counter = find('.nx-num');
  const K = 960 / 2714;
  const C = [1386 * K, 1120 * K];
  const A = 1434 * K;
  const B = 330 * K;
  const angle = (-22 * Math.PI) / 180;
  const start = 4.968952380427856;

  const strips = find('#strips');
  const N_ST = window.innerWidth >= 768 ? 16 : 9;
  const rects = [];
  if (strips) {
    strips.innerHTML = '';
    for (let i = 0; i < N_ST; i++) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('fill', '#2e3138');
      strips.appendChild(r);
      rects.push(r);
    }
  }

  const svg = find('#scene');
  const iconG = find('#iconG');
  const wm = find('#wm');
  const wN = find('#wN');
  const wR = find('#wR');
  const SC = 1.0611643330876935;
  const O = [945.3333333333, 260];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function point(t, scale = 1) {
    return [
      C[0] + scale * (A * Math.cos(t) * Math.cos(angle) - B * Math.sin(t) * Math.sin(angle)),
      C[1] + scale * (A * Math.cos(t) * Math.sin(angle) + B * Math.sin(t) * Math.cos(angle)),
    ];
  }

  const S = { p: 0, m: 0, m2: 0, e: 0, pr: 0, num: 1, st: Array(N_ST).fill(0) };

  function layout() {
    if (!svg) return;
    const w = svg.clientWidth || window.innerWidth;
    const h = svg.clientHeight || window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const isDesktop = w >= 1024;
    const lw = isDesktop ? clamp(0.3056 * w, 320, 460) : clamp(0.64 * w, 200, 300);
    const k0 = lw / 1100;
    const ww = isDesktop ? Math.min(0.5 * w, 780) : Math.min(0.84 * w, 380);
    const kf = ww / 4196;
    const cx = w / 2;
    const cy = h / 2;
    const a0 = [cx - 550 * k0, cy - 445 * k0];
    const nw = isDesktop ? 128 : 130;
    const kn = nw / 4196;
    const navH = isDesktop ? 16 + 32 : 12 + 28;
    const pad = isDesktop ? (w - Math.min(w - 48, 1140)) / 2 + 30 : 12 + 22;
    const m2 = S.m2;
    const F0 = [cx - kf * 2358, cy - kf * 632];
    const F1 = [pad - kn * 260, navH - kn * 632];
    const kc = kf + (kn - kf) * m2;
    const F = [F0[0] + (F1[0] - F0[0]) * m2, F0[1] + (F1[1] - F0[1]) * m2];
    const k1 = kc / SC;
    const a1 = [F[0] + kc * (-70 / SC + O[0]), F[1] + kc * (-50 / SC + O[1])];
    const m = S.m;
    const k = k0 * Math.pow(k1 / k0, m);
    const a = [a0[0] + (a1[0] - a0[0]) * m, a0[1] + (a1[1] - a0[1]) * m];
    iconG && iconG.setAttribute('transform', `translate(${a[0]} ${a[1]}) scale(${k})`);
    wm && wm.setAttribute('transform', `translate(${F[0]} ${F[1]}) scale(${kc})`);
    const sw = w / N_ST;
    rects.forEach((r, i) => {
      const p = S.st[i];
      r.setAttribute('x', i * sw - 0.5);
      r.setAttribute('width', sw + 1);
      r.setAttribute('y', -h * p);
      r.setAttribute('height', h + 1);
    });
    const e = S.e;
    const d = 420 * (1 - e);
    wN && wN.setAttribute('opacity', e);
    wN && wN.setAttribute('transform', `translate(${d} 0)`);
    wR && wR.setAttribute('opacity', e);
    wR && wR.setAttribute('transform', `translate(${-d} 0)`);
    if (counter) counter.style.opacity = 0.92 * S.num;
  }

  function draw() {
    layout();
    const progress = S.p;
    if (counter) counter.textContent = String(Math.round(progress * 100)).padStart(3, '0');
    const theta = start + progress * 2 * Math.PI;
    const pos = point(theta);
    const behind = Math.sin(theta) > 0;
    const scale = behind ? 0.82 : 1;
    const dotScale = 1.084 * scale;
    const transform = `translate(${pos[0]} ${pos[1]}) scale(${dotScale}) translate(-1481.97 -493.78)`;
    if (front) {
      front.setAttribute('transform', transform);
      front.style.display = behind ? 'none' : '';
    }
    if (back) {
      back.setAttribute('transform', transform);
      back.style.display = behind ? '' : 'none';
    }
    const lead = progress >= 1 ? 1 : progress + 0.006;
    let d = `M ${C[0]} ${C[1]}`;
    for (let j = 0; j <= Math.ceil(lead * 360); j++) {
      const t = start + Math.min(lead, j / 360) * 2 * Math.PI;
      const p = point(t, 24);
      d += ` L ${p[0]} ${p[1]}`;
    }
    const end = point(start + lead * 2 * Math.PI, 24);
    d += ` L ${end[0]} ${end[1]} Z`;
    if (sweep) sweep.setAttribute('d', d);
  }

  const tl = gsap.timeline({ paused: true, onUpdate: draw });
  tl.to(S, { p: 1, duration: 2.6, ease: 'power2.inOut' }, 0)
    .to(S, { num: 0, duration: 0.35, ease: 'power1.out' }, 2.6)
    .to(S, { m: 1, duration: 1.15, ease: 'power3.inOut' }, 2.8)
    .to(S, { e: 1, duration: 1.3, ease: 'power4.out' }, 3.1)
    .to(S, { m2: 1, duration: 1.3, ease: 'power3.inOut' }, 4.7)
    .to(S, { pr: 1, duration: 2.4, ease: 'power3.out' }, 5.0);

  const ord = [...Array(N_ST).keys()];
  for (let i = 0; i < N_ST; i++) {
    tl.to(S.st, { [i]: 1, duration: 1.7, ease: 'power2.inOut' }, 4.95 + ord[i] * 0.05);
  }

  function lens() {
    const nav = find('#nav');
    if (!nav) return;
    const r = nav.getBoundingClientRect();
    const W = Math.round(r.width);
    const H = Math.round(r.height);
    if (!W || !H) return;
    const e = H / 2;
    const svgm = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><defs><linearGradient id='l'><stop offset='0' stop-color='rgb(255,128,128)'/><stop offset='1' stop-color='rgb(128,128,128)'/></linearGradient><linearGradient id='r'><stop offset='0' stop-color='rgb(128,128,128)'/><stop offset='1' stop-color='rgb(0,128,128)'/></linearGradient><linearGradient id='t' x2='0' y2='1'><stop offset='0' stop-color='rgb(128,255,128)'/><stop offset='1' stop-color='rgb(128,128,128)'/></linearGradient><linearGradient id='b' x2='0' y2='1'><stop offset='0' stop-color='rgb(128,128,128)'/><stop offset='1' stop-color='rgb(128,0,128)'/></linearGradient></defs><rect width='${W}' height='${H}' fill='rgb(128,128,128)'/><rect width='${e}' height='${H}' fill='url(#l)'/><rect x='${W-e}' width='${e}' height='${H}' fill='url(#r)'/><rect x='${e}' width='${W-2*e}' height='${e/2}' fill='url(#t)'/><rect x='${e}' y='${H-e/2}' width='${W-2*e}' height='${e/2}' fill='url(#b)'/></svg>`;
    const im = document.getElementById('lgmap');
    if (im) {
      im.setAttribute('width', W);
      im.setAttribute('height', H);
      im.setAttribute('href', 'data:image/svg+xml;utf8,' + encodeURIComponent(svgm));
    }
  }

  lens();
  window.addEventListener('resize', lens);

  tl.call(() => window.dispatchEvent(new Event('noxira:prepare')), null, 4.05);
  tl.call(() => window.dispatchEvent(new Event('noxira:mount')), null, 5.3);
  tl.call(() => {
    window.dispatchEvent(new Event('noxira:ready'));
  }, null, 6.3);
  tl.to({}, { duration: 0.01 }, 6.4);

  function play() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      snapToEnd();
    } else {
      tl.restart();
    }
  }

  function snapToEnd() {
    tl.progress(1);
    draw();
    if (counter) counter.style.opacity = 0;
    window.dispatchEvent(new Event('noxira:prepare'));
    window.dispatchEvent(new Event('noxira:mount'));
    window.dispatchEvent(new Event('noxira:ready'));
    document.documentElement.classList.add('nx-ready');
    window.__nxMounted = 1;
    window.__nxPrepared = 1;
  }

  draw();
  window.addEventListener('resize', draw);

  return {
    play,
    snapToEnd,
    timeline: tl,
    destroy: () => {
      tl.kill();
      window.removeEventListener('resize', lens);
      window.removeEventListener('resize', draw);
    },
  };
}
