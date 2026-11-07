const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const env = require('../config/env');

const INK = rgb(0.07, 0.09, 0.15);
const SLATE = rgb(0.4, 0.45, 0.55);
const CYAN = rgb(0.05, 0.52, 0.65);
const EMERALD = rgb(0.04, 0.55, 0.38);

/**
 * Render a skill-test certificate PDF (A4 landscape) with a QR code that
 * links to the public verification page for the certificate's token.
 */
async function renderSkillCertificatePdf(cert) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Border
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: CYAN, borderWidth: 2 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: rgb(0.85, 0.9, 0.94), borderWidth: 1 });

  const center = (text, y, size, f, color) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
  };

  center('NOXIRA TECHNOLOGIES', height - 90, 20, fontBold, INK);
  center('Skill Test Certificate', height - 125, 13, font, CYAN);

  center('This certifies that', height - 175, 11, font, SLATE);
  center(cert.studentName, height - 215, 28, fontBold, INK);
  center('has passed the online skill assessment', height - 250, 11, font, SLATE);
  center(cert.courseTitle, height - 285, 18, fontBold, INK);

  const scoreLine = `Score: ${cert.score}/${cert.totalQuestions} (${cert.scorePercent}%)`;
  center(scoreLine, height - 320, 12, font, EMERALD);

  const issued = new Date(cert.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  center(`Certificate No: ${cert.certificateNumber}`, height - 360, 10, font, SLATE);
  center(`Issued: ${issued}`, height - 378, 10, font, SLATE);

  // QR code -> public verification URL
  const verifyUrl = `${env.VERIFY_BASE_URL.replace(/\/$/, '')}/verify/${cert.verificationToken}`;
  const qrPng = await QRCode.toBuffer(verifyUrl, { width: 220, margin: 1 });
  const qrImage = await pdfDoc.embedPng(qrPng);
  page.drawImage(qrImage, { x: width / 2 - 45, y: 95, width: 90, height: 90 });
  center('Scan or visit the verification portal to confirm authenticity', 78, 8, font, SLATE);

  center('NOXIRA Technologies - Credential Registry', 48, 9, font, SLATE);

  return Buffer.from(await pdfDoc.save());
}

module.exports = { renderSkillCertificatePdf };
