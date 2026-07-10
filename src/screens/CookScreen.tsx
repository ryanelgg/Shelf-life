import { useState, useRef, useEffect } from 'react';
import posthog from 'posthog-js';
import { AvocadoMascot } from '../components/AvocadoMascot';
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
  const chatsRemaining = chatLimit - chatsUsed;

  // Reset chat state when the signed-in user changes (prevents history leaking between accounts)
  useEffect(() => {
    const session = getAvoSession(sessionOwnerId);
    setMessages(session.messages);
    historyRef.current = session.history;
  }, [sessionOwnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Block sending if the user hasn't granted AI consent yet
    if (avoAiConsent !== 'granted') return;

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
      const errorMsg = (err as { status?: number })?.status === 401
        ? "Looks like the API key isn't set up yet."
        : (err as { status?: number })?.status === 429
        ? "I'm getting a lot of questions right now — try again in a moment!"
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

      {/* Avo's Daily Briefing (Pro) */}
      <DailyBriefing
        pantryItems={pantryItems}
        isProUser={isProUser}
        userName={user?.name}
        onUpgrade={() => { setUpgradeReason('briefing'); setShowUpgrade(true); }}
      />

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
              ? `✨ Avo trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left · ${chatsRemaining} chats today`
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
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => sendMessage(s)}
            disabled={isStreaming || avoAiConsent !== 'granted'}
            style={{
              padding: '7px 13px',
              borderRadius: '20px',
              border: '1px solid var(--tab-border)',
              background: 'var(--bg-card)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: "'Cormorant Garamond', serif",
              cursor: isStreaming ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(74,124,89,0.08)',
              opacity: isStreaming ? 0.5 : 1,
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

interface DailyBriefingProps {
  pantryItems: PantryItemLite[];
  isProUser: boolean;
  userName?: string;
  onUpgrade: () => void;
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

function DailyBriefing({ pantryItems, isProUser, userName, onUpgrade }: DailyBriefingProps) {
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const meal = getMealOfDay();
  const recipe = pickRecipeOfDay(meal);

  // Expiring soon (next 3 days)
  const expiringSoon = pantryItems.filter(item => {
    const days = getDaysUntilExpiration(item.expirationDate);
    return days >= 0 && days <= 3;
  });

  const greeting = meal === 'breakfast' ? 'Good morning' : meal === 'lunch' ? 'Good afternoon' : 'Good evening';
  const mealLabel = meal === 'breakfast' ? "Today's breakfast pick" : meal === 'lunch' ? "Today's lunch pick" : "Tonight's dinner pick";

  const expiringLine = expiringSoon.length === 0
    ? 'Everything in your pantry is still fresh.'
    : expiringSoon.length === 1
    ? `${expiringSoon[0].name} could use you soon.`
    : `${expiringSoon.length} items could use you in the next few days.`;

  const cardInner = (
    <div style={{
      padding: '16px 18px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Top row: date + Pro tag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontSize: '10px',
          fontFamily: 'DM Mono, monospace',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {dateLabel}
        </div>
        <div style={{
          padding: '3px 10px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #D4A44A, #B8862D)',
          color: '#fff',
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '0.06em',
          fontFamily: "'Cormorant Garamond', serif",
        }}>
          PRO
        </div>
      </div>

      {/* Greeting */}
      <div>
        <div style={{
          fontSize: '17px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          fontFamily: "'Cormorant Garamond', serif",
          lineHeight: 1.2,
        }}>
          {greeting}{userName ? `, ${userName}` : ''}.
        </div>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          marginTop: '4px',
          lineHeight: 1.45,
        }}>
          {expiringLine}
        </div>
      </div>

      {/* Recipe pick */}
      {recipe && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '14px',
          background: 'rgba(74,124,89,0.08)',
          border: '1px solid rgba(74,124,89,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '12px',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            color: '#fff',
            fontSize: '17px',
          }}>
            {meal === 'breakfast' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 13a6 6 0 0 1 12 0v3H6v-3z"/>
                <path d="M4 16h16M6 19h12"/>
              </svg>
            ) : meal === 'lunch' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M8 12h8M12 8v8"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11h18a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8z"/>
                <path d="M12 3v4"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '2px',
            }}>
              {mealLabel}
            </div>
            <div style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: "'Cormorant Garamond', serif",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {recipe.name}
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '1px',
            }}>
              {recipe.cookTime} min · {recipe.difficulty}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
      <div style={{
        position: 'relative',
        background: 'var(--bg-card)',
        borderRadius: '18px',
        border: '1px solid rgba(74,124,89,0.12)',
        boxShadow: '0 2px 12px rgba(74,124,89,0.06)',
        overflow: 'hidden',
      }}>
        {isProUser ? cardInner : (
          <>
            {/* Locked version: blurred + tap to upgrade */}
            <div style={{ filter: 'blur(4px)', opacity: 0.55, pointerEvents: 'none' }}>
              {cardInner}
            </div>
            <button
              onClick={onUpgrade}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '8px',
                background: 'rgba(250,247,242,0.55)',
                backdropFilter: 'blur(2px)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Cormorant Garamond', serif",
                padding: '12px',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2"/>
                  <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
                </svg>
                Avo's Daily Briefing
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                lineHeight: 1.45,
                maxWidth: '240px',
              }}>
                Get a personalized rundown each morning — tap to unlock with Pro.
              </div>
              <div style={{
                marginTop: '4px',
                padding: '6px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #D4A44A, #B8862D)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.03em',
              }}>
                Unlock with Pro
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
