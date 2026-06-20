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
  Code,
  Terminal,
  Activity,
  Search,
  Plus,
  Play,
  RotateCcw
} from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const TOPICS: Topic[] = [
  { id: 'welcome', title: 'Welcome to Krato', icon: <Play size={18} />, color: '#ffffff' },
  { id: 'dashboard', title: 'Dashboard 101', icon: <Activity size={18} />, color: '#3b82f6' },
  { id: 'cli', title: 'The Krato CLI', icon: <Terminal size={18} />, color: '#10b981' },
  { id: 'exp-replication', title: 'Exp: Replication', icon: <Layers size={18} />, color: '#f59e0b' },
  { id: 'exp-chaos', title: 'Exp: Chaos Mode', icon: <Zap size={18} />, color: '#ef4444' },
  { id: 'hashing', title: 'Deep Dive: Hashing', icon: <Hash size={18} />, color: '#3b82f6' },
  { id: 'gossip', title: 'Deep Dive: Gossip', icon: <Share2 size={18} />, color: '#10b981' },
  { id: 'quorum', title: 'Deep Dive: Quorum', icon: <ShieldCheck size={18} />, color: '#f59e0b' },
];

interface GuideProps {
  onBack: () => void;
}

const ExplorerGuide: React.FC<GuideProps> = ({ onBack }) => {
  const [activeTopic, setActiveTopic] = useState<string>('welcome');

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
            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/20">
              <Search size={16} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Explorer Guide</h2>
          </div>
          <p className="text-[10px] text-text-dim font-medium uppercase tracking-[0.2em]">Learning Pathway</p>
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
            {activeTopic === 'welcome' && <WelcomeSection />}
            {activeTopic === 'dashboard' && <DashboardSection />}
            {activeTopic === 'cli' && <CLISection />}
            {activeTopic === 'exp-replication' && <ReplicationSection />}
            {activeTopic === 'exp-chaos' && <ChaosSection />}
            {activeTopic === 'hashing' && <HashingSection />}
            {activeTopic === 'gossip' && <GossipSection />}
            {activeTopic === 'quorum' && <QuorumSection />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

/* --- Sections --- */

const WelcomeSection: React.FC = () => (
  <div className="space-y-12">
    <SectionHeader icon={Play} title="Welcome to Krato" color="#ffffff" tagline="Distributed Key-Value Store with Dynamo-inspired Architecture." />
    <div className="prose prose-invert max-w-none space-y-8">
      <p className="text-lg text-text-dim leading-relaxed">
        Krato is a highly-available, distributed key-value store built as a learning resource and a showcase for system design principles. 
        It solves the complex challenges of scaling data across multiple servers using industry-standard protocols.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card title="Decentralized" icon={<Share2 className="text-secondary" />}>
          No single point of failure. Nodes use Gossip to maintain cluster status and health.
        </Card>
        <Card title="Highly Scalable" icon={<Layers className="text-primary" />}>
          As nodes are added, data is automatically re-partitioned across the Hash Ring.
        </Card>
      </div>

      <div className="p-8 rounded-[32px] bg-primary/5 border border-primary/10 flex gap-6 items-start">
        <Info className="text-primary shrink-0 mt-1" size={24} />
        <div>
          <h4 className="text-xl font-bold mb-2">How to use this guide</h4>
          <p className="text-text-dim text-sm leading-relaxed">
            Follow the sections in order to understand how to interact with Krato. You'll start with the **Dashboard**, move to the **CLI**, and eventually perform **Experiments** to see real failure recovery in action.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const DashboardSection: React.FC = () => (
  <div className="space-y-12">
    <SectionHeader icon={Activity} title="Dashboard 101" color="#3b82f6" tagline="Your window into the distributed cluster." />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div className="space-y-8">
        <h3 className="text-2xl font-bold">Key Components</h3>
        <ul className="space-y-6">
          <li className="flex gap-4">
            <div className="mt-1"><Circle size={8} fill="currentColor" className="text-primary" /></div>
            <div>
              <span className="font-bold block">The Hash Ring</span>
              <span className="text-sm text-text-dim">A circular visualization of your storage nodes. Each node owns a segment of the 2^64 hash space.</span>
            </div>
          </li>
          <li className="flex gap-4">
            <div className="mt-1"><Circle size={8} fill="currentColor" className="text-secondary" /></div>
            <div>
              <span className="font-bold block">System Pulse (Log)</span>
              <span className="text-sm text-text-dim">A real-time stream of what's happening. Look here to see Membership changes and Key Put/Get events.</span>
            </div>
          </li>
          <li className="flex gap-4">
            <div className="mt-1"><Circle size={8} fill="currentColor" className="text-accent" /></div>
            <div>
              <span className="font-bold block">Krato AI Diagnostic</span>
              <span className="text-sm text-text-dim">A Gemini-powered assistant that can query the cluster, set flags, and explain why certain events are occurring.</span>
            </div>
          </li>
        </ul>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-8 flex items-center justify-center">
         <img src="/home/sagarsubedi/.gemini/antigravity/brain/2e23fbb5-570e-4d10-b7e5-1a200feef8e6/dashboard_main_1781962078817.png" alt="Dashboard View" className="rounded-2xl shadow-2xl border border-white/5" />
      </div>
    </div>
  </div>
);

const CLISection: React.FC = () => (
  <div className="space-y-12">
    <SectionHeader icon={Terminal} title="The Krato CLI" color="#10b981" tagline="Directly interact with the data store via command line." />
    <div className="space-y-8">
      <p className="text-text-dim text-lg">
        The Krato CLI is the primary way to perform administrative and data tasks. The cluster exposes an API on port <code>18080</code>.
      </p>

      <div className="space-y-6">
        <h4 className="text-xl font-bold flex items-center gap-2"><Code size={18} className="text-secondary" /> Setting a Key</h4>
        <pre className="bg-black/60 p-6 rounded-2xl border border-white/5 font-mono text-sm text-secondary overflow-x-auto">
          go run cmd/cli/main.go set my_website https://krato.io
        </pre>
        <p className="text-xs text-text-dim italic">Observation: Watch the Dashboard Ring. You will see 3 nodes flash briefly as the write is replicated.</p>
      </div>

      <div className="space-y-6">
        <h4 className="text-xl font-bold flex items-center gap-2"><Code size={18} className="text-secondary" /> Fetching a Key</h4>
        <pre className="bg-black/60 p-6 rounded-2xl border border-white/5 font-mono text-sm text-secondary overflow-x-auto">
          go run cmd/cli/main.go get my_website
        </pre>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
         <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <h5 className="font-bold mb-2">API Endpoint</h5>
            <p className="text-xs text-text-dim font-mono">http://localhost:18080</p>
         </div>
         <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <h5 className="font-bold mb-2">Protocol</h5>
            <p className="text-xs text-text-dim">REST (HTTP) for CLI / JSON-over-WS for Dashboard</p>
         </div>
      </div>
    </div>
  </div>
);

const ReplicationSection: React.FC = () => (
  <div className="space-y-12">
    <SectionHeader icon={Layers} title="Experiment: Replication" color="#f59e0b" tagline="Verify data redundancy across the cluster." />
    <div className="space-y-10">
      <div className="prose prose-invert max-w-none">
        <h3 className="text-2xl font-bold">Step 1: Write a Key</h3>
        <p className="text-text-dim">Use the CLI or the Dashboard input to save a value. Note which node the key resolver highlights as the "Primary".</p>
        <div className="bg-black/30 p-4 rounded-xl font-mono text-xs text-accent">set test_key hello_world</div>
      </div>

      <div className="prose prose-invert max-w-none">
        <h3 className="text-2xl font-bold">Step 2: Explore Nodes</h3>
        <p className="text-text-dim">Open the **Cluster Explorer** from the dashboard header. Click on the primary node and the two subsequent nodes on the ring.</p>
        <div className="p-6 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center gap-4">
          <Info size={18} className="text-secondary" />
          <p className="text-sm">You will see <code>test_key</code> present on all 3 nodes. This confirms our Replication Factor (N=3) is working!</p>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 text-center italic text-white/30">
        "Data is replicated clockwise. If node A is primary, node B and C also get a copy."
      </div>
    </div>
  </div>
);

const ChaosSection: React.FC = () => (
  <div className="space-y-12">
    <SectionHeader icon={Zap} title="Experiment: Chaos Mode" color="#ef4444" tagline="Test the cluster's self-healing capabilities." />
    <div className="space-y-10">
      <div className="prose prose-invert max-w-none">
        <h3 className="text-2xl font-bold mb-4">Simulating a Outage</h3>
        <ol className="space-y-4 text-text-dim list-decimal pl-6">
          <li>Open the **Chaos Lab** from the header.</li>
          <li>Click **"Terminate Node"** on any active node.</li>
          <li>**Watch the System Pulse**: After a few seconds, you will see a `node_down` event.</li>
          <li>**The Gossip Logic**: Other nodes detect the missed heartbeats and propagate the failure info cluster-wide.</li>
        </ol>
      </div>

      <div className="p-8 rounded-3xl bg-error/5 border border-error/10">
         <h4 className="text-lg font-bold text-error mb-2">Self-Healing</h4>
         <p className="text-sm text-text-dim leading-relaxed">
           Even with a node down, you can still `GET` the keys it owned! The system will automatically route your request to the next available replica on the ring.
         </p>
      </div>
    </div>
  </div>
);

/* --- Theoretical Deep Dives (Repurposed Labs) --- */

const HashingSection: React.FC = () => {
  const [nodes, setNodes] = useState(['Node A', 'Node B', 'Node C']);
  return (
    <div className="space-y-12 opacity-80 scale-95 border-t border-white/5 pt-16">
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-4">Deep Dive Concept</div>
      <SectionHeader icon={Hash} title="Consistent Hashing" color="#3b82f6" tagline="The math that keeps data migration minimal." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
         <div className="bg-white/[0.02] border border-white/[0.05] rounded-[40px] p-8 aspect-square relative flex items-center justify-center">
            <div className="relative w-64 h-64 border-2 border-dashed border-white/10 rounded-full flex items-center justify-center animate-[spin_60s_linear_infinite]">
              {nodes.map((node, i) => {
                const angle = (i / nodes.length) * 360;
                return (
                  <div key={node} className="absolute w-10 h-10 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center" style={{ transform: `rotate(${angle}deg) translate(128px) rotate(-${angle}deg)` }}>
                    <Server size={18} className="text-primary" />
                  </div>
                );
              })}
            </div>
         </div>
         <div className="space-y-6">
            <p className="text-sm text-text-dim leading-relaxed">Consistent Hashing ensures that when nodes leave or join, only a small fraction of keys move. This is the foundation of modern distributed databases.</p>
            <div className="flex gap-2">
              <button onClick={() => setNodes([...nodes, `Node ${nodes.length}`])} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold font-mono">+ Add Node</button>
              <button onClick={() => setNodes(nodes.slice(0, -1))} className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-bold font-mono">Remove</button>
            </div>
         </div>
      </div>
    </div>
  );
};

const GossipSection: React.FC = () => (
  <div className="space-y-12 opacity-80 scale-95 border-t border-white/5 pt-16">
    <div className="text-[10px] uppercase tracking-[0.3em] text-secondary font-bold mb-4">Deep Dive Concept</div>
    <SectionHeader icon={Share2} title="Gossip Protocol" color="#10b981" tagline="Decentralized cluster membership." />
    <div className="prose prose-invert max-w-none text-text-dim text-sm">
      <p>Information spreads like an epidemic. Every second, nodes pick neighbors at random and share status updates. This ensures everyone eventually agrees on the cluster's health without a leader.</p>
    </div>
  </div>
);

const QuorumSection: React.FC = () => (
  <div className="space-y-12 opacity-80 scale-95 border-t border-white/5 pt-16">
    <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-4">Deep Dive Concept</div>
    <SectionHeader icon={ShieldCheck} title="Quorum & Consistency" color="#f59e0b" tagline="W + R > N" />
    <div className="prose prose-invert max-w-none text-text-dim text-sm">
       <p>Tunable consistency allows you to choose between speed and correctness. If your write set and read set overlap, your client will always see the latest write.</p>
    </div>
  </div>
);

/* --- UI Utilities --- */

const SectionHeader: React.FC<{ icon: any; title: string; color: string; tagline: string }> = ({ icon: Icon, title, color, tagline }) => (
  <header className="space-y-4">
    <div className="w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 border shadow-2xl" style={{ backgroundColor: `${color}15`, borderColor: `${color}30`, color }}>
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

export default ExplorerGuide;
