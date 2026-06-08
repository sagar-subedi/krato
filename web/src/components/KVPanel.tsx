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
    <div className="grid grid-cols-2 gap-6">
      {/* Set Panel */}
      <div className="glass p-6 rounded-2xl space-y-4 glow-primary">
        <div className="flex items-center gap-2 text-primary">
          <Plus size={18} />
          <h2 className="text-sm font-bold uppercase tracking-widest">Set Key-Value</h2>
        </div>
        <div className="space-y-3">
          <input 
            type="text" 
            value={setKey}
            onChange={(e) => setSetKey(e.target.value)}
            placeholder="Key" 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 transition-colors"
          />
          <textarea 
            value={setValue}
            onChange={(e) => setSetValue(e.target.value)}
            placeholder="Value (JSON or String)" 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 transition-colors h-24 resize-none"
          />
          <button 
            onClick={handleSet}
            disabled={isSetting}
            className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            {isSetting ? 'Processing...' : 'Write to Cluster'}
            {!isSetting && <ArrowRight size={16} />}
          </button>
        </div>
      </div>

      {/* Get Panel */}
      <div className="glass p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-secondary">
          <Search size={18} />
          <h2 className="text-sm font-bold uppercase tracking-widest">Get Value</h2>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={getKey}
              onChange={(e) => setGetKey(e.target.value)}
              placeholder="Enter key..." 
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-secondary/50 transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && handleGet()}
            />
            <button 
              onClick={handleGet}
              disabled={isGetting}
              className="bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/30 px-6 rounded-xl font-bold text-sm transition-all"
            >
              Fetch
            </button>
          </div>

          <div className="flex-1 min-h-[148px] bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col font-mono">
            {isGetting ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse text-xs">
                Querying nodes...
              </div>
            ) : getResult ? (
              <div className="space-y-2">
                <div className="text-[10px] uppercase text-gray-500 font-bold">Result</div>
                {getResult.error ? (
                  <div className="text-error text-xs">{getResult.error}</div>
                ) : getResult.value === null ? (
                  <div className="text-gray-500 text-xs italic">Key not found in any replica</div>
                ) : (
                  <div className="text-secondary text-xs break-all bg-secondary/5 p-2 rounded border border-secondary/10 overflow-auto max-h-24">
                    {getResult.value}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 italic text-xs">
                Enter a key to perform a quorum read
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KVPanel;
