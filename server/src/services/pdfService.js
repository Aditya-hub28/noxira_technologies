const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const { generateVerificationQRCodeBuffer } = require('./qrService');

/**
 * Formats a date into "DD Month YYYY"
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Converts Hex string '#RRGGBB' to pdf-lib rgb()
 */
function hexToPdfRgb(hex, fallback = rgb(15 / 255, 23 / 255, 42 / 255)) {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return fallback;
}

/**
 * Calculates adaptive font size so long names never overflow their bounding width
 */
function calculateAdaptiveFontSize(text, font, initialFontSize, maxAllowedWidth, minFontSize = 14) {
  let currentSize = initialFontSize;
  while (currentSize > minFontSize) {
    const textWidth = font.widthOfTextAtSize(text, currentSize);
    if (textWidth <= maxAllowedWidth) {
      return currentSize;
    }
    currentSize -= 1;
  }
  return minFontSize;
}


// ---------------------------------------------------------------------------
// NOXIRA certificate template (v2, approved 28 Nov 2026)
// A blank vector PDF (frame, logo, title, paragraph, signature, labels) is used
// as the page. Only the website-controlled fields are drawn on top, in the
// empty placeholder areas: name, course, timeline, date of issue, QR, certificate ID.
// Coordinates come from the 1123x794 CSS-pixel design; PX converts them to points.
// ---------------------------------------------------------------------------
const TEMPLATE_DIR = path.resolve(__dirname, '../assets/certificate');
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const PX = PAGE_W / 1123;
const CERT_FIELDS = {
  name: { centerX: 561.5, baselineY: 360, size: 41, maxWidth: 650, minSize: 22, color: [11, 27, 63] },
  course: { centerX: 561.5, baselineY: 454, size: 18.5, maxWidth: 700, minSize: 11, color: [28, 37, 64] },
  timeline: { centerX: 561.5, baselineY: 541.5, size: 17, maxWidth: 500, minSize: 11, color: [28, 37, 64] },
  issue: { centerX: 561, baselineY: 641.5, size: 17, maxWidth: 250, minSize: 11, color: [11, 27, 63] },
  certId: { centerX: 893, baselineY: 690.5, size: 12.5, maxWidth: 200, minSize: 8, color: [11, 27, 63], spacing: 0.06 },
  qr: { x: 837, y: 536, size: 112 }
};

function px(v) { return v * PX; }
function pyBaseline(v) { return PAGE_H - v * PX; }

function fitSize(text, font, size, maxWidth, minSize) {
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(text, s * PX) > maxWidth * PX) s -= 0.5;
  return s;
}

function drawCentered(page, text, font, field) {
  const size = fitSize(text, font, field.size, field.maxWidth, field.minSize);
  const pt = size * PX;
  const spacing = (field.spacing || 0) * pt;
  const width = font.widthOfTextAtSize(text, pt) + spacing * Math.max(text.length - 1, 0);
  const color = rgb(field.color[0] / 255, field.color[1] / 255, field.color[2] / 255);
  let x = px(field.centerX) - width / 2;
  const y = pyBaseline(field.baselineY);
  if (!spacing) {
    page.drawText(text, { x, y, size: pt, font, color });
    return;
  }
  for (const ch of text) {
    page.drawText(ch, { x, y, size: pt, font, color });
    x += font.widthOfTextAtSize(ch, pt) + spacing;
  }
}

