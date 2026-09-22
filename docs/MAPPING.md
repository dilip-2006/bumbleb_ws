# SLAM Mapping Guide

## Overview

Mapping uses **SLAM Toolbox** (`async_slam_toolbox_node`) configured in `bumbleb_bot/config/slam.yaml` to generate high-resolution occupancy grids from simulated or real LiDAR and odometry. The asynchronous mapper keeps scan processing responsive while the robot is moving.

---

## 1. Mapping Workflow

```text
Start Robot Stack
       ↓
Click [ MAPPING (SLAM) ] on Web Dashboard
       ↓
Pre-Flight Validation Check:
   - /scan active?
   - /odom active?
   - TF odom -> base_link active?
   - TF base_link -> lidar_link active?
       ↓
SLAM Toolbox Process Launched
       ↓
Drive Robot via Dashboard Teleoperation or WASD
       ↓
Review Generated Map on Interactive Viewer
       ↓
Enter Map Name in Dashboard (e.g., warehouse_main)
       ↓
Click [ SAVE MAP ]
       ↓
Map saved to maps/<name>.yaml and maps/<name>.pgm
       ↓
Click [ SERIALIZE GRAPH ]
       ↓
SLAM pose graph saved as maps/<name>.posegraph and maps/<name>.data
       ↓
Click [ STOP MAPPING ]
```

---

## 2. Pre-Flight Sensor Checks

Before SLAM starts, `amr_system_manager` automatically verifies all requirements:

1. `/scan` frequency > 5 Hz
2. `/odom` frequency > 10 Hz
3. TF `odom -> base_link` present
4. TF `base_link -> lidar_link` present

If any prerequisite fails, the state machine rejects the transition and displays an actionable diagnostic error on the web dashboard.

---

## 3. Saving Maps

Maps are stored in the isolated directory `/home/dk/bumbleb_ws/maps/`.

From the Web Dashboard:
- Enter a name in **Map Management** (e.g. `warehouse_zone_1`).
- Click **[ SAVE MAP ]**.
- Click **[ SERIALIZE GRAPH ]** to persist the SLAM Toolbox pose graph for later mapping continuation.

To resume a serialized map, select the map and click **[ RESUME MAPPING ]**. This starts asynchronous SLAM and requests pose-graph deserialization.
- The system executes `map_saver_cli` with proper timeouts, producing both `<name>.yaml` and `<name>.pgm`.

From the Command Line (for debugging):

```bash
ros2 run nav2_map_server map_saver_cli -f /home/dk/bumbleb_ws/maps/warehouse_main --ros-args -p save_map_timeout:=5000
```
