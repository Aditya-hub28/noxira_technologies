const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const OfferLetter = require('../models/OfferLetter');

/**
 * Public streaming download for offer letter PDF using 72-hour signed bearer token.
 * Expired token -> 410 Gone
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
        return res.status(410).json({
          success: false,
          error: 'LINK_EXPIRED',
          message: 'This offer letter download link has expired (links are valid for 72 hours). Please contact admissions for a refreshed link.'
        });
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
      return res.status(410).json({
        success: false,
        error: 'LINK_EXPIRED',
        message: 'This offer letter download link has expired. Please contact admissions for a refreshed link.'
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
