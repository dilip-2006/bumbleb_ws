# BumbleB AMR — Autonomous Warehouse Navigation & Web Control Dashboard

An industrial Autonomous Mobile Robot (AMR) system for warehouse logistics built on **ROS 2 Humble** with a modern **React Web Dashboard**.

---

## System Overview

```
                        +------------------------------------+
                        |       Operator Web Dashboard       |
                        |      (React 18 + Vite + roslib)    |
                        |        http://localhost:3000       |
                        +-----------------+------------------+
                                          |
                               WebSocket (ws://localhost:9090)
                                          |
                        +-----------------v------------------+
                        |          rosbridge_server          |
                        |       (/home/dk/rosbridge_ws)      |
                        +-----------------+------------------+
                                          |
                                    ROS 2 Humble
                                          |
     +------------------------------------+------------------------------------+
     |                                    |                                    |
+----v--------------------+      +--------v---------------+          +---------v----------+
|   amr_system_manager    |      |  amr_location_manager  |          |     bumbleb_bot    |
| (FSM, Health, Processes)|      | (Locations & Nav Goals)|          | (Kinematics, TF,   |
+----+--------------------+      +--------+---------------+          |  URDF, Simulation) |
     |                                    |                          +---------+----------+
     |                                    |                                    |
     +-----------------+------------------+                                    |
                       |                                                       |
        +--------------+--------------+                                        |
        |                             |                                        |
+-------v---------+           +-------v---------+                              |
|  SLAM Toolbox   |           |  Map Server &   |                              |
| (Mapping Mode)  |           | AMCL + Nav2     |                              |
+-----------------+           +-----------------+                              |
                                                                               |
               +---------------------------------------------------------------+
               |
        +------v------------------------------+
        |  Simulation (Gazebo Classic)        |
        |  or Physical Robot (ZLAC8015D)      |
        +-------------------------------------+
```

---

## Workspace Structure

The robot workspace contains strictly the robot and hardware driver packages, with rosbridge isolated in an underlay and the web dashboard in its own modular folder:

```text
/home/dk/bumbleb_ws/
├── src/
│   ├── bumbleb_bot/             # Primary robot package (URDF, launch, config, scripts)
│   │   ├── config/              # nav2.yaml, slam.yaml, localization.yaml, drivetrain.yaml
│   │   ├── description/         # URDF/Xacro models, sensors, wheels
│   │   ├── launch/              # bringup, simulation, slam, localization, navigation, rosbridge
│   │   ├── scripts/             # system_manager_node.py, location_manager_node.py
│   │   └── src/                 # drivetrain_node.cpp (kinematics, odometry, TF)
│   └── zlac_drive/              # ZLAC8015D Modbus motor driver (hardware layer)
│
├── web_dashboard/               # Modern React + Vite control dashboard (separate folder)
├── maps/                        # Controlled directory for saved warehouse maps (.yaml + .pgm)
├── locations/                   # Warehouse locations database (warehouse_locations.yaml)
└── docs/                        # Complete technical documentation suite
```

---

## Quick Start

### 1. Source and Build

```bash
# Source ROS 2 Humble and the rosbridge underlay
source /opt/ros/humble/setup.bash
source /home/dk/rosbridge_ws/install/setup.bash

# Build the workspace
cd /home/dk/bumbleb_ws
colcon build --symlink-install --cmake-args -DBUILD_TESTING=OFF
source install/setup.bash
```

### 2. Launch the Robot System

Start Gazebo simulation, drivetrain, rosbridge WebSocket server, system manager, and location manager with one unified command:

```bash
ros2 launch bumbleb_bot bringup.launch.py
```

### 3. Launch the Web Dashboard

In a second terminal:

```bash
cd /home/dk/bumbleb_ws/web_dashboard
npm run dev
```

Open your browser at `http://localhost:3000` to control the robot!

---

## Documentation Index

Detailed guides are available in the [`docs/`](docs/) directory:

- [Architecture Guide](docs/ARCHITECTURE.md) — System components, ROS 2 topics, services, actions, and TF tree.
- [Setup & Installation](docs/SETUP.md) — Dependencies, environment setup, and compilation.
- [Simulation Guide](docs/SIMULATION.md) — Gazebo simulation, virtual LiDAR, and physics.
- [Mapping Guide](docs/MAPPING.md) — SLAM Toolbox mapping, pre-flight checks, and map saving.
- [Localization Guide](docs/LOCALIZATION.md) — Map Server, AMCL, and pose initialization.
- [Navigation Guide](docs/NAVIGATION.md) — Nav2 stack, costmaps, planner, and click-to-nav.
- [Web Dashboard Guide](docs/WEB_DASHBOARD.md) — Web dashboard architecture, telemetry, and teleoperation.
- [Hardware Migration Guide](docs/HARDWARE_MIGRATION.md) — Transferring from Gazebo simulation to physical AMR.
