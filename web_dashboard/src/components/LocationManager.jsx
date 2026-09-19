import React, { useState } from 'react';
import { MapPin, Navigation, Trash2, Plus, BatteryCharging, Box, Truck, Compass, Check } from 'lucide-react';

export default function LocationManager({ locations, robotPose, activeMap, onSaveLocation, onDeleteLocation, onNavigateToLocation }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState('shelf');
  const [customX, setCustomX] = useState('');
  const [customY, setCustomY] = useState('');
  const [useCurrentPose, setUseCurrentPose] = useState(true);

  const handleOpenModal = (presetX = null, presetY = null) => {
    if (presetX !== null && presetY !== null) {
      setCustomX(presetX.toFixed(2));
      setCustomY(presetY.toFixed(2));
      setUseCurrentPose(false);
    } else {
      setCustomX(Number(robotPose?.x || 0).toFixed(2));
      setCustomY(Number(robotPose?.y || 0).toFixed(2));
      setUseCurrentPose(true);
    }
    setLocName(`Shelf ${locations.length + 1}`);
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!locName.trim()) return;

    onSaveLocation({
      action: 'save_location',
      name: locName.trim(),
      type: locType,
      use_current_pose: useCurrentPose,
      x: parseFloat(customX) || 0.0,
      y: parseFloat(customY) || 0.0,
      yaw: robotPose?.yaw || 0.0,
      map: activeMap || 'warehouse_main'
    });
    setModalOpen(false);
    setLocName('');
  };

  const getDistanceToRobot = (locX, locY) => {
    if (!robotPose || robotPose.x == null) return null;
    const d = Math.hypot(locX - robotPose.x, locY - robotPose.y);
    return d.toFixed(2);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'charging':
        return <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />;
      case 'loading':
        return <Truck className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Box className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  return (
    <div className="panel flex flex-col h-full justify-between">
      <div className="panel-header py-2 px-3">
        <span className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          WAREHOUSE LOCATIONS ({locations.length})
        </span>
        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary text-[11px] px-2.5 py-1 flex items-center gap-1 shadow-sm"
        >
          <Plus className="w-3 h-3" />
          SAVE CURRENT POSE
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-2 max-h-[380px]">
        {locations.length === 0 ? (
          <div className="text-center py-10 text-xs font-mono text-slate-500">
            No warehouse locations stored.<br />Click "Save Current Pose" or "Mark Pin" on the map.
          </div>
        ) : (
          locations.map((loc) => {
            const dist = getDistanceToRobot(loc.x, loc.y);
            return (
              <div
                key={loc.id || loc.name}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                    {getTypeIcon(loc.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                      {loc.name}
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {loc.type}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>({Number(loc.x).toFixed(2)}m, {Number(loc.y).toFixed(2)}m)</span>
                      {dist && (
                        <span className="text-sky-400 font-semibold">• {dist}m away</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onNavigateToLocation(loc.name)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all text-xs font-mono font-bold flex items-center gap-1 shadow-md shadow-blue-600/20 active:scale-95"
                    title={`Send Nav2 dispatch to ${loc.name}`}
                  >
                    <Navigation className="w-3 h-3" />
                    DISPATCH
                  </button>
                  <button
                    onClick={() => onDeleteLocation(loc.name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Delete location"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                Save Warehouse Location
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">LOCATION NAME</label>
                <input
                  type="text"
                  required
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  placeholder="e.g. Shelf 4, Dock B, Charging Station"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">LOCATION TYPE</label>
                <select
                  value={locType}
                  onChange={(e) => setLocType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="shelf">Shelf / Storage Rack</option>
                  <option value="charging">Charging Station</option>
                  <option value="loading">Loading / Unloading Dock</option>
                  <option value="staging">Staging Area</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">X (METERS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customX}
                    onChange={(e) => { setCustomX(e.target.value); setUseCurrentPose(false); }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Y (METERS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customY}
                    onChange={(e) => { setCustomY(e.target.value); setUseCurrentPose(false); }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary text-xs px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs px-4"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
