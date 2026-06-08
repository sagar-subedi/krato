import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Clock, 
  Zap, 
  Trash2, 
  AlertTriangle,
  Play,
  RotateCcw,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import HashRing from './components/HashRing';
import EventLog from './components/EventLog';
import AIChat from './components/AIChat';
import KVPanel from './components/KVPanel';
import type { KratoEvent, ClusterState, RingSnapshot } from './types';

const App: React.FC = () => {
  const [events, setEvents] = useState<KratoEvent[]>([]);
  const [ringData, setRingData] = useState<RingSnapshot>({});
  const [cluster, setCluster] = useState<ClusterState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      fetchInitialData();
    };

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data) as KratoEvent;
      setEvents(prev => [event, ...prev.slice(0, 49)]);
      
      // Real-time metric updates if possible from event data
      // For now, simple re-fetch on cluster changes
      if (['gossip', 'node_status', 'key_op'].includes(event.type)) {
        fetchInitialData();
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => ws.close();
  }, []);

  const fetchInitialData = async () => {
    try {
      const ringRes = await fetch('/api/cluster/ring');
      const ringData = await ringRes.json();
      setRingData(ringData);

      const nodesRes = await fetch('/api/nodes');
      const nodesData = (await nodesRes.json()) as ClusterState;
      setCluster(nodesData);
    } catch (err) {
      console.error("Failed to fetch cluster data", err);
    }
  };

  const handleSet = async (key: string, value: string) => {
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, consistency: 'quorum' })
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg);
    }
    // Optimization: immediate fetch or wait for WS event
    fetchInitialData();
  };

  const handleGet = async (key: string): Promise<string | null> => {
    const res = await fetch(`/api/keys?key=${key}&consistency=quorum`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg);
    }
    const data = await res.json();
    return data.value;
  };

  const handleChaos = async (latency: string, killed: boolean) => {
    await fetch('/api/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latency, killed })
    });
    fetchInitialData();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[1920px] mx-auto overflow-hidden h-screen text-text">
      {/* Header */}
      <header className="h-16 glass flex items-center justify-between px-8 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Database className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight">KRATO <span className="text-[10px] text-primary/60 ml-1 font-mono">v1.2.0</span></h1>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-text-dim">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-secondary animate-pulse' : 'bg-error'}`} />
              {isConnected ? 'Network Synchronized' : 'System Offline'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6">
            <a href="#" className="text-xs font-bold font-heading text-primary nav-link flex items-center gap-2">
              <LayoutDashboard size={14} /> Dashboard
            </a>
            <a href="#" className="text-xs font-bold font-heading text-text-dim hover:text-white nav-link flex items-center gap-2 transition-colors">
              <ShieldCheck size={14} /> Security
            </a>
            <a href="#" className="text-xs font-bold font-heading text-text-dim hover:text-white nav-link flex items-center gap-2 transition-colors">
              <MessageSquare size={14} /> Reports
            </a>
          </nav>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <div className="text-[10px] font-bold text-white">Sagar Subedi</div>
               <div className="text-[9px] text-primary">Cluster Admin</div>
             </div>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column: Metrics & Topology */}
        <div className="col-span-3 space-y-6 flex flex-col overflow-hidden">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard 
              icon={<Zap className="text-yellow-400" size={16} />} 
              label="TOTAL OPERATIONS" 
              value={cluster?.metrics.request_count.toString() || '0'} 
              color="yellow"
            />
            <StatCard 
              icon={<Clock className="text-blue-400" size={16} />} 
              label="LATENCY P99" 
              value={`${cluster?.metrics.p99 ? (cluster.metrics.p99 / 1e6).toFixed(2) : '0'}ms`} 
              color="blue"
            />
            <StatCard 
              icon={<Database className="text-green-400" size={16} />} 
              label="ACTIVE KEYS" 
              value={cluster?.metrics.key_count.toString() || '0'} 
              color="green"
            />
            <StatCard 
              icon={<Activity className="text-purple-400" size={16} />} 
              label="NODE COUNT" 
              value={cluster?.nodes.length.toString() || '0'} 
              color="purple"
            />
          </div>

          {/* Node Explorer */}
          <div className="flex-1 glass rounded-2xl p-5 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-dim font-heading">Cluster Topology</h3>
              <span className="bg-secondary/10 text-secondary text-[8px] px-2 py-0.5 rounded-full font-bold">HEALTHY</span>
            </div>
            <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {cluster?.nodes.map(n => (
                <div key={n.ID} className="p-4 rounded-xl glass-bright border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                       <div>
                        <div className="text-[12px] font-bold group-hover:text-primary transition-colors">{n.ID}</div>
                        <div className="text-[9px] text-text-dim font-mono">{n.Address}</div>
                       </div>
                    </div>
                    <div className="text-[9px] font-bold font-mono text-secondary px-2 py-1 bg-secondary/5 rounded border border-secondary/10">ACTIVE</div>
                  </div>
                </div>
              ))}
              {(!cluster || cluster.nodes.length === 0) && (
                <div className="flex-1 flex items-center justify-center text-text-dim text-xs py-10 italic">
                   Discovering peers...
                </div>
              )}
            </div>
          </div>

          {/* Chaos Panel */}
          <div className="glass p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-error">
              <AlertTriangle size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest font-heading">System Chaos Monitor</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleChaos("500ms", false)}
                className="p-3 rounded-xl glass-bright border border-white/5 hover:border-error/20 hover:bg-error/5 transition-all flex flex-col items-center gap-2 text-[10px] font-bold"
              >
                <Play size={14} className="text-error" />
                Inject Delay
              </button>
              <button 
                onClick={() => handleChaos("0s", true)}
                className="p-3 rounded-xl glass-bright border border-white/5 hover:border-error/20 hover:bg-error/5 transition-all flex flex-col items-center gap-2 text-[10px] font-bold"
              >
                <Trash2 size={14} className="text-error" />
                Isolate Node
              </button>
              <button 
                  onClick={() => handleChaos("0s", false)}
                  className="col-span-2 p-3 rounded-xl glass-bright border border-white/5 hover:border-secondary/20 hover:bg-secondary/5 transition-all flex items-center justify-center gap-2 text-[10px] font-bold"
                >
                <RotateCcw size={14} className="text-secondary" />
                Restore Cluster Equilibrium
              </button>
            </div>
          </div>
        </div>

        {/* Center: Ring & Playground */}
        <div className="col-span-6 flex flex-col gap-6 h-full overflow-hidden">
          <div className="glass rounded-3xl p-4 flex-1 relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute top-6 left-6 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
               <span className="text-[10px] font-bold tracking-widest text-text-dim uppercase font-heading">Consistent Hash Ring</span>
            </div>
            <HashRing ringData={ringData} nodes={cluster?.nodes || []} />
          </div>
          
          <div className="h-2/5 min-h-[300px]">
             <KVPanel onSet={handleSet} onGet={handleGet} />
          </div>
        </div>

        {/* Right Sidebar: Events */}
        <div className="col-span-3 h-full overflow-hidden">
          <EventLog events={events} />
        </div>
      </main>
      
      <AIChat />
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className={`glass p-5 rounded-2xl relative overflow-hidden group hover:glow-${color} transition-all duration-500`}>
    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
       {icon}
    </div>
    <div className="relative z-10 space-y-1">
      <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim">{label}</div>
      <div className="text-2xl font-mono font-bold tracking-tight">{value}</div>
    </div>
    <div className={`absolute bottom-0 left-0 h-1 bg-${color}-400/20 w-full`} />
  </div>
);

export default App;
