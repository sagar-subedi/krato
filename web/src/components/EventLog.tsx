import React from 'react';
import type { KratoEvent } from '../types';
import { Terminal, Activity, Zap, Server, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventLogProps {
  events: KratoEvent[];
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'gossip': return <Server size={14} className="text-blue-400" />;
    case 'key_op': return <Zap size={14} className="text-yellow-400" />;
    case 'replication': return <ShieldCheck size={14} className="text-green-400" />;
    case 'node_status': return <Activity size={14} className="text-purple-400" />;
    default: return <Terminal size={14} className="text-gray-400" />;
  }
};

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  return (
    <div className="glass rounded-2xl flex flex-col h-full overflow-hidden border-white/5">
      <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <Terminal size={16} className="text-primary" />
          <h2 className="font-bold text-[10px] uppercase tracking-[0.2em] text-text-dim font-heading">Live Cluster Events</h2>
        </div>
        <div className="flex items-center gap-1.5">
           <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
           <span className="text-[9px] font-mono text-secondary uppercase font-bold">Streaming</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] custom-scrollbar">
        <AnimatePresence initial={false}>
          {(events || []).map((event, i) => (
            <motion.div
              key={`${event.timestamp}-${i}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="p-4 rounded-xl glass-bright border border-white/5 hover:border-white/10 transition-all group"
            >
              <div className="flex gap-4">
                <div className="mt-0.5 p-2 rounded-lg bg-black/40 group-hover:bg-primary/10 transition-colors">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold tracking-tight">{event.type.toUpperCase()}</span>
                    <span className="text-[10px] text-text-dim">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-primary font-bold opacity-80 underline decoration-primary/30 underline-offset-2">node_id</span>
                    <code className="text-text-dim">{event.node_id}</code>
                  </div>
                  {event.metadata && (
                    <div className="text-[10px] text-secondary opacity-90 break-all bg-black/60 p-2.5 rounded-lg border border-white/5 mt-2 font-mono leading-relaxed shadow-inner">
                      {Object.entries(event.metadata).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-text-dim/60">{k}:</span>
                          <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {(!events || events.length === 0) && (
          <div className="flex flex-col items-center justify-center p-10 space-y-4 opacity-30">
             <Terminal size={32} />
             <p className="text-center italic text-xs">Waiting for cluster events...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventLog;
