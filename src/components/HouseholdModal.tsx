import { useState, useEffect, useCallback } from 'react';
import { Card } from './Card';
import { useStore } from '../store/useStore';
import { HOUSEHOLD_MAX_MEMBERS } from '../types';
import type { HouseholdMember } from '../types';
import {
  createHousehold,
  joinHousehold,
  leaveHousehold,
  getHouseholdMembers,
} from '../lib/households';
import { loadAllData, flushOutbox } from '../lib/supabaseSync';
import * as debug from '../lib/debug';

type StreakChoice = 'personal' | 'household';

interface HouseholdModalProps {
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg-primary)',
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 24px',
  animation: 'upgradeFadeIn 0.35s ease-out',
  overflowY: 'auto',
};

const primaryBtn: React.CSSProperties = {
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
};

export function HouseholdModal({ onClose }: HouseholdModalProps) {
  const { household, setHousehold, supabaseUserId, loadCloudData, setHouseholdStreakEnabled } = useStore();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Streak prompt state: shown before create/join to let the user choose
  const [streakPromptPending, setStreakPromptPending] = useState<'create' | 'join' | null>(null);

  const refreshMembers = useCallback(async () => {
    if (!household) return;
    try {
      setMembers(await getHouseholdMembers());
    } catch (e) {
      debug.error('[household] member load failed', e);
    }
  }, [household]);

  useEffect(() => { void refreshMembers(); }, [refreshMembers]);

  // After joining/creating/leaving, reload the now-current pantry (shared or solo).
  const reloadPantry = async (householdId: string | null) => {
    if (!supabaseUserId) return;
    try {
      // Drain any queued offline writes BEFORE loading from the server, or an
      // item added while offline (still sitting in the outbox) would be wiped
      // when loadCloudData replaces local state with the server's. Mirrors the
      // flushOutbox()→loadCloudData order App.tsx already uses on sign-in.
      await flushOutbox();
      const { pantryItems, wasteLogs } = await loadAllData(supabaseUserId, householdId);
      loadCloudData(pantryItems, wasteLogs);
    } catch (e) {
      debug.error('[household] pantry reload failed', e);
    }
  };

  const doCreate = async (streakChoice: StreakChoice) => {
    setBusy(true); setError(null);
    setHouseholdStreakEnabled(streakChoice === 'household');
    try {
      const hh = await createHousehold();
      setHousehold(hh);
      await reloadPantry(hh.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create household');
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async (streakChoice: StreakChoice) => {
    if (!code.trim()) return;
    setBusy(true); setError(null);
    setHouseholdStreakEnabled(streakChoice === 'household');
    try {
      const hh = await joinHousehold(code.trim());
      setHousehold(hh);
      await reloadPantry(hh.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join household');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => { if (!busy) setStreakPromptPending('create'); };
  const handleJoin = () => { if (!busy && code.trim()) setStreakPromptPending('join'); };

  const handleStreakChoice = (choice: StreakChoice) => {
    const action = streakPromptPending;
    setStreakPromptPending(null);
    if (action === 'create') void doCreate(choice);
    else if (action === 'join') void doJoin(choice);
  };

  const handleLeave = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await leaveHousehold();
      setHousehold(null);
      await reloadPantry(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave household');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; the code is shown on screen regardless
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Household</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {household
              ? 'Everyone in your household shares one pantry — no more double-buying.'
              : `Share one pantry with up to ${HOUSEHOLD_MAX_MEMBERS} people. They join free with your invite code.`}
          </p>
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--expired)', lineHeight: 1.5 }}>{error}</div>
        )}

        {household ? (
          <>
            <Card style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Invite code
              </div>
              <button
                onClick={handleCopy}
                style={{ ...primaryBtn, background: 'transparent', color: 'var(--text-primary)', border: '1.5px dashed var(--accent)', width: '100%', fontFamily: 'DM Mono, monospace', letterSpacing: '0.2em', fontSize: '22px' }}
              >
                {household.inviteCode}
              </button>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {copied ? 'Copied!' : 'Tap to copy · share it with your household'}
              </div>
            </Card>

            <Card style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Members ({members.length}/{HOUSEHOLD_MAX_MEMBERS})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {members.map(m => (
                  <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', textAlign: 'left' }}>
                    <span>{m.name || 'Member'}</span>
                    {m.role === 'owner' && (
                      <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>OWNER</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <button onClick={handleLeave} disabled={busy} style={{ ...primaryBtn, background: 'transparent', color: 'var(--expired)', border: '1.5px solid var(--expired)', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Leaving…' : 'Leave household'}
            </button>
          </>
        ) : (
          <>
            <button onClick={handleCreate} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Working…' : 'Create a household'}
            </button>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— or join one —</div>

            <Card style={{ padding: '18px 20px' }}>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={8}
                aria-label="Household invite code"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.2em', fontSize: '18px', textAlign: 'center', boxSizing: 'border-box' }}
              />
              <button onClick={handleJoin} disabled={busy || !code.trim()} style={{ ...primaryBtn, width: '100%', marginTop: '12px', opacity: (busy || !code.trim()) ? 0.5 : 1 }}>
                {busy ? 'Joining…' : 'Join household'}
              </button>
            </Card>
          </>
        )}

        <button onClick={busy ? undefined : onClose} style={{ padding: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: "'Cormorant Garamond', serif", fontSize: '13px', cursor: busy ? 'default' : 'pointer' }}>
          Done
        </button>
      </div>

      {/* Streak choice prompt — shown before create/join */}
      {streakPromptPending && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          animation: 'upgradeFadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '20px',
            padding: '28px 24px',
            maxWidth: '340px',
            width: '100%',
            display: 'flex', flexDirection: 'column', gap: '16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '36px' }}>🔥</div>
            <div>
              <div style={{ fontSize: '19px', fontWeight: 800, fontFamily: "'Cormorant Garamond', serif", marginBottom: '8px' }}>
                Start a Household Streak?
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Everyone in the household shares one streak. Log food you used to keep it alive.
              </div>
            </div>
            <div style={{
              background: 'rgba(205, 92, 92, 0.08)',
              border: '1px solid rgba(205, 92, 92, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '12px',
              color: 'var(--expired)',
              lineHeight: 1.5,
              textAlign: 'left',
            }}>
              ⚠️ <strong>Heads up:</strong> If <em>any</em> member tosses food, the streak resets for <em>everyone</em>. Your personal streak will be replaced by the shared one.
            </div>
            <button
              onClick={() => handleStreakChoice('household')}
              style={{ ...primaryBtn, width: '100%' }}
            >
              Yes — share our streak 🔥
            </button>
            <button
              onClick={() => handleStreakChoice('personal')}
              style={{ ...primaryBtn, width: '100%', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              No thanks, keep personal streaks
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes upgradeFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
