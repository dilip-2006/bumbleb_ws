import React, { useState } from 'react';
import { Map, Save, FolderOpen, Check, AlertCircle } from 'lucide-react';

export default function MapManager({ maps, activeMap, onSaveMap, onLoadMap }) {
  const [mapInput, setMapInput] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  const handleSave = (e) => {
    e.preventDefault();
    if (!mapInput.trim()) return;

    // Strict validation
    if (!/^[a-zA-Z0-9_\-]+$/.test(mapInput.trim())) {
      setSaveStatus({ ok: false, msg: 'Invalid name. Letters, numbers, - and _ only.' });
      return;
    }

    onSaveMap(mapInput.trim());
    setSaveStatus({ ok: true, msg: `Map '${mapInput.trim()}' save requested.` });
    setTimeout(() => setSaveStatus(null), 4000);
    setMapInput('');
  };

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <Map className="w-4 h-4 text-sky-400" />
          MAP MANAGEMENT & SAVING
        </span>
        <span className="text-[10px] font-mono text-slate-400">CONTROLLED STORAGE</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Save Map Form */}
        <form onSubmit={handleSave} className="space-y-2">
          <label className="block text-xs font-mono font-semibold text-slate-300">
            SAVE CURRENT MAP (/map)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={mapInput}
              onChange={(e) => setMapInput(e.target.value)}
              placeholder="e.g. warehouse_main"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              SAVE MAP
            </button>
          </div>

          {saveStatus && (
            <div className={`text-[11px] font-mono flex items-center gap-1.5 mt-1 ${
              saveStatus.ok ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {saveStatus.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{saveStatus.msg}</span>
            </div>
          )}
        </form>

        {/* Available Maps List */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 mb-2">
            AVAILABLE WAREHOUSE MAPS ({maps.length})
          </label>
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {maps.length === 0 ? (
              <div className="text-center py-4 text-xs font-mono text-slate-500">
                No saved maps found in maps/
              </div>
            ) : (
              maps.map((name) => {
                const isActive = name === activeMap;
                return (
                  <div
                    key={name}
                    className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
                      isActive ? 'bg-blue-950/40 border-blue-500/40 text-blue-200' : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderOpen className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span className="truncate font-semibold">{name}</span>
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onLoadMap(name)}
                      disabled={isActive}
                      className="btn btn-secondary text-[11px] px-2.5 py-1 shrink-0"
                    >
                      {isActive ? 'LOADED' : 'LOAD MAP'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
