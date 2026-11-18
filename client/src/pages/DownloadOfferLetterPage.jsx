import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { api } from '../services/api';
import './verify.css';

if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const FAIL_TEXT = "No offer letter found for these details. If you haven't applied yet, please apply for a program first.";
const CONFETTI_COLORS = ['#38c8ff', '#0a8fd6', '#10b981', '#34d399', '#67e8f9', '#059669'];

// Module-level confetti engine
const fxState = { parts: [], running: false };

function fitFx(canvas) {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function fxTick(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fxState.parts = fxState.parts.filter((p) => p.age < p.life);
  for (const p of fxState.parts) {
    p.age += 1;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.16;
    p.vx *= 0.985;
    p.vy *= 0.99;
    p.r += p.vr;
    const t = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, t);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.fillStyle = p.c;
    if (p.rect) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
    else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  if (fxState.parts.length) requestAnimationFrame(() => fxTick(canvas));
  else { fxState.running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

function burst(canvas, x, y) {
  if (!canvas) return;
  for (let i = 0; i < 85; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    fxState.parts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.5,
      s: 5 + Math.random() * 7,
      c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 55 + Math.random() * 40,
      age: 0,
      rect: Math.random() < 0.55
    });
  }
  if (!fxState.running) {
    fxState.running = true;
    requestAnimationFrame(() => fxTick(canvas));
  }
}

function offerPdfUrl(email, id) {
  return `/api/v1/intake/offer-letter/pdf?email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`;
}

async function renderOfferFront(url) {
  const task = pdfjsLib.getDocument({ url });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 1600 / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas.toDataURL('image/png');
  } finally {
    task.destroy();
  }
}

function OfferLetterFront({ offer }) {
  return (
    <div className="vc" style={{ padding: '8% 6%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
      <div className="vc-outer" />
      <div className="vc-inner" />
      <div className="vc-badge" style={{ position: 'static', transform: 'none', width: 'auto', padding: '6px 18px', fontSize: '11px', letterSpacing: '.12em' }}>
        NOXIRA TECHNOLOGIES
      </div>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: 'clamp(14px, 3.2cqw, 20px)', color: '#0f172a', letterSpacing: '.04em' }}>
          OFFICIAL OFFER LETTER
        </div>
        <div style={{ width: 50, height: 2, background: '#d97706', margin: '8px auto' }} />
        <div style={{ fontSize: 'clamp(11px, 2cqw, 13px)', color: '#334155', fontStyle: 'italic' }}>
          This confirms the selection of
        </div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: 'clamp(16px, 3.8cqw, 22px)', color: '#0f172a', marginTop: 6 }}>
          {offer.recipientName}
        </div>
        <div style={{ fontSize: 'clamp(11px, 2.2cqw, 14px)', color: '#d97706', fontWeight: 700, marginTop: 6 }}>
          {offer.programTitle}
        </div>
      </div>
      <div style={{ width: '84%', display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(9px, 1.6cqw, 11px)', color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
        <div><b>Ref: {offer.applicationId}</b></div>
        <div><span>Issued by Admissions</span></div>
      </div>
    </div>
  );
}

