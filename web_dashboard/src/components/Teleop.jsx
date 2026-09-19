import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Sliders, Keyboard, Disc, Gauge, Zap } from 'lucide-react';

export default function Teleop({ connected, isEmergencyStop, onSendVelocity }) {
  const [maxLin, setMaxLin] = useState(0.25); // Safe warehouse cruise speed
  const [maxAng, setMaxAng] = useState(0.60);
  const [activeKeys, setActiveKeys] = useState({});
  const intervalRef = useRef(null);

  // Virtual Joystick state
  const joystickContainerRef = useRef(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 }); // -1.0 to 1.0
  const joystickPosRef = useRef({ x: 0, y: 0 });

  const stopRobot = useCallback(() => {
    setJoystickPos({ x: 0, y: 0 });
    joystickPosRef.current = { x: 0, y: 0 };
    onSendVelocity?.(0.0, 0.0);
  }, [onSendVelocity]);

  // Keyboard navigation listener (W/A/S/D and Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
        setActiveKeys(prev => ({ ...prev, [key]: true }));
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      setActiveKeys(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (key === ' ') {
        stopRobot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [stopRobot]);

  // Drive loop at 10 Hz
  useEffect(() => {
    if (!connected || isEmergencyStop) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      let vx = 0.0;
      let wz = 0.0;

      // 1. Keyboard priority
      if (activeKeys['w'] || activeKeys['arrowup']) vx += maxLin;
      if (activeKeys['s'] || activeKeys['arrowdown']) vx -= maxLin;
      if (activeKeys['a'] || activeKeys['arrowleft']) wz += maxAng;
      if (activeKeys['d'] || activeKeys['arrowright']) wz -= maxAng;

      // 2. Virtual Joystick
      if (vx === 0.0 && wz === 0.0 && (joystickPosRef.current.x !== 0 || joystickPosRef.current.y !== 0)) {
        vx = -joystickPosRef.current.y * maxLin; // Up is negative Y
        wz = -joystickPosRef.current.x * maxAng; // Left is positive yaw
      }

      if (vx !== 0.0 || wz !== 0.0) {
        onSendVelocity?.(vx, wz);
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeKeys, connected, isEmergencyStop, maxLin, maxAng, onSendVelocity]);

  // Virtual Joystick pointer events
  const handleJoystickStart = (e) => {
    if (isEmergencyStop || !connected) return;
    setJoystickActive(true);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e) => {
    if (!joystickContainerRef.current) return;
    const rect = joystickContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = rect.width / 2 - 16;
    const distance = Math.hypot(dx, dy);

    let normX = dx / maxRadius;
    let normY = dy / maxRadius;

    if (distance > maxRadius) {
      normX = (dx / distance);
      normY = (dy / distance);
    }

    const pos = { x: Math.max(-1, Math.min(1, normX)), y: Math.max(-1, Math.min(1, normY)) };
    setJoystickPos(pos);
    joystickPosRef.current = pos;
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    stopRobot();
  };

  const setSpeedPreset = (lin, ang) => {
    setMaxLin(lin);
    setMaxAng(ang);
  };

  return (
    <div className="panel flex flex-col h-full justify-between">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-emerald-400" />
          MANUAL TELEOPERATION
        </span>
        <span className="text-[10px] font-mono text-slate-400">DIFF-DRIVE TELEOP</span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Virtual Joystick & Controls Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Virtual Analog Joystick */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Analog Touch Joystick
            </div>
            <div
              ref={joystickContainerRef}
              onMouseDown={handleJoystickStart}
              onMouseMove={joystickActive ? handleJoystickMove : undefined}
              onMouseUp={handleJoystickEnd}
              onMouseLeave={joystickActive ? handleJoystickEnd : undefined}
              onTouchStart={handleJoystickStart}
              onTouchMove={joystickActive ? handleJoystickMove : undefined}
              onTouchEnd={handleJoystickEnd}
              className={`relative h-36 w-36 rounded-full bg-slate-950 border-2 transition-colors flex items-center justify-center cursor-pointer select-none shadow-inner ${
                joystickActive ? 'border-sky-500 shadow-sky-500/20 shadow-lg' : 'border-slate-800'
              } ${(!connected || isEmergencyStop) ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {/* Center Crosshairs */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-800 pointer-events-none" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-800 pointer-events-none" />
              <div className="absolute h-16 w-16 rounded-full border border-slate-800/80 pointer-events-none" />

              {/* Draggable Knob */}
              <div
                className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-transform duration-75 shadow-xl ${
                  joystickActive
                    ? 'bg-gradient-to-br from-sky-500 to-blue-600 border-white ring-4 ring-sky-500/30'
                    : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-500'
                }`}
                style={{
                  transform: `translate(${joystickPos.x * 48}px, ${joystickPos.y * 48}px)`
                }}
              >
                <Disc className="w-5 h-5 text-white opacity-80" />
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Vx: {(-joystickPos.y * maxLin).toFixed(2)} m/s • Wz: {(-joystickPos.x * maxAng).toFixed(2)} rad/s
            </div>
          </div>

          {/* D-Pad Buttons & Keyboard Controls */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-slate-400" />
              WASD / Arrow Keys
            </div>

            <div className="flex flex-col items-center gap-1.5">
              {/* Up */}
              <button
                onMouseDown={() => { onSendVelocity?.(maxLin, 0.0); }}
                onMouseUp={stopRobot}
                onMouseLeave={stopRobot}
                disabled={!connected || isEmergencyStop}
                className={`h-10 w-12 rounded-lg flex items-center justify-center border font-mono font-bold transition-all active:scale-95 ${
                  activeKeys['w'] || activeKeys['arrowup']
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Forward (W / Up Arrow)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>

              {/* Left, Brake, Right */}
              <div className="flex items-center gap-1.5">
                <button
                  onMouseDown={() => { onSendVelocity?.(0.0, maxAng); }}
                  onMouseUp={stopRobot}
                  onMouseLeave={stopRobot}
                  disabled={!connected || isEmergencyStop}
                  className={`h-10 w-12 rounded-lg flex items-center justify-center border font-mono font-bold transition-all active:scale-95 ${
                    activeKeys['a'] || activeKeys['arrowleft']
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                  title="Turn Left (A / Left Arrow)"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={stopRobot}
                  className="h-10 w-14 rounded-lg flex items-center justify-center bg-red-600 hover:bg-red-500 text-white border border-red-400 font-mono font-bold transition-all shadow-md shadow-red-600/30 active:scale-95 text-[11px]"
                  title="Brake / Stop (Spacebar)"
                >
                  <Square className="w-3.5 h-3.5 fill-white mr-1" />
                  STOP
                </button>

                <button
                  onMouseDown={() => { onSendVelocity?.(0.0, -maxAng); }}
                  onMouseUp={stopRobot}
                  onMouseLeave={stopRobot}
                  disabled={!connected || isEmergencyStop}
                  className={`h-10 w-12 rounded-lg flex items-center justify-center border font-mono font-bold transition-all active:scale-95 ${
                    activeKeys['d'] || activeKeys['arrowright']
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                  title="Turn Right (D / Right Arrow)"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Down */}
              <button
                onMouseDown={() => { onSendVelocity?.(-maxLin, 0.0); }}
                onMouseUp={stopRobot}
                onMouseLeave={stopRobot}
                disabled={!connected || isEmergencyStop}
                className={`h-10 w-12 rounded-lg flex items-center justify-center border font-mono font-bold transition-all active:scale-95 ${
                  activeKeys['s'] || activeKeys['arrowdown']
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Reverse (S / Down Arrow)"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Speed Limit Presets & Sliders */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5 font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              SPEED PRESETS:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSpeedPreset(0.12, 0.35)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  maxLin === 0.12 ? 'bg-amber-500/20 border border-amber-500 text-amber-300' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Slow (0.12 m/s)
              </button>
              <button
                onClick={() => setSpeedPreset(0.25, 0.60)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  maxLin === 0.25 ? 'bg-blue-500/20 border border-blue-500 text-blue-300' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Normal (0.25 m/s)
              </button>
              <button
                onClick={() => setSpeedPreset(0.45, 0.90)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  maxLin === 0.45 ? 'bg-red-500/20 border border-red-500 text-red-300' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Fast (0.45 m/s)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Linear:</span>
                <span className="text-slate-200 font-bold">{maxLin.toFixed(2)} m/s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.05"
                value={maxLin}
                onChange={(e) => setMaxLin(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Angular:</span>
                <span className="text-slate-200 font-bold">{maxAng.toFixed(2)} rad/s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={maxAng}
                onChange={(e) => setMaxAng(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
