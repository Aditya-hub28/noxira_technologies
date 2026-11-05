const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');

const REGULAR_FONT_PATH = path.resolve(__dirname, '../assets/fonts/NoxiraUnicode-Regular.ttf');
const BOLD_FONT_PATH = path.resolve(__dirname, '../assets/fonts/NoxiraUnicode-Bold.ttf');

let cachedParsedRegular = null;
let cachedParsedBold = null;

function getParsedFontkitFonts() {
  if (!cachedParsedRegular && fs.existsSync(REGULAR_FONT_PATH)) {
    try {
      cachedParsedRegular = fontkit.create(fs.readFileSync(REGULAR_FONT_PATH));
    } catch (e) {
      console.error('Failed to load parsed regular fontkit font:', e.message);
    }
  }
  if (!cachedParsedBold && fs.existsSync(BOLD_FONT_PATH)) {
    try {
      cachedParsedBold = fontkit.create(fs.readFileSync(BOLD_FONT_PATH));
    } catch (e) {
      console.error('Failed to load parsed bold fontkit font:', e.message);
    }
  }
  return { regular: cachedParsedRegular, bold: cachedParsedBold };
}

/**
 * Validates that every character in the string can be rendered by the target font.
 * Throws an actionable error specifying field name and unsupported character if missing.
 */
function validateGlyphsForFont(text, fieldLabel, parsedFont) {
  if (!text || !parsedFont) return;
  for (const char of text) {
    const cp = char.codePointAt(0);
    // Ignore ASCII whitespace & control chars
    if (cp <= 32 || cp === 127) continue;
    if (!parsedFont.hasGlyphForCodePoint(cp)) {
      throw new Error(`Field "${fieldLabel}" contains unsupported character '${char}' (U+${cp.toString(16).toUpperCase().padStart(4, '0')}). Please provide standard Latin or Indian script characters.`);
    }
  }
}

const DEFAULT_SAMPLE_FIELDS = [
  {
    id: 'issueDate',
    label: 'Issue Date',
    page: 1,
    x: 72,
    y: 155,
    fontSize: 10,
    fontColor: '#475569',
    alignment: 'left',
    maxWidth: 160,
    isRequired: true
  },
  {
    id: 'applicationId',
    label: 'Application ID',
    page: 1,
    x: 360,
    y: 155,
    fontSize: 11,
    fontColor: '#0f172a',
    alignment: 'right',
    maxWidth: 160,
    isRequired: true
  },
  {
    id: 'studentName',
    label: 'Candidate Legal Name',
    page: 1,
    x: 72,
    y: 230,
    fontSize: 14,
    fontColor: '#0f172a',
    alignment: 'left',
    maxWidth: 450,
    isRequired: true
  },
  {
    id: 'programTitle',
    label: 'Programme Title',
    page: 1,
    x: 72,
    y: 310,
    fontSize: 13,
    fontColor: '#0f172a',
    alignment: 'left',
    maxWidth: 450,
    isRequired: true
  },
  {
    id: 'batchId',
    label: 'Cohort Batch',
    page: 1,
    x: 72,
    y: 345,
    fontSize: 11,
    fontColor: '#334155',
    alignment: 'left',
    maxWidth: 200,
    isRequired: true
  },
  {
    id: 'durationWeeks',
    label: 'Duration (Weeks)',
    page: 1,
    x: 280,
    y: 345,
    fontSize: 11,
    fontColor: '#334155',
    alignment: 'left',
    maxWidth: 150,
    isRequired: false
  },
  {
    id: 'feeLocked',
    label: 'Task Review Fee',
    page: 1,
    x: 72,
    y: 380,
    fontSize: 11,
    fontColor: '#334155',
    alignment: 'left',
    maxWidth: 300,
    isRequired: false
  }
];

/**
 * Generates a clean A4 portrait sample offer template PDF with a prominent watermark.
 * Contains only neutral sample text; no copied signatures or fake director names.
 */
