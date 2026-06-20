import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Share2, 
  Layers, 
  Zap, 
  Circle, 
  Database, 
  Hash, 
  ShieldCheck, 
  Cpu, 
  ArrowRight,
  Info,
  Server,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  Code
} from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const TOPICS: Topic[] = [
  { id: 'hashing', title: 'Consistent Hashing', icon: <Hash size={18} />, color: '#3b82f6' },
  { id: 'gossip', title: 'Gossip Protocol', icon: <Share2 size={18} />, color: '#10b981' },
  { id: 'quorum', title: 'Quorum & Consistency', icon: <ShieldCheck size={18} />, color: '#f59e0b' },
  { id: 'vector', title: 'Vector Clocks', icon: <Cpu size={18} />, color: '#8b5cf6' },
];

interface AcademyProps {
  onBack: () => void;
}

const ArchitectureAcademy: React.FC<AcademyProps> = ({ onBack }) => {
  const [activeTopic, setActiveTopic] = useState<string>('hashing');

  return (
    <div className="flex bg-background h-full overflow-hidden text-white">
      {/* Sidebar Navigation */}
      <aside className="w-72 border-r border-white/[0.06] flex flex-col pt-8 shrink-0 bg-black/20">
        <div className="px-8 mb-10">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-text-dim hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-wider">Back to Dashboard</span>
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20">
              <BookOpen size={16} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Academy</h2>
          </div>
          <p className="text-[10px] text-text-dim font-medium uppercase tracking-[0.2em]">Distributed Systems</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setActiveTopic(topic.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${
                activeTopic === topic.id 
                  ? 'bg-white/[0.05] text-white shadow-xl' 
                  : 'text-text-dim hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <div 
                className={`p-2 rounded-xl transition-all ${
                  activeTopic === topic.id ? 'bg-white/10 scale-110' : 'bg-transparent group-hover:scale-105'
                }`}
                style={{ color: activeTopic === topic.id ? topic.color : undefined }}
              >
                {topic.icon}
              </div>
              <div className="text-left">
                <span className="text-sm font-bold block">{topic.title}</span>
                <span className="text-[9px] text-text-dim group-hover:text-white/40 transition-colors uppercase tracking-widest font-mono">
                  {topic.id === activeTopic ? 'Now Viewing' : 'Explore Concept'}
                </span>
              </div>
              {activeTopic === topic.id && (
                <motion.div 
                  layoutId="active-indicator" 
                  className="ml-auto w-1.5 h-6 rounded-full"
                  style={{ backgroundColor: topic.color }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-8">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.05] relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-dim mb-3 flex items-center gap-2">
              <Info size={12} className="text-primary" /> Philosophy
            </div>
            <p className="text-xs text-white/50 leading-relaxed italic">
              "Krato is built on the shoulders of giants like Amazon Dynamo and Apache Cassandra."
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.03),transparent_40%)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTopic}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-5xl mx-auto px-16 py-16"
          >
            {activeTopic === 'hashing' && <HashingSection />}
            {activeTopic === 'gossip' && <GossipSection />}
            {activeTopic === 'quorum' && <QuorumSection />}
            {activeTopic === 'vector' && <VectorClockSection />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

/* --- Detailed Content Sections --- */

const HashingSection: React.FC = () => {
  const [nodes, setNodes] = useState(['Node A', 'Node B', 'Node C']);
  
  return (
    <div className="space-y-16">
      <SectionHeader 
        icon={Hash} 
        title="Consistent Hashing" 
        color="#3b82f6"
        tagline="The art of horizontal scaling without the chaos of data migration."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-12 space-y-8">
           <div className="prose prose-invert max-w-none">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">The Core Problem</h3>
            <p className="text-text-dim text-lg leading-relaxed">
              In a traditional distributed system, you might use <code>hash(key) % N</code> to decide which node stores a key. 
              But what happens when <code>N</code> changes? When you add or remove a node, <strong>almost every key maps to a new location</strong>, 
              triggering a massive data migration storm that can crash your cluster.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card title="Minimal Disruption" icon={<Zap className="text-accent" />}>
              Only <code>K/N</code> keys need to move when a node joins or leaves, where K is total keys and N is node count.
            </Card>
            <Card title="Virtual Nodes (Vnodes)" icon={<Layers className="text-primary" />}>
              Krato maps each physical node to 150+ positions on the ring, ensuring an even distribution of data even if nodes have different performance profiles.
            </Card>
          </div>
        </div>

        {/* Lab Component */}
        <div className="lg:col-span-7 bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-12 relative overflow-hidden flex items-center justify-center min-h-[500px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05),transparent_70%)]" />
          <div className="relative w-80 h-80 border-2 border-dashed border-white/10 rounded-full flex items-center justify-center animate-[spin_60s_linear_infinite]">
             <div className="absolute inset-0 border border-white/5 rounded-full scale-110" />
             <div className="absolute inset-0 border border-white/5 rounded-full scale-90" />
            {nodes.map((node, i) => {
              const angle = (i / nodes.length) * 360;
              return (
                <motion.div 
                  key={node} 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute w-14 h-14 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl"
                  style={{ 
                    transform: `rotate(${angle}deg) translate(160px) rotate(-${angle}deg)` 
                  }}
                >
                  <Server size={24} className="text-primary" />
                  <div className="absolute -bottom-6 text-[10px] font-mono font-bold text-white/40">{node}</div>
                </motion.div>
              );
            })}
          </div>
          <div className="absolute center text-center pointer-events-none">
            <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-2">Hash Space</div>
            <div className="text-4xl font-mono text-white/10 font-black tracking-tighter">0 - 2^64</div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 flex flex-col justify-center">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">Interactive Lab</h3>
            <p className="text-sm text-text-dim leading-relaxed">
              Experiment with cluster topology. Notice how the "Ring" structure ensures that each node is responsible for the range of hashes between itself and its predecessor.
            </p>
          </div>

          <div className="p-8 bg-white/[0.03] border border-white/[0.08] rounded-3xl space-y-6 shadow-2xl backdrop-blur-sm">
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setNodes([...nodes, `Node ${String.fromCharCode(65 + nodes.length)}`])}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <PlusIcon size={18} /> Add Physical Node
              </button>
              <button 
                onClick={() => setNodes(nodes.slice(0, -1))}
                className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
                disabled={nodes.length <= 1}
              >
                <MinusIcon size={18} /> Remove Node
              </button>
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <Layers size={18} />
              </div>
              <div className="text-[11px] text-text-dim">
                Each dot represents a <strong>Vnode</strong>. In production, we use 150 per node to balance load perfectly.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const GossipSection: React.FC = () => {
  const [nodes, setNodes] = useState(
    Array.from({ length: 12 }).map((_, i) => ({ id: i, infected: i === 0 }))
  );
  const [rounds, setRounds] = useState(0);

  const propagate = () => {
    setNodes(prev => prev.map(node => {
      if (node.infected) return node;
      const neighbors = prev.filter(other => other.infected && Math.random() > 0.6);
      if (neighbors.length > 0) return { ...node, infected: true };
      return node;
    }));
    setRounds(r => r + 1);
  };

  return (
    <div className="space-y-16">
      <SectionHeader 
        icon={Share2} 
        title="Gossip Protocol" 
        color="#10b981"
        tagline="How a thousand nodes stay in sync without a central leader."
      />

      <div className="prose prose-invert max-w-none">
        <h3 className="text-2xl font-bold">The Epidemic Metaphor</h3>
        <p className="text-text-dim text-lg leading-relaxed">
          In a peer-to-peer system, how do you know if a node in Tokyo is down when your shard is in London?
          Gossip protocols use <strong>Epidemic Algorithms</strong>. Every second, each node picks a few random peers and shares what it knows about the cluster's health. 
          Information spreads like a virus, reaching everyone in <code>log(N)</code> rounds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-6 bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-12 flex items-center justify-center relative min-h-[400px]">
           <div className="grid grid-cols-4 gap-4 relative z-10 w-full">
            {nodes.map((node) => (
              <motion.div
                key={node.id}
                animate={{ 
                  scale: node.infected ? [1, 1.15, 1] : 1,
                  backgroundColor: node.infected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                  borderColor: node.infected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255,255,255,0.05)'
                }}
                className="aspect-square rounded-2xl border flex items-center justify-center group"
              >
                <Server size={20} className={node.infected ? 'text-secondary' : 'text-white/10 transition-colors group-hover:text-white/20'} />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col justify-center space-y-8">
           <div className="flex items-center justify-between p-8 bg-white/[0.03] border border-white/[0.08] rounded-3xl bg-black/20">
              <div className="text-center flex-1">
                <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Rounds</div>
                <div className="text-4xl font-black">{rounds}</div>
              </div>
              <div className="w-[1px] h-12 bg-white/10" />
              <div className="text-center flex-1">
                <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Informed</div>
                <div className="text-4xl font-black text-secondary">
                  {Math.round((nodes.filter(n => n.infected).length / nodes.length) * 100)}%
                </div>
              </div>
           </div>

           <div className="flex gap-4">
             <button 
                onClick={propagate}
                className="flex-1 py-5 bg-secondary text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
             >
               Propagate Gossip round <ArrowRight size={18} />
             </button>
             <button 
                onClick={() => { setNodes(nodes.map((_, i) => ({ id: i, infected: i === 0 }))); setRounds(0); }}
                className="px-6 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all"
             >
               Reset
             </button>
           </div>

           <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
             <div className="flex items-center gap-3 mb-2">
               <ShieldCheck size={14} className="text-secondary" />
               <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">Failure Detection</h4>
             </div>
             <p className="text-[11px] text-text-dim leading-relaxed">
               Krato uses gossip to monitor "heartbeat counters". If a node's heartbeat hasn't increased in a specific timeframe, it's marked as "suspicious" and eventually "down" by the cluster consensus.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const QuorumSection: React.FC = () => {
  const [n, setN] = useState(3);
  const [w, setW] = useState(2);
  const [r, setR] = useState(2);

  const isStrict = (w + r) > n;

  return (
    <div className="space-y-16">
      <SectionHeader 
        icon={ShieldCheck} 
        title="Quorum Consistency" 
        color="#f59e0b"
        tagline="Tunable consistency: Balance speed vs. correctness."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-12 prose prose-invert max-w-none">
          <h3 className="text-2xl font-bold italic">"W + R &gt; N" - The Golden Rule</h3>
          <p className="text-text-dim text-lg leading-relaxed">
            How do you guarantee that a user sees their own write in a system with 3 replicas? 
            By ensuring that the number of nodes you write to (W) and the number you read from (R) overlap. 
            If $W + R &gt; N$, you are guaranteed to read from at least one node that has the latest write.
          </p>
        </div>

        <div className="lg:col-span-7 bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-16 flex flex-col items-center justify-center relative overflow-hidden bg-black/20">
          <div className="flex items-center gap-4 mb-16">
            <div className="flex items-center gap-1">
              {Array.from({ length: w }).map((_, i) => (
                <div key={i} className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]">W</div>
              ))}
            </div>
            <div className="text-2xl font-black text-white/10 mx-2 text-primary">+</div>
            <div className="flex items-center gap-1">
              {Array.from({ length: r }).map((_, i) => (
                <div key={i} className="w-10 h-10 rounded-xl bg-secondary/20 border border-secondary/40 flex items-center justify-center text-xs font-bold text-secondary shadow-[0_0_15px_rgba(16,185,129,0.2)]">R</div>
              ))}
            </div>
            <div className="text-2xl font-black text-white/10 mx-2 text-secondary">&gt;</div>
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black text-white/40">{n}</div>
          </div>

          <motion.div 
            key={isStrict ? 'strict' : 'eventual'}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-12 py-6 rounded-3xl border-2 flex flex-col items-center transition-all duration-500 ${
              isStrict 
                ? 'bg-secondary/10 border-secondary/30 shadow-[0_0_40px_rgba(16,185,129,0.1)]' 
                : 'bg-error/10 border-error/30 shadow-[0_0_40px_rgba(239,68,68,0.1)]'
            }`}
          >
            <div className={`text-4xl font-black mb-2 ${isStrict ? 'text-secondary' : 'text-error'}`}>
              {isStrict ? 'Strict Consistency' : 'Eventual Consistency'}
            </div>
            <div className="text-xs text-text-dim text-center leading-relaxed">
              {isStrict 
                ? 'Guaranteed to see the latest write. Higher latency, higher durability.' 
                : 'May see stale data temporarily. Lightning fast "fire-and-forget" writes.'}
            </div>
          </motion.div>

          <div className="mt-16 flex gap-4">
            {Array.from({ length: n }).map((_, i) => (
               <div key={i} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative">
                  <Database size={20} className="text-white/10" />
                  {i < w && <div className="absolute top-0 right-0 w-3 h-3 rounded-full bg-primary -translate-y-1 translate-x-1 border-2 border-background" />}
                  {i < r && <div className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-secondary translate-y-1 -translate-x-1 border-2 border-background" />}
               </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-10">
          <div className="p-8 bg-white/[0.03] border border-white/[0.08] rounded-3xl space-y-10 shadow-2xl backdrop-blur-sm bg-black/10">
            <QuorumSlider label="Replication Factor (N)" min={1} max={7} value={n} onChange={setN} color="#ffffff" />
            <QuorumSlider label="Write Quorum (W)" min={1} max={n} value={w} onChange={setW} color="#3b82f6" />
            <QuorumSlider label="Read Quorum (R)" min={1} max={n} value={r} onChange={setR} color="#10b981" />
          </div>

          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-2">
               <Info size={16} className="text-primary" />
               Real-world Example
            </h4>
            <p className="text-xs text-text-dim leading-relaxed">
              In an e-commerce checkout, you want <strong>Strict Consistency</strong> ($W=3, R=3$) for stock levels. For a "likes" counter on a post, <strong>Eventual Consistency</strong> ($W=1, R=1$) is faster and perfectly acceptable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const VectorClockSection: React.FC = () => (
  <div className="space-y-16 animate-pulse">
    <SectionHeader 
      icon={Cpu} 
      title="Vector Clocks" 
      color="#8b5cf6"
      tagline="Chronological order in a world without synchronized clocks."
    />
    <div className="prose prose-invert max-w-none text-center py-20">
      <h3 className="text-2xl font-bold text-white/40">Lab Under Construction</h3>
      <p className="text-text-dim">Visualizing causality and conflict resolution (LWW vs Semantic merge).</p>
    </div>
  </div>
);

/* --- UI Components --- */

const SectionHeader: React.FC<{ icon: any; title: string; color: string; tagline: string }> = ({ icon: Icon, title, color, tagline }) => (
  <header className="space-y-4 border-b border-white/[0.06] pb-10">
    <div 
      className="w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 border shadow-2xl transition-transform hover:rotate-3"
      style={{ backgroundColor: `${color}15`, borderColor: `${color}30`, color }}
    >
      <Icon size={32} />
    </div>
    <h1 className="text-5xl font-black tracking-tight leading-none">{title}</h1>
    <p className="text-xl text-text-dim max-w-3xl font-medium leading-relaxed">{tagline}</p>
  </header>
);

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-all group">
    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-6 group-hover:scale-110 transition-all">
      {icon}
    </div>
    <h4 className="text-lg font-bold mb-3">{title}</h4>
    <p className="text-sm text-text-dim leading-relaxed font-medium">{children}</p>
  </div>
);

const QuorumSlider: React.FC<{ label: string; min: number; max: number; value: number; onChange: (v: number) => void; color: string }> = ({ label, min, max, value, onChange, color }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center px-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">{label}</span>
      <span className="text-2xl font-mono font-black" style={{ color }}>{value}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer outline-none transition-all hover:bg-white/20"
      style={{ accentColor: color }}
    />
  </div>
);

function PlusIcon({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>; }
function MinusIcon({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>; }

export default ArchitectureAcademy;
