import { Suspense, lazy, useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import { loadProfile, loadAllData, mergePantryItemsToCloud, flushOutbox, wasSignOutUserInitiated, clearUserInitiatedSignOutFlag } from './lib/supabaseSync';
import { getMyHousehold } from './lib/households';
import { subscribeHousehold, unsubscribeHousehold } from './lib/householdRealtime';
import { publishWidgetData } from './lib/widget';
import { formatLocalDate } from './types';
import type { AuthProvider, PantryItem } from './types';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { PantryMergeModal } from './components/PantryMergeModal';
import { TabBar } from './components/TabBar';
import { SettingsScreen } from './screens/SettingsScreen';
import { KeyboardScrollManager } from './components/KeyboardScrollManager';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import * as debug from './lib/debug';
import posthog from 'posthog-js';

const PantryScreen = lazy(() => import('./screens/PantryScreen').then((module) => ({ default: module.PantryScreen })));
const AddItemScreen = lazy(() => import('./screens/AddItemScreen').then((module) => ({ default: module.AddItemScreen })));
const CookScreen = lazy(() => import('./screens/CookScreen').then((module) => ({ default: module.CookScreen })));
const ImpactScreen = lazy(() => import('./screens/ImpactScreen').then((module) => ({ default: module.ImpactScreen })));
const PlanScreen = lazy(() => import('./screens/PlanScreen').then((module) => ({ default: module.PlanScreen })));

function FloatingAddButton({ onScan, onReceipt }: { onScan: () => void; onReceipt: () => void }) {
  const [open, setOpen] = useState(false);

  const options = [
    {
      label: 'Receipt',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
      action: () => { setOpen(false); onReceipt(); },
      delay: '0ms',
      bottom: '158px',
    },
    {
      label: 'Scan',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Corner brackets framing the barcode */}
          <path d="M3 8V5a2 2 0 0 1 2-2h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M21 16v3a2 2 0 0 1-2 2h-3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          {/* Variable-width barcode bars */}
          <line x1="7" y1="8" x2="7" y2="16" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
          <line x1="10" y1="8" x2="10" y2="16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          <line x1="13" y1="8" x2="13" y2="16" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="15.5" y1="8" x2="15.5" y2="16" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          <line x1="18" y1="8" x2="18" y2="16" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
      action: () => { setOpen(false); onScan(); },
      delay: '60ms',
      bottom: '222px',
    },
  ];

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 88, background: 'rgba(0,0,0,0.25)' }}
        />
      )}

      {options.map((opt) => (
        <div
          key={opt.label}
          style={{
            position: 'fixed',
            bottom: opt.bottom,
            right: '20px',
            zIndex: 91,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexDirection: 'row-reverse',
            transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
            opacity: open ? 1 : 0,
            transition: `transform 0.25s cubic-bezier(0.34,1.56,0.64,1) ${opt.delay}, opacity 0.2s ease ${opt.delay}`,
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          <button
            onClick={opt.action}
            aria-label={opt.label}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 12px rgba(74,124,89,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {opt.icon}
          </button>
          <span style={{
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: "'Cormorant Garamond', serif",
            padding: '5px 12px',
            borderRadius: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
          }}>
            {opt.label}
          </span>
        </div>
      ))}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close add menu' : 'Add item'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom: '86px',
          right: '20px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid rgba(255,255,255,0.25)',
          boxShadow: '0 4px 14px rgba(74,124,89,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 92,
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <line x1="11" y1="4" x2="11" y2="18"/>
          <line x1="4" y1="11" x2="18" y2="11"/>
        </svg>
      </button>
    </>
  );
}

function ScreenFallback({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: 'var(--text-muted)',
      fontSize: '14px',
      fontFamily: "'Cormorant Garamond', serif",
    }}>
      Loading {label}...
    </div>
  );
}

