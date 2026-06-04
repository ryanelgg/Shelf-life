import { useEffect, useState } from 'react';

interface TodoItem {
  id: string;
  text: string;
}

interface TodoSection {
  title: string;
  items: TodoItem[];
}

const SECTIONS: TodoSection[] = [
  {
    title: 'This week — bugs / code',
    items: [
      { id: 'bug-avo-error', text: 'Fix Avo chat error branching (CookScreen.tsx:119) — propagate status from avoApi.ts so 401/429 messages actually show' },
      { id: 'bug-lint', text: 'Run lint autofix pass on notifications.ts + debug.ts (17 escapes + 4 unused vars)' },
      { id: 'bug-edge-auth', text: 'Decide on edge function auth — flip verify_jwt = true + add per-user rate limiting in avo-chat and receipt-ocr' },
      { id: 'bug-notif-id', text: 'Fix notification-ID collisions in notifications.ts — switch to a registry-based ID scheme' },
      { id: 'bug-blob-revoke', text: 'Defer URL.revokeObjectURL in dataExport.ts:82 (Safari/Firefox download cancel)' },
      { id: 'bug-zxing-deps', text: 'Add missing deps or eslint-disable on ZXing useEffect in BarcodeScanner.tsx:154' },
    ],
  },
  {
    title: 'This week — pre-launch polish',
    items: [
      { id: 'polish-icon-pick', text: 'Pick app icon (logo-1 through logo-5)' },
      { id: 'polish-asset-catalog', text: 'Generate iOS asset catalog (light/dark/tinted) for chosen icon' },
      { id: 'polish-screenshots', text: 'Draft App Store screenshots in Canva at 1290×2796' },
      { id: 'polish-description', text: 'Draft App Store description + keywords in Notes' },
      { id: 'polish-cap-sync', text: 'npm run build && npx cap sync ios — verify "Pantre" name everywhere on real phone' },
      { id: 'polish-reviewer-acct', text: 'Pre-create reviewer test account credentials' },
    ],
  },
  {
    title: 'Blocked on parent/guardian',
    items: [
      { id: 'parent-termly-form', text: "Finish Termly privacy policy form (parent's legal name)" },
      { id: 'parent-termly-publish', text: 'Publish Termly policy and get public URL' },
      { id: 'parent-urls', text: 'Replace placeholder URLs in SettingsScreen.tsx + UpgradeModal.tsx (pantre.app → usepantre.me)' },
      { id: 'parent-test-email', text: "Test sign-up with someone else's real email" },
      { id: 'parent-apple-dev', text: 'Apple Developer Program enrollment' },
      { id: 'parent-asc-tax', text: 'ASC Paid Apps Agreement + bank account + W-9 or W-8BEN' },
      { id: 'parent-asc-wait', text: "Wait 1–3 days for Apple's tax review" },
      { id: 'parent-asc-sub', text: 'Create pantre_pro_monthly subscription in ASC' },
      { id: 'parent-icon-1024', text: 'App icon 1024×1024 (no transparency, no rounded corners)' },
      { id: 'parent-privacy-labels', text: 'Privacy nutrition labels (match Termly disclosures)' },
    ],
  },
  {
    title: 'Blocked on ASC tax going Active',
    items: [
      { id: 'rc-project', text: 'Create RevenueCat project' },
      { id: 'rc-keys', text: 'Upload App-Specific Shared Secret + .p8 key + Key ID + Issuer ID' },
      { id: 'rc-entitlement', text: 'Create entitlement `pro` and offering `default`' },
      { id: 'rc-install', text: 'npm install @revenuecat/purchases-capacitor' },
      { id: 'rc-configure', text: 'Wire Purchases.configure at app boot' },
      { id: 'rc-auth', text: 'Wire Purchases.logIn / logOut into auth listener' },
      { id: 'rc-upgrade', text: 'Replace fake upgrade flow with purchasePackage' },
      { id: 'rc-cancel', text: 'Replace cancel flow with deep-link to Apple Settings' },
      { id: 'rc-restore', text: 'Add Restore Purchases button on paywall + Settings' },
      { id: 'rc-sync', text: 'Sync subscription state on app boot + foreground' },
      { id: 'rc-paywall-copy', text: 'Update paywall copy with auto-renewal disclosure' },
      { id: 'rc-sandbox', text: 'Sandbox test on real iPhone' },
    ],
  },
  {
    title: 'After launch — new features',
    items: [
      { id: 'feat-household', text: 'Household sharing (Pro feature) — household_id on pantry_items + waste_logs, invite via link' },
      { id: 'feat-spending', text: 'Spending insights on Impact screen — multiply receipt prices × tossed items' },
      { id: 'feat-widget', text: 'Apple Watch / Lock Screen widget — "X expiring today" via native Swift widget + App Group' },
    ],
  },
];

const STORAGE_KEY = 'pantre.dailyTodo.checked.v1';

function loadChecked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function DailyTodoChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // ignore
    }
  }, [checked]);

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const reset = () => {
    if (confirm('Uncheck everything?')) setChecked({});
  };

  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '24px 16px 80px',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      color: 'var(--text-primary, #1a1a1a)',
    }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          Pantre — Daily To-Do
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted, #666)', marginTop: 6 }}>
          {done} of {total} done · saved locally on this device
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 10,
            padding: '6px 12px',
            border: '1px solid var(--tab-border, #ddd)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--text-muted, #666)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Reset all
        </button>
      </header>

      {SECTIONS.map(section => {
        const sectionDone = section.items.filter(i => checked[i.id]).length;
        return (
          <section key={section.title} style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 18,
              fontWeight: 700,
              margin: '0 0 12px',
              borderBottom: '1px solid var(--tab-border, #eee)',
              paddingBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{section.title}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted, #888)', fontWeight: 500 }}>
                {sectionDone}/{section.items.length}
              </span>
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {section.items.map(item => {
                const isDone = !!checked[item.id];
                return (
                  <li key={item.id} style={{ marginBottom: 8 }}>
                    <label style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: isDone ? 'rgba(0,0,0,0.03)' : 'transparent',
                    }}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggle(item.id)}
                        style={{ marginTop: 3, flexShrink: 0 }}
                      />
                      <span style={{
                        fontSize: 15,
                        lineHeight: 1.45,
                        textDecoration: isDone ? 'line-through' : 'none',
                        color: isDone ? 'var(--text-muted, #999)' : 'inherit',
                      }}>
                        {item.text}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
