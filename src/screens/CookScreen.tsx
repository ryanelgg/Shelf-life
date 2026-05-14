import { useState, useRef, useEffect } from 'react';
import { AvocadoMascot } from '../components/AvocadoMascot';
import { useStore } from '../store/useStore';

interface Message {
  id: string;
  role: 'avo' | 'user';
  text: string;
  streaming?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  "What foods are high in protein?",
  "Best foods for energy?",
  "What's heart-healthy to eat?",
  "Foods that fight inflammation?",
  "How do I eat for better sleep?",
];



export function CookScreen() {
  const { pantryItems } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      role: 'avo',
      text: "Hey! I'm Avo, your personal nutrition guide. Ask me anything about food, nutrients, or what to eat for your goals. I can even work with what's in your pantry!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<ConversationMessage[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Add user message to display
    const userMsgId = `u-${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: trimmed }]);
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

    // Create a streaming Avo message
    const avoMsgId = `a-${Date.now()}`;
    setMessages(prev => [...prev, { id: avoMsgId, role: 'avo', text: '', streaming: true }]);

    let fullText = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyRef.current }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break outer;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error('api_error');
            if (parsed.text) {
              fullText += parsed.text;
              setMessages(prev =>
                prev.map(m => m.id === avoMsgId ? { ...m, text: fullText } : m)
              );
            }
          } catch (e) {
            if ((e as Error).message === 'api_error') throw e;
          }
        }
      }

      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: fullText },
      ];
    } catch (err) {
      const status = (err as Error).message;
      const errorMsg = status === '429'
        ? "I'm getting a lot of questions right now — try again in a moment!"
        : "Something went wrong connecting to my brain. Try again?";

      setMessages(prev =>
        prev.map(m => m.id === avoMsgId ? { ...m, text: errorMsg } : m)
      );
    } finally {
      setMessages(prev =>
        prev.map(m => m.id === avoMsgId ? { ...m, streaming: false } : m)
      );
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
            disabled={isStreaming}
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
          placeholder="Ask about nutrition..."
          disabled={isStreaming}
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
            opacity: isStreaming ? 0.6 : 1,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
          style={{
            width: 44, height: 44,
            borderRadius: '50%',
            background: input.trim() && !isStreaming ? 'var(--accent)' : 'var(--accent-dim)',
            border: 'none',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
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
