import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Maximize2, Minimize2, Crosshair, Navigation, MapPin, ZoomIn, ZoomOut, RotateCcw, Compass, Eye, EyeOff, Layers } from 'lucide-react';

export default function MapViewer({ mapData, robotPose, laserScan, globalPath, locations, onSendGoal, onSaveLocationAtPose }) {
  const canvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const containerRef = useRef(null);

  // Viewport transform (camera in map meters)
  const [camera, setCamera] = useState({ x: 0.0, y: 0.0, scale: 45 }); // scale = pixels per meter
  const [toolMode, setToolMode] = useState('PAN'); // 'PAN' | 'NAV_GOAL' | 'MARK_LOC'
  const [dragStart, setDragStart] = useState(null);
  const [goalDragStart, setGoalDragStart] = useState(null);
  const [goalDragCurrent, setGoalDragCurrent] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [mouseMapPos, setMouseMapPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layers visibility
  const [showLaser, setShowLaser] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLocations, setShowLocations] = useState(true);

  // Robot trajectory trail (history)
  const [trail, setTrail] = useState([]);
  const lastTrailPoseRef = useRef({ x: null, y: null });

  // Update trail when robot moves
  useEffect(() => {
    if (!robotPose || robotPose.x == null || robotPose.y == null) return;
    const { x, y } = robotPose;
    const last = lastTrailPoseRef.current;
    if (last.x === null || Math.hypot(x - last.x, y - last.y) > 0.08) {
      lastTrailPoseRef.current = { x, y };
      setTrail(prev => [...prev.slice(-180), { x, y }]);
    }
  }, [robotPose]);

  // Update offscreen canvas when mapData changes
  useEffect(() => {
    if (!mapData || !mapData.info || !mapData.data) return;

    const { width, height } = mapData.info;
    if (width <= 0 || height <= 0) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const pixels = imgData.data;

    const raw = mapData.data;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const rosIdx = (height - 1 - row) * width + col;
        const pVal = raw[rosIdx];
        const pixelIdx = (row * width + col) * 4;

        if (pVal === -1) {
          // Unknown: dark navy/slate
          pixels[pixelIdx] = 13;
          pixels[pixelIdx + 1] = 18;
          pixels[pixelIdx + 2] = 28;
          pixels[pixelIdx + 3] = 255;
        } else if (pVal === 0) {
          // Free navigable space: soft dark slate
          pixels[pixelIdx] = 30;
          pixels[pixelIdx + 1] = 41;
          pixels[pixelIdx + 2] = 59;
          pixels[pixelIdx + 3] = 255;
        } else {
          // Occupied obstacle/wall: high-visibility crisp cyan/white
          pixels[pixelIdx] = 186;
          pixels[pixelIdx + 1] = 230;
          pixels[pixelIdx + 2] = 253;
          pixels[pixelIdx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    offscreenCanvasRef.current = offscreen;
  }, [mapData]);

  // Transform coordinates: Map (meters) -> Canvas (pixels)
  const mapToCanvas = useCallback((mx, my, w, h) => {
    const cx = w / 2 + (mx - camera.x) * camera.scale;
    const cy = h / 2 - (my - camera.y) * camera.scale; // Y-up in ROS, Y-down in Canvas
    return { x: cx, y: cy };
  }, [camera]);

  // Canvas (pixels) -> Map (meters)
  const canvasToMap = useCallback((cx, cy, w, h) => {
    const mx = camera.x + (cx - w / 2) / camera.scale;
    const my = camera.y - (cy - h / 2) / camera.scale;
    return { x: mx, y: my };
  }, [camera]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 800;
    const height = canvas.height = canvas.parentElement.clientHeight || 550;

    // Background
    ctx.fillStyle = '#080c16';
    ctx.fillRect(0, 0, width, height);

    // 1. Grid Lines & Meter Coordinates
    if (showGrid) {
      const minM = canvasToMap(0, height, width, height);
      const maxM = canvasToMap(width, 0, width, height);
      const startX = Math.floor(minM.x);
      const endX = Math.ceil(maxM.x);
      const startY = Math.floor(minM.y);
      const endY = Math.ceil(maxM.y);

      // Minor 1m grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#121a2c';
      for (let x = startX; x <= endX; x++) {
        if (x % 5 === 0) continue;
        const p = mapToCanvas(x, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, height);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y++) {
        if (y % 5 === 0) continue;
        const p = mapToCanvas(0, y, width, height);
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(width, p.y);
        ctx.stroke();
      }

      // Major 5m grid with numbers
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#1e2d4a';
      ctx.fillStyle = '#475569';
      ctx.font = '10px JetBrains Mono';
      for (let x = startX; x <= endX; x++) {
        if (x % 5 !== 0) continue;
        const p = mapToCanvas(x, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, height);
        ctx.stroke();
        ctx.fillText(`${x}m`, p.x + 4, height - 8);
      }
      for (let y = startY; y <= endY; y++) {
        if (y % 5 !== 0) continue;
        const p = mapToCanvas(0, y, width, height);
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(width, p.y);
        ctx.stroke();
        ctx.fillText(`${y}m`, 8, p.y - 4);
      }

      // World Origin (0,0) Axis Cross
      const origin = mapToCanvas(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b82f688';
      ctx.beginPath();
      ctx.moveTo(origin.x - 16, origin.y);
      ctx.lineTo(origin.x + 16, origin.y);
      ctx.moveTo(origin.x, origin.y - 16);
      ctx.lineTo(origin.x, origin.y + 16);
      ctx.stroke();
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.fillText('(0,0)', origin.x + 5, origin.y - 5);
    }

    // 2. Draw Occupancy Grid Map
    if (offscreenCanvasRef.current && mapData && mapData.info) {
      const { resolution, origin: mapOrigin, width: mw, height: mh } = mapData.info;
      const ox = mapOrigin.position.x;
      const oy = mapOrigin.position.y;

      const pTopLeft = mapToCanvas(ox, oy + mh * resolution, width, height);
      const pBottomRight = mapToCanvas(ox + mw * resolution, oy, width, height);

      const renderW = pBottomRight.x - pTopLeft.x;
      const renderH = pBottomRight.y - pTopLeft.y;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreenCanvasRef.current, pTopLeft.x, pTopLeft.y, renderW, renderH);

      // Map boundary frame
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(pTopLeft.x, pTopLeft.y, renderW, renderH);
    }

    // 3. Draw Robot Trajectory Trail
    if (showTrail && trail.length > 1) {
      ctx.strokeStyle = '#06b6d488';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      trail.forEach((pos, idx) => {
        const cp = mapToCanvas(pos.x, pos.y, width, height);
        if (idx === 0) ctx.moveTo(cp.x, cp.y);
        else ctx.lineTo(cp.x, cp.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw LaserScan Points & Field of View
    if (showLaser && laserScan && laserScan.ranges && robotPose) {
      const rx = robotPose.x || 0;
      const ry = robotPose.y || 0;
      const ryaw = robotPose.yaw || 0;
      const minAngle = laserScan.angle_min || -Math.PI;
      const angleInc = laserScan.angle_increment || (Math.PI / 180);
      const ranges = laserScan.ranges;

      ctx.fillStyle = '#ef4444ee';
      for (let i = 0; i < ranges.length; i += 2) {
        const r = ranges[i];
        if (r >= (laserScan.range_min || 0.1) && r <= (laserScan.range_max || 12.0)) {
          const angle = ryaw + minAngle + i * angleInc;
          const lx = rx + r * Math.cos(angle);
          const ly = ry + r * Math.sin(angle);
          const cp = mapToCanvas(lx, ly, width, height);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Draw Global Nav2 Path
    if (globalPath && globalPath.poses && globalPath.poses.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      globalPath.poses.forEach((poseStamped, idx) => {
        const p = mapToCanvas(poseStamped.pose.position.x, poseStamped.pose.position.y, width, height);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Saved Warehouse Locations (POIs)
    if (showLocations && locations && locations.length > 0) {
      locations.forEach((loc) => {
        const p = mapToCanvas(loc.x, loc.y, width, height);
        const color = loc.type === 'charging' ? '#f59e0b' : loc.type === 'loading' ? '#a855f7' : '#38bdf8';

        // Outer glow
        ctx.fillStyle = `${color}33`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();

        // Pin center
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Direction orientation tick if yaw is present
        if (loc.yaw != null) {
          const tickLen = 14;
          const tx = p.x + tickLen * Math.cos(-loc.yaw);
          const ty = p.y + tickLen * Math.sin(-loc.yaw);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }

        // Label Tag
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        const text = loc.name;
        ctx.font = 'bold 10px JetBrains Mono';
        const tw = ctx.measureText(text).width;
        ctx.beginPath();
        ctx.roundRect(p.x + 10, p.y - 10, tw + 10, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, p.x + 15, p.y + 3);
      });
    }

    // 7. Active Goal Target Marker
    if (activeGoal) {
      const gp = mapToCanvas(activeGoal.x, activeGoal.y, width, height);
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gp.x - 18, gp.y);
      ctx.lineTo(gp.x + 18, gp.y);
      ctx.moveTo(gp.x, gp.y - 18);
      ctx.lineTo(gp.x, gp.y + 18);
      ctx.stroke();

      if (activeGoal.yaw != null) {
        const arrowLen = 26;
        const ax = gp.x + arrowLen * Math.cos(-activeGoal.yaw);
        const ay = gp.y + arrowLen * Math.sin(-activeGoal.yaw);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gp.x, gp.y);
        ctx.lineTo(ax, ay);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 8. Interactive Dragging for Nav Goal Orientation
    if (goalDragStart && goalDragCurrent) {
      const startP = mapToCanvas(goalDragStart.x, goalDragStart.y, width, height);
      const currP = mapToCanvas(goalDragCurrent.x, goalDragCurrent.y, width, height);

      // Target circle
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startP.x, startP.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Heading arrow from start to current drag
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startP.x, startP.y);
      ctx.lineTo(currP.x, currP.y);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(currP.y - startP.y, currP.x - startP.x);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(currP.x, currP.y);
      ctx.lineTo(currP.x - 10 * Math.cos(angle - Math.PI / 6), currP.y - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(currP.x - 10 * Math.cos(angle + Math.PI / 6), currP.y - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    // 9. Draw BumbleB Robot Footprint & Heading
    if (robotPose) {
      const rx = robotPose.x || 0;
      const ry = robotPose.y || 0;
      const ryaw = robotPose.yaw || 0;
      const rp = mapToCanvas(rx, ry, width, height);

      ctx.save();
      ctx.translate(rp.x, rp.y);
      ctx.rotate(-ryaw); // Canvas inverted Y

      // Robot dimensions: 0.60m length, 0.40m width
      const lengthPx = 0.60 * camera.scale;
      const widthPx = 0.40 * camera.scale;

      // Chassis shadow & glow
      ctx.shadowColor = '#2563eb';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(30, 58, 138, 0.6)';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-lengthPx / 2, -widthPx / 2, lengthPx, widthPx, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Left and Right Drive Wheels
      const wheelL = 0.18 * camera.scale;
      const wheelW = 0.05 * camera.scale;
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      // Left wheel
      ctx.fillRect(-wheelL / 2, -widthPx / 2 - wheelW / 2, wheelL, wheelW);
      ctx.strokeRect(-wheelL / 2, -widthPx / 2 - wheelW / 2, wheelL, wheelW);
      // Right wheel
      ctx.fillRect(-wheelL / 2, widthPx / 2 - wheelW / 2, wheelL, wheelW);
      ctx.strokeRect(-wheelL / 2, widthPx / 2 - wheelW / 2, wheelL, wheelW);

      // Prominent Direction Arrow (Amber)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(lengthPx / 2 + 8, 0);
      ctx.lineTo(lengthPx / 4, -widthPx / 3.5);
      ctx.lineTo(lengthPx / 4, widthPx / 3.5);
      ctx.closePath();
      ctx.fill();

      // Center LiDAR Scanner Mount
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 0.06 * camera.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }, [
    mapData, robotPose, laserScan, globalPath, locations, activeGoal,
    camera, mapToCanvas, canvasToMap, showGrid, showLaser, showTrail,
    showLocations, trail, goalDragStart, goalDragCurrent
  ]);

  // Mouse Handlers
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const mPos = canvasToMap(clickX, clickY, rect.width, rect.height);

      if (toolMode === 'NAV_GOAL') {
        // Start dragging to set goal position and heading
        setGoalDragStart({ x: mPos.x, y: mPos.y });
        setGoalDragCurrent({ x: mPos.x, y: mPos.y });
      } else if (toolMode === 'MARK_LOC') {
        onSaveLocationAtPose?.(mPos.x, mPos.y, 0.0);
        setToolMode('PAN');
      } else {
        setDragStart({ x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y });
      }
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const mPos = canvasToMap(clickX, clickY, rect.width, rect.height);
    setMouseMapPos(mPos);

    if (goalDragStart) {
      setGoalDragCurrent({ x: mPos.x, y: mPos.y });
    } else if (dragStart) {
      const dx = (e.clientX - dragStart.x) / camera.scale;
      const dy = (e.clientY - dragStart.y) / camera.scale;
      setCamera(prev => ({
        ...prev,
        x: dragStart.camX - dx,
        y: dragStart.camY + dy
      }));
    }
  };

  const handleMouseUp = (e) => {
    if (goalDragStart) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const mPos = canvasToMap(clickX, clickY, rect.width, rect.height);

      // Compute yaw from drag vector: start -> current
      const dx = mPos.x - goalDragStart.x;
      const dy = mPos.y - goalDragStart.y;
      const yaw = Math.hypot(dx, dy) > 0.15 ? Math.atan2(dy, dx) : 0.0;

      setActiveGoal({ x: goalDragStart.x, y: goalDragStart.y, yaw });
      onSendGoal?.(goalDragStart.x, goalDragStart.y, yaw);

      setGoalDragStart(null);
      setGoalDragCurrent(null);
      setToolMode('PAN');
    }
    setDragStart(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setCamera(prev => ({
      ...prev,
      scale: Math.max(8, Math.min(300, prev.scale * zoomFactor))
    }));
  };

  const fitMap = () => {
    if (mapData?.info) {
      const { width, height, resolution, origin } = mapData.info;
      const centerX = origin.position.x + (width * resolution) / 2;
      const centerY = origin.position.y + (height * resolution) / 2;
      setCamera({ x: centerX, y: centerY, scale: 35 });
    } else {
      setCamera({ x: 0, y: 0, scale: 45 });
    }
  };

  const centerOnRobot = () => {
    if (robotPose) {
      setCamera(prev => ({
        ...prev,
        x: robotPose.x || 0,
        y: robotPose.y || 0
      }));
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`panel flex flex-col flex-1 relative overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen' : 'h-full min-h-[460px]'
      }`}
    >
      {/* Map Header Toolbar */}
      <div className="panel-header py-2 px-3.5 bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-sky-950/60 border border-sky-500/30 text-sky-400">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
          </div>
          <span className="text-xs font-extrabold tracking-wide text-slate-200">
            2D OCCUPANCY GRID & REAL-TIME LIDAR
          </span>
        </div>

        {/* Real-time map telemetry HUD */}
        <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-500">CURSOR:</span>
            <span className="text-sky-300">({mouseMapPos.x.toFixed(2)}m, {mouseMapPos.y.toFixed(2)}m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">ZOOM:</span>
            <span className="text-amber-300">{camera.scale.toFixed(0)} px/m</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative w-full h-full bg-[#070b14] overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Primary Interactive Action Toolbar */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-2xl z-10">
          <button
            onClick={() => setToolMode('PAN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              toolMode === 'PAN'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Pan Viewport (Click and Drag map)"
          >
            Pan
          </button>

          <button
            onClick={() => setToolMode('NAV_GOAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              toolMode === 'NAV_GOAL'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40 ring-2 ring-amber-400/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Click & Drag on map to set Nav2 Goal + Orientation heading"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-300" />
            <span>Set Nav Goal</span>
          </button>

          <button
            onClick={() => setToolMode('MARK_LOC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              toolMode === 'MARK_LOC'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Click map to create a new named warehouse location pin"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mark Location</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Quick Zoom & Center buttons */}
          <button
            onClick={() => setCamera(prev => ({ ...prev, scale: Math.min(300, prev.scale * 1.25) }))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCamera(prev => ({ ...prev, scale: Math.max(8, prev.scale * 0.8) }))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitMap}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fit Map to View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={centerOnRobot}
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
            title="Center View on Robot"
          >
            <Navigation className="w-4 h-4 text-sky-400" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Toggle Fullscreen Map"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>

        {/* Layer Controls Bar (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-xl text-xs font-mono z-10">
          <button
            onClick={() => setShowLaser(!showLaser)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-all ${
              showLaser ? 'bg-red-950/60 text-red-300 border border-red-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle LiDAR Laser Scan Points"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
            LiDAR
          </button>
          <button
            onClick={() => setShowTrail(!showTrail)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-all ${
              showTrail ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Odometry Trail"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span>
            Trail
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-all ${
              showGrid ? 'bg-slate-800 text-slate-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Meter Grid"
          >
            Grid
          </button>
        </div>

        {/* Legend Overlay (Bottom Right) */}
        <div className="absolute bottom-3 right-3 px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md text-[11px] font-mono flex items-center gap-4 shadow-xl z-10">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500 ring-1 ring-blue-400"></span>
            <span className="text-slate-300 font-semibold">BumbleB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-slate-300 font-semibold">LiDAR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-4 bg-emerald-500 rounded-sm"></span>
            <span className="text-slate-300 font-semibold">Nav2 Plan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-400 bg-amber-500/30"></span>
            <span className="text-slate-300 font-semibold">Target</span>
          </div>
        </div>

        {/* Nav Goal Instruction Notice when active */}
        {toolMode === 'NAV_GOAL' && (
          <div className="absolute bottom-3 left-3 px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-500/50 backdrop-blur-md text-xs font-mono text-amber-200 shadow-xl flex items-center gap-2 z-10 animate-bounce">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <span>Click and drag on the map to set goal coordinates and heading angle!</span>
          </div>
        )}
      </div>
    </div>
  );
}