async function generateNoxiraTemplateCertificate({
  recipientName,
  programTitle,
  startDate,
  endDate,
  issueDate,
  certificateNumber,
  publicVerificationToken,
  isDraft = false
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [templatePage] = await pdfDoc.embedPdf(fs.readFileSync(path.join(TEMPLATE_DIR, 'noxira-certificate-template.pdf')));
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  page.drawPage(templatePage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const fontsDir = path.join(TEMPLATE_DIR, 'fonts');
  const fName = await pdfDoc.embedFont(fs.readFileSync(path.join(fontsDir, 'playfair-display-latin-700-normal.woff')), { subset: true });
  const fBody = await pdfDoc.embedFont(fs.readFileSync(path.join(fontsDir, 'lora-latin-700-normal.woff')), { subset: true });
  const fLabel = await pdfDoc.embedFont(fs.readFileSync(path.join(fontsDir, 'montserrat-latin-700-normal.woff')), { subset: true });

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  const timeline = startStr === endStr ? `Conducted on ${endStr}` : `${startStr} to ${endStr}`;

  drawCentered(page, recipientName, fName, CERT_FIELDS.name);
  drawCentered(page, programTitle, fBody, CERT_FIELDS.course);
  drawCentered(page, timeline, fBody, CERT_FIELDS.timeline);
  drawCentered(page, formatDate(issueDate || new Date()), fBody, CERT_FIELDS.issue);
  drawCentered(page, String(certificateNumber), fLabel, CERT_FIELDS.certId);

  const qrImage = await pdfDoc.embedPng(await generateVerificationQRCodeBuffer(publicVerificationToken));
  const q = CERT_FIELDS.qr;
  page.drawImage(qrImage, { x: px(q.x), y: PAGE_H - px(q.y + q.size), width: px(q.size), height: px(q.size) });

  if (isDraft) {
    const draftText = 'DRAFT - NOT ISSUED';
    const draftSize = 54;
    page.drawText(draftText, {
      x: (PAGE_W - fLabel.widthOfTextAtSize(draftText, draftSize)) / 2 + 40,
      y: PAGE_H / 2 - 60,
      size: draftSize,
      font: fLabel,
      color: rgb(239 / 255, 68 / 255, 68 / 255),
      opacity: 0.22,
      rotate: degrees(28)
    });
  }
  return Buffer.from(await pdfDoc.save());
}

/**
 * Renders a print-ready vector PDF certificate using pdf-lib
 * Supports custom background image overlays (Canva / Figma templates)
 */
async function generateCertificatePdf({
  recipientName,
  programTitle,
  startDate,
  endDate,
  issueDate,
  certificateNumber,
  publicVerificationToken,
  signatoryName = 'Aditya Jha',
  signatoryTitle = 'Managing Director & Lead Architect',
  isDraft = false,
  customBackgroundBuffer = null,
  backgroundImagePath = null,
  customLayout = null
}) {
  // No custom uploaded background: use the approved NOXIRA template (v2).
  const hasUploadedBg = Boolean(customBackgroundBuffer) || Boolean(backgroundImagePath && fs.existsSync(backgroundImagePath));
  if (!hasUploadedBg) {
    return generateNoxiraTemplateCertificate({
      recipientName, programTitle, startDate, endDate, issueDate,
      certificateNumber, publicVerificationToken, isDraft
    });
  }

  // A4 Landscape dimensions in points
  const width = 841.89;
  const height = 595.28;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  // Load standard fonts
  const fontTitle = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBodyBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Palette
  const cNavy = rgb(15 / 255, 23 / 255, 42 / 255);
  const cGold = rgb(217 / 255, 119 / 255, 6 / 255);
  const cSlate = rgb(51 / 255, 65 / 255, 85 / 255);

  let hasCustomBg = false;

  // 1. Check for custom background image (from Canva/Figma upload)
  let bgBuf = customBackgroundBuffer;
  if (!bgBuf && backgroundImagePath && fs.existsSync(backgroundImagePath)) {
    try {
      bgBuf = fs.readFileSync(backgroundImagePath);
    } catch (err) {
      console.warn('Could not read background image from disk:', err.message);
    }
  }

  if (bgBuf) {
    try {
      let bgImage;
      try {
        bgImage = await pdfDoc.embedPng(bgBuf);
      } catch (e) {
        bgImage = await pdfDoc.embedJpg(bgBuf);
      }
      page.drawImage(bgImage, { x: 0, y: 0, width, height });
      hasCustomBg = true;
    } catch (embedErr) {
      console.warn('Failed to embed custom background image, falling back to vector borders:', embedErr.message);
    }
  }

  // 2. If NO custom background image, draw luxury vector borders & headers
  if (!hasCustomBg) {
    // Fill white
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

    // Outer border
    const marginOuter = 20;
    page.drawRectangle({
      x: marginOuter,
      y: marginOuter,
      width: width - marginOuter * 2,
      height: height - marginOuter * 2,
      borderColor: cNavy,
      borderWidth: 3
    });

    // Inner gold border
    const marginInner = 28;
    page.drawRectangle({
      x: marginInner,
      y: marginInner,
      width: width - marginInner * 2,
      height: height - marginInner * 2,
      borderColor: cGold,
      borderWidth: 1.2
    });

    // Header badge
    page.drawRectangle({
      x: width / 2 - 160,
      y: height - 60,
      width: 320,
      height: 32,
      color: rgb(254 / 255, 243 / 255, 199 / 255),
      borderColor: cGold,
      borderWidth: 1
    });

    const orgName = 'NOXIRA TECHNOLOGIES';
    const orgWidth = fontBodyBold.widthOfTextAtSize(orgName, 14);
    page.drawText(orgName, {
      x: (width - orgWidth) / 2,
      y: height - 49,
      size: 14,
      font: fontBodyBold,
      color: cGold
    });

    const certHead = 'CERTIFICATE OF ACHIEVEMENT';
    const certHeadWidth = fontTitle.widthOfTextAtSize(certHead, 28);
    page.drawText(certHead, {
      x: (width - certHeadWidth) / 2,
      y: height - 105,
      size: 28,
      font: fontTitle,
      color: cNavy
    });

    page.drawLine({
      start: { x: width / 2 - 120, y: height - 118 },
      end: { x: width / 2 + 120, y: height - 118 },
      thickness: 1.5,
      color: cGold
    });

    const presentText = 'This is proudly presented to';
    const presentWidth = fontItalic.widthOfTextAtSize(presentText, 14);
    page.drawText(presentText, {
      x: (width - presentWidth) / 2,
      y: height - 148,
      size: 14,
      font: fontItalic,
      color: cSlate
    });
  }

  // 3. Dynamic Recipient Name
  const nameY = customLayout?.name?.y || (height - 200);
  const nameColor = hexToPdfRgb(customLayout?.name?.color, cNavy);
  const initialNameSize = customLayout?.name?.fontSize || 34;
  const maxNameWidth = 620;
  const adaptiveSize = calculateAdaptiveFontSize(recipientName, fontTitle, initialNameSize, maxNameWidth, 16);
  const nameWidth = fontTitle.widthOfTextAtSize(recipientName, adaptiveSize);

  page.drawText(recipientName, {
    x: (width - nameWidth) / 2,
    y: nameY,
    size: adaptiveSize,
    font: fontTitle,
    color: nameColor
  });

  if (!hasCustomBg) {
    page.drawLine({
      start: { x: (width - nameWidth) / 2 - 15, y: nameY - 10 },
      end: { x: (width + nameWidth) / 2 + 15, y: nameY - 10 },
      thickness: 1,
      color: cGold
    });

    const completionText = 'for successfully completing the rigorous curriculum and technical requirements of';
    const compWidth = fontBody.widthOfTextAtSize(completionText, 12);
    page.drawText(completionText, {
      x: (width - compWidth) / 2,
      y: nameY - 40,
      size: 12,
      font: fontBody,
      color: cSlate
    });
  }

  // 4. Dynamic Program Title
  const progY = customLayout?.program?.y || (hasCustomBg ? nameY - 60 : height - 275);
  const progColor = hexToPdfRgb(customLayout?.program?.color, cGold);
  const progBaseSize = customLayout?.program?.fontSize || 20;
  const progSize = calculateAdaptiveFontSize(programTitle, fontBodyBold, progBaseSize, 600, 14);
  const progWidth = fontBodyBold.widthOfTextAtSize(programTitle, progSize);

  page.drawText(programTitle, {
    x: (width - progWidth) / 2,
    y: progY,
    size: progSize,
    font: fontBodyBold,
    color: progColor
  });

  // 5. Dates
  const dateY = customLayout?.date?.y || (progY - 33);
  const dateColor = hexToPdfRgb(customLayout?.date?.color, cSlate);
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  const dateText = startStr === endStr ? `Conducted on ${endStr}` : `Program Duration: ${startStr} to ${endStr}`;
  const dateTextWidth = fontBody.widthOfTextAtSize(dateText, 11);

  page.drawText(dateText, {
    x: (width - dateTextWidth) / 2,
    y: dateY,
    size: 11,
    font: fontBody,
    color: dateColor
  });

  // 6. Certificate ID & Issue Date
  const certIdX = customLayout?.certId?.x || 60;
  const certIdY = customLayout?.certId?.y || 110;
  const certIdColor = hexToPdfRgb(customLayout?.certId?.color, cNavy);

  page.drawText(`Certificate ID: ${certificateNumber}`, {
    x: certIdX,
    y: certIdY,
    size: 10,
    font: fontBodyBold,
    color: certIdColor
  });

  page.drawText(`Issued On: ${formatDate(issueDate || new Date())}`, {
    x: certIdX,
    y: certIdY - 18,
    size: 9.5,
    font: fontBody,
    color: cSlate
  });

  // 7. Verification QR Code
  const qrSize = customLayout?.qr?.size || 78;
  const qrX = customLayout?.qr?.x || (width / 2 - qrSize / 2);
  const qrY = customLayout?.qr?.y || 55;

  const qrPngBuffer = await generateVerificationQRCodeBuffer(publicVerificationToken);
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);

  page.drawRectangle({
    x: qrX - 4,
    y: qrY - 4,
    width: qrSize + 8,
    height: qrSize + 8,
    color: rgb(1, 1, 1),
    borderColor: cGold,
    borderWidth: 1
  });

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize
  });

  const qrCaption = 'VERIFY CREDENTIAL';
  const capWidth = fontBodyBold.widthOfTextAtSize(qrCaption, 7.5);
  page.drawText(qrCaption, {
    x: qrX + (qrSize - capWidth) / 2,
    y: qrY - 12,
    size: 7.5,
    font: fontBodyBold,
    color: cNavy
  });

  // 8. Signatory
  const signX = customLayout?.signatory?.x || (width - 240);
  const signY = customLayout?.signatory?.y || 90;

  page.drawLine({
    start: { x: signX, y: signY + 15 },
    end: { x: signX + 180, y: signY + 15 },
    thickness: 1.2,
    color: cNavy
  });

  page.drawText(signatoryName, {
    x: signX,
    y: signY,
    size: 11,
    font: fontBodyBold,
    color: cNavy
  });

  page.drawText(signatoryTitle, {
    x: signX,
    y: signY - 14,
    size: 9,
    font: fontBody,
    color: cSlate
  });

  // 9. Watermark if DRAFT preview
  if (isDraft) {
    const draftText = 'DRAFT - NOT ISSUED';
    const draftSize = 54;
    const draftWidth = fontTitle.widthOfTextAtSize(draftText, draftSize);
    
    page.drawText(draftText, {
      x: (width - draftWidth) / 2,
      y: height / 2 - 20,
      size: draftSize,
      font: fontTitle,
      color: rgb(239 / 255, 68 / 255, 68 / 255),
      opacity: 0.22,
      rotate: degrees(28)
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generateCertificatePdf,
  calculateAdaptiveFontSize
};