export default function App() {
  const { user, activeTab, setActiveTab, setAddItemMode, theme, showSettings, setUser, setSupabaseUserId, loadCloudData, resetOnboarding, setOAuthNewUser, setHousehold, household, supabaseUserId } = useStore();

  // Set when a guest who has local pantry items signs into an existing account.
  // The modal asks whether to merge the local items into the cloud account or
  // discard them and use the cloud-only state. Auth completion is paused until
  // the user picks.
  const [pendingMerge, setPendingMerge] = useState<{
    items: PantryItem[];
    finalize: (mode: 'merge' | 'discard') => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastProcessedUrl: string | null = null;
    const listener = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.includes('auth/callback')) return;
      if (url === lastProcessedUrl) return;
      lastProcessedUrl = url;
      debug.log('[oauth] deep link received, closing browser');
      await Browser.close();
      const hashParams = new URLSearchParams(url.split('#')[1] ?? '');
      const queryParams = new URLSearchParams((url.split('?')[1] ?? '').split('#')[0]);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = queryParams.get('code');
      debug.log('[oauth] tokens present:', { access: !!accessToken, refresh: !!refreshToken, code: !!code });
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        debug.log('[oauth] setSession result:', { user: data.session?.user.id, error: error?.message });
      } else if (code) {
        debug.log('[oauth] PKCE code received, exchanging for session');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        debug.log('[oauth] exchangeCode result:', { user: data.session?.user?.id, error: error?.message });
      } else {
        debug.warn('[oauth] missing tokens — URL was:', url);
      }
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1612' : '#faf7f2');
  }, [theme]);

  // Keep the iOS home-screen widget in sync with the pantry (no-op off iOS).
  const pantryItems = useStore(s => s.pantryItems);
  useEffect(() => {
    void publishWidgetData(pantryItems);
  }, [pantryItems]);

  useEffect(() => {
    // Monotonic token: each auth event claims a number, and any async work
    // checks it's still the latest before applying state. This stops two
    // overlapping events (e.g. rapid SIGNED_IN/TOKEN_REFRESHED) from loading
    // profile/data out of order and clobbering each other.
    let authSeq = 0;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const mySeq = ++authSeq;
      debug.log('[auth] state change:', event, 'userId:', session?.user?.id);
      if (event === 'SIGNED_OUT') {
        if (wasSignOutUserInitiated()) {
          clearUserInitiatedSignOutFlag();
          posthog.reset();
          resetOnboarding();
        } else {
          debug.log('[auth] passive sign-out — keeping local data');
          setSupabaseUserId(null);
        }
        return;
      }
      if (!session?.user) return;

      const sbUser = session.user;
      // Capture pre-signin state so we can detect a guest→account transition
      // and offer the local pantry items to the cloud account.
      const prevUserId = useStore.getState().supabaseUserId;
      const localItemsBeforeSignin = useStore.getState().pantryItems;
      setSupabaseUserId(sbUser.id);

      // loadProfile throws only on a real error. A null result means the row
      // genuinely doesn't exist (a new user). So a thrown error here is a
      // transient failure — bail WITHOUT routing the user into onboarding, so a
      // returning user keeps their locally-persisted session instead of being
      // forced to re-onboard on a network blip.
      let profile;
      try {
        profile = await loadProfile(sbUser.id);
      } catch (err) {
        debug.error('[auth] loadProfile failed (transient) — not routing to onboarding:', err);
        return;
      }
      if (mySeq !== authSeq) return; // superseded by a newer auth event

      debug.log('[auth] loaded profile:', { hasProfile: !!profile, onboardingComplete: profile?.onboarding_complete });
      if (profile?.onboarding_complete) {
        // Transition to main app BEFORE loading pantry/waste data — a failed
        // data load must not leave the user stranded on the sign-in screen.
        setUser({
          id: sbUser.id,
          name: profile.name ?? sbUser.user_metadata?.full_name ?? 'Friend',
          email: profile.email ?? sbUser.email,
          authProvider: profile.auth_provider as AuthProvider,
          dietaryPreferences: (profile.dietary_preferences ?? []) as never,
          createdAt: profile.created_at,
          onboardingComplete: true,
          streakDays: profile.streak_days,
          lastActiveDate: profile.last_active_date ?? formatLocalDate(new Date()),
          subscriptionTier: profile.subscription_tier as 'free' | 'pro',
          avoChatCount: profile.avo_chat_count,
          avoChatResetDate: profile.avo_chat_reset_date ?? formatLocalDate(new Date()),
          avoTrialStartedAt: profile.avo_trial_started_at ?? null,
          avoFreeChatsUsed: profile.avo_free_chats_used ?? 0,
        });
        debug.log('[auth] setUser called — transitioning to main app');
        posthog.identify(sbUser.id, {
          email: sbUser.email,
          tier: profile.subscription_tier,
          auth_provider: profile.auth_provider,
        });

        const finishSignIn = async (mergeLocal: boolean) => {
          if (mergeLocal && localItemsBeforeSignin.length > 0) {
            try {
              await mergePantryItemsToCloud(localItemsBeforeSignin, sbUser.id);
            } catch (err) {
              debug.warn('[auth] merge failed, falling back to cloud-only:', err);
            }
          }
          try {
            // Resolve the user's household first so we load the SHARED pantry
            // (every member's items live under the same household_id).
            const household = await getMyHousehold(sbUser.id);
            if (mySeq !== authSeq) return; // superseded while loading
            setHousehold(household);
            // Push any writes that failed to sync while offline UP to the cloud
            // BEFORE we read it back — otherwise loadAllData would overwrite local
            // state and silently drop offline adds / resurrect offline deletes.
            await flushOutbox();
            const { pantryItems, wasteLogs } = await loadAllData(sbUser.id, household?.id ?? null);
            if (mySeq !== authSeq) return; // superseded while loading
            loadCloudData(pantryItems, wasteLogs);
            debug.log('[auth] cloud data loaded:', { pantryCount: pantryItems.length, wasteCount: wasteLogs.length, household: household?.id ?? null });
          } catch (err) {
            debug.warn('[auth] loadAllData failed, keeping local data:', err);
          }
        };

        // Guest→account transition with unsynced local items: ask before we
        // overwrite local state with the cloud's pantry.
        if (prevUserId === null && localItemsBeforeSignin.length > 0) {
          setPendingMerge({
            items: localItemsBeforeSignin,
            finalize: async (mode) => {
              await finishSignIn(mode === 'merge');
              setPendingMerge(null);
            },
          });
        } else {
          await finishSignIn(false);
        }
      } else {
        const rawProvider = sbUser.app_metadata?.provider;
        const provider: 'apple' | 'google' | 'email' =
          rawProvider === 'apple' ? 'apple' :
          rawProvider === 'google' ? 'google' :
          'email';
        debug.log('[auth] no onboarding — calling setOAuthNewUser, provider:', provider);
        setOAuthNewUser({
          name: sbUser.user_metadata?.full_name ?? sbUser.user_metadata?.name ?? '',
          email: sbUser.email ?? '',
          provider,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadCloudData, resetOnboarding, setOAuthNewUser, setSupabaseUserId, setUser, setHousehold]);

  // Live-sync the shared pantry while the user is in a household. Re-subscribes
  // when the household changes (create/join/leave) and tears down on sign-out.
  useEffect(() => {
    if (household?.id && supabaseUserId) {
      subscribeHousehold(household.id);
      return () => unsubscribeHousehold();
    }
    unsubscribeHousehold();
  }, [household?.id, supabaseUserId]);

  if (!user?.onboardingComplete) {
    return (
      <div data-theme={theme} style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <OnboardingFlow />
        <KeyboardScrollManager />
      </div>
    );
  }

  const screens = {
    pantry: <PantryScreen />,
    add: <AddItemScreen />,
    cook: <CookScreen />,
    impact: <ImpactScreen />,
    plan: <PlanScreen />,
  };

  const activeScreenLabel = {
    pantry: 'pantry',
    add: 'add items',
    cook: 'Avo',
    impact: 'impact',
    plan: 'meal plan',
  }[activeTab];

  return (
    <div data-theme={theme} style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div id="kb-scroll-target" key={activeTab} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense fallback={<ScreenFallback label={activeScreenLabel} />}>
          {screens[activeTab]}
        </Suspense>
      </div>
      {activeTab !== 'add' && activeTab !== 'cook' && !showSettings && (
        <FloatingAddButton
          onScan={() => { setAddItemMode('scan'); setActiveTab('add'); }}
          onReceipt={() => { setAddItemMode('receipt'); setActiveTab('add'); }}
        />
      )}
      <TabBar />
      {showSettings && <SettingsScreen />}
      {pendingMerge && (
        <PantryMergeModal
          itemCount={pendingMerge.items.length}
          onMerge={() => pendingMerge.finalize('merge')}
          onDiscard={() => pendingMerge.finalize('discard')}
        />
      )}
      <KeyboardScrollManager />
    </div>
  );
}
