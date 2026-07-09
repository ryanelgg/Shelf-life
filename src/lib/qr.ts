import qrcode from 'qrcode-generator';

/**
 * Build a scalable SVG QR code for the given text (dark modules on transparent
 * background — render it inside a white container for scannability). Type 0 =
 * auto-size for the data; 'M' error correction tolerates a bit of glare/smudge.
 */
export function buildQrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
