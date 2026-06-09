import { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AvocadoMascot } from './AvocadoMascot';
import { useStore } from '../store/useStore';
import { parseLocalDate } from '../types';
import type { WasteLog } from '../types';
import { hapticLight } from '../lib/haptics';
import * as debug from '../lib/debug';

interface Props {
  onClose: () => void;
}

interface WrappedStats {
  moneySaved: number;
  itemsSaved: number;
  tossed: number;
  co2Saved: number;
  saveRate: number;
  topCategory: string | null;
  streakDays: number;
  rangeLabel: string;
}

function computeWrapped(logs: WasteLog[], streakDays: number, days = 7): WrappedStats {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const recent = logs.filter(w => parseLocalDate(w.date) >= cutoff);

  const tossed = recent.filter(w => w.action === 'tossed');
  const saved = recent.filter(w => w.action !== 'tossed');
  const moneySaved = saved.reduce((sum, w) => sum + w.estimatedValue * w.quantity, 0);
  const saveRate = recent.length > 0 ? (saved.length / recent.length) * 100 : 0;

  // Most-saved category this week
  const counts = new Map<string, number>();
  for (const w of saved) counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
  let topCategory: string | null = null;
  let topCount = 0;
  for (const [cat, n] of counts) if (n > topCount) { topCount = n; topCategory = cat; }

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return {
    moneySaved,
    itemsSaved: saved.length,
    tossed: tossed.length,
    co2Saved: saved.length * 0.5,
    saveRate,
    topCategory,
    streakDays,
    rangeLabel: `${fmt(cutoff)} – ${fmt(now)}`,
  };
}

