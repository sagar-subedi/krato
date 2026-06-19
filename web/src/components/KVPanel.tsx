import React, { useState } from 'react';
import { Search, Plus, ArrowRight } from 'lucide-react';

interface KVPanelProps {
  onSet: (key: string, value: string) => Promise<void>;
  onGet: (key: string) => Promise<string | null>;
}

const KVPanel: React.FC<KVPanelProps> = ({ onSet, onGet }) => {
  const [setKey, setSetKey] = useState('');
  const [setValue, setSetValue] = useState('');
  const [getKey, setGetKey] = useState('');
  const [getResult, setGetResult] = useState<{ value: string | null; error?: string } | null>(null);
  const [isSetting, setIsSetting] = useState(false);
  const [isGetting, setIsGetting] = useState(false);

  const handleSet = async () => {
    if (!setKey || !setValue) return;
    setIsSetting(true);
    try {
      await onSet(setKey, setValue);
      setSetKey('');
      setSetValue('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSetting(false);
    }
  };

  const handleGet = async () => {
    if (!getKey) return;
    setIsGetting(true);
    setGetResult(null);
    try {
      const val = await onGet(getKey);
      setGetResult({ value: val });
    } catch (err: any) {
      setGetResult({ value: null, error: err.message });
    } finally {
      setIsGetting(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Set Panel */}
      <div className="bento-card flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <span className="metric-label">Store Fragment</span>
           <Plus size={14} className="text-primary/50" />
        </div>
        <div className="space-y-3 flex-1 flex flex-col justify-center">
          <input 
            type="text" 
            value={setKey}
            onChange={(e) => setSetKey(e.target.value)}
            placeholder="Fragment Key" 
            className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-mono focus:outline-none focus:border-primary/50 transition-colors"
          />
          <textarea 
            value={setValue}
            onChange={(e) => setSetValue(e.target.value)}
            placeholder="Payload..." 
            className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-mono focus:outline-none focus:border-primary/50 transition-colors h-20 resize-none"
          />
          <button 
            onClick={handleSet}
            disabled={isSetting}
            className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 py-2.5 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            {isSetting ? 'Replicating...' : 'Commit to Cluster'}
            {!isSetting && <ArrowRight size={14} />}
          </button>
        </div>
      </div>

      {/* Get Panel */}
      <div className="bento-card flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <span className="metric-label">Direct Query</span>
           <Search size={14} className="text-secondary/50" />
        </div>
        <div className="space-y-3 flex-1 flex flex-col">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={getKey}
              onChange={(e) => setGetKey(e.target.value)}
              placeholder="Query Key" 
              className="flex-1 bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-mono focus:outline-none focus:border-secondary/50 transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && handleGet()}
            />
            <button 
              onClick={handleGet}
              disabled={isGetting}
              className="bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 px-4 rounded-xl font-bold text-[10px] transition-all"
            >
              Fetch
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col font-mono overflow-hidden">
            {isGetting ? (
              <div className="flex-1 flex items-center justify-center text-text-dim animate-pulse text-[10px]">
                Quorum consensus...
              </div>
            ) : getResult ? (
              <div className="h-full flex flex-col">
                <div className="text-[8px] uppercase text-text-dim font-bold mb-1">Result</div>
                {getResult.error ? (
                  <div className="text-error text-[10px]">{getResult.error}</div>
                ) : getResult.value === null ? (
                  <div className="text-text-dim text-[10px] italic">Not found</div>
                ) : (
                  <div className="text-secondary text-[10px] break-all p-2 rounded bg-secondary/5 border border-secondary/10 overflow-auto custom-scrollbar">
                    {getResult.value}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-dim italic text-[10px] opacity-30 text-center">
                Consensus read across replicas
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KVPanel;
