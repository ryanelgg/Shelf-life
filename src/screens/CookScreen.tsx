import { useState, useRef, useEffect } from 'react';
import posthog from 'posthog-js';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { SparkleIcon } from '../components/icons';
import { useStore } from '../store/useStore';
import { UpgradeModal } from '../components/UpgradeModal';
import { AvoConsentModal } from '../components/AvoConsentModal';
import { FREE_LIMITS, formatLocalDate, getDaysUntilExpiration, isAvoTrialActive, avoTrialDaysLeft } from '../types';
import { BROWSE_RECIPES } from '../data/recipes';
import type { Recipe } from '../types';
import {
  getAvoSession,
  setAvoSessionHistory,
  setAvoSessionMessages,
  type AvoChatMessage,
  type AvoDisplayMessage,
} from '../lib/avoChatSession';
import { requestAvoChat } from '../lib/avoApi';
import * as debug from '../lib/debug';
import { hapticLight } from '../lib/haptics';

const SUGGESTIONS = [
  "What foods are high in protein?",
  "Best foods for energy?",
  "What's heart-healthy to eat?",
  "Foods that fight inflammation?",
  "How do I eat for better sleep?",
];

export function CookScreen() {
  const { user, pantryItems, incrementAvoChat, decrementAvoChat, isPro, setSubscriptionTier, avoAiConsent, setAvoAiConsent } = useStore();
  const sessionOwnerId = user?.id ?? null;
  const [messages, setMessages] = useState<AvoDisplayMessage[]>(() => getAvoSession(sessionOwnerId).messages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'chat' | 'briefing'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<AvoChatMessage[]>(getAvoSession(sessionOwnerId).history);

  const isProUser = user?.subscriptionTier === 'pro';
  const trialActive = user ? isAvoTrialActive(user) : false;
  const trialDaysLeft = user ? avoTrialDaysLeft(user) : 0;
  // Pro users and users inside their 7-day trial both get the daily allowance;
  // free users past the trial fall back to the lifetime allotment.
  const hasProAccess = isProUser || trialActive;
  const today = formatLocalDate(new Date());
  const chatsUsed = hasProAccess
    ? (user?.avoChatResetDate === today ? (user?.avoChatCount ?? 0) : 0)
    : (user?.avoFreeChatsUsed ?? 0);
  const chatLimit = hasProAccess ? FREE_LIMITS.proChatPerDay : FREE_LIMITS.avoChatTotal;
  // Clamp: a legacy free user migrated with avoChatCount > avoChatTotal would
  // otherwise render a negative remaining count (e.g. "-3/5 free chats").
  const chatsRemaining = Math.max(0, chatLimit - chatsUsed);
  // Chips are dead when AI is off (declined) — disable them so a tap isn't a
  // silent no-op. (When consent is null the consent modal is covering the screen.)
  const chipsDisabled = isStreaming || avoAiConsent === 'declined';

  // Reset chat state when the signed-in user changes (prevents history leaking between accounts)
  useEffect(() => {
    const session = getAvoSession(sessionOwnerId);
    setMessages(session.messages);
    historyRef.current = session.history;
  }, [sessionOwnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pull the daily briefing up INSIDE the chat, on demand. Computed locally, so
  // it costs no AI call and can't fail — Avo just posts it as a message.
  const showDailyBriefing = (userText = "What's my daily briefing?") => {
    if (isStreaming) return;
    hapticLight();
    if (!hasProAccess) { setUpgradeReason('briefing'); setShowUpgrade(true); return; }
    const userMsg: AvoDisplayMessage = { id: `u-${crypto.randomUUID()}`, role: 'user', text: userText };
    const avoMsg: AvoDisplayMessage = { id: `a-${crypto.randomUUID()}`, role: 'avo', text: buildDailyBriefingText(pantryItems, user?.name) };
    setMessages(prev => {
      const next = [...prev, userMsg, avoMsg];
      setAvoSessionMessages(next);
      return next;
    });
    posthog.capture('avo_daily_briefing_viewed');
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Block sending if the user hasn't granted AI consent yet
    if (avoAiConsent !== 'granted') return;

    // The daily briefing is answered locally — no AI round-trip needed. Match
    // only the explicit feature word "briefing" (or "daily/my/morning brief"),
    // NOT a bare "brief" — otherwise "give me a brief overview of protein" gets
    // hijacked into the local briefing and never reaches Avo.
    if (/\bbriefing\b/i.test(trimmed) || /\b(daily|my|morning)\s+brief\b/i.test(trimmed)) {
      showDailyBriefing(trimmed); setInput(''); return;
    }

    hapticLight();

    if (!incrementAvoChat()) {
      setUpgradeReason('chat');
      setShowUpgrade(true);
      return;
    }

    posthog.capture('avo_chat_sent', { message_length: trimmed.length, conversation_length: messages.length });

    // Add user message to display
    const userMsgId = `u-${Date.now()}`;
    setMessages(prev => {
      const next = [...prev, { id: userMsgId, role: 'user' as const, text: trimmed }];
      setAvoSessionMessages(next);
      return next;
    });
    setInput('');
    setIsStreaming(true);

    // Build user message — include pantry context if relevant
    const pantryContext = pantryItems.length > 0
      ? `\n\n[User's current pantry: ${pantryItems.slice(0, 12).map(i => i.name).join(', ')}]`
      : '';
    const userContent = trimmed + pantryContext;

    // Append to history
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: userContent },
    ];
    setAvoSessionHistory(historyRef.current);

    // Create a streaming Avo message
    const avoMsgId = `a-${Date.now()}`;
    setMessages(prev => {
      const next = [...prev, { id: avoMsgId, role: 'avo' as const, text: '', streaming: true }];
      setAvoSessionMessages(next);
      return next;
    });

    try {
      const fullText = await requestAvoChat(historyRef.current);
      setMessages(prev => {
        const next = prev.map(m => m.id === avoMsgId ? { ...m, text: fullText } : m);
        setAvoSessionMessages(next);
        return next;
      });

      // Append assistant response to history
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: fullText },
      ];
      setAvoSessionHistory(historyRef.current);
    } catch (err) {
      debug.error('[Avo chat error]', err);
      // Rollback the chat credit since the request failed
      decrementAvoChat();
      const status = (err as { status?: number })?.status;
      const friendly = (err as { friendly?: boolean })?.friendly;
      const errorMsg = friendly
        ? (err as Error).message
        : status === 401
        ? "I couldn't verify your session — try signing out and back in."
        : status === 429
        ? "I'm getting a lot of questions right now — try again in a moment!"
        : status === 404
        ? "My brain isn't hooked up yet — the Avo chat service hasn't been deployed."
        : status && status >= 500
        ? "My brain had a hiccup on the server. Try again in a moment!"
        : "Something went wrong connecting to my brain. Try again?";

      setMessages(prev => {
        const next = prev.map(m => m.id === avoMsgId ? { ...m, text: errorMsg } : m);
        setAvoSessionMessages(next);
        return next;
      });
    } finally {
      setMessages(prev => {
        const next = prev.map(m => m.id === avoMsgId ? { ...m, streaming: false } : m);
        setAvoSessionMessages(next);
        return next;
      });
      setIsStreaming(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="screen-enter" style={{
        padding: '20px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: '-4px',
        flexShrink: 0,
      }}>
        <AvocadoMascot size={34} />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Ask Avo</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Your nutrition guide</p>
        </div>
      </div>

      {/* Free tier chat counter */}
      {!isPro() && (
        <div style={{
          padding: '0 16px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: '11px',
            color: chatsRemaining <= 1 ? 'var(--expiring)' : 'var(--text-muted)',
            fontWeight: 600,
          }}>
            {trialActive
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <SparkleIcon size={12} /> Avo trial · {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left · {chatsRemaining} chats today
                </span>
              : `${chatsRemaining}/${FREE_LIMITS.avoChatTotal} free chats`}
          </div>
          <button
            onClick={() => { setUpgradeReason('chat'); setShowUpgrade(true); }}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #D4A44A, #B8862D)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: "'Cormorant Garamond', serif",
              cursor: 'pointer',
            }}
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Suggestion chips */}
      <div className="chips-scroll" style={{
        display: 'flex',
        gap: '7px',
        overflowX: 'auto',
        padding: '0 16px 12px',
        flexShrink: 0,
        WebkitOverflowScrolling: 'touch' as const,
        scrollbarWidth: 'none' as const,
        msOverflowStyle: 'none' as const,
      }}>
        <button
          onClick={() => showDailyBriefing()}
          disabled={chipsDisabled}
          style={{
            padding: '7px 13px',
            borderRadius: '20px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: "'Cormorant Garamond', serif",
            cursor: chipsDisabled ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(74,124,89,0.2)',
            opacity: chipsDisabled ? 0.5 : 1,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <AvocadoMascot size={15} isStatic /> Today's briefing
          </span>
        </button>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => sendMessage(s)}
            disabled={chipsDisabled}
            style={{
              padding: '7px 13px',
              borderRadius: '20px',
              border: '1px solid var(--tab-border)',
              background: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: "'Cormorant Garamond', serif",
              cursor: chipsDisabled ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(74,124,89,0.08)',
              opacity: chipsDisabled ? 0.5 : 1,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Spacer pushes messages to the bottom when chat is short */}
        <div style={{ flex: 1 }} />
        {messages.map(msg => (
          <div
            key={msg.id}
            className="card-enter"
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            {msg.role === 'avo' && (
              <div style={{ flexShrink: 0, marginBottom: '2px' }}>
                <AvocadoMascot size={28} />
              </div>
            )}
            <div style={{
              maxWidth: '78%',
              padding: '10px 14px',
              borderRadius: msg.role === 'avo' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
              background: msg.role === 'avo' ? 'var(--bg-card)' : 'var(--accent)',
              border: msg.role === 'avo' ? '1px solid rgba(74,124,89,0.1)' : 'none',
              color: msg.role === 'avo' ? 'var(--text-primary)' : '#fff',
              fontSize: '13px',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              boxShadow: msg.role === 'avo' ? '0 1px 6px rgba(74,124,89,0.07)' : '0 2px 8px rgba(74,124,89,0.25)',
            }}>
              {msg.text || (msg.streaming ? <StreamingDots /> : '')}
            </div>
          </div>
        ))}

        <div ref={bottomRef} style={{ height: '8px' }} />
      </div>

      {/* Re-enable banner when consent was declined */}
      {avoAiConsent === 'declined' && (
        <div style={{
          margin: '0 16px 12px',
          padding: '12px 14px',
          borderRadius: '14px',
          border: '1px solid var(--tab-border)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Avo AI is off. Turn it on to ask questions about your pantry.
          </div>
          <button
            onClick={() => setAvoAiConsent(null)}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Turn on
          </button>
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: '12px 16px 20px',
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
        borderTop: '1px solid rgba(74,124,89,0.08)',
        background: 'var(--bg-primary)',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder={avoAiConsent === 'granted' ? 'Ask about nutrition...' : 'Turn on Avo AI to chat'}
          disabled={isStreaming || avoAiConsent !== 'granted'}
          style={{
            flex: 1,
            padding: '11px 14px',
            borderRadius: '22px',
            border: '1px solid var(--input-border)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            opacity: (isStreaming || avoAiConsent !== 'granted') ? 0.6 : 1,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming || avoAiConsent !== 'granted'}
          style={{
            width: 44, height: 44,
            borderRadius: '50%',
            background: (input.trim() && !isStreaming && avoAiConsent === 'granted') ? 'var(--accent)' : 'var(--accent-dim)',
            border: 'none',
            cursor: (input.trim() && !isStreaming && avoAiConsent === 'granted') ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !isStreaming ? '#fff' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {showUpgrade && (
        <UpgradeModal
          feature={upgradeReason}
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => { setSubscriptionTier('pro'); setShowUpgrade(false); }}
        />
      )}

      {avoAiConsent === null && (
        <AvoConsentModal
          onAccept={() => setAvoAiConsent('granted')}
          onDecline={() => setAvoAiConsent('declined')}
        />
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .chips-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function StreamingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--text-muted)',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Avo's Daily Briefing ─────────────────────────────────────────────────────
// Pro feature. Pulls expiring items + a recipe pick keyed to the time of day,
// then ties them together with a friendly Avo-voiced line.

interface PantryItemLite {
  id: string;
  name: string;
  expirationDate: string;
}


function getMealOfDay(): 'breakfast' | 'lunch' | 'dinner' {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  return 'dinner';
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function pickRecipeOfDay(meal: 'breakfast' | 'lunch' | 'dinner'): Recipe | null {
  const pool = BROWSE_RECIPES.filter(r => r.tags?.includes(meal));
  if (pool.length === 0) return null;
  // Stable for the whole day (won't flip mid-scroll)
  return pool[dayOfYear(new Date()) % pool.length];
}


// Build Avo's daily briefing as a chat message: expiring items + a time-of-day
// recipe pick, in Avo's voice. Pure/local — no AI call, so it never fails.
function buildDailyBriefingText(pantryItems: PantryItemLite[], userName?: string): string {
  const meal = getMealOfDay();
  const recipe = pickRecipeOfDay(meal);
  const greeting = meal === 'breakfast' ? 'Good morning' : meal === 'lunch' ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const mealLabel = meal === 'breakfast' ? "Today's breakfast pick" : meal === 'lunch' ? "Today's lunch pick" : "Tonight's dinner pick";

  const lines: string[] = [`${greeting}${userName ? `, ${userName}` : ''}! Here's your briefing for ${dateLabel}.`];

  if (pantryItems.length === 0) {
    lines.push("Your pantry's empty right now — add a few items and I'll build you a real plan around what expires first.");
    return lines.join('\n\n');
  }

  const expiringSoon = pantryItems.filter(item => {
    const days = getDaysUntilExpiration(item.expirationDate);
    return days >= 0 && days <= 3;
  });

  if (expiringSoon.length === 0) lines.push('Everything in your pantry is still fresh — nice work.');
  else if (expiringSoon.length === 1) lines.push(`${expiringSoon[0].name} could use you in the next few days — let's not waste it.`);
  else lines.push(`${expiringSoon.length} items could use you soon: ${expiringSoon.slice(0, 5).map(i => i.name).join(', ')}.`);

  if (recipe) lines.push(`${mealLabel}: ${recipe.name} — ${recipe.cookTime} min, ${recipe.difficulty}.`);

  lines.push('Want a recipe for any of these, or a shopping list? Just ask.');
  return lines.join('\n\n');
}
