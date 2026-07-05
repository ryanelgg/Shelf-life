import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// ── "Pantre Wrapped" shareable impact card ───────────────────────────────────
// Renders a polished, on-brand PNG of the user's food-rescue stats and opens the
// native share sheet (or Web Share / download on the web). Deliberately uses a
// fixed light brand look — independent of the app's light/dark theme — so the
// shared image always reads well on someone else's feed.

export interface ImpactCardStats {
  moneySaved: number;
  itemsSaved: number;
  streakDays: number;
  co2Saved: string; // kilograms, pre-formatted (e.g. "15.5")
  saveRate: number; // 0–100
}

// Brand palette (mirrors src/styles/globals.css light theme).
const CREAM = '#faf7f2';
const PANEL = '#ffffff';
const GREEN = '#4a7c59';
const GREEN_SOFT = 'rgba(74, 124, 89, 0.10)';
const BROWN = '#5a3e28';
const MUTED_BROWN = 'rgba(90, 62, 40, 0.55)';
const SERIF = "'Cormorant Garamond', 'Georgia', serif";
const MONO = "'DM Mono', 'Courier New', monospace";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  // Fallback for older WebViews without CanvasRenderingContext2D.roundRect.
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  value: string,
  label: string,
) {
  ctx.textAlign = 'center';
  ctx.fillStyle = GREEN;
  ctx.font = `500 84px ${MONO}`;
  ctx.fillText(value, cx, 968);
  ctx.fillStyle = MUTED_BROWN;
  ctx.font = `600 28px ${SERIF}`;
  ctx.fillText(label.toUpperCase(), cx, 1016);
}

async function renderCard(stats: ImpactCardStats): Promise<HTMLCanvasElement> {
  // Wait for brand fonts so the canvas doesn't fall back to a system face.
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* font loading is best-effort */
  }

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background + inner panel
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 48, 48, W - 96, H - 96, 48);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(74, 124, 89, 0.18)';
  roundRect(ctx, 48, 48, W - 96, H - 96, 48);
  ctx.stroke();

  const cx = W / 2;

  // Avo + title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '120px serif';
  ctx.fillText('🥑', cx, 250);
  ctx.fillStyle = BROWN;
  ctx.font = `800 68px ${SERIF}`;
  ctx.fillText('My Pantre Wrapped', cx, 350);
  ctx.fillStyle = MUTED_BROWN;
  ctx.font = `500 30px ${SERIF}`;
  ctx.fillText('Food I rescued instead of tossing', cx, 400);

  // Hero — money saved
  roundRect(ctx, 120, 470, W - 240, 240, 36);
  ctx.fillStyle = GREEN_SOFT;
  ctx.fill();
  ctx.fillStyle = MUTED_BROWN;
  ctx.font = `600 28px ${SERIF}`;
  ctx.fillText('MONEY SAVED', cx, 540);
  ctx.fillStyle = GREEN;
  ctx.font = `500 150px ${MONO}`;
  ctx.fillText(`$${stats.moneySaved.toFixed(0)}`, cx, 660);
  ctx.fillStyle = MUTED_BROWN;
  ctx.font = `500 30px ${SERIF}`;
  ctx.fillText(
    `by not tossing ${stats.itemsSaved} item${stats.itemsSaved === 1 ? '' : 's'}`,
    cx,
    760,
  );

  // Three stats row
  drawStat(ctx, 270, `${stats.itemsSaved}`, 'Items rescued');
  drawStat(ctx, cx, `${stats.streakDays}`, 'Day streak');
  drawStat(ctx, 810, `${stats.co2Saved}kg`, 'CO₂ prevented');

  // Save-rate line
  ctx.fillStyle = MUTED_BROWN;
  ctx.font = `500 30px ${SERIF}`;
  ctx.fillText(
    `${stats.saveRate.toFixed(0)}% of my tracked food used before expiring`,
    cx,
    1130,
  );

  // Footer
  ctx.fillStyle = GREEN;
  ctx.font = `700 34px ${SERIF}`;
  ctx.fillText('Track yours at usepantre.me 🥑', cx, 1230);

  return canvas;
}

function shareCaption(stats: ImpactCardStats): string {
  return `I saved $${stats.moneySaved.toFixed(0)} and rescued ${stats.itemsSaved} item${
    stats.itemsSaved === 1 ? '' : 's'
  } from the trash with Pantre 🥑`;
}

function filename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `pantre-wrapped-${yyyy}-${mm}-${dd}.png`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/**
 * Render and share the user's impact card. Returns true if a share/download was
 * initiated, false if the user cancelled the share sheet. Throws only on real
 * rendering/IO failures so callers can surface an error.
 */
export async function shareImpactCard(stats: ImpactCardStats): Promise<boolean> {
  const canvas = await renderCard(stats);
  const name = filename();
  const text = shareCaption(stats);

  if (Capacitor.isNativePlatform()) {
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    const writeRes = await Filesystem.writeFile({
      path: name,
      data: base64,
      directory: Directory.Cache,
    });
    try {
      await Share.share({
        title: 'My Pantre Wrapped',
        text,
        files: [writeRes.uri],
        dialogTitle: 'Share your impact',
      });
      return true;
    } catch {
      // Share plugin throws when the user dismisses the sheet — not an error.
      return false;
    }
  }

  // Web: prefer the native Web Share sheet with the file; fall back to download.
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: 'My Pantre Wrapped', text });
      return true;
    } catch {
      return false;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
