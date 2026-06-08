import { useState, useEffect, useRef } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { UpgradeModal } from '../components/UpgradeModal';
import { useStore } from '../store/useStore';
import { formatLocalDate } from '../types';
import type { DietaryPref, AuthProvider, SubscriptionTier } from '../types';
import { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, upsertProfile, EmailAlreadyRegisteredError, verifyEmailOtp, resendEmailOtp } from '../lib/supabaseSync';

type Step = 'welcome' | 'signin' | 'name' | 'diet' | 'setup' | 'ready';

const SETUP_MESSAGES = [
  'Personalizing your recipes...',
  'Setting up your shelf...',
  'Organizing your categories...',
  'Preparing Avo...',
  'Finishing touches...',
  'Almost ready!',
];

const DIETS: { id: DietaryPref; label: string; emoji: string }[] = [
  { id: 'none', label: 'No restrictions', emoji: '🍽️' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
  { id: 'dairy-free', label: 'Dairy-free', emoji: '🥛' },
  { id: 'nut-free', label: 'Nut-free', emoji: '🥜' },
];

export function OnboardingFlow() {
  const { setUser, oauthNewUser, setOAuthNewUser } = useStore();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [authProvider, setAuthProvider] = useState<AuthProvider>('guest');
  const [email, setEmail] = useState<string | undefined>();
  const [diets, setDiets] = useState<DietaryPref[]>(['none']);
  const [chosenTier, setChosenTier] = useState<SubscriptionTier>('free');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // After OAuth redirect: auto-skip sign-in and advance to the name step.
  // We don't pre-fill the name — the user types it fresh.
  useEffect(() => {
    if (!oauthNewUser) return;
    const nextUser = oauthNewUser;
    const timer = window.setTimeout(() => {
      if (nextUser.email) setEmail(nextUser.email);
      setAuthProvider(nextUser.provider);
      setOAuthNewUser(null);
      setStep('name');
    }, 0);

    return () => window.clearTimeout(timer);
  }, [oauthNewUser, setOAuthNewUser]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  const handleSignIn = async (provider: 'apple' | 'google') => {
    setAuthProvider(provider);
    setEmailError(null);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
      // Page will redirect to OAuth provider — when it returns, App.tsx handles the session
    } catch {
      setEmailError('Sign in failed. Please try again.');
    }
  };

  const handleEmailSubmit = async () => {
    const trimmedEmail = emailValue.trim();
    if (!trimmedEmail.includes('@')) {
      setEmailError('Please enter a valid email');
      return;
    }
    if (passwordValue.length < 6) {
      setEmailError('Password must be at least 6 characters');
      return;
    }
    setEmailSubmitting(true);
    setEmailError(null);
    setEmailNotice(null);
    try {
      setAuthProvider('email');
      if (emailMode === 'signin') {
        await signInWithEmail(trimmedEmail, passwordValue);
        // Auth listener in App.tsx handles routing on successful sign-in
      } else {
        const { needsConfirmation } = await signUpWithEmail(trimmedEmail, passwordValue);
        if (needsConfirmation) {
          // Switch to the 6-digit code entry screen
          setPendingEmail(trimmedEmail);
          setAwaitingCode(true);
          setCodeValue('');
          setEmailError(null);
          setEmailNotice(null);
          setResendCooldown(60);
          setEmailSubmitting(false);
        }
        // If !needsConfirmation, auth listener will fire SIGNED_IN and route the user
      }
    } catch (e) {
      if (e instanceof EmailAlreadyRegisteredError) {
        // Flip the form to sign-in mode and keep the email prefilled
        setEmailMode('signin');
        setEmailError('This email is already registered. Enter your password to sign in.');
        setEmailSubmitting(false);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setEmailError(msg);
      setEmailSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = codeValue.trim();
    if (code.length < 6) {
      setEmailError('Enter the code from your email');
      return;
    }
    setEmailSubmitting(true);
    setEmailError(null);
    setEmailNotice(null);
    try {
      setAuthProvider('email');
      await verifyEmailOtp(pendingEmail, code);
      // verifyOtp creates a session → SIGNED_IN listener in App.tsx routes the
      // user into onboarding automatically. Leave the spinner up during that.
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      // Supabase surfaces OTP failures as "token" errors — translate to user-friendly copy.
      const msg = !raw || /token|otp|invalid|expired/i.test(raw)
        ? 'Expired or invalid code — please try again.'
        : raw;
      setEmailError(msg);
      setEmailSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setEmailError(null);
    setEmailNotice(null);
    try {
      await resendEmailOtp(pendingEmail);
      setResendCooldown(60);
      setEmailNotice(`New code sent to ${pendingEmail}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not resend the code. Please wait a moment and try again.';
      setEmailError(msg);
    }
  };

  const toggleDiet = (d: DietaryPref) => {
    if (d === 'none') {
      setDiets(['none']);
      return;
    }
    setDiets(prev => {
      const next = prev.filter(p => p !== 'none');
      return next.includes(d) ? next.filter(p => p !== d) : [...next, d];
    });
  };

  const handleComplete = () => {
    const { supabaseUserId } = useStore.getState();
    const userId = supabaseUserId ?? `u-${Date.now()}`;
    const newUser = {
      id: userId,
      name: name.trim() || 'Friend',
      email,
      authProvider,
      dietaryPreferences: diets,
      createdAt: new Date().toISOString(),
      onboardingComplete: true,
      streakDays: 0,
      lastActiveDate: formatLocalDate(new Date()),
      subscriptionTier: chosenTier,
      avoChatCount: 0,
      avoChatResetDate: formatLocalDate(new Date()),
    };
    setUser(newUser);
    if (supabaseUserId) upsertProfile(newUser, supabaseUserId);
  };

  return (
    <div className="onboarding-scroll" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px 60px',
      gap: '20px',
      textAlign: 'center',
      position: 'relative',
    }}>
      {step === 'welcome' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AvocadoMascot size={90} />
          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2 }}>
            Meet Avo, your<br />
            <span style={{ color: 'var(--accent)' }}>Pantre</span> buddy
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '300px' }}>
            I'll help you track your food, reduce waste, and save money. Together we'll make every ingredient count!
          </p>
          <button
            className="btn-solid"
            onClick={() => setStep('signin')}
            style={{
              padding: '16px 48px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Let's get started!
          </button>
        </div>
      )}

      {step === 'signin' && !awaitingCode && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <AvocadoMascot size={70} />
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Sign in to save your data</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '280px' }}>
            Keep your pantry, recipes, and subscription synced across devices.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '300px', marginTop: '8px' }}>
            {/* Sign in with Apple */}
            <button
              onClick={() => handleSignIn('apple')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '14px 20px', borderRadius: '14px', border: 'none',
                background: '#000', color: '#fff',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                width: '100%',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Sign in with Apple
            </button>

            {/* Sign in with Google */}
            <button
              onClick={() => handleSignIn('google')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '14px 20px', borderRadius: '14px',
                border: '1px solid var(--tab-border)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                width: '100%',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z" fill="#FBBC05"/>
                <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            {/* Sign in with Email — expands inline below */}
            <button
              onClick={() => { setEmailExpanded(e => !e); setEmailError(null); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '14px 20px', borderRadius: '14px',
                border: '1px solid var(--tab-border)',
                background: 'transparent', color: 'var(--text-primary)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                width: '100%',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 7l9 6 9-6"/>
              </svg>
              Sign in with Email
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: emailExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
                  marginLeft: '4px',
                }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Inline expanding email form */}
            <div
              style={{
                overflow: 'hidden',
                maxHeight: emailExpanded ? '320px' : '0px',
                opacity: emailExpanded ? 1 : 0,
                transform: emailExpanded ? 'translateY(0)' : 'translateY(-6px)',
                transition: 'max-height 320ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms ease, transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
                width: '100%',
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '4px 2px 2px',
              }}>
                <input
                  type="email"
                  value={emailValue}
                  onChange={e => setEmailValue(e.target.value)}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={emailSubmitting}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="password"
                  value={passwordValue}
                  onChange={e => setPasswordValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void handleEmailSubmit()}
                  placeholder={emailMode === 'signup' ? 'Password (6+ characters)' : 'Password'}
                  disabled={emailSubmitting}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {emailError && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--expired)',
                    padding: '2px 4px',
                    lineHeight: 1.4,
                  }}>
                    {emailError}
                  </div>
                )}
                {emailNotice && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--accent)',
                    padding: '8px 10px',
                    lineHeight: 1.4,
                    background: 'var(--accent-dim)',
                    borderRadius: '8px',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>{emailNotice}
                  </div>
                )}
                <button
                  onClick={() => { void handleEmailSubmit(); }}
                  disabled={emailSubmitting}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: emailSubmitting ? 'not-allowed' : 'pointer',
                    opacity: emailSubmitting ? 0.7 : 1,
                    width: '100%',
                  }}
                >
                  {emailSubmitting ? '…' : emailMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
                <button
                  onClick={() => { setEmailMode(m => m === 'signin' ? 'signup' : 'signin'); setEmailError(null); }}
                  disabled={emailSubmitting}
                  style={{
                    padding: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: emailSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {emailMode === 'signin' ? 'New to Pantre? Create an account' : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => { setAuthProvider('guest'); setStep('name'); }}
            style={{
              padding: '10px', background: 'none', border: 'none',
              color: 'var(--text-muted)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '13px', cursor: 'pointer', marginTop: '4px',
            }}
          >
            Continue without an account
          </button>
        </div>
      )}

      {step === 'signin' && awaitingCode && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <AvocadoMascot size={70} />
          <h2 style={{ fontSize: '22px', fontWeight: 800, textAlign: 'center' }}>Check your email!</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '280px', textAlign: 'center' }}>
            Avo sent a 6-digit code to<br />
            <strong style={{ color: 'var(--text-primary)' }}>{pendingEmail}</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '300px' }}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codeValue}
              onChange={e => setCodeValue(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && void handleVerifyCode()}
              placeholder="· · · · · ·"
              disabled={emailSubmitting}
              autoFocus
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                border: '2px solid var(--accent)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '0.4em',
                textAlign: 'center',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {emailError && (
              <div style={{ fontSize: '12px', color: 'var(--expired)', padding: '2px 4px', lineHeight: 1.4 }}>
                {emailError}
              </div>
            )}
            {emailNotice && (
              <div style={{ fontSize: '12px', color: 'var(--accent)', padding: '8px 10px', lineHeight: 1.4, background: 'var(--accent-dim)', borderRadius: '8px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>{emailNotice}
              </div>
            )}
            <button
              onClick={() => { void handleVerifyCode(); }}
              disabled={emailSubmitting || codeValue.length < 6}

              style={{
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '15px',
                fontWeight: 700,
                cursor: (emailSubmitting || codeValue.length < 6) ? 'not-allowed' : 'pointer',
                opacity: (emailSubmitting || codeValue.length < 6) ? 0.7 : 1,
                width: '100%',
              }}
            >
              {emailSubmitting ? '…' : "Let's go!"}
            </button>
            <button
              onClick={() => { void handleResendCode(); }}
              disabled={emailSubmitting || resendCooldown > 0}
              style={{
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid var(--input-border)',
                background: 'none',
                color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--accent)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '13px',
                fontWeight: 600,
                cursor: (emailSubmitting || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                width: '100%',
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
            <button
              onClick={() => { setAwaitingCode(false); setCodeValue(''); setEmailError(null); setEmailNotice(null); setResendCooldown(0); }}
              disabled={emailSubmitting}
              style={{
                padding: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '12px',
                fontWeight: 600,
                cursor: emailSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              ← Use a different email
            </button>
          </div>
        </div>
      )}

      {step === 'name' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <AvocadoMascot size={60} />
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>What's your name?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>So I know what to call you!</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name..."
            autoFocus
            onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('diet')}
            style={{
              width: '100%',
              maxWidth: '300px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '14px',
              padding: '16px 20px',
              color: 'var(--text-primary)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '16px',
              outline: 'none',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          />
          <button
            className="btn-solid"
            onClick={() => setStep('diet')}
            disabled={!name.trim()}
            style={{
              padding: '14px 40px',
              background: name.trim() ? 'var(--accent)' : 'var(--accent-dim)',
              border: 'none',
              borderRadius: '14px',
              color: name.trim() ? '#fff' : 'var(--text-muted)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '15px',
              fontWeight: 700,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Continue
          </button>
        </div>
      )}


      {step === 'diet' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <AvocadoMascot size={60} />
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Dietary preferences?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>We'll tailor recipe suggestions for you</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '320px' }}>
            {DIETS.map(d => {
              const isSelected = diets.includes(d.id);
              return (
                <button
                  key={d.id}
                  className="btn-toggle"
                  onClick={() => toggleDiet(d.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '14px',
                    border: isSelected ? '1px solid var(--forest-dim)' : '1px solid var(--tab-border)',
                    background: isSelected ? 'var(--forest-light)' : 'transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: "'Cormorant Garamond', serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{d.emoji}</span> {d.label}
                </button>
              );
            })}
          </div>
          <button
            className="btn-solid"
            onClick={() => setStep('setup')}
            style={{
              padding: '14px 40px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'setup' && (
        <SetupAnimation name={name} onDone={() => setShowUpgrade(true)} />
      )}

      {showUpgrade && (
        <UpgradeModal
          feature="onboarding"
          closeDelay={6000}
          onClose={() => { setShowUpgrade(false); setStep('ready'); }}
          onUpgrade={() => { setChosenTier('pro'); setShowUpgrade(false); setStep('ready'); }}
        />
      )}


      {step === 'ready' && (
        <div className="card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AvocadoMascot size={90} />
          <h2 style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.2 }}>
            You're all set, <span style={{ color: 'var(--accent)' }}>{name || 'Friend'}</span>!
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '300px' }}>
            Tap the + button to add your first item. I'll help you track freshness, cut waste, and find recipes!
          </p>
          <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
            {/* Track */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>Track</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Your food</div>
            </div>
            {/* Cook */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3C7 3 3 7 3 12h18c0-5-4-9-9-9z"/>
                  <path d="M3 12h18v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-1z"/>
                  <line x1="12" y1="16" x2="12" y2="20"/>
                  <line x1="8" y1="20" x2="16" y2="20"/>
                </svg>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>Cook</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Smart recipes</div>
            </div>
            {/* Save */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3C7 8 4 10 4 14a8 8 0 0016 0c0-4-3-6-8-11z"/>
                  <path d="M12 22c2 0 4-1.5 4-4 0-2.5-2-3.5-4-6-2 2.5-4 3.5-4 6 0 2.5 2 4 4 4z"/>
                </svg>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>Save</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>The planet</div>
            </div>
          </div>
          <button
            className="btn-solid"
            onClick={handleComplete}
            style={{
              padding: '16px 48px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '12px',
            }}
          >
            Open My Pantry
          </button>
        </div>
      )}

      {/* Step indicator — only shown during user-input steps */}
      {(['welcome', 'signin', 'name', 'diet'] as Step[]).includes(step) && (() => {
        const USER_STEPS: Step[] = ['welcome', 'signin', 'name', 'diet'];
        const currentIdx = USER_STEPS.indexOf(step);
        return (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {USER_STEPS.map((s, i) => (
                <div key={s} style={{
                  width: step === s ? 20 : 6,
                  height: 6,
                  borderRadius: '3px',
                  background: i <= currentIdx ? 'var(--accent)' : 'var(--accent-dim)',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }} />
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Step {currentIdx + 1} of {USER_STEPS.length}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SetupAnimation({ name, onDone }: { name: string; onDone: () => void }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const totalDuration = 4000;
    const msgInterval = totalDuration / SETUP_MESSAGES.length;
    const progressInterval = 30;
    let elapsed = 0;

    const progressTimer = setInterval(() => {
      elapsed += progressInterval;
      setProgress(Math.min(100, (elapsed / totalDuration) * 100));
      if (elapsed >= totalDuration) {
        clearInterval(progressTimer);
        setTimeout(() => onDoneRef.current(), 400);
      }
    }, progressInterval);

    const msgTimer = setInterval(() => {
      setMsgIndex(prev => {
        const next = prev + 1;
        if (next >= SETUP_MESSAGES.length) { clearInterval(msgTimer); return prev; }
        return next;
      });
    }, msgInterval);

    return () => { clearInterval(progressTimer); clearInterval(msgTimer); };
  }, []);

  return (
    <div className="card-enter" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
    }}>
      {/* Bouncing Avo */}
      <div style={{ animation: 'setupBounce 1.2s ease-in-out infinite' }}>
        <AvocadoMascot size={80} isStatic />
      </div>

      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
          Setting up your shelf, {name || 'Friend'}
        </h2>
        <p
          key={msgIndex}
          style={{
            fontSize: '14px', color: 'var(--accent)', fontWeight: 600,
            animation: 'fadeUp 0.4s ease-out',
          }}
        >
          {SETUP_MESSAGES[msgIndex]}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%', maxWidth: '260px', height: '6px',
        borderRadius: '3px', background: 'var(--accent-dim)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: '3px', background: 'var(--accent)',
          width: `${progress}%`, transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Setup checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '260px' }}>
        {SETUP_MESSAGES.map((msg, i) => (
          <div key={msg} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            opacity: i <= msgIndex ? 1 : 0.3,
            transition: 'opacity 0.4s ease',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: i < msgIndex ? 'var(--accent)' : i === msgIndex ? 'var(--accent-dim)' : 'transparent',
              border: i < msgIndex ? 'none' : '1.5px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease',
            }}>
              {i < msgIndex && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 6 L5 8 L9 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {i === msgIndex && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                  animation: 'pulse 1s ease-in-out infinite',
                }} />
              )}
            </div>
            <span style={{ fontSize: '13px', fontWeight: i <= msgIndex ? 600 : 400 }}>{msg}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes setupBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
