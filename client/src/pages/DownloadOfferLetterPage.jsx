import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { api } from '../services/api';
import './verify.css';

if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const FAIL_TEXT = "No offer letter found for these details. If you haven't applied yet, please apply for a program first.";

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

export default function DownloadOfferLetterPage() {
  const [email, setEmail] = useState('');
  const [appId, setAppId] = useState('');
  const [view, setView] = useState('form'); // form | busy | ok | stage | fail
  const [offer, setOffer] = useState(null);
  const [pdfImg, setPdfImg] = useState(null);
  const timersRef = useRef([]);
  const later = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)); };

  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setView('form');
    setOffer(null);
    setPdfImg(null);
  };

  const lookup = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    const cleanId = appId.trim();
    if (!cleanEmail || !cleanId) return;
    reset();
    setView('busy');
    const started = Date.now();
    try {
      const data = await api.lookupOfferLetter(cleanEmail, cleanId);
      const wait = Math.max(0, 1400 - (Date.now() - started));
      later(() => {
        setOffer({ ...data.offerLetter, email: cleanEmail });
        setView('ok');
        renderOfferFront(offerPdfUrl(cleanEmail, data.offerLetter.applicationId))
          .then((img) => { if (img) setPdfImg(img); })
          .catch(() => {});
        later(() => setView('stage'), 1500);
      }, wait);
    } catch (err) {
      const wait = Math.max(0, 1400 - (Date.now() - started));
      later(() => setView('fail'), wait);
    }
  };

  return (
    <div className="vfy-wrap">
      <canvas className="vfy-fx" />
      <div className="vfy-head">
        <h1>Download Offer Letter</h1>
        <p>Enter the email address and application ID from your selection email to view and download your official NOXIRA offer letter.</p>
      </div>

      <div className={`vfy-panel ${view === 'busy' ? 'busy' : ''}`}>
        {(view === 'form' || view === 'fail') && (
          <form onSubmit={lookup}>
            <div className="vfy-formrow">
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
            <div className="vfy-formrow" style={{ marginTop: 10 }}>
              <input
                className="vfy-input"
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Application ID (e.g. NOX-K7M2QP)"
                aria-label="Application ID"
                autoCapitalize="characters"
              />
              <button className="vfy-btn" type="submit" disabled={!email.trim() || !appId.trim()}>View Letter</button>
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
              <div className="vfy-face front" style={{ position: 'relative', overflow: 'hidden', borderRadius: 18 }}>
                {pdfImg
                  ? <img src={pdfImg} alt="NOXIRA Offer Letter" style={{ display: 'block', width: '100%', height: 'auto' }} />
                  : <div className="vfy-busy-text">Loading your offer letter<span className="vfy-busy-dots" /></div>}
              </div>
            </div>
            <div className="vfy-bloom" />
            <div className="vfy-vstrip">
              <span className="pill">OFFER ISSUED</span>
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
                Download Offer Letter
              </a>
              <button className="vfy-close" type="button" onClick={reset} aria-label="Look up another offer letter">
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
