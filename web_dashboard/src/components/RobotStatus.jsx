import React from 'react';
import { Compass, Gauge, BatteryCharging, Navigation, Activity } from 'lucide-react';

export default function RobotStatus({ robotPose, velocity, battery, navStatus }) {
  const x = Number(robotPose?.x || 0).toFixed(3);
  const y = Number(robotPose?.y || 0).toFixed(3);
  const rawYaw = robotPose?.yaw || 0;
  const yawDeg = Number(robotPose?.yaw_deg ?? (rawYaw * 180 / Math.PI)).toFixed(1);
  const yawRad = Number(rawYaw).toFixed(2);
  const linVel = Math.abs(Number(velocity?.linear || 0)).toFixed(2);
  const angVel = Number(velocity?.angular || 0).toFixed(2);
  const batPct = Math.round((battery?.percentage || 0.95) * 100);
  const batVolt = Number(battery?.voltage || 25.4).toFixed(1);

  return (
    <div className="panel flex flex-col justify-between h-full bg-[#0b101d]/90">
      <div className="panel-header py-1.5 px-3">
        <span className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          KINEMATICS & TELEMETRY
        </span>
        <span className="text-[10px] font-mono text-slate-400">DIFF-DRIVE 50Hz</span>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* X Position */}
        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800/90 shadow-inner">
          <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-0.5">X POSITION</div>
          <div className="text-xl font-black font-mono text-white flex items-baseline gap-1">
            {x} <span className="text-[10px] font-normal text-slate-400">m</span>
          </div>
          <div className="text-[9px] font-mono text-slate-500">Map Frame</div>
        </div>

        {/* Y Position */}
        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800/90 shadow-inner">
          <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-0.5">Y POSITION</div>
          <div className="text-xl font-black font-mono text-white flex items-baseline gap-1">
            {y} <span className="text-[10px] font-normal text-slate-400">m</span>
          </div>
          <div className="text-[9px] font-mono text-slate-500">Map Frame</div>
        </div>

        {/* Heading Yaw + Compass Needle */}
        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800/90 shadow-inner flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-0.5">HEADING</div>
            <div className="text-xl font-black font-mono text-amber-300">
              {yawDeg}°
            </div>
            <div className="text-[9px] font-mono text-slate-500">{yawRad} rad</div>
          </div>
          {/* Mini Compass Dial */}
          <div className="relative h-8 w-8 rounded-full border border-slate-700 bg-slate-950 flex items-center justify-center shrink-0">
            <div
              className="w-1 h-6 bg-gradient-to-t from-transparent via-amber-400 to-red-500 rounded-full transition-transform duration-100"
              style={{ transform: `rotate(${yawDeg}deg)` }}
            />
            <div className="absolute w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Velocity */}
        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800/90 shadow-inner flex items-center justify-between">
          <div>
            <div className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-0.5">SPEED</div>
            <div className="text-xl font-black font-mono text-emerald-300 flex items-baseline gap-1">
              {linVel} <span className="text-[10px] font-normal text-slate-400">m/s</span>
            </div>
            <div className="text-[9px] font-mono text-slate-500">ω = {angVel} rad/s</div>
          </div>
          <Gauge className="w-5 h-5 text-emerald-400 opacity-60" />
        </div>
      </div>

      {/* Battery & Nav2 Status Bar */}
      <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Battery Health */}
        <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/20 text-emerald-400">
              <BatteryCharging className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-200 font-bold">24V BATTERY</div>
              <div className="text-[9px] font-mono text-slate-400">{batVolt} V Nominal</div>
            </div>
          </div>
          <div className="w-28">
            <div className="flex justify-between text-[10px] font-mono font-bold mb-0.5">
              <span className={batPct > 20 ? 'text-emerald-400' : 'text-red-400'}>{batPct}%</span>
              <span className="text-slate-500">HEALTHY</span>
            </div>
            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  batPct > 50 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-amber-500'
                }`}
                style={{ width: `${batPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Feedback */}
        <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg border ${
              navStatus?.status === 'NAVIGATING' ? 'bg-sky-950/60 border-sky-500/30 text-sky-400 animate-pulse' :
              navStatus?.status === 'SUCCEEDED' ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' :
              'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Navigation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono text-slate-200 font-bold flex items-center gap-1">
                NAV2: <span className="text-sky-400">{navStatus?.status || 'IDLE'}</span>
              </div>
              <div className="text-[9px] font-mono text-slate-400 truncate">
                {navStatus?.target ? `Target: ${navStatus.target}` : 'Ready for goal'}
              </div>
            </div>
          </div>
          <div className="text-right font-mono shrink-0 pl-1">
            <div className="text-xs font-bold text-white">
              {navStatus?.distance_remaining != null ? `${navStatus.distance_remaining}m` : '--'}
            </div>
            <div className="text-[8px] text-slate-500 uppercase">REMAINING</div>
          </div>
        </div>
      </div>
    </div>
  );
}
