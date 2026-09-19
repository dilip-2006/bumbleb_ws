import React, { useState } from 'react';
import { Play, Square, Layers, Map, Navigation, Power, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ModeSelector({ systemState, onCommand, activeMap }) {
  const currentMode = systemState?.state || 'READY';
  const [confirmModal, setConfirmModal] = useState(null);

  const handleAction = (action, label, requiresConfirm = false) => {
    if (requiresConfirm) {
      setConfirmModal({ action, label });
    } else {
      onCommand({ action });
    }
  };

  const confirmAndExecute = () => {
    if (confirmModal) {
      onCommand({ action: confirmModal.action });
      setConfirmModal(null);
    }
  };

  return (
    <div className="panel flex flex-col h-full justify-between bg-[#0b101d]/90">
      <div className="panel-header py-1.5 px-3">
        <span className="flex items-center gap-2">
          <Power className="w-3.5 h-3.5 text-amber-400" />
          SYSTEM AUTONOMY MODES
        </span>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-slate-400">STATE:</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-bold text-amber-300">
            {currentMode}
          </span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2.5 justify-between flex-1">
        {/* Step-by-Step Mode Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 1. Start Robot / Ready */}
          <button
            onClick={() => handleAction('start_robot', 'Start Robot')}
            disabled={currentMode !== 'OFF'}
            className={`btn py-2.5 flex flex-col items-center gap-1 transition-all ${
              currentMode === 'READY'
                ? 'bg-slate-800/90 text-white border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                : 'btn-secondary'
            }`}
          >
            <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono">
              <Power className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. READY</span>
            </div>
            <span className="text-[9px] text-slate-400 font-normal">Drivetrain Active</span>
          </button>

          {/* 2. SLAM Mapping */}
          {currentMode === 'MAPPING' ? (
            <button
              onClick={() => handleAction('stop_mapping', 'Stop SLAM Mapping', true)}
              className="btn btn-danger py-2.5 flex flex-col items-center gap-1 animate-pulse"
            >
              <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono">
                <Square className="w-3.5 h-3.5" />
                <span>STOP SLAM</span>
              </div>
              <span className="text-[9px] text-red-200 font-normal">Mapping Active</span>
            </button>
          ) : (
            <button
              onClick={() => handleAction('start_mapping', 'Start SLAM Mapping', currentMode !== 'READY')}
              className="btn btn-secondary py-2.5 flex flex-col items-center gap-1 hover:border-purple-500/50"
            >
              <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono text-purple-300">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>2. MAPPING</span>
              </div>
              <span className="text-[9px] text-slate-400 font-normal">SLAM Toolbox</span>
            </button>
          )}

          {/* 3. Localization Mode */}
          {currentMode === 'LOCALIZATION' ? (
            <button
              onClick={() => handleAction('stop_localization', 'Stop Localization', true)}
              className="btn btn-danger py-2.5 flex flex-col items-center gap-1"
            >
              <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono">
                <Square className="w-3.5 h-3.5" />
                <span>STOP AMCL</span>
              </div>
              <span className="text-[9px] text-red-200 font-normal">AMCL Active</span>
            </button>
          ) : (
            <button
              onClick={() => onCommand({ action: 'start_localization', map_name: activeMap })}
              className="btn btn-secondary py-2.5 flex flex-col items-center gap-1 hover:border-teal-500/50"
            >
              <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono text-teal-300">
                <Map className="w-3.5 h-3.5 text-teal-400" />
                <span>3. AMCL</span>
              </div>
              <span className="text-[9px] text-slate-400 font-normal">Map Localization</span>
            </button>
          )}

          {/* 4. Nav2 Navigation Mode */}
          {currentMode === 'NAVIGATION' ? (
            <button
              onClick={() => handleAction('stop_navigation', 'Stop Nav2 Navigation')}
              className="btn btn-danger py-2.5 flex flex-col items-center gap-1 shadow-lg shadow-red-500/30"
            >
              <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono">
                <Square className="w-3.5 h-3.5" />
                <span>STOP NAV2</span>
              </div>
              <span className="text-[9px] text-red-200 font-normal">Nav2 Autonomy</span>
            </button>
          ) : (
            <button
              onClick={() => onCommand({ action: 'start_navigation', map_name: activeMap })}
              className="btn btn-primary py-2.5 flex flex-col items-center gap-1 shadow-md shadow-blue-500/30"
            >
              <div className="flex items-center gap-1 text-[11px] font-extrabold font-mono">
                <Navigation className="w-3.5 h-3.5 text-sky-200" />
                <span>4. NAV2</span>
              </div>
              <span className="text-[9px] text-sky-200 font-normal">Autonomous Goals</span>
            </button>
          )}
        </div>

        {/* Quick Safety & Subsystem Controls Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('system_reset', 'System Reset')}
              className="btn btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1 hover:border-slate-600"
              title="Reset state machine to READY"
            >
              <RefreshCw className="w-3 h-3 text-slate-400" />
              SYSTEM RESET
            </button>
            <button
              onClick={() => handleAction('stop_robot', 'Stop Robot & Subsystems', true)}
              className="btn btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1 text-red-300 hover:border-red-500/40"
            >
              <Square className="w-3 h-3 text-red-400" />
              STOP ALL
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
            <span>ACTIVE:</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-bold text-white">
              {currentMode === 'MAPPING' ? 'SLAM_TOOLBOX' :
               currentMode === 'LOCALIZATION' ? 'MAP_SERVER + AMCL' :
               currentMode === 'NAVIGATION' ? 'NAV2_CONTROLLER' :
               currentMode === 'READY' ? 'DRIVETRAIN_ACTIVE' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Confirm Action</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Execute <strong className="text-amber-400">{confirmModal.label}</strong>? This transitions active ROS 2 nodes.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndExecute}
                className="btn btn-primary text-xs px-4 py-1.5"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
