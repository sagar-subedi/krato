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
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    const aiMsgIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'ai', text: '' }]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            fullText += data;
            setMessages(prev => {
              const next = [...prev];
              next[aiMsgIndex] = { role: 'ai', text: fullText };
              return next;
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const next = [...prev];
        next[aiMsgIndex] = { role: 'ai', text: "Error: Connection to diagnostic engine lost." };
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
            className="glass w-[400px] h-[600px] rounded-[32px] overflow-hidden flex flex-col shadow-2xl border-white/10"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-primary to-accent flex items-center justify-between text-white shadow-lg overflow-hidden relative">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                 <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,1),transparent)]" />
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md">
                   <Sparkles size={16} />
                </div>
                <div>
                   <span className="font-bold text-sm tracking-tight font-heading">Gemini Diagnostic</span>
                   <div className="text-[9px] font-mono opacity-70 uppercase tracking-widest font-bold">L4 Observer Neural Engine</div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="hover:rotate-90 transition-transform relative z-10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/20">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-8">
                  <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary glow-primary animate-pulse">
                     <Bot size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-heading font-bold text-sm">System Analysis Ready</h3>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      I can help you audit the hash ring, analyze replication health, or perform detailed metrics deep-dives.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full">
                     <QuickAction text="Check cluster health" onClick={() => setInput("Check cluster health")} />
                     <QuickAction text="Analyze key distribution" onClick={() => setInput("Analyze key distribution")} />
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] leading-relaxed relative ${
                    m.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-none glow-primary' 
                      : 'glass-bright text-gray-200 rounded-tl-none border border-white/5'
                  }`}>
                    {m.text || (m.role === 'ai' && <div className="flex gap-1 py-1"><div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" /></div>)}
                  </div>
                </div>
              ))}
              {isTyping && (
                 <div className="flex justify-start">
                    <div className="glass-bright p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                       <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                       <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                       <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                       <span className="text-[9px] font-mono text-text-dim ml-2 font-bold uppercase tracking-widest">Generating Insight</span>
                    </div>
                 </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-white/10 glass-bright shadow-inner">
              <div className="relative group">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask the engine..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none focus:border-primary/50 transition-all font-mono group-hover:border-white/20"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="absolute right-3 top-3 p-2 rounded-xl bg-primary text-white hover:bg-accent disabled:opacity-50 disabled:grayscale transition-all shadow-lg"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-[24px] blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
            <motion.button
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="relative w-16 h-16 rounded-[22px] bg-surface border border-white/10 text-white flex items-center justify-center shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-1">
                 <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]" />
              </div>
              <Bot size={28} className="group-hover:text-primary transition-colors" />
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QuickAction: React.FC<{ text: string, onClick: () => void }> = ({ text, onClick }) => (
  <button 
    onClick={onClick}
    className="py-2 px-4 rounded-xl glass-bright border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all text-left text-[10px] font-bold text-text-dim hover:text-primary flex items-center gap-2"
  >
     <Terminal size={10} /> {text}
  </button>
);

export default AIChat;
