import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, X, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, text: userMsg }];
    setMessages(newMessages);
    setIsTyping(true);
    const aiMsgIdx = newMessages.length;
    setMessages(prev => [...prev, { role: 'ai', text: '' }]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            fullText += line.slice(6);
            setMessages(prev => {
              const next = [...prev];
              next[aiMsgIdx] = { role: 'ai', text: fullText };
              return next;
            });
          }
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[aiMsgIdx] = { role: 'ai', text: 'Error: Could not reach diagnostic engine.' };
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden">
      <div className="fixed bottom-8 right-8 pointer-events-auto">
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                width: 380,
                height: 560,
                background: '#111114',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 28,
                boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #f59e0b)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Sparkles size={16} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Gemini Diagnostic</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Cluster Analysis Engine
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} style={{ color: 'white', opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  background: '#0f0f12',
                }}
              >
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: '0 24px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 20, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bot size={28} color="#3b82f6" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>System Analysis Ready</div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, lineHeight: 1.6 }}>
                        I can audit the hash ring, analyze replication health, and explain cluster behavior.
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      <QuickAction text="Check cluster health" onClick={() => setInput('Check cluster health')} />
                      <QuickAction text="Analyze key distribution" onClick={() => setInput('Analyze key distribution')} />
                      <QuickAction text="Explain consistent hashing" onClick={() => setInput('Explain consistent hashing in this cluster')} />
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      fontSize: 12,
                      lineHeight: 1.6,
                      background: m.role === 'user' ? '#3b82f6' : '#1c1c22',
                      color: m.role === 'user' ? 'white' : '#d4d4d8',
                      border: m.role === 'ai' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}>
                      {m.text || (m.role === 'ai' && (
                        <span style={{ opacity: 0.5, fontFamily: 'monospace', fontSize: 11 }}>Thinking…</span>
                      ))}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: '#3b82f6', opacity: 0.5,
                        animation: `bounce 0.8s ease ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{
                padding: '14px 16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: '#111114',
                display: 'flex',
                gap: 8,
              }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask the engine…"
                  style={{
                    flex: 1,
                    background: '#1a1a20',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    width: 38, height: 38,
                    borderRadius: 12,
                    background: input.trim() ? '#3b82f6' : '#1a1a20',
                    border: 'none',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: input.trim() ? 'pointer' : 'default',
                    opacity: input.trim() ? 1 : 0.4,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="fab"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsOpen(true)}
              style={{
                width: 56, height: 56,
                borderRadius: 18,
                background: '#111114',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 8, height: 8, borderRadius: 999,
                background: '#3b82f6',
                boxShadow: '0 0 8px #3b82f6',
              }} />
              <Bot size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const QuickAction: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 12px',
      borderRadius: 10,
      background: '#1a1a20',
      border: '1px solid rgba(255,255,255,0.06)',
      color: '#71717a',
      fontSize: 11,
      fontWeight: 700,
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
      width: '100%',
      transition: 'all 0.15s',
    }}
    onMouseOver={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)')}
    onMouseOut={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
  >
    <Terminal size={10} color="#3b82f6" />
    {text}
  </button>
);

export default AIChat;
