import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Radio, Disc, Boxes, Compass, Layers, Map, Navigation } from 'lucide-react';

export default function SensorStatus({ systemHealth }) {
  const comps = systemHealth?.components || {};

  const items = [
    { key: 'lidar', label: 'LiDAR (/scan)', icon: Radio, data: comps.lidar },
    { key: 'odometry', label: 'Odometry (/odom)', icon: Disc, data: comps.odometry },
    { key: 'tf', label: 'TF Tree', icon: Compass, data: comps.tf },
    { key: 'controller', label: 'Drivetrain', icon: Boxes, data: comps.controller },
    { key: 'slam_toolbox', label: 'SLAM Toolbox', icon: Layers, data: comps.slam_toolbox },
    { key: 'map_server', label: 'Map Server', icon: Map, data: comps.map_server },
    { key: 'amcl', label: 'AMCL', icon: Compass, data: comps.amcl },
    { key: 'nav2', label: 'Nav2 Stack', icon: Navigation, data: comps.nav2 },
  ];

  return (
    <div className="panel flex flex-col">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          SYSTEM & SENSOR HEALTH
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
          systemHealth?.overall === 'OK' ? 'badge-ok' :
          systemHealth?.overall === 'WARNING' ? 'badge-warning' : 'badge-error'
        }`}>
          OVERALL: {systemHealth?.overall || 'UNKNOWN'}
        </span>
      </div>

      <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          const status = item.data?.status || 'OK';
          const isOk = status === 'OK';
          const isWarn = status === 'WARNING';
          const isRunning = item.data?.running;

          return (
            <div
              key={item.key}
              className={`p-2.5 rounded-lg border transition-all ${
                isOk ? 'bg-slate-900/60 border-slate-800' :
                isWarn ? 'bg-amber-950/20 border-amber-500/30' :
                'bg-red-950/20 border-red-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{item.label}</span>
                </div>
                {isOk ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isWarn ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
              </div>

              <div className="text-[11px] font-mono text-slate-400 truncate" title={item.data?.message}>
                {item.data?.message || (isRunning ? 'Running' : 'Ready')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
