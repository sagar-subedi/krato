import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Server,
  HardDrive,
  Key,
  ChevronRight,
  Shield,
  Activity,
  Eye,
  X,
  Copy,
  Check,
} from 'lucide-react';
import type { NodeInfo, NodeDetail } from '../types';

interface NodeExplorerProps {
  nodes: NodeInfo[];
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
  clusterKeys: Record<string, string[]>;
}

const NodeExplorer: React.FC<NodeExplorerProps> = ({ nodes, selectedNodeId, onSelectNode, clusterKeys }) => {
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState<string | null>(null);
  const [loadingValue, setLoadingValue] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedNodeId) {
      fetchNodeDetail(selectedNodeId);
      setSelectedKey(null);
      setKeyValue(null);
    }
  }, [selectedNodeId]);

  const fetchNodeDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/node/${id}`);
      if (res.ok) setNodeDetail(await res.json());
    } catch (err) {
      console.error('Failed to fetch node detail', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKeyValue = async (key: string) => {
    if (selectedKey === key) {
      // toggle off
      setSelectedKey(null);
      setKeyValue(null);
      return;
    }
    setSelectedKey(key);
    setKeyValue(null);
    setLoadingValue(true);
    try {
      const res = await fetch(`/api/keys?key=${encodeURIComponent(key)}&consistency=quorum`);
      if (res.status === 404) {
        setKeyValue('(not found)');
      } else if (res.ok) {
        const data = await res.json();
        setKeyValue(data.value ?? '(empty)');
      } else {
        setKeyValue('(error fetching value)');
      }
    } catch {
      setKeyValue('(network error)');
    } finally {
      setLoadingValue(false);
    }
  };

  const copyValue = () => {
    if (!keyValue) return;
    navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentKeys = selectedNodeId ? clusterKeys[selectedNodeId] || [] : [];
  const filteredKeys = currentKeys.filter(k => k.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full overflow-hidden bg-surface bento-card p-0! rounded-2xl">
      {/* Node Sidebar */}
      <div className="w-48 border-r border-white/5 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-white/5">
          <span className="metric-label">Cluster Nodes</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {nodes.slice().sort((a, b) => a.ID.localeCompare(b.ID)).map(n => (
            <button
              key={n.ID}
              onClick={() => onSelectNode(n.ID)}
              className={`explorer-item w-full flex items-center justify-between text-left ${selectedNodeId === n.ID ? 'active' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <Server size={12} className={selectedNodeId === n.ID ? 'text-primary' : 'text-text-dim'} />
                <div>
                  <div className="text-[11px] font-bold">{n.ID}</div>
                  <div className="text-[8px] opacity-40 font-mono truncate max-w-[80px]">{n.Address}</div>
                </div>
              </div>
              <ChevronRight size={10} className="opacity-20 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ${loading ? 'opacity-40' : 'opacity-100'}`}>
        {selectedNodeId ? (
          <>
            {/* Stats Strip */}
            <div className="px-5 py-3 border-b border-white/5 bg-board/20 flex items-center gap-6 shrink-0">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-primary" />
                <span className="text-[11px] font-bold">{selectedNodeId}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${nodeDetail?.status === 'ACTIVE' ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                  {nodeDetail?.status || '…'}
                </span>
                {nodeDetail?.is_self && (
                  <span className="text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-bold flex items-center gap-1">
                    <Shield size={8} /> Leader
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 ml-auto text-text-dim">
                <Key size={10} className="text-accent" />
                <span className="text-[10px] font-mono font-bold">{currentKeys.length} keys</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-dim">
                <HardDrive size={10} className="text-secondary" />
                <span className="text-[10px] font-mono font-bold">
                  {nodeDetail?.stats?.db_size ? `${(nodeDetail.stats.db_size / 1024).toFixed(1)} KB` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-text-dim">
                <Activity size={10} className="text-primary" />
                <span className="text-[10px] font-mono font-bold">
                  {nodeDetail?.status === 'ACTIVE' ? '99.9%' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* Key List + Value Panel */}
            <div className="flex flex-1 overflow-hidden">
              {/* Keys */}
              <div className="flex flex-col w-1/2 border-r border-white/5 overflow-hidden">
                <div className="p-3 border-b border-white/5 shrink-0">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-2 text-text-dim" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Filter keys…"
                      className="w-full bg-board/40 border border-white/5 rounded-lg py-1.5 pl-7 pr-3 text-[11px] focus:outline-none focus:border-primary/40"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {filteredKeys.length > 0 ? (
                    filteredKeys.map(key => (
                      <button
                        key={key}
                        onClick={() => fetchKeyValue(key)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left border-b border-white/4 transition-all hover:bg-white/5 ${selectedKey === key ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${selectedKey === key ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-dim'}`}>
                          <Key size={10} />
                        </div>
                        <span className={`text-[11px] font-mono truncate flex-1 ${selectedKey === key ? 'text-white' : 'text-text-dim'}`}>
                          {key}
                        </span>
                        <Eye size={10} className={`shrink-0 transition-opacity ${selectedKey === key ? 'opacity-60 text-primary' : 'opacity-0 group-hover:opacity-40'}`} />
                      </button>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-16 text-center opacity-25 space-y-2">
                      <Database size={24} />
                      <div className="text-[10px]">No keys on this node</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Value Panel */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {selectedKey ? (
                  <>
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-board/10">
                      <div>
                        <div className="text-[8px] text-text-dim font-bold uppercase tracking-wider mb-0.5">Value for</div>
                        <div className="text-[11px] font-mono font-bold text-white truncate max-w-[180px]">{selectedKey}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={copyValue}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                          title="Copy value"
                        >
                          {copied ? <Check size={12} className="text-secondary" /> : <Copy size={11} className="text-text-dim" />}
                        </button>
                        <button
                          onClick={() => { setSelectedKey(null); setKeyValue(null); }}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                          <X size={12} className="text-text-dim" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                      {loadingValue ? (
                        <div className="flex items-center gap-2 text-text-dim text-[11px] animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                          Fetching from quorum…
                        </div>
                      ) : keyValue !== null ? (
                        <pre className="text-[11px] font-mono text-secondary leading-relaxed whitespace-pre-wrap break-all bg-secondary/5 border border-secondary/10 rounded-xl p-3">
                          {keyValue}
                        </pre>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 space-y-2 p-6">
                    <Eye size={24} />
                    <div className="text-[10px]">Click a key to view its value</div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 space-y-3 p-8">
            <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center">
              <Server size={32} />
            </div>
            <div>
              <div className="text-sm font-bold">Select a node</div>
              <div className="text-[10px] mt-1">Explore per-shard key distribution and storage stats</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeExplorer;
