import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { api } from '../services/api';
import { INTERNSHIP_EMAIL } from '../config/supportContact';
import './verify.css';

if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const MIN_BUSY_MS = 1900;
const CONFETTI_COLORS = ['#38c8ff', '#0a8fd6', '#10b981', '#34d399', '#67e8f9', '#059669'];

// Module-level confetti engine (single canvas per page)
const fxState = { parts: [], running: false };

function fitFx(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function fxTick(canvas) {
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
  for (let i = 0; i < 85; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 7.5;
    fxState.parts.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 2.5,
      s: 2.5 + Math.random() * 4.5,
      c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
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

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Render page 1 of the issued certificate PDF (the exact admin-set design frozen at
// issuance) to an image for the flip card's front face.
async function renderCertificateFront(certNumber) {
  const url = `/api/v1/public/verify/${encodeURIComponent(certNumber)}/pdf`;
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

function CertificateFront({ cert }) {
  const name = cert.recipientName || '';
  const nameClass = name.length > 36 ? 'vc-name xlong' : name.length > 24 ? 'vc-name long' : 'vc-name';
  const start = formatDate(cert.startDate);
  const end = formatDate(cert.endDate);
  const dateText = start && end ? (start === end ? `Conducted on ${end}` : `Program Duration: ${start} to ${end}`) : (end || start);
  return (
    <div className="vc">
      <div className="vc-outer" />
      <div className="vc-inner" />
      <div className="vc-badge">NOXIRA TECHNOLOGIES</div>
      <div className="vc-head">CERTIFICATE OF ACHIEVEMENT</div>
      <div className="vc-rule" />
      <div className="vc-present">This is proudly presented to</div>
      <div className={nameClass}>{name}</div>
      <div className="vc-nameline" />
      <div className="vc-comp">for successfully completing the rigorous curriculum and technical requirements of</div>
      <div className="vc-prog">{cert.programTitle}</div>
      {dateText && <div className="vc-dates">{dateText}</div>}
      <div className="vc-id">
        <b>Certificate ID: {cert.certificateNumber}</b>
        <br />
        <span>Issued On: {formatDate(cert.issueDate)}</span>
      </div>
      {(cert.signatoryName || cert.signatoryTitle) && (
        <div className="vc-sign">
          <div className="line" />
          <b>{cert.signatoryName}</b>
          <span>{cert.signatoryTitle}</span>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  const { token: routeToken } = useParams();
  const [input, setInput] = useState(routeToken || '');
  const [view, setView] = useState('form'); // form | busy | ok | fail | stage
  const [cert, setCert] = useState(null);
  const [fail, setFail] = useState({ title: '', sub: '', replacement: null });
  const [pdfImg, setPdfImg] = useState(null); // rendered issued-PDF front (admin-set design)
  const [panelFx, setPanelFx] = useState(''); // '' | 'busy' | 'ripple' | 'deny'
  const [okFading, setOkFading] = useState(false);

  const panelRef = useRef(null);
  const headRef = useRef(null);
  const badgeRef = useRef(null);
  const fxRef = useRef(null);
  const timersRef = useRef([]);
  const pendingMorph = useRef(null);
  const autoFired = useRef(false);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const canvas = fxRef.current;
    if (canvas) fitFx(canvas);
    const onResize = () => { if (fxRef.current) fitFx(fxRef.current); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      fxState.parts = [];
    };
  }, []);

  const morphToStage = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    pendingMorph.current = { w0: panel.offsetWidth, h0: panel.offsetHeight };
    setView('stage');
  }, []);

  // FLIP panel morph (560px -> 920px) once the certificate stage renders
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
    const cardH = Math.max(180, Math.min(509, availH));
    panel.style.setProperty('--cardw', `${Math.min(720, Math.round((cardH * 2000) / 1414))}px`);

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

  const showDeny = useCallback((title, sub, replacement = null) => {
    setPanelFx('deny');
    setFail({ title, sub, replacement });
    setView('fail');
    later(() => setPanelFx(''), 900);
  }, [later]);

  const verify = useCallback(async (raw) => {
    const id = (raw ?? input).trim();
    if (!id) return;
    setCert(null);
    setOkFading(false);
    setPdfImg(null);
    setView('busy');
    setPanelFx('busy');
    const started = Date.now();
    const settle = (fn) => {
      const wait = Math.max(0, MIN_BUSY_MS - (Date.now() - started));
      later(() => { setPanelFx(''); fn(); }, wait);
    };
    try {
      const data = await api.verifyToken(id);
      settle(() => {
        if (data.verified && data.status === 'VALID') {
          setCert(data);
          setView('ok');
          setPanelFx('ripple');
          if (data.pdfAvailable) {
            renderCertificateFront(data.certificateNumber)
              .then((img) => { if (img) setPdfImg(img); })
              .catch((e) => { console.warn('Certificate PDF render failed, using vector fallback:', e); });
          }
          later(() => {
            const b = badgeRef.current?.getBoundingClientRect();
            if (b && fxRef.current) burst(fxRef.current, b.left + b.width / 2, b.top + b.height / 2);
          }, 430);
          later(() => setPanelFx(''), 900);
          later(() => setOkFading(true), 1400);
          later(morphToStage, 1750);
        } else if (data.status === 'REVOKED') {
          showDeny(
            'Certificate Revoked',
            data.revocationReason
              ? `This certificate was revoked: ${data.revocationReason}`
              : 'This certificate has been revoked and is no longer valid.'
          );
        } else if (data.status === 'REPLACED') {
          showDeny(
            'Certificate Replaced',
            `This certificate has been superseded by a newer version${data.replacement?.certificateNumber ? ` (${data.replacement.certificateNumber})` : ''}.`,
            data.replacement || null
          );
        } else {
          showDeny('Invalid or Unverified Certificate', 'Certificate not found or invalid token. Check the ID and try again.');
        }
      });
    } catch (err) {
      settle(() => {
        if (err.status === 404 || err.status === 400) {
          showDeny('Invalid or Unverified Certificate', 'Certificate not found or invalid token. Check the ID and try again.');
        } else {
          showDeny('Verification Unavailable', 'The registry could not be reached. Check your connection and try again.');
        }
      });
    }
  }, [input, later, morphToStage, showDeny]);

  // Auto-verify when landing on /verify/:token (e.g. QR scan from the PDF)
  useEffect(() => {
    if (routeToken && !autoFired.current) {
      autoFired.current = true;
      setInput(routeToken);
      verify(routeToken);
    }
  }, [routeToken, verify]);

  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    fxState.parts = [];
    setView('form');
    setCert(null);
    setPdfImg(null);
    setPanelFx('');
    setOkFading(false);
    setInput('');
  };

  return (
    <div className="vfy">
      <div className="vfy-glow g1" />
      <div className="vfy-glow g2" />
      <canvas className="vfy-fx" ref={fxRef} />

      <div className="vfy-head" ref={headRef}>
        <h1>Certificate Verification</h1>
        <p className="vfy-lede">
          Verify the authentic issuance and current validity status of any NOXIRA certificate directly in the official registry.
        </p>
      </div>

      <div className={`vfy-panel ${panelFx}`} ref={panelRef}>
        {view === 'form' && (
          <form
            className="vfy-formrow"
            onSubmit={(e) => { e.preventDefault(); verify(); }}
          >
            <div className="vfy-inwrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.8-3.8" />
              </svg>
              <input
                className="vfy-input"
                type="text"
                placeholder="Enter Certificate ID (e.g. NOX-2027-0101)"
                autoComplete="off"
                spellCheck="false"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Certificate ID or verification token"
              />
            </div>
            <button className="vfy-btn" type="submit">Verify</button>
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
            <div className="vfy-busy-text">Verifying against the registry<span className="vfy-busy-dots" /></div>
          </div>
        )}

        {view === 'ok' && (
          <div className={`vfy-pop ${okFading ? 'vfy-fadeout' : ''}`}>
            <div className="vfy-badgewrap" ref={badgeRef}>
              <div className="vfy-shock" />
              <div className="vfy-shock s2" />
              <svg className="vfy-badge ok" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="38" />
                <path d="M27 43 L38 54 L58 32" />
              </svg>
            </div>
            <div className="vfy-result-title vfy-ok-title">Officially Verified &amp; Authentic</div>
            <div className="vfy-result-sub">Issued by NOXIRA Technologies - record status: VALID</div>
          </div>
        )}

        {view === 'fail' && (
          <div>
            <div className="vfy-badgewrap">
              <svg className="vfy-badge fail" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="38" />
                <path d="M31 31 L53 53" />
                <path d="M53 31 L31 53" />
              </svg>
            </div>
            <div className="vfy-result-title vfy-fail-title">{fail.title}</div>
            <div className="vfy-result-sub">{fail.sub}</div>
            {fail.replacement?.publicVerificationToken && (
              <Link className="vfy-repl" to={`/verify/${fail.replacement.publicVerificationToken}`} onClick={() => { autoFired.current = false; reset(); }}>
                Verify the replacement certificate
              </Link>
            )}
            <button className="vfy-btn vfy-btn-block" type="button" onClick={reset}>Try Again</button>
          </div>
        )}

        {view === 'stage' && cert && (
          <div className="vfy-stage">
            <div className="vfy-entrance">
              <div className="vfy-flip">
                <div className="vfy-flip-inner">
                  <div className="vfy-face front">
                    {pdfImg ? <img src={pdfImg} alt="NOXIRA Certificate" /> : <CertificateFront cert={cert} />}
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
                    <div className="vfy-back-sub">Verified Certificate</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="vfy-bloom" />
            <div className="vfy-vstrip">
              <span className="pill">STATUS: VALID</span>
              <span className="who">{cert.recipientName}</span>
              <span className="prog">{cert.programTitle}</span>
              <span className="cid">{cert.certificateNumber}</span>
            </div>
            <div className="vfy-actions">
              <a
                className="vfy-dl"
                href={`/api/v1/public/verify/${encodeURIComponent(cert.certificateNumber)}/pdf`}
                download={`NOXIRA-Certificate-${cert.certificateNumber}.pdf`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="M7 11l5 5 5-5" />
                  <path d="M4 21h16" />
                </svg>
                Download
              </a>
              <button className="vfy-close" type="button" onClick={reset} aria-label="Verify another certificate">
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
        This registry check confirms that the certificate record exists and verifies its current status (VALID, REVOKED, or REPLACED). Zero personally identifiable information is exposed publicly on this portal.
      </div>
      <p className="vfy-help">Need help? Email <a href={`mailto:${INTERNSHIP_EMAIL}`}>{INTERNSHIP_EMAIL}</a></p>
    </div>
  );
}
