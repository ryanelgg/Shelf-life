import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Renders the shareable weekly Impact Card to a PNG and opens the native share
// sheet. Pure canvas (no html2canvas dependency) so the output is deterministic
// and works inside the WebView. The image shows only aggregate numbers — never
// the user's actual food items — so it's safe to post publicly.

export interface CardTheme {
  id: string;
  name: string;
  pro: boolean;
  bg: [string, string]; // gradient stops
  fg: string;
  sub: string;
  accent: string;
}

export const CARD_THEMES: CardTheme[] = [
  { id: 'classic',  name: 'Classic',  pro: false, bg: ['#f7f3e9', '#e3efe0'], fg: '#2f3e2f', sub: '#6b7a6b', accent: '#4a7c59' },
  { id: 'forest',   name: 'Forest',   pro: true,  bg: ['#10341f', '#1f5d38'], fg: '#f2fbf3', sub: '#bfe3c8', accent: '#9be7b0' },
  { id: 'sunset',   name: 'Sunset',   pro: true,  bg: ['#ffd9a0', '#ff9aa2'], fg: '#4a2f1f', sub: '#7a5544', accent: '#c2410c' },
  { id: 'midnight', name: 'Midnight', pro: true,  bg: ['#0f172a', '#1e293b'], fg: '#e2e8f0', sub: '#94a3b8', accent: '#6ee7b7' },
];

export function getCardTheme(id: string): CardTheme {
  return CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0];
}

export interface ImpactCardData {
  weekRange: string;
  moneySaved: number;
  itemsRescued: number;
  saveRate: number;
  streak: number;
  co2Kg: number;
  avatar: string;
  newBadge?: { emoji: string; name: string } | null;
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: string,
  label: string,
  theme: CardTheme,
): void {
  ctx.fillStyle = theme.fg;
  ctx.font = '700 76px system-ui, -apple-system, sans-serif';
  ctx.fillText(value, x, y);
  ctx.fillStyle = theme.sub;
  ctx.font = '500 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(label, x, y + 54);
}

export function renderImpactCardPng(data: ImpactCardData, themeId: string): string {
  const theme = getCardTheme(themeId);
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, theme.bg[0]);
  grad.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = 'center';

  ctx.fillStyle = theme.sub;
  ctx.font = '600 34px system-ui, -apple-system, sans-serif';
  ctx.fillText('MY PANTRE WEEK', S / 2, 120);
  ctx.fillStyle = theme.fg;
  ctx.font = '500 46px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.weekRange, S / 2, 180);

  ctx.font = '150px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.avatar || '🥑', S / 2, 360);

  ctx.fillStyle = theme.accent;
  ctx.font = '800 168px system-ui, -apple-system, sans-serif';
  ctx.fillText(`$${data.moneySaved.toFixed(0)}`, S / 2, 540);
  ctx.fillStyle = theme.sub;
  ctx.font = '500 40px system-ui, -apple-system, sans-serif';
  ctx.fillText('saved from the bin this week', S / 2, 600);

  ctx.textAlign = 'center';
  drawStat(ctx, S * 0.24, 760, `${data.itemsRescued}`, 'rescued', theme);
  drawStat(ctx, S * 0.5, 760, `${Math.round(data.saveRate)}%`, 'kept', theme);
  drawStat(ctx, S * 0.76, 760, `${data.streak}`, 'day streak', theme);

  ctx.fillStyle = theme.fg;
  ctx.font = '500 40px system-ui, -apple-system, sans-serif';
  ctx.fillText(`🌳 ${data.co2Kg.toFixed(1)} kg CO₂ kept out of the air`, S / 2, 900);

  if (data.newBadge) {
    ctx.fillStyle = theme.accent;
    ctx.font = '600 40px system-ui, -apple-system, sans-serif';
    ctx.fillText(`New badge: ${data.newBadge.emoji} ${data.newBadge.name}`, S / 2, 962);
  }

  ctx.fillStyle = theme.sub;
  ctx.font = '600 38px system-ui, -apple-system, sans-serif';
  ctx.fillText('🥑 usepantre.me', S / 2, 1020);

  return canvas.toDataURL('image/png');
}

export async function shareImpactCard(dataUrl: string): Promise<void> {
  const base64 = dataUrl.split(',')[1] ?? '';
  const filename = `pantre-impact-${Date.now()}.png`;

  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: 'My Pantre week',
      text: 'Look how much food I saved with Pantre 🥑',
      url: res.uri,
      dialogTitle: 'Share your impact',
    });
    return;
  }

  // Web: prefer the native file-share sheet, fall back to a download.
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: unknown) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: 'My Pantre week' });
      return;
    }
  } catch {
    // fall through to download
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
