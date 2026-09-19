import React, { useState } from 'react';
import { useRos } from './hooks/useRos';
import Header from './components/Header';
import RobotStatus from './components/RobotStatus';
import SensorStatus from './components/SensorStatus';
import ModeSelector from './components/ModeSelector';
import MapViewer from './components/MapViewer';
import LocationManager from './components/LocationManager';
import MapManager from './components/MapManager';
import Teleop from './components/Teleop';
import { Gamepad2, MapPin, Layers, Activity, Sparkles, CheckCircle2, ChevronRight, Terminal, Cpu } from 'lucide-react';

export default function App() {
  const {
    connected,
    systemState,
    systemHealth,
    robotPose,
    navStatus,
    locations,
    maps,
    battery,
    mapData,
    laserScan,
    globalPath,
    velocity,
    sendCommand,
    sendLocationCommand,
    sendGoal,
    sendVelocity
  } = useRos();

  // Right Drawer Tab: 'TELEOP' | 'LOCATIONS' | 'MAPS' | 'DIAGNOSTICS'
  const [controlTab, setControlTab] = useState('TELEOP');

  const handleEmergencyStop = () => {
    sendCommand({ action: 'emergency_stop' });
  };

  const handleResetEmergencyStop = () => {
    sendCommand({ action: 'reset_emergency_stop' });
  };

  const handleSaveMap = (name) => {
    sendCommand({ action: 'save_map', map_name: name });
  };

  const handleLoadMap = (name) => {
    sendCommand({ action: 'load_map', map_name: name });
  };

  const handleSaveLocation = (payload) => {
    sendLocationCommand(payload);
  };

  const handleDeleteLocation = (name) => {
    sendLocationCommand({ action: 'delete_location', name });
  };

  const handleNavigateToLocation = (name) => {
    sendLocationCommand({ action: 'navigate_to_location', name });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070a13] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* 1. Global Navigation Header */}
      <Header
        connected={connected}
        systemState={systemState}
        onEmergencyStop={handleEmergencyStop}
        onResetEmergencyStop={handleResetEmergencyStop}
      />

      {/* 2. Main Mission Cockpit */}
      <main className="flex-1 p-3 md:p-5 flex flex-col gap-3 max-w-[1920px] w-full mx-auto">
        {/* Top Telemetry & Autonomous Mode Command Deck */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-5">
            <ModeSelector
              systemState={systemState}
              onCommand={sendCommand}
              activeMap={systemState?.active_map}
            />
          </div>
          <div className="xl:col-span-7">
            <RobotStatus
              robotPose={robotPose}
              velocity={velocity}
              battery={battery}
              navStatus={navStatus}
            />
          </div>
        </div>

        {/* Central Cockpit Workspace: Interactive Map (Left) + Integrated Mission Panel (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch min-h-[580px]">
          {/* Main 2D Occupancy Map & LiDAR Radar (8 cols) */}
          <div className="lg:col-span-8 flex flex-col h-full min-h-[520px]">
            <MapViewer
              mapData={mapData}
              robotPose={robotPose}
              laserScan={laserScan}
              globalPath={globalPath}
              locations={locations}
              onSendGoal={(x, y, yaw) => sendGoal(x, y, yaw, 'map')}
              onSaveLocationAtPose={(x, y, yaw) => {
                const name = prompt(
                  `Enter Location Name for coordinates (${x.toFixed(2)}, ${y.toFixed(2)}):`,
                  `Shelf ${locations.length + 1}`
                );
                if (name) {
                  sendLocationCommand({
                    action: 'save_location',
                    name,
                    type: 'shelf',
                    use_current_pose: false,
                    x,
                    y,
                    yaw,
                    map: systemState?.active_map || 'warehouse_main'
                  });
                }
              }}
            />
          </div>

          {/* Integrated Multi-Tab Mission Control Panel (4 cols) */}
          <div className="lg:col-span-4 flex flex-col panel bg-[#0b101d]/90 overflow-hidden min-h-[520px]">
            {/* Control Panel Tab Navigation */}
            <div className="flex items-center bg-slate-950/80 border-b border-slate-800/90 p-1 gap-1">
              <button
                onClick={() => setControlTab('TELEOP')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  controlTab === 'TELEOP'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>DRIVE</span>
              </button>

              <button
                onClick={() => setControlTab('LOCATIONS')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  controlTab === 'LOCATIONS'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>POIs ({locations.length})</span>
              </button>

              <button
                onClick={() => setControlTab('MAPS')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  controlTab === 'MAPS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>MAPS</span>
              </button>

              <button
                onClick={() => setControlTab('DIAGNOSTICS')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  controlTab === 'DIAGNOSTICS'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>HEALTH</span>
              </button>
            </div>

            {/* Tab Viewport */}
            <div className="flex-1 p-3 overflow-y-auto">
              {controlTab === 'TELEOP' && (
                <Teleop
                  connected={connected}
                  isEmergencyStop={systemState?.is_emergency_stop}
                  onSendVelocity={sendVelocity}
                />
              )}

              {controlTab === 'LOCATIONS' && (
                <LocationManager
                  locations={locations}
                  robotPose={robotPose}
                  activeMap={systemState?.active_map}
                  onSaveLocation={handleSaveLocation}
                  onDeleteLocation={handleDeleteLocation}
                  onNavigateToLocation={handleNavigateToLocation}
                />
              )}

              {controlTab === 'MAPS' && (
                <MapManager
                  maps={maps}
                  activeMap={systemState?.active_map}
                  onSaveMap={handleSaveMap}
                  onLoadMap={handleLoadMap}
                />
              )}

              {controlTab === 'DIAGNOSTICS' && (
                <div className="space-y-4">
                  <SensorStatus systemHealth={systemHealth} />

                  {/* Hardware Migration Roadmap Card */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-2">
                    <div className="flex items-center gap-2 text-sky-400 font-bold">
                      <Cpu className="w-4 h-4" />
                      <span>SIMULATION ➔ HARDWARE MIGRATION</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      This stack is 100% hardware-compatible. When switching from Gazebo to real robot:
                    </p>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>LiDAR: RPLiDAR A1 publishes to <code className="text-sky-300">/scan</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Drivetrain: ZLAC706-CAN driver listens to <code className="text-sky-300">/cmd_vel</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Command: <code className="text-amber-300">simulation:=false</code></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Simulation Testing Roadmap Banner */}
        <div className="p-3 rounded-xl bg-[#090e1a]/90 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Sparkles className="w-4 h-4" />
            <span>SIMULATION VERIFICATION WORKFLOW:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-semibold">
              1. Teleop Drive (WASD)
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300 font-semibold">
              2. Start SLAM Mapping
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-teal-300 font-semibold">
              3. Save Map
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-semibold">
              4. Nav2 Autonomous Dispatch
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-semibold">
              5. Connect Physical AMR
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 bg-[#05070e] border-t border-slate-900/80 text-center text-[10px] font-mono text-slate-500">
        BumbleB AMR Autonomous Warehouse Fleet Platform • Gazebo Classic simulation • ROS 2 Humble • WebSocket :9090
      </footer>
    </div>
  );
}
