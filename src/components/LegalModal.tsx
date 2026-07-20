import { useEffect } from 'react';

export type LegalDoc = 'privacy' | 'terms';

interface LegalModalProps {
  doc: LegalDoc;
  onClose: () => void;
}

// In-app Privacy Policy / Terms of Use. Placeholder text shown INSIDE the app so
// the required links work before the public Termly pages are published. Replace
// the copy (or point the Settings links back at usepantre.me/privacy · /terms)
// once the final policy is live.
const PRIVACY_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'The short version',
    body: 'Pantre helps you track the food you own so you waste less of it. We collect the minimum needed to make that work, we do not sell your personal information, and you can export or delete your data at any time from Settings.',
  },
  {
    heading: 'What we store',
    body: 'The pantry items, waste logs, shopping lists, and meal plans you create; your account details (name, email, sign-in provider); and basic app settings. If you use a shared household, those items are shared with the members you invite.',
  },
  {
    heading: 'Avo AI',
    body: 'When you chat with Avo, your question and pantry item names are sent to Groq to generate a response. When you scan a receipt or fridge photo, that image is sent to Anthropic (Claude). In both cases the data is used only to answer your request and is not retained for training. Avo is not medical advice, and AI features are optional and can be turned off in Settings.',
  },
  {
    heading: 'Camera',
    body: 'The camera is used only to scan barcodes and receipts when you choose to. Images are processed to read items and are not stored beyond that request.',
  },
  {
    heading: 'What we do NOT do',
    body: 'We do not sell your data, we do not use it for third-party advertising, and we do not knowingly collect data from anyone under 13.',
  },
  {
    heading: 'Your choices',
    body: 'Download or delete all of your data from Settings at any time. Deleting your account removes your data from our systems.',
  },
  {
    heading: 'Contact',
    body: 'Questions about privacy? Email privacy@usepantre.me.',
  },
];

const TERMS_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'Using Pantre',
    body: 'Pantre is provided to help you track food and reduce waste. Use it lawfully and keep your login secure — you are responsible for activity on your account.',
  },
  {
    heading: 'Not professional advice',
    body: 'Expiry estimates, recipes, and Avo AI are informational and provided on a best-effort basis. They are not food-safety, medical, or nutritional guarantees. Always use your own judgment about whether food is safe to eat.',
  },
  {
    heading: 'Subscriptions',
    body: 'Pantre Pro is an auto-renewing subscription. Price and renewal terms are shown before you purchase. You can manage or cancel anytime in your App Store account settings; cancellation takes effect at the end of the current period.',
  },
  {
    heading: 'Your content',
    body: 'The pantry data you add stays yours. You grant us permission to store and process it so the app can function and sync across your devices and household.',
  },
  {
    heading: 'Changes & availability',
    body: 'We may update the app and these terms as Pantre evolves. The service is provided “as is,” and we are not liable for spoiled food, missed reminders, or other losses arising from use of the app.',
  },
  {
    heading: 'Contact',
    body: 'Questions about these terms? Email support@usepantre.me.',
  },
];

export function LegalModal({ doc, onClose }: LegalModalProps) {
  const isPrivacy = doc === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Use';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  // Close on Escape (web) for convenience.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      animation: 'upgradeFadeIn 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: 'max(20px, env(safe-area-inset-top)) 16px 12px',
        borderBottom: '1px solid var(--tab-border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)', fontSize: '20px', lineHeight: 1,
            padding: '4px 8px', marginLeft: '-8px',
          }}
        >
          ‹
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 800 }}>{title}</h1>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 32px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>
          Pantre · In-app summary. A full policy is available on request at {isPrivacy ? 'privacy' : 'support'}@usepantre.me.
        </div>
        {sections.map(s => (
          <div key={s.heading} style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {s.heading}
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              {s.body}
            </div>
          </div>
        ))}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: '8px', padding: '12px',
            borderRadius: '12px', border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontFamily: "'Cormorant Garamond', serif", fontSize: '15px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>

      <style>{`@keyframes upgradeFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
