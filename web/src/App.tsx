import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Database,
  Clock,
  Trash2,
  Play,
  RotateCcw,
  Layers,
  AlertTriangle,
  X,
  Search,
  Plus,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HashRing from './components/HashRing';
import EventLog from './components/EventLog';
import AIChat from './components/AIChat';
import NodeExplorer from './components/NodeExplorer';
import ExplorerGuide from './components/ExplorerGuide';
import type { KratoEvent, ClusterState, RingSnapshot } from './types';

const App: React.FC = () => {
  const [events, setEvents] = useState<KratoEvent[]>([]);
  const [ringData, setRingData] = useState<RingSnapshot>({});
  const [cluster, setCluster] = useState<ClusterState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeKeyOp, setActiveKeyOp] = useState<KratoEvent | null>(null);
  const [activeNodeEvent, setActiveNodeEvent] = useState<KratoEvent | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [clusterKeys, setClusterKeys] = useState<Record<string, string[]>>({});
  const [activeModal, setActiveModal] = useState<'explorer' | 'chaos' | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'guide'>('dashboard');

  // Inline KV state
  const [kvMode, setKvMode] = useState<'set' | 'get'>('set');
  const [kvKey, setKvKey] = useState('');
  const [kvValue, setKvValue] = useState('');
  const [kvResult, setKvResult] = useState<{ value: string | null; error?: string } | null>(null);
  const [kvLoading, setKvLoading] = useState(false);
  const kvKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let heartbeatInterval: ReturnType<typeof setInterval>;
    let retryCount = 0;

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket: ${wsUrl} (Attempt ${retryCount + 1})`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        retryCount = 0;
        fetchInitialData();
        
        // Heartbeat to keep proxy connections alive
        heartbeatInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as KratoEvent;
          setEvents(prev => [event, ...prev.slice(0, 49)]);
          if (event.type === 'key_op') setActiveKeyOp(event);
          if (event.type === 'node_status') setActiveNodeEvent(event);
          if (['gossip', 'node_status', 'key_op'].includes(event.type)) fetchInitialData();
        } catch (err) {
          // Ignore pong or non-JSON messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearInterval(heartbeatInterval);
        
        // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
        const delay = Math.min(1000 * Math.pow(2, retryCount), 15000);
        console.log(`WebSocket closed. Retrying in ${delay}ms...`);
        
        reconnectTimeout = setTimeout(() => {
          retryCount++;
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws?.close();
      };
    };

    connect();

    return () => {
      ws?.close();
      clearTimeout(reconnectTimeout);
      clearInterval(heartbeatInterval);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [ringRes, nodesRes, keysRes] = await Promise.all([
        fetch('/api/cluster/ring'),
        fetch('/api/nodes'),
        fetch('/api/cluster/keys'),
      ]);
      if (nodesRes.ok && ringRes.ok) {
        const nodesData = (await nodesRes.json()) as ClusterState;
        const ringSnapshot = await ringRes.json();
        setRingData(ringSnapshot);

        // Sort physical nodes by ring SUCCESSION to ensure visual adjacency
        // 1. Get all hashes in order
        const sortedHashes = Object.keys(ringSnapshot).sort((a, b) => {
          const ba = BigInt(a);
          const bb = BigInt(b);
          return ba < bb ? -1 : 1;
        });

        // 2. Identify physical node order by first appearance
        const orderedNodeIds: string[] = [];
        const seen = new Set<string>();
        for (const h of sortedHashes) {
          const nid = ringSnapshot[h];
          if (!seen.has(nid)) {
            seen.add(nid);
            orderedNodeIds.push(nid);
          }
        }

        // 3. Sort physical nodes list by this ring order
        nodesData.nodes.sort((a, b) => {
          const idxA = orderedNodeIds.indexOf(a.ID);
          const idxB = orderedNodeIds.indexOf(b.ID);
          return idxA - idxB;
        });

        setCluster(nodesData);
        if (!selectedNodeId && nodesData.nodes.length > 0) {
          setSelectedNodeId(nodesData.nodes[0].ID);
        }
      }
      if (keysRes.ok) setClusterKeys(await keysRes.json());
    } catch (err) {
      console.error('Failed to fetch cluster data', err);
    }
  };

  // Inline Set
  const handleSet = async () => {
    if (!kvKey || !kvValue) return;
    setKvLoading(true);
    setKvResult(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: kvKey, value: kvValue, consistency: 'quorum' }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKvResult({ value: '✓ Written to cluster' });
      setKvValue('');
      fetchInitialData();
    } catch (err: any) {
      setKvResult({ value: null, error: err.message });
    } finally {
      setKvLoading(false);
    }
  };

  // Inline Get
  const handleGet = async () => {
    if (!kvKey) return;
    setKvLoading(true);
    setKvResult(null);
    try {
      const res = await fetch(`/api/keys?key=${encodeURIComponent(kvKey)}&consistency=quorum`);
      if (res.status === 404) { setKvResult({ value: null }); return; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setKvResult({ value: data.value });
    } catch (err: any) {
      setKvResult({ value: null, error: err.message });
    } finally {
      setKvLoading(false);
    }
  };

  const handleChaos = async (latency: string, killed: boolean) => {
    await fetch('/api/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latency, killed }),
    });
    fetchInitialData();
  };

  const closeModal = () => setActiveModal(null);

  return (
    <>
      <div className="flex flex-col h-screen bg-background text-text overflow-hidden">
        {/* ── Header ── */}
        {currentView !== 'guide' && (
        <header className="flex items-center justify-between px-8 h-16 shrink-0 border-b border-white/[0.08] bg-black/30 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight leading-none text-white">KRATO</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-secondary' : 'bg-error'} animate-pulse`} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                  {isConnected ? 'Live' : 'Reconnecting'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <CompactMetric label="Throughput" value={`${cluster?.metrics?.request_count ?? 0}`} unit="rps" icon={<Activity size={12} />} />
            <CompactMetric label="P99" value={cluster?.metrics?.p99 ? `${(cluster.metrics.p99 / 1e6).toFixed(1)}` : '—'} unit="ms" icon={<Clock size={12} />} />
            <CompactMetric label="Nodes" value={`${cluster?.nodes?.length ?? 0}`} unit="up" icon={<Layers size={12} />} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal(activeModal === 'chaos' ? null : 'chaos')}
              className={`cursor-pointer px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all ${
                activeModal === 'chaos'
                  ? 'bg-error/10 border-error/40 text-error'
                  : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white hover:bg-white/5'
              }`}
            >
              Chaos Lab
            </button>
            <button
              onClick={() => setActiveModal(activeModal === 'explorer' ? null : 'explorer')}
              className={`cursor-pointer px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all ${
                activeModal === 'explorer'
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white hover:bg-white/5'
              }`}
            >
              Explorer
            </button>
            <button
              onClick={() => setCurrentView((currentView as string) === 'guide' ? 'dashboard' : 'guide')}
              className="cursor-pointer px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all"
            >
              Guide
            </button>
          </div>
        </header>
        )}

        {/* ── Main Content Switcher ── */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 hero-container overflow-hidden">
                  {/* Left: Ring + Inline KV strip */}
                  <div className="flex flex-col overflow-hidden gap-3 min-h-0">
                    {/* Hash Ring card */}
                    <div className="bento-card flex-1 flex flex-col items-center justify-center relative overflow-hidden min-h-0">
                      <div className="absolute top-5 left-5 z-10 space-y-0.5">
                        <div className="metric-label">Consistency Topology</div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                          <span className="text-[9px] font-mono text-white/40">
                            {Object.keys(ringData).length} vnodes · {cluster?.nodes?.length ?? 0} shards
                          </span>
                        </div>
                      </div>

                      <HashRing
                        ringData={ringData}
                        nodes={cluster?.nodes || []}
                        activeOp={activeKeyOp}
                        nodeEvent={activeNodeEvent}
                        onSelectNode={(id) => {
                          setSelectedNodeId(id);
                          setActiveModal('explorer');
                        }}
                      />

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-white/15 font-bold uppercase tracking-widest whitespace-nowrap">
                        Click any node to explore · Keys flash on write/read
                      </div>
                    </div>

                    {/* Inline KV Input Strip */}
                    <div className="bento-card shrink-0 p-4!">
                      <div className="flex items-center gap-3">
                        {/* Mode Toggle */}
                        <div className="flex bg-black/30 rounded-lg p-0.5 shrink-0">
                          <button
                            onClick={() => { setKvMode('set'); setKvResult(null); }}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${kvMode === 'set' ? 'bg-primary text-white' : 'text-text-dim hover:text-white'}`}
                          >
                            <Plus size={10} className="inline mr-1" />Set
                          </button>
                          <button
                            onClick={() => { setKvMode('get'); setKvResult(null); }}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${kvMode === 'get' ? 'bg-secondary text-white' : 'text-text-dim hover:text-white'}`}
                          >
                            <Search size={10} className="inline mr-1" />Get
                          </button>
                        </div>

                        {/* Key Input */}
                        <input
                          ref={kvKeyRef}
                          value={kvKey}
                          onChange={e => { setKvKey(e.target.value); setKvResult(null); }}
                          onKeyDown={e => e.key === 'Enter' && (kvMode === 'set' ? handleSet() : handleGet())}
                          placeholder="Key"
                          className="w-36 bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-primary/40 transition-colors"
                        />

                        {/* Value input (set mode only) */}
                        {kvMode === 'set' && (
                          <input
                            value={kvValue}
                            onChange={e => setKvValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSet()}
                            placeholder="Value"
                            className="flex-1 bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-primary/40 transition-colors"
                          />
                        )}

                        {/* Result (get mode) */}
                        {kvMode === 'get' && (
                          <div className="flex-1 bg-black/10 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-mono min-h-[36px] flex items-center">
                            {kvLoading ? (
                              <span className="text-text-dim animate-pulse">Querying quorum…</span>
                            ) : kvResult ? (
                              kvResult.error ? (
                                <span className="text-error">{kvResult.error}</span>
                              ) : kvResult.value === null ? (
                                <span className="text-text-dim italic">Key not found</span>
                              ) : (
                                <span className="text-secondary break-all">{kvResult.value}</span>
                              )
                            ) : (
                              <span className="text-white/15 italic">Result will appear here</span>
                            )}
                          </div>
                        )}

                        {/* CTA */}
                        <button
                          onClick={kvMode === 'set' ? handleSet : handleGet}
                          disabled={kvLoading || !kvKey || (kvMode === 'set' && !kvValue)}
                          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all disabled:opacity-40 ${
                            kvMode === 'set' ? 'bg-primary hover:bg-primary/80 text-white' : 'bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20'
                          }`}
                        >
                          {kvLoading ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                          {kvMode === 'set' ? 'Write' : 'Fetch'}
                        </button>

                        {/* Set success result */}
                        {kvMode === 'set' && kvResult && (
                          <div className="text-[10px] font-mono shrink-0">
                            {kvResult.error ? (
                              <span className="text-error">{kvResult.error}</span>
                            ) : (
                              <span className="text-secondary">{kvResult.value}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Real-time Event Stream */}
                  <div className="bento-card flex flex-col overflow-hidden p-0! min-h-0">
                    <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                      <span className="metric-label">System Pulse</span>
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1 h-1 rounded-full bg-secondary" style={{ opacity: 0.3 + i * 0.25 }} />
                        ))}
                        <span className="text-[8px] text-secondary ml-1.5 font-bold uppercase tracking-wider">Live</span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <EventLog events={events} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="guide"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full"
              >
                <ExplorerGuide onBack={() => setCurrentView('dashboard')} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ── Modals ── */}
        {activeModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    {activeModal === 'explorer' && 'Cluster Explorer'}
                    {activeModal === 'chaos' && 'Chaos Laboratory'}
                  </h2>
                  <p className="text-[10px] text-text-dim mt-0.5">
                    {activeModal === 'explorer' && 'Browse per-node key distribution and their values'}
                    {activeModal === 'chaos' && 'Inject failure modes to validate cluster resilience'}
                  </p>
                </div>
                <button onClick={closeModal} className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-text-dim hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-hidden" style={{ height: 'calc(85vh - 80px)' }}>
                {activeModal === 'explorer' && (
                  <NodeExplorer
                    nodes={cluster?.nodes || []}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    clusterKeys={clusterKeys}
                  />
                )}

                {activeModal === 'chaos' && (
                  <div className="p-8 space-y-8">
                    <div className="text-center space-y-2 text-text-dim max-w-sm mx-auto">
                      <AlertTriangle size={26} className="mx-auto text-error/50" />
                      <p className="text-xs leading-relaxed">
                        Inject failure modes to observe how Krato maintains consistency and availability under adverse conditions.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <ChaosCard icon={<Play size={20} />} title="Network Delay" desc="Inject 500ms latency" onClick={() => { handleChaos('500ms', false); closeModal(); }} />
                      <ChaosCard icon={<Trash2 size={20} />} title="Node Partition" desc="Cut node from cluster" danger onClick={() => { handleChaos('0s', true); closeModal(); }} />
                      <ChaosCard icon={<RotateCcw size={20} />} title="Rebalance" desc="Restore normal operation" onClick={() => { handleChaos('0s', false); closeModal(); }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <AIChat />
    </>
  );
};

/* Sub-components */

const CompactMetric: React.FC<{ label: string; value: string; unit: string; icon: React.ReactNode }> = ({ label, value, unit, icon }) => (
  <div className="flex items-center gap-2.5">
    <div className="text-white/40">{icon}</div>
    <div>
      <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none mb-0.5">{label}</div>
      <div className="text-sm font-mono font-bold leading-none text-white">
        {value}<span className="text-[10px] text-white/40 ml-0.5 font-normal">{unit}</span>
      </div>
    </div>
  </div>
);

const ChaosCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; danger?: boolean; onClick: () => void }> = ({ icon, title, desc, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all ${
      danger
        ? 'border-error/20 text-error hover:bg-error/5 hover:border-error/40'
        : 'border-white/5 text-text-dim hover:bg-white/5 hover:text-white hover:border-white/10'
    }`}
  >
    {icon}
    <div className="text-center">
      <div className="text-xs font-bold">{title}</div>
      <div className="text-[9px] text-text-dim mt-0.5">{desc}</div>
    </div>
  </button>
);

export default App;
