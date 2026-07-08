import { Card } from './Card';
import { openOlio, openTooGoodToGo, offerToFriend } from '../lib/foodRescue';

interface RescueModalProps {
  itemName: string;
  /** Called when the user gives the item away (logs it as shared, not wasted). */
  onRescued: () => void;
  /** Called when the user tosses it anyway. */
  onTossAnyway: () => void;
  /** Dismiss without doing anything — the item stays in the pantry. */
  onClose: () => void;
}

export function RescueModal({ itemName, onRescued, onTossAnyway, onClose }: RescueModalProps) {
  const rescueOptions: { label: string; sublabel: string; action: () => void | Promise<void> }[] = [
    { label: 'Share on Olio', sublabel: 'Give it to a neighbour for free', action: openOlio },
    { label: 'Too Good To Go', sublabel: 'List surplus food nearby', action: openTooGoodToGo },
    { label: 'Offer to a friend', sublabel: 'Text someone you know', action: () => offerToFriend(itemName) },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%',
        background: 'var(--bg-primary)',
        borderRadius: '24px 24px 0 0',
        padding: '24px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: 'var(--tab-border)',
          alignSelf: 'center', marginTop: '-12px', marginBottom: '4px',
        }} />

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>This still looks good 🌿</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '6px' }}>
            Your {itemName} hasn't expired yet. Could someone else enjoy it before it goes to waste?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rescueOptions.map(opt => (
            <Card
              key={opt.label}
              onClick={() => { void Promise.resolve(opt.action()); onRescued(); }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{opt.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.sublabel}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>›</span>
            </Card>
          ))}
        </div>

        <button
          onClick={onTossAnyway}
          style={{
            padding: '13px', borderRadius: '14px', border: '1px solid var(--tab-border)',
            background: 'transparent', color: 'var(--text-muted)',
            fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          No, toss it anyway
        </button>
      </div>
    </div>
  );
}
