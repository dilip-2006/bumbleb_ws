# Web Dashboard User & Developer Guide

## Overview

The BumbleB Web Dashboard is a modern, responsive Single Page Application built with **React 18**, **Vite**, and **roslibjs**. It runs entirely in the operator's browser and communicates with ROS 2 via WebSocket on port 9090.

---

## 1. Directory Structure

```text
web_dashboard/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── Header.jsx           # Status badge, ROS connection, E-STOP
    │   ├── RobotStatus.jsx      # Telemetry: X, Y, Yaw, Velocity, Battery
    │   ├── SensorStatus.jsx     # Diagnostics: LiDAR, Odometry, TF, Nodes
    │   ├── ModeSelector.jsx     # FSM mode controller & quick actions
    │   ├── MapViewer.jsx        # HTML5 Canvas occupancy grid renderer
    │   ├── LocationManager.jsx  # Warehouse locations manager
    │   ├── MapManager.jsx       # Map saving and loading UI
    │   └── Teleop.jsx           # Safe manual keyboard/touch teleop
    ├── hooks/
    │   └── useRos.js            # Reactive hook for ROS subscriptions
    └── ros/
        └── rosConnection.js     # WebSocket connection & roslibjs wrapper
```

---

## 2. Key Capabilities

### Real-Time Map Visualization
- Renders occupancy grid bitmap from `/map` with zoom, pan, and centering controls.
- Overlays laser scan points `/scan` in real time.
- Renders robot footprint ($0.60\,\text{m}\times0.40\,\text{m}$) and heading vector.
- Displays Nav2 planned paths and warehouse pins.

### Interactive Goal Navigation
- Click anywhere on the map to send goal to `/navigate_to_pose`.
- Displays real-time remaining distance and navigation state.

### Warehouse Location Management
- Click **[ SAVE CURRENT POSE ]** to store current coordinates with name & type.
- Click **[ GO ]** on any saved location to navigate autonomously.

### Safe Teleoperation
- Keyboard drive via **WASD** or **Arrow Keys** (Spacebar to stop).
- Linear speed slider (0.05 to 0.50 m/s) and angular speed slider (0.1 to 1.0 rad/s).
- Heartbeat watchdog: automatically publishes zero velocity on key release or disconnect.

### Emergency Stop
- Prominent E-STOP button in header and side panel.
- Immediately stops navigation, clamps velocities to zero, and latches `EMERGENCY_STOP`.
- Requires explicit operator reset before resuming operations.

---

## 3. Running the Dashboard

```bash
cd /home/dk/bumbleb_ws/web_dashboard
npm run dev
```

Open `http://localhost:3000` in Google Chrome or any modern browser.
