import { useState, useCallback, useRef } from 'react';
import posthog from 'posthog-js';
import { Card } from '../components/Card';
import { useStore } from '../store/useStore';
import { UpgradeModal } from '../components/UpgradeModal';
import { CancelProModal } from '../components/CancelProModal';
import { HouseholdModal } from '../components/HouseholdModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { SignOutModal } from '../components/SignOutModal';
import { LegalModal, type LegalDoc } from '../components/LegalModal';
import type { DietaryPref } from '../types';
import { deleteAccount, signOut, syncProfileUpdates } from '../lib/supabaseSync';
import { ensureNotificationPermission } from '../lib/notifications';
import { exportUserData } from '../lib/dataExport';
import { openAppStoreReview } from '../lib/appReview';
import * as debug from '../lib/debug';

const DIETS: { id: DietaryPref; label: string }[] = [
  { id: 'none', label: 'No restrictions' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'nut-free', label: 'Nut-free' },
];


export function SettingsScreen() {
  const { user, theme, setTheme, setShowSettings, updateUser, resetOnboarding, setSubscriptionTier, supabaseUserId, avoAiConsent, setAvoAiConsent, notificationsEnabled, setNotificationsEnabled, pantryItems, wasteLogs, household } = useStore();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancelPro, setShowCancelPro] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [editingDiet, setEditingDiet] = useState(false);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setShowSettings(false);
      setClosing(false);
    }, 280);
  };

  const handleExportData = async () => {
    try {
      await exportUserData({
        user,
        pantryItems,
        wasteLogs,
        theme,
        avoAiConsent,
        notificationsEnabled,
      });
    } catch (e) {
      debug.error('export failed:', e);
      showToast('Could not export your data right now. Please try again.');
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }
    const granted = await ensureNotificationPermission();
    if (granted) {
      posthog.capture('notification_permission_granted');
      setNotificationsEnabled(true);
    } else {
      posthog.capture('notification_permission_denied');
      // Permission denied — user has to flip it in iOS Settings
      showToast('Notifications are blocked. Go to iOS Settings → Pantre → Notifications to turn them on.');
    }
  };

  const handleSaveName = () => {
    if (!name.trim()) return;
    updateUser({ name: name.trim() });
    if (supabaseUserId) syncProfileUpdates(supabaseUserId, { name: name.trim() });
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    resetOnboarding();
    setShowDeleteAccount(false);
  };

  const handleSignOut = async () => {
    // Sign-out only ends the session. Cloud data is preserved so the user keeps
    // their pantry on next login. Permanent deletion lives in handleDeleteAccount.
    await signOut();
    resetOnboarding();
  };

  return (
    <div
      className={`settings-screen ${closing ? 'settings-exit' : 'settings-enter'}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Settings</h2>
        <button onClick={close} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent)', fontSize: '14px', fontWeight: 600,
          fontFamily: "'Cormorant Garamond', serif",
        }}>
          Done
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {/* Profile */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Profile
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Display Name</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleSaveName}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {user?.email && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {user.email}
                </div>
              </div>
            )}
            {user?.authProvider && user.authProvider !== 'guest' && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Signed in with</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {user.authProvider}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Subscription */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Subscription
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  {user?.subscriptionTier === 'pro' ? 'Pantre Pro' : 'Free Plan'}
                </span>
                {user?.subscriptionTier === 'pro' && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #D4A44A, #B8862D)', color: '#fff',
                    fontSize: '9px', fontWeight: 700,
                  }}>PRO</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {user?.subscriptionTier === 'pro'
                  ? 'Unlimited items, chats & receipt scanning'
                  : '20 items · 5 chats'
                }
              </div>
            </div>
            {user?.subscriptionTier !== 'pro' ? (
              <button
                onClick={() => setShowUpgrade(true)}
                style={{
                  padding: '8px 16px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #D4A44A, #B8862D)', color: '#fff',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Upgrade
              </button>
            ) : (
              <button
                onClick={() => setShowCancelPro(true)}
                style={{
                  padding: '8px 16px', borderRadius: '10px',
                  border: '1px solid var(--text-muted)', background: 'none',
                  color: 'var(--text-muted)',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel Pro
              </button>
            )}
          </div>
          {user?.subscriptionTier === 'pro' && (
            <button
              onClick={() => window.open('https://apps.apple.com/account/subscriptions', '_blank')}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid var(--tab-border)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Manage Subscription in Apple Settings →
            </button>
          )}
        </Card>

        {/* Household sharing (Pro) */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Household
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ paddingRight: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                {household ? 'Sharing on' : 'Share your pantry'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {household
                  ? `Code ${household.inviteCode} · up to 4 members`
                  : 'One shared pantry for up to 4 people · Pro'}
              </div>
            </div>
            <button
              onClick={() => {
                // Pro-gated: free users with no household are sent to upgrade.
                if (household || user?.subscriptionTier === 'pro') setShowHousehold(true);
                else setShowUpgrade(true);
              }}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: household ? 'var(--accent)' : 'linear-gradient(135deg, #D4A44A, #B8862D)',
                color: '#fff',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {household ? 'Manage' : 'Set up'}
            </button>
          </div>
        </Card>

        {/* Theme */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Dark Mode</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {theme === 'dark' ? 'Dark theme active' : 'Light theme active'}
              </div>
            </div>
            <button
              className={`theme-toggle ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Avo Notifications</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                {notificationsEnabled
                  ? 'On — expiration reminders, streak nudges & friendly check-ins'
                  : 'Off — turn on for expiration alerts, streak protection & gentle nudges'}
              </div>
            </div>
            <button
              className={`theme-toggle ${notificationsEnabled ? 'active' : ''}`}
              onClick={() => { void handleToggleNotifications(); }}
            />
          </div>
        </Card>

        {/* Avo AI privacy */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Avo AI</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                {avoAiConsent === 'granted'
                  ? 'On — chat is processed by Groq; receipt & fridge photo scans by Anthropic'
                  : avoAiConsent === 'declined'
                  ? 'Off — chat is disabled'
                  : 'Not set — you\'ll be asked when you open chat'}
              </div>
            </div>
            <button
              className={`theme-toggle ${avoAiConsent === 'granted' ? 'active' : ''}`}
              onClick={() => setAvoAiConsent(avoAiConsent === 'granted' ? 'declined' : 'granted')}
            />
          </div>
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid var(--tab-border)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            ⚕️ Avo AI provides general nutrition information only and is not a substitute for professional medical advice, diagnosis, or treatment.
          </div>
        </Card>

        {/* Dietary preferences */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dietary Preferences
            </div>
            <button
              onClick={() => setEditingDiet(e => !e)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: '12px', fontWeight: 600,
                fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              {editingDiet ? 'Done' : 'Edit'}
            </button>
          </div>
          {editingDiet ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DIETS.map(d => {
                const selected = (user?.dietaryPreferences ?? []).includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      const prefs = user?.dietaryPreferences ?? [];
                      let next: DietaryPref[];
                      if (d.id === 'none') {
                        next = ['none'];
                      } else {
                        const without = prefs.filter(p => p !== 'none');
                        next = without.includes(d.id) ? without.filter(p => p !== d.id) : [...without, d.id];
                        if (next.length === 0) next = ['none'];
                      }
                      updateUser({ dietaryPreferences: next });
                      if (supabaseUserId) syncProfileUpdates(supabaseUserId, { dietary_preferences: next });
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: '16px',
                      border: selected ? '1.5px solid var(--accent)' : '1px solid var(--tab-border)',
                      background: selected ? 'var(--accent-dim)' : 'transparent',
                      color: selected ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Cormorant Garamond', serif",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(user?.dietaryPreferences?.filter(p => p !== 'none') ?? []).length > 0
                ? user!.dietaryPreferences!.filter(p => p !== 'none').map(pref => (
                    <span key={pref} style={{
                      padding: '6px 12px', borderRadius: '16px',
                      background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                      color: 'var(--accent)', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                    }}>
                      {pref}
                    </span>
                  ))
                : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No restrictions</span>
              }
            </div>
          )}
        </Card>

        {/* Support & Legal */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Support & Legal
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SettingsLink
              label="Contact Support"
              onClick={() => window.open('mailto:support@usepantre.me?subject=Pantre%20Support', '_blank')}
            />
            <SettingsLink
              label="Send Feedback"
              onClick={() => window.open('mailto:feedback@usepantre.me?subject=Pantre%20Feedback', '_blank')}
            />
            <SettingsLink
              label="⭐ Rate Pantre"
              onClick={() => { posthog.capture('rate_app_tapped'); void openAppStoreReview(); }}
            />
            <SettingsLink
              label="Download My Data"
              onClick={() => { void handleExportData(); }}
            />
            <SettingsLink
              label="Privacy Policy"
              onClick={() => setLegalDoc('privacy')}
            />
            <SettingsLink
              label="Terms of Use"
              onClick={() => setLegalDoc('terms')}
              hideBorder
            />
          </div>
        </Card>

        {/* App info */}
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            About
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Version</span>
              <span className="mono">1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Made with</span>
              <span>🥑 + ❤️</span>
            </div>
            <div style={{
              marginTop: '8px',
              paddingTop: '10px',
              borderTop: '1px solid var(--tab-border)',
              fontSize: '11px',
              lineHeight: 1.6,
            }}>
              <div style={{ marginBottom: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>Powered by</div>
              <div>Groq · Anthropic Claude · Supabase · Apple · Google</div>
            </div>
          </div>
        </Card>

        {/* Sign out */}
        <button
          onClick={() => setShowSignOut(true)}
          style={{
            padding: '14px',
            background: 'transparent',
            border: `1px solid ${user?.subscriptionTier === 'pro' ? 'var(--tab-border)' : 'var(--expired)'}`,
            borderRadius: '14px',
            color: user?.subscriptionTier === 'pro' ? 'var(--text-muted)' : 'var(--expired)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          Sign Out
        </button>

        {/* Delete account */}
        <button
          onClick={() => setShowDeleteAccount(true)}
          style={{
            padding: '12px',
            background: 'transparent',
            border: 'none',
            borderRadius: '14px',
            color: 'var(--expired)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            opacity: 0.85,
          }}
        >
          Delete Account
        </button>
      </div>

      {showUpgrade && (
        <UpgradeModal
          feature="pantry"
          onClose={() => setShowUpgrade(false)}
          onUpgrade={async () => { await setSubscriptionTier('pro'); setShowUpgrade(false); }}
        />
      )}

      {showCancelPro && (
        <CancelProModal
          onClose={() => setShowCancelPro(false)}
          onConfirm={async () => { await setSubscriptionTier('free'); setShowCancelPro(false); }}
        />
      )}

      {showHousehold && (
        <HouseholdModal onClose={() => setShowHousehold(false)} />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

      {showSignOut && (
        <SignOutModal
          isPro={user?.subscriptionTier === 'pro'}
          onClose={() => setShowSignOut(false)}
          onConfirm={handleSignOut}
        />
      )}

      {legalDoc && (
        <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: `calc(env(safe-area-inset-bottom) + 24px)`,
          left: '16px',
          right: '16px',
          background: 'rgba(30,30,30,0.92)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '14px',
          fontSize: '13px',
          lineHeight: 1.45,
          zIndex: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          textAlign: 'center',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function SettingsLink({ label, onClick, hideBorder }: { label: string; onClick: () => void; hideBorder?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        background: 'none',
        border: 'none',
        borderBottom: hideBorder ? 'none' : '1px solid var(--tab-border)',
        color: 'var(--text-primary)',
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>›</span>
    </button>
  );
}