async function generateSampleOfferTemplatePdf() {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 portrait: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. Watermark: SAMPLE - NOT VALID FOR ISSUE
  page.drawText('SAMPLE - NOT VALID FOR ISSUE', {
    x: 65,
    y: 280,
    size: 32,
    font: fontBold,
    color: rgb(0.9, 0.9, 0.92),
    rotate: degrees(45)
  });

  // 2. Organization Header
  page.drawText('NOXIRA TECHNOLOGIES', {
    x: 72,
    y: 770,
    size: 20,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16) // slate-900
  });

  page.drawText('TECHNICAL INTAKE & APPLICANT ADMISSION PORTAL', {
    x: 72,
    y: 752,
    size: 9,
    font: fontBold,
    color: rgb(0.85, 0.55, 0.1) // amber-600
  });

  // Divider line
  page.drawLine({
    start: { x: 72, y: 738 },
    end: { x: 523, y: 738 },
    thickness: 1.5,
    color: rgb(0.88, 0.9, 0.94)
  });

  // 3. Document Title
  page.drawText('INTERNSHIP ADMISSION & OFFER LETTER', {
    x: 72,
    y: 700,
    size: 15,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16)
  });

  // Labels for sample layout
  page.drawText('Date of Issuance:', { x: 72, y: 650, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  page.drawText('Application Ref:', { x: 360, y: 650, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  page.drawText('Candidate Details:', { x: 72, y: 590, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.55) });

  page.drawText('Programme Track:', { x: 72, y: 510, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.55) });
  page.drawText('Assigned Cohort:', { x: 72, y: 475, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  page.drawText('Track Duration:', { x: 280, y: 475, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  page.drawText('Submission Fee:', { x: 72, y: 440, size: 9, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  // 4. Sample Body Paragraphs (strictly neutral)
  const introText =
    'This document represents a system-generated template preview for administrative inspection. ' +
    'Upon owner upload and activation of a finalized design, dynamic candidate credentials, ' +
    'programme details, and admission references will be rendered in accordance with verified records.';

  page.drawText(introText, {
    x: 72,
    y: 380,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.45),
    maxWidth: 450,
    lineHeight: 14
  });

  // 5. Footer Watermark Banner
  page.drawRectangle({
    x: 72,
    y: 60,
    width: 451,
    height: 38,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1
  });

  page.drawText('SAMPLE TEMPLATE - SYSTEM PREVIEW ONLY - NOT VALID FOR REAL ISSUE', {
    x: 88,
    y: 82,
    size: 8.5,
    font: fontBold,
    color: rgb(0.8, 0.2, 0.2) // red warning
  });

  page.drawText('Official offer letters will be rendered using owner-uploaded template designs.', {
    x: 88,
    y: 70,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.55)
  });

  const pdfBuffer = Buffer.from(await pdfDoc.save());
  return pdfBuffer;
}

/**
 * Validates an uploaded PDF buffer:
 * - Must be valid PDF bytes loadable by pdf-lib
 * - Rejects encrypted / password-protected documents
 * - Page count must be between 1 and 5
 * - Extracts normalized page dimensions
 */
async function validateUploadedOfferPdf(pdfBuffer) {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error('Invalid PDF data provided.');
  }

  if (pdfBuffer.length > 10 * 1024 * 1024) {
    throw new Error('PDF file size exceeds maximum permitted limit of 10 MB.');
  }

  // Quick magic header check
  const header = pdfBuffer.slice(0, 5).toString('ascii');
  if (!header.startsWith('%PDF-')) {
    throw new Error('Uploaded file is not a valid PDF document (missing %PDF- header).');
  }

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: false });
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('encrypt')) {
      throw new Error('Encrypted or password-protected PDF files are not supported. Please upload an unencrypted PDF.');
    }
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }

  if (pdfDoc.isEncrypted) {
    throw new Error('Encrypted PDF files are not supported. Please upload an unencrypted document.');
  }

  const pageCount = pdfDoc.getPageCount();
  if (pageCount < 1 || pageCount > 5) {
    throw new Error(`Offer letter templates must contain between 1 and 5 pages. Uploaded document has ${pageCount} pages.`);
  }

  const pageDimensions = [];
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const size = page.getSize();
    pageDimensions.push({
      pageNumber: i + 1,
      width: Math.round(size.width * 100) / 100,
      height: Math.round(size.height * 100) / 100
    });
  }

  return {
    pageCount,
    pageDimensions
  };
}

