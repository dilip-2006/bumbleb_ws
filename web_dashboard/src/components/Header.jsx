import React, { useState } from 'react';
import { Wifi, WifiOff, AlertOctagon, ShieldAlert, Cpu, MapPin, Box, Terminal, Info, CheckCircle2 } from 'lucide-react';

export default function Header({ connected, systemState, onEmergencyStop, onResetEmergencyStop }) {
  const isEstop = systemState?.is_emergency_stop || systemState?.state === 'EMERGENCY_STOP';
  const state = systemState?.state || 'READY';
  const activeMap = systemState?.active_map || 'warehouse_main';
  const [showSimInfo, setShowSimInfo] = useState(false);

  return (
    <header className="bg-[#090d16]/95 border-b border-slate-800/80 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur-md shadow-lg">
      {/* Brand & Mode */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-[1px] shadow-lg shadow-amber-500/20">
          <div className="h-full w-full bg-[#090d16] rounded-[11px] flex items-center justify-center font-black text-amber-400 font-mono text-base">
            B
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              BUMBLEB <span className="text-amber-400 font-extrabold">AMR</span>
            </h1>
            {/* Simulation First Badge */}
            <div className="relative">
              <button
                onClick={() => setShowSimInfo(!showSimInfo)}
                className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 transition-all shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>SIMULATION FIRST</span>
                <Info className="w-2.5 h-2.5 opacity-70" />
              </button>

              {/* Simulation Info Dropdown */}
              {showSimInfo && (
                <div className="absolute left-0 top-full mt-2 w-72 p-3.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-xs z-50 font-mono">
                  <div className="flex items-center gap-2 text-amber-400 font-bold mb-1.5">
                    <Box className="w-4 h-4" />
                    <span>GAZEBO SIMULATION ACTIVE</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px] mb-2">
                    Testing on virtual warehouse (<code className="text-sky-300">obstacle.world</code>) first.
                  </p>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                    <span className="text-emerald-400 font-bold">Physical Robot Migration:</span>
                    <br />
                    Once virtual navigation is validated, launching with <code className="text-amber-300">simulation:=false</code> seamlessly engages the physical RPLiDAR A1 and ZLAC706-CAN motor drivers.
                  </div>
                  <button
                    onClick={() => setShowSimInfo(false)}
                    className="mt-2 text-[10px] text-sky-400 hover:underline block text-right w-full"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Warehouse Fleet Autonomy • SLAM • Nav2 • rosbridge :9090
          </p>
        </div>

        {/* Active Map & Environment Badges */}
        <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800">
            <MapPin className="w-3 h-3 text-sky-400" />
            <span className="text-slate-400 text-[11px]">MAP:</span>
            <span className="text-slate-200 font-bold text-[11px]">{activeMap || 'warehouse_main'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800">
            <Box className="w-3 h-3 text-purple-400" />
            <span className="text-slate-400 text-[11px]">ENV:</span>
            <span className="text-purple-300 font-bold text-[11px]">GAZEBO CLASSIC</span>
          </div>
        </div>
      </div>

      {/* Status Indicators & Emergency Stop */}
      <div className="flex items-center gap-2.5">
        {/* ROS Bridge Status */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono font-bold transition-all ${
          connected ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 'bg-red-950/40 border-red-500/40 text-red-400'
        }`}>
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="text-[11px]">ROSBRIDGE ON</span>
            </>
          ) : (
            <>
              <span className="inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              <WifiOff className="w-3.5 h-3.5" />
              <span className="text-[11px]">WS DISCONNECTED</span>
            </>
          )}
        </div>

        {/* FSM State Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono font-black tracking-wider ${
          isEstop ? 'bg-red-900/60 border-red-500 text-red-200 animate-estop' :
          state === 'NAVIGATION' ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-sm shadow-sky-500/20' :
          state === 'MAPPING' ? 'bg-purple-950/60 border-purple-500 text-purple-300 shadow-sm shadow-purple-500/20' :
          state === 'LOCALIZATION' ? 'bg-teal-950/60 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/20' :
          state === 'READY' ? 'bg-slate-900 border-emerald-500/50 text-emerald-300' :
          'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <Cpu className="w-3.5 h-3.5" />
          <span>{state}</span>
        </div>

        {/* Emergency Stop Button */}
        {isEstop ? (
          <button
            onClick={onResetEmergencyStop}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-black text-xs shadow-lg transition-all active:scale-95 border border-emerald-400"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>RESET E-STOP</span>
          </button>
        ) : (
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-mono font-black text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95 border border-red-500"
            title="Immediate 20Hz zero-velocity motor clamp"
          >
            <AlertOctagon className="w-4 h-4 animate-pulse" />
            <span>EMERGENCY STOP</span>
          </button>
        )}
      </div>
    </header>
  );
}
