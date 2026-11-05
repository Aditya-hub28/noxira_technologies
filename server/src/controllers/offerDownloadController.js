const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const OfferLetter = require('../models/OfferLetter');
const Application = require('../models/Application');

function renderExpiredRecoveryHtml(appId) {
  const safeAppId = appId ? String(appId).replace(/[^a-zA-Z0-9_-]/g, '') : '';
  const statusLink = safeAppId ? `/status?id=${encodeURIComponent(safeAppId)}` : '/status';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Letter Link Expired · NOXIRA Technologies</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 2.5rem 2rem;
      max-width: 28rem;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .icon {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 9999px;
      background-color: #fff1f2;
      color: #e11d48;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem auto;
      font-size: 1.75rem;
      font-weight: bold;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 800;
      margin: 0 0 0.5rem 0;
      color: #0f172a;
    }
    p {
      font-size: 0.875rem;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 1.5rem 0;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 0.75rem 1rem;
      background-color: #0f172a;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
      border-radius: 0.5rem;
      transition: background-color 0.15s ease;
      box-sizing: border-box;
      margin-bottom: 0.75rem;
    }
    .btn:hover {
      background-color: #1e293b;
    }
    .btn-secondary {
      background-color: #f1f5f9;
      color: #334155;
    }
    .btn-secondary:hover {
      background-color: #e2e8f0;
    }
    .footer {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#9888;</div>
    <h1>Offer Letter Link Expired</h1>
    <p>This secure download link was valid for 72 hours and has expired. For data security, offer letters require an active authenticated link.</p>
    <a href="${statusLink}" class="btn">Check Application Status &amp; Request Link</a>
    <a href="/" class="btn btn-secondary">Return to NOXIRA Home</a>
    <div class="footer">NOXIRA Admissions · Academic &amp; Engineering Registry</div>
  </div>
</body>
</html>`;
}

function sendExpiredResponse(req, res, appId) {
  // Content negotiation: HTML page for browsers, JSON for API/curl clients
  const acceptHeader = (req.headers && (req.headers['accept'] || req.headers['Accept'])) || '';
  const prefersHtml = (req.accepts ? (req.accepts('html') && !req.accepts('json')) : acceptHeader.includes('text/html'));
  if (prefersHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (res.type) res.type('html');
    return res.status(410).send(renderExpiredRecoveryHtml(appId));
  }
  return res.status(410).json({
    success: false,
    error: 'LINK_EXPIRED',
    message: 'This offer letter download link has expired (links are valid for 72 hours). Please contact admissions for a refreshed link.'
  });
}

/**
 * Public streaming download for offer letter PDF using 72-hour signed bearer token.
 * Expired token -> 410 Gone (HTML page or JSON)
 * Tampered / revoked / unknown token -> 404 Not Found
 */
exports.downloadOfferLetter = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid download token provided.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const unverified = jwt.decode(token);
        return sendExpiredResponse(req, res, unverified?.appId);
      }
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found or link is invalid.'
      });
    }

    if (!decoded || decoded.purpose !== 'OFFER_DOWNLOAD' || !decoded.sub || !decoded.jti) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found or link is invalid.'
      });
    }

    const offer = await OfferLetter.findById(decoded.sub);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found.'
      });
    }

    // Check if token JTI matches current valid token and hasn't been revoked
    if (offer.downloadToken !== decoded.jti || offer.downloadTokenRevokedAt) {
      return res.status(404).json({
        success: false,
        message: 'This download link has been revoked or replaced by a new link.'
      });
    }

    // Check expiry timestamp
    if (offer.downloadTokenExpiresAt && new Date() > new Date(offer.downloadTokenExpiresAt)) {
      return sendExpiredResponse(req, res, offer.applicationId);
    }

    // Re-check application state: must be APPROVED
    const application = await Application.findOne({ applicationId: offer.applicationId });
    if (!application || application.status !== 'APPROVED') {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found.'
      });
    }

    // Re-check offer generationStatus: must be GENERATED
    if (offer.generationStatus !== 'GENERATED') {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found.'
      });
    }

    if (!fs.existsSync(offer.pdfPath)) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter document file is unavailable.'
      });
    }

    const stat = fs.statSync(offer.pdfPath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="NOXIRA-Offer-${offer.applicationId}.pdf"`,
      'Content-Length': stat.size,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    });

    const fileStream = fs.createReadStream(offer.pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

exports.renderExpiredRecoveryHtml = renderExpiredRecoveryHtml;