/**
 * Hex color to pdf-lib rgb conversion helper
 */
function parseHexColor(hex = '#0f172a') {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
  }
  return rgb(0.06, 0.09, 0.16);
}

/**
 * Normalizes input string for PDF rendering by cleaning carriage returns/tabs.
 * Preserves Rupee sign (₹), Latin, Indian scripts, and Unicode text.
 */
function sanitizeTextForPdf(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return str.replace(/[\r\n\t]/g, ' ').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

/**
 * Renders a personalized offer letter PDF using a template buffer and field mappings.
 * Supports both signatures:
 *   renderOfferPdf(templateDoc, data, options)
 *   renderOfferPdf(pdfBuffer, fields, data, options)
 */
async function renderOfferPdf(templateOrBuffer, arg2 = {}, arg3 = {}, arg4 = {}) {
  let pdfBuffer;
  let fields = [];
  let data = {};
  let options = {};

  if (Buffer.isBuffer(templateOrBuffer)) {
    pdfBuffer = templateOrBuffer;
  } else if (typeof templateOrBuffer === 'string') {
    if (fs.existsSync(templateOrBuffer)) {
      pdfBuffer = await fs.promises.readFile(templateOrBuffer);
    } else {
      pdfBuffer = Buffer.from(templateOrBuffer);
    }
  } else if (templateOrBuffer && typeof templateOrBuffer === 'object') {
    fields = templateOrBuffer.fields || [];
    if (templateOrBuffer.pdfStoragePath && fs.existsSync(templateOrBuffer.pdfStoragePath)) {
      pdfBuffer = await fs.promises.readFile(templateOrBuffer.pdfStoragePath);
    } else if (templateOrBuffer.pdfBuffer) {
      pdfBuffer = templateOrBuffer.pdfBuffer;
    }
  }

  if (Array.isArray(arg2)) {
    fields = arg2;
    data = arg3 || {};
    options = arg4 || {};
  } else {
    data = arg2 || {};
    options = arg3 || {};
  }

  if (!pdfBuffer) {
    throw new Error('Template PDF buffer or valid storage path could not be resolved.');
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  let fontRegular, fontBold;
  const { regular: parsedRegular, bold: parsedBold } = getParsedFontkitFonts();

  if (fs.existsSync(REGULAR_FONT_PATH) && fs.existsSync(BOLD_FONT_PATH)) {
    const regBytes = await fs.promises.readFile(REGULAR_FONT_PATH);
    const boldBytes = await fs.promises.readFile(BOLD_FONT_PATH);
    fontRegular = await pdfDoc.embedFont(regBytes);
    fontBold = await pdfDoc.embedFont(boldBytes);
  } else {
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const isSample = Boolean(options.isSample);
  const totalPages = pdfDoc.getPageCount();

  // If rendering a sample, draw watermark
  if (isSample) {
    for (let i = 0; i < totalPages; i++) {
      const p = pdfDoc.getPage(i);
      p.drawText('SAMPLE - NOT VALID FOR ISSUE', {
        x: 65,
        y: 280,
        size: 32,
        font: fontBold,
        color: rgb(0.9, 0.9, 0.92),
        rotate: degrees(45)
      });
    }
  }

  // Value resolution mapping
  const resolveValue = (fieldId) => {
    switch (fieldId) {
      case 'studentName':
        return data.studentName || data.recipientSnapshot?.fullName || data.fullName || '';
      case 'applicationId':
        return data.applicationId || '';
      case 'programTitle':
        return data.programTitle || data.title || data.programSnapshot?.title || '';
      case 'programCode':
        return data.programCode || data.code || data.programSnapshot?.code || '';
      case 'batchId':
        return data.batchId || data.programSnapshot?.batchId || '';
      case 'issueDate': {
        const d = data.issuedAt ? new Date(data.issuedAt) : (data.issueDate ? new Date(data.issueDate) : new Date());
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      case 'durationWeeks': {
        const weeks = data.durationWeeks ?? data.programSnapshot?.durationWeeks;
        return weeks != null && weeks !== '' ? `${weeks} Weeks` : '';
      }
      case 'startDate': {
        const sd = data.startDate || data.programSnapshot?.startDate;
        if (!sd) return '';
        const d = new Date(sd);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      case 'endDate': {
        const ed = data.endDate || data.programSnapshot?.endDate;
        if (!ed) return '';
        const d = new Date(ed);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      case 'feeLocked': {
        const fee = data.feeLocked ?? data.programSnapshot?.feeLocked;
        if (fee === undefined || fee === null || fee === '') return '';
        const num = Number(fee);
        if (num === 0) return '₹0 (free programme)';
        return `₹${num.toLocaleString('en-IN')}`;
      }
      default:
        return data[fieldId] ? String(data[fieldId]) : '';
    }
  };

  for (const field of fields) {
    const rawVal = resolveValue(field.id);
    const sanitizedVal = sanitizeTextForPdf(rawVal);

    if (field.isRequired && !sanitizedVal) {
      throw new Error(`Required offer letter field "${field.label || field.id}" is missing or empty.`);
    }

    if (!sanitizedVal) continue; // Optional empty fields render empty

    const pageIdx = (field.page || 1) - 1;
    if (pageIdx < 0 || pageIdx >= totalPages) continue;

    const page = pdfDoc.getPage(pageIdx);
    const { width: pWidth, height: pHeight } = page.getSize();

    const isBold = field.id === 'studentName' || field.id === 'programTitle' || field.id === 'applicationId';
    const fontToUse = isBold ? fontBold : fontRegular;
    const parsedToUse = isBold ? parsedBold : parsedRegular;

    // Fail with an actionable error if any character is unsupported by the font
    validateGlyphsForFont(sanitizedVal, field.label || field.id, parsedToUse);

    let effectiveFontSize = field.fontSize || 12;
    const maxWidth = field.maxWidth || 450;

    // Auto-fit long text: scale down font size if it exceeds maxWidth
    let textWidth = fontToUse.widthOfTextAtSize(sanitizedVal, effectiveFontSize);
    while (textWidth > maxWidth && effectiveFontSize > 7) {
      effectiveFontSize -= 0.5;
      textWidth = fontToUse.widthOfTextAtSize(sanitizedVal, effectiveFontSize);
    }

    // Top-left editor coordinates -> PDF bottom-left coordinates
    let pdfX = Number(field.x) || 72;
    const editorY = Number(field.y) || 100;
    const pdfY = pHeight - editorY - effectiveFontSize;

    if (field.alignment === 'center') {
      pdfX = field.x + (maxWidth - textWidth) / 2;
    } else if (field.alignment === 'right') {
      pdfX = field.x + maxWidth - textWidth;
    }

    page.drawText(sanitizedVal, {
      x: Math.max(0, pdfX),
      y: Math.max(0, pdfY),
      size: effectiveFontSize,
      font: fontToUse,
      color: parseHexColor(field.fontColor)
    });
  }

  const finalBuffer = Buffer.from(await pdfDoc.save());
  return finalBuffer;
}

module.exports = {
  DEFAULT_SAMPLE_FIELDS,
  generateSampleOfferTemplatePdf,
  validateUploadedOfferPdf,
  renderOfferPdf
};
