import { Suspense, lazy, useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import { loadProfile, loadAllData, wasSignOutUserInitiated, clearUserInitiatedSignOutFlag } from './lib/supabaseSync';
import { formatLocalDate } from './types';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { TabBar } from './components/TabBar';
import { SettingsScreen } from './screens/SettingsScreen';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import * as debug from './lib/debug';

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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="4" height="10" rx="1"/>
          <rect x="9" y="5" width="2" height="14" rx="1"/>
          <rect x="13" y="7" width="3" height="10" rx="1"/>
          <rect x="18" y="6" width="2" height="12" rx="1"/>
          <line x1="1" y1="12" x2="23" y2="12" stroke="none"/>
        </svg>
      ),
      action: () => { setOpen(false); onScan(); },
      delay: '60ms',
      bottom: '222px',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 88, background: 'rgba(0,0,0,0.25)' }}
        />
      )}

      {/* Option buttons */}
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

      {/* Main + button */}
      <button
        onClick={() => setOpen(o => !o)}
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
  const { user, activeTab, setActiveTab, setAddItemMode, theme, showSettings, setUser, setSupabaseUserId, loadCloudData, resetOnboarding, setOAuthNewUser } = useStore();

  // Handle deep link callback from OAuth (Google Sign-In via browser)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastProcessedUrl: string | null = null;
    const listener = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.includes('auth/callback')) return;
      // iOS can deliver the same deep link multiple times — only handle it once
      if (url === lastProcessedUrl) return;
      lastProcessedUrl = url;
      debug.log('[oauth] deep link received, closing browser');
      await Browser.close();
      const hashParams = new URLSearchParams(url.split('#')[1] ?? '');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      debug.log('[oauth] tokens present:', { access: !!accessToken, refresh: !!refreshToken });
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        debug.log('[oauth] setSession result:', { user: data.session?.user.id, error: error?.message });
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      debug.log('[auth] state change:', event, 'userId:', session?.user?.id);
      if (event === 'SIGNED_OUT') {
        if (wasSignOutUserInitiated()) {
          // User tapped Sign Out in Settings — full wipe.
          clearUserInitiatedSignOutFlag();
          resetOnboarding();
        } else {
          // Passive session expiry / refresh failure / remote revocation.
          // Don't wipe local data — let the user keep using the app offline.
          // They can re-authenticate later and we'll rehydrate from cloud.
          debug.log('[auth] passive sign-out — keeping local data');
          setSupabaseUserId(null);
        }
        return;
      }
      if (!session?.user) return;

      const sbUser = session.user;
      setSupabaseUserId(sbUser.id);

      try {
      const profile = await loadProfile(sbUser.id);
      debug.log('[auth] loaded profile:', { hasProfile: !!profile, onboardingComplete: profile?.onboarding_complete });
      if (profile?.onboarding_complete) {
        // Transition to main app BEFORE loading pantry/waste data — a failed
        // data load must not leave the user stranded on the sign-in screen.
        setUser({
          id: sbUser.id,
          name: profile.name ?? sbUser.user_metadata?.full_name ?? 'Friend',
          email: profile.email ?? sbUser.email,
          authProvider: profile.auth_provider as 'google' | 'apple' | 'guest',
          dietaryPreferences: (profile.dietary_preferences ?? []) as never,
          createdAt: profile.created_at,
          onboardingComplete: true,
          streakDays: profile.streak_days,
          lastActiveDate: profile.last_active_date ?? formatLocalDate(new Date()),
          subscriptionTier: profile.subscription_tier as 'free' | 'pro',
          avoChatCount: profile.avo_chat_count,
          avoChatResetDate: profile.avo_chat_reset_date ?? formatLocalDate(new Date()),
        });
        debug.log('[auth] setUser called — transitioning to main app');
        try {
          const { pantryItems, wasteLogs } = await loadAllData(sbUser.id);
          loadCloudData(pantryItems, wasteLogs);
          debug.log('[auth] cloud data loaded:', { pantryCount: pantryItems.length, wasteCount: wasteLogs.length });
        } catch (err) {
          debug.warn('[auth] loadAllData failed, continuing without cloud data:', err);
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
      } catch (err) {
        debug.error('[auth] handler threw — user will be stranded unless we recover:', err);
        // Fallback: at least put the user into onboarding with whatever provider we know
        const provider = sbUser.app_metadata?.provider === 'apple' ? 'apple' : 'google';
        setOAuthNewUser({
          name: sbUser.user_metadata?.full_name ?? sbUser.user_metadata?.name ?? '',
          email: sbUser.email ?? '',
          provider,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadCloudData, resetOnboarding, setOAuthNewUser, setSupabaseUserId, setUser]);

  if (!user?.onboardingComplete) {
    return (
      <div data-theme={theme} style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <OnboardingFlow />
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
      <div key={activeTab} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
    </div>
  );
}
