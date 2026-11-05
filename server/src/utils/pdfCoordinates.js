/**
 * NOXIRA PDF Coordinate Utilities
 * Conversion between PDF point coordinates (top-left origin) and display pixels.
 */

function pointToPixel({ x, y }, { width: pageWidth, height: pageHeight }, { width: displayWidth, height: displayHeight }) {
  if (!pageWidth || !pageHeight || !displayWidth || !displayHeight) {
    throw new Error('Invalid dimensions provided for pointToPixel conversion');
  }
  const pixelX = (x / pageWidth) * displayWidth;
  const pixelY = (y / pageHeight) * displayHeight;
  return { pixelX, pixelY };
}

function pixelToPoint({ pixelX, pixelY }, { width: pageWidth, height: pageHeight }, { width: displayWidth, height: displayHeight }) {
  if (!pageWidth || !pageHeight || !displayWidth || !displayHeight) {
    throw new Error('Invalid dimensions provided for pixelToPoint conversion');
  }
  const x = (pixelX / displayWidth) * pageWidth;
  const y = (pixelY / displayHeight) * pageHeight;
  return { x: Math.round(x), y: Math.round(y) };
}

module.exports = {
  pointToPixel,
  pixelToPoint
};