export default function DownloadOfferLetterPage() {
  const [email, setEmail] = useState('');
  const [appId, setAppId] = useState('');
  const [view, setView] = useState('form'); // form | busy | ok | stage | fail
  const [offer, setOffer] = useState(null);
  const [pdfImg, setPdfImg] = useState(null);
  const [panelFx, setPanelFx] = useState(''); // '' | 'busy' | 'ripple' | 'deny'

  const panelRef = useRef(null);
  const headRef = useRef(null);
  const fxRef = useRef(null);
  const timersRef = useRef([]);
  const pendingMorph = useRef(null);

  const later = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  // Resize canvas on resize
  useEffect(() => {
    const onResize = () => fitFx(fxRef.current);
    fitFx(fxRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setEmail('');
    setAppId('');
    setOffer(null);
    setPdfImg(null);
    setPanelFx('');
    setView('form');
    const panel = panelRef.current;
    if (panel) {
      panel.classList.remove('morphed');
      panel.style.width = '';
      panel.style.height = '';
      panel.style.removeProperty('--card-ratio');
      panel.style.removeProperty('--cardw');
    }
  }, []);

  const morphToStage = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    pendingMorph.current = { w0: panel.offsetWidth, h0: panel.offsetHeight };
    setView('stage');
  }, []);

  // FLIP panel morph into full liquid glass presentation
  useLayoutEffect(() => {
    if (view !== 'stage' || !pendingMorph.current) return undefined;
    const { w0, h0 } = pendingMorph.current;
    pendingMorph.current = null;
    const panel = panelRef.current;
    const head = headRef.current;
    if (!panel || !head) return undefined;

    panel.classList.add('morphed');
    const headBottom = head.getBoundingClientRect().bottom;
    const stripH = window.innerWidth < 560 ? 100 : 64;
    const availH = window.innerHeight - headBottom - 64 - 54 - stripH - 40;
    const cardH = Math.max(220, Math.min(520, availH));
    panel.style.setProperty('--card-ratio', '595/842');
    panel.style.setProperty('--cardw', `${Math.min(400, Math.round((cardH * 595) / 842))}px`);

    const w1 = Math.min(920, Math.round(window.innerWidth * 0.96));
    panel.style.transition = 'none';
    panel.style.width = `${w1}px`;
    panel.style.height = 'auto';
    const h1 = panel.scrollHeight;
    panel.style.width = `${w0}px`;
    panel.style.height = `${h0}px`;
    void panel.offsetHeight; // eslint-disable-line no-void
    panel.style.transition = 'width .75s cubic-bezier(.45,.05,.25,1), height .75s cubic-bezier(.45,.05,.25,1), background-color .35s ease, border-color .35s ease';
    panel.style.width = `${w1}px`;
    panel.style.height = `${h1}px`;
    const t = setTimeout(() => {
      panel.style.transition = 'none';
      panel.style.width = '';
      panel.style.height = '';
      void panel.offsetHeight; // eslint-disable-line no-void
      panel.style.transition = '';
    }, 850);
    return () => clearTimeout(t);
  }, [view]);

  const lookup = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    const cleanId = appId.trim().toUpperCase();
    if (!cleanEmail || !cleanId) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setOffer(null);
    setPdfImg(null);
    setView('busy');
    setPanelFx('busy');
    const started = Date.now();

    try {
      const data = await api.lookupOfferLetter(cleanEmail, cleanId);
      const wait = Math.max(0, 1400 - (Date.now() - started));
      later(() => {
        setOffer({ ...data.offerLetter, email: cleanEmail });
        setView('ok');
        setPanelFx('ripple');
        renderOfferFront(offerPdfUrl(cleanEmail, data.offerLetter.applicationId))
          .then((img) => { if (img) setPdfImg(img); })
          .catch(() => {});

        const canvas = fxRef.current;
        const panel = panelRef.current;
        if (canvas && panel) {
          fitFx(canvas);
          const r = panel.getBoundingClientRect();
          burst(canvas, r.left + r.width / 2, r.top + r.height / 2);
        }

        later(() => {
          morphToStage();
        }, 1500);
      }, wait);
    } catch (err) {
      const wait = Math.max(0, 1400 - (Date.now() - started));
      later(() => {
        setPanelFx('deny');
        setView('fail');
        later(() => setPanelFx(''), 900);
      }, wait);
    }
  };

  return (
    <div className="vfy-wrap">
      <canvas ref={fxRef} className="vfy-fx" />
      <div ref={headRef} className="vfy-head">
        <h1>Download Offer Letter</h1>
        <p>Enter the email address and application ID from your selection email to view and download your official NOXIRA offer letter.</p>
      </div>

      <div
        ref={panelRef}
        className={`vfy-panel ${panelFx}`}
      >
        {(view === 'form' || view === 'fail') && (
          <form onSubmit={lookup}>
            <div className="vfy-formrow">
              <div className="vfy-inwrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  className="vfy-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aditya@example.com"
                  aria-label="Email address"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="vfy-formrow" style={{ marginTop: 10 }}>
              <div className="vfy-inwrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  className="vfy-input"
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="Application ID (e.g. NOX-2026-FSD-1001)"
                  aria-label="Application ID"
                  autoCapitalize="characters"
                />
              </div>
              <button className="vfy-btn" type="submit" disabled={!email.trim() || !appId.trim()}>
                View Letter
              </button>
            </div>
            {view === 'fail' && (
              <div className="vfy-fail-strip" role="alert">{FAIL_TEXT}</div>
            )}
          </form>
        )}

        {view === 'busy' && (
          <div>
            <div className="vfy-orbwrap">
              <div className="pulse" />
              <div className="pulse p2" />
              <div className="core" />
              <div className="vfy-orbit"><i /><i /><i /></div>
            </div>
            <div className="vfy-busy-text">Checking the registry<span className="vfy-busy-dots" /></div>
          </div>
        )}

        {view === 'ok' && (
          <div className="vfy-pop">
            <div className="vfy-badgewrap">
              <svg className="vfy-badge ok" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="38" />
                <path d="M27 43 L38 54 L58 32" />
              </svg>
            </div>
            <div className="vfy-result-title vfy-ok-title">Offer Letter Found</div>
            <div className="vfy-result-sub">Issued by NOXIRA Technologies</div>
          </div>
        )}

        {view === 'stage' && offer && (
          <div className="vfy-stage">
            <div className="vfy-entrance">
              <div className="vfy-flip">
                <div className="vfy-flip-inner">
                  <div className="vfy-face front">
                    {pdfImg ? <img src={pdfImg} alt="NOXIRA Offer Letter" /> : <OfferLetterFront offer={offer} />}
                    <div className="vfy-sweep" />
                  </div>
                  <div className="vfy-face back">
                    <div className="vfy-frame-outer" />
                    <div className="vfy-frame-inner" />
                    <div className="vfy-corner tl" />
                    <div className="vfy-corner br" />
                    <img className="vfy-back-logo" src="/noxira-wordmark.png" alt="NOXIRA logo" />
                    <div className="vfy-back-name">NOXIRA TECHNOLOGIES</div>
                    <div className="vfy-back-divider" />
                    <div className="vfy-back-sub">Official Offer Letter</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="vfy-bloom" />
            <div className="vfy-vstrip">
              <span className="pill">STATUS: ISSUED</span>
              <span className="who">{offer.recipientName}</span>
              <span className="prog">{offer.programTitle}</span>
              <span className="cid">{offer.applicationId}</span>
            </div>
            <div className="vfy-actions">
              <a
                className="vfy-dl"
                href={offerPdfUrl(offer.email, offer.applicationId)}
                download={`NOXIRA-Offer-Letter-${offer.applicationId}.pdf`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="M7 11l5 5 5-5" />
                  <path d="M4 21h16" />
                </svg>
                Download
              </a>
              <button className="vfy-close" type="button" onClick={reset} aria-label="Verify another offer letter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="vfy-notice">
        Offer letters are issued only to selected candidates after review. Lookup requires the exact email address and application ID from your selection email.
      </div>
    </div>
  );
}