// Draw the shareable card to an offscreen canvas and return a PNG data URL.
// Done by hand (no html2canvas dependency) so it works in any build.
function renderCard(s: WrappedStats, name: string): string {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1f3326');
  bg.addColorStop(1, '#0f1a13');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Avo + title
  ctx.font = '160px serif';
  ctx.fillText('🥑', W / 2, 360);
  ctx.fillStyle = '#9fd3ab';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('MY PANTRE WRAPPED', W / 2, 470);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '40px sans-serif';
  ctx.fillText(s.rangeLabel, W / 2, 540);

  // Hero — money saved
  ctx.fillStyle = '#fdfaf4';
  ctx.font = 'bold 230px sans-serif';
  ctx.fillText(`$${s.moneySaved.toFixed(0)}`, W / 2, 850);
  ctx.fillStyle = '#9fd3ab';
  ctx.font = '46px sans-serif';
  ctx.fillText('saved from the bin this week', W / 2, 930);

  // Stat rows
  const rows: [string, string][] = [
    [`${s.itemsSaved}`, s.itemsSaved === 1 ? 'item rescued' : 'items rescued'],
    [`${s.co2Saved.toFixed(1)} kg`, 'CO₂ prevented'],
    [`${s.streakDays}`, s.streakDays === 1 ? 'day streak' : 'day zero-waste streak'],
  ];
  if (s.topCategory) rows.push([s.topCategory, 'most rescued']);

  let y = 1180;
  for (const [big, label] of rows) {
    ctx.fillStyle = '#fdfaf4';
    ctx.font = 'bold 88px sans-serif';
    ctx.fillText(big, W / 2, y);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '40px sans-serif';
    ctx.fillText(label, W / 2, y + 58);
    y += 190;
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '38px sans-serif';
  ctx.fillText(name ? `${name} · usepantre.me` : 'usepantre.me', W / 2, H - 90);

  return canvas.toDataURL('image/png');
}

function isCancelled(err: unknown): boolean {
  return err instanceof Error && /cancel|dismiss|abort/i.test(err.message);
}

export function AvoWrapped({ onClose }: Props) {
  const { wasteLogs, user } = useStore();
  const [sharing, setSharing] = useState(false);
  const stats = useMemo(
    () => computeWrapped(wasteLogs, user?.streakDays ?? 0),
    [wasteLogs, user?.streakDays],
  );

  const firstName = (user?.name ?? '').trim().split(' ')[0] ?? '';
  const shareText = `I saved $${stats.moneySaved.toFixed(0)} and rescued ${stats.itemsSaved} item${stats.itemsSaved === 1 ? '' : 's'} from the bin this week with Pantre 🥑 usepantre.me`;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    hapticLight();
    try {
      const dataUrl = renderCard(stats, firstName);
      const base64 = dataUrl.split(',')[1];
      const filename = `pantre-wrapped-${Date.now()}.png`;

      if (Capacitor.isNativePlatform()) {
        const res = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
        await Share.share({ title: 'My Pantre Wrapped', text: shareText, url: res.uri, dialogTitle: 'Share your week' });
      } else if (navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My Pantre Wrapped', text: shareText });
        } else {
          downloadDataUrl(dataUrl, filename);
        }
      } else {
        downloadDataUrl(dataUrl, filename);
      }
    } catch (err) {
      if (!isCancelled(err)) debug.error('[wrapped] share failed', err);
    } finally {
      setSharing(false);
    }
  };

  const statTiles: [string, string][] = [
    [`${stats.itemsSaved}`, stats.itemsSaved === 1 ? 'item rescued' : 'items rescued'],
    [`${stats.co2Saved.toFixed(1)} kg`, 'CO₂ prevented'],
    [`${stats.saveRate.toFixed(0)}%`, 'save rate'],
    [`${stats.streakDays}`, 'day streak'],
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(15,26,19,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card-enter"
        style={{
          width: '100%', maxWidth: '360px', borderRadius: '24px',
          padding: '28px 24px 22px',
          background: 'linear-gradient(160deg, #1f3326 0%, #0f1a13 100%)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          textAlign: 'center', color: '#fdfaf4',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
          <AvocadoMascot size={56} isStatic />
        </div>
        <div style={{ fontSize: '12px', letterSpacing: '0.14em', fontWeight: 800, color: '#9fd3ab', textTransform: 'uppercase' }}>
          My Pantre Wrapped
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(253,250,244,0.5)', marginTop: '4px' }}>
          {stats.rangeLabel}
        </div>

        <div className="mono" style={{ fontSize: '64px', fontWeight: 500, color: '#fdfaf4', lineHeight: 1.1, marginTop: '16px' }}>
          ${stats.moneySaved.toFixed(0)}
        </div>
        <div style={{ fontSize: '13px', color: '#9fd3ab', marginTop: '2px' }}>
          saved from the bin this week
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '22px' }}>
          {statTiles.map(([big, label]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px 8px',
            }}>
              <div className="mono" style={{ fontSize: '24px', fontWeight: 600, color: '#fdfaf4' }}>{big}</div>
              <div style={{ fontSize: '10px', color: 'rgba(253,250,244,0.55)', fontWeight: 600, marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        {stats.topCategory && (
          <div style={{ fontSize: '12px', color: 'rgba(253,250,244,0.6)', marginTop: '16px' }}>
            Most rescued this week: <span style={{ color: '#9fd3ab', fontWeight: 700 }}>{stats.topCategory}</span>
          </div>
        )}

        <button
          onClick={() => { void handleShare(); }}
          disabled={sharing}
          style={{
            marginTop: '22px', width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
            background: '#4a7c59', color: '#fdfaf4', fontSize: '15px', fontWeight: 700,
            cursor: sharing ? 'default' : 'pointer', fontFamily: "'Cormorant Garamond', serif",
            opacity: sharing ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {sharing ? 'Preparing…' : 'Share my week'}
        </button>
        <button
          onClick={onClose}
          style={{
            marginTop: '8px', width: '100%', padding: '10px', background: 'none', border: 'none',
            color: 'rgba(253,250,244,0.5)', fontSize: '13px', cursor: 'pointer',
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
