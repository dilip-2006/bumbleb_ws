# BumbleB AMR System Architecture

## Overview

The BumbleB Autonomous Mobile Robot software stack is organized into distinct, loosely coupled layers connected via standard ROS 2 Humble interfaces and WebSockets:

1. **Physical / Simulation Layer**: Gazebo Classic or physical ZLAC8015D brushless hub motors with RPLIDAR A1.
2. **Drivetrain & Control Layer**: `bumbleb_drivetrain_node` computing kinematics, watchdog timing, wheel velocity commands, and velocity-integrated dead-reckoning odometry.
3. **State & Subsystem Supervision Layer**: `amr_system_manager` executing a finite state machine, pre-flight safety checks, and node process supervision.
4. **Localization & Mapping Layer**: SLAM Toolbox (mapping) or Map Server + AMCL (localization).
5. **Autonomous Navigation Layer**: Nav2 stack (DWB controller, NavfnPlanner, costmaps, behavior tree).
6. **Location Management Layer**: `amr_location_manager` persisting warehouse waypoints and dispatching Nav2 goals.
7. **Gateway Layer**: `rosbridge_server` providing JSON WebSocket access on port 9090.
8. **Operator Interface Layer**: Standalone React + Vite web dashboard.

---

## Finite State Machine (FSM)

```
       +-------------------------+
       |           OFF           |
       +------------+------------+
                    | start_robot
       +------------v------------+
       |         BOOTING         |
       +------------+------------+
                    | pre-flight OK
       +------------v------------+
       |          READY          |<------------------------------+
       +----+---------------+----+                               |
            |               |                                    |
  start_    |               | start_                             |
  mapping   |               | localization                       |
       +----v-------+  +----v-----------+                        |
       |  MAPPING   |  |  LOCALIZATION  |<---------------+       |
       +----+-------+  +----+-----------+                |       |
            |               | start_                     |       |
  save_map  |               | navigation                 |       |
       +----v-------+  +----v-----------+  stop_nav      |       |
       | MAP_SAVING |  |   NAVIGATION   +----------------+       |
       +----+-------+  +----+-----------+                        |
            |               |                                    |
            +---------------+------------------------------------+
                            |
             EMERGENCY STOP | (from ANY state)
                     +------v-------+
                     |EMERGENCY_STOP|
                     +------+-------+
                            | reset_emergency_stop
                            v
                          READY
```

---

## TF Tree

```text
map ──[SLAM Toolbox / AMCL]──> odom ──[bumbleb_drivetrain_node]──> base_link ──[robot_state_publisher]──> lidar_link
                                                                          ├──> chassis
                                                                          ├──> left_wheel
                                                                          ├──> right_wheel
                                                                          └──> casters
```

- `map -> odom`: Broadcast by SLAM Toolbox while in `MAPPING` mode, or by AMCL while in `LOCALIZATION`/`NAVIGATION` mode. Never both simultaneously.
- `odom -> base_link`: Broadcast continuously at 50 Hz by `bumbleb_drivetrain_node`.
- `base_link -> lidar_link`: Broadcast statically by `robot_state_publisher` from the URDF model ($x=0.22\,\text{m}$, $y=0.0\,\text{m}$, $z=0.18\,\text{m}$).

---

## ROS 2 Topics

| Topic | Type | Description |
|---|---|---|
| `/scan` | `sensor_msgs/LaserScan` | 2D LiDAR planar scan returns (10 Hz) |
| `/odom` | `nav_msgs/Odometry` | Wheel dead-reckoning odometry (50 Hz) |
| `/cmd_vel` | `geometry_msgs/Twist` | Velocity command input (watchdog timeout 0.5s) |
| `/joint_states` | `sensor_msgs/JointState` | Wheel joint velocities and positions |
| `/map` | `nav_msgs/OccupancyGrid` | Generated or loaded 2D grid map |
| `/plan` | `nav_msgs/Path` | Nav2 global planned trajectory |
| `/amcl_pose` | `geometry_msgs/PoseWithCovarianceStamped` | AMCL estimated robot pose in map frame |
| `/amr/system_state` | `std_msgs/String` (JSON) | Current FSM state, active map, active processes |
| `/amr/system_health` | `std_msgs/String` (JSON) | Health diagnostics for sensors, TF, and nodes |
| `/amr/robot_pose` | `geometry_msgs/PoseStamped` | Current robot pose in map frame |
| `/amr/navigation_status` | `std_msgs/String` (JSON) | Nav2 status, target name, distance remaining |
| `/amr/locations` | `std_msgs/String` (JSON) | Array of saved warehouse shelf / station coordinates |
| `/amr/maps` | `std_msgs/String` (JSON) | Array of available maps in controlled storage |
| `/amr/battery_state` | `sensor_msgs/BatteryState` | Voltage, percentage, charging state |
| `/amr/command` | `std_msgs/String` (JSON) | Direct WebSocket control commands |
| `/amr/location_command` | `std_msgs/String` (JSON) | Location creation, deletion, navigation commands |

---

## ROS 2 Services

| Service | Type | Description |
|---|---|---|
| `/amr/start_robot` | `std_srvs/Trigger` | Transitions robot from OFF to READY |
| `/amr/stop_robot` | `std_srvs/Trigger` | Stops all motion and returns to OFF |
| `/amr/start_mapping` | `std_srvs/Trigger` | Verifies pre-flight checks and starts SLAM |
| `/amr/stop_mapping` | `std_srvs/Trigger` | Stops SLAM and returns to READY |
| `/amr/start_localization` | `std_srvs/Trigger` | Launches Map Server and AMCL on active map |
| `/amr/stop_localization` | `std_srvs/Trigger` | Stops localization subsystems |
| `/amr/start_navigation` | `std_srvs/Trigger` | Launches Nav2 planning and control stack |
| `/amr/set_mode` | `bumbleb_bot/srv/SetMode` | Reliably switches READY/MAPPING/LOCALIZATION/NAVIGATION modes |
| `/amr/map_operation` | `bumbleb_bot/srv/MapOperation` | Saves maps and serializes/deserializes SLAM pose graphs |
| `/amr/navigate_to_pose` | `bumbleb_bot/srv/NavigateToPose` | Sends a dashboard coordinate goal to Nav2 |
| `/amr/set_initial_pose` | `bumbleb_bot/srv/SetInitialPose` | Publishes the AMCL initial pose |
| `/amr/stop_navigation` | `std_srvs/Trigger` | Stops Nav2 navigation |
| `/amr/emergency_stop` | `std_srvs/Trigger` | Clamps velocity to 0 and latches EMERGENCY_STOP |
| `/amr/reset_emergency_stop` | `std_srvs/Trigger` | Resets emergency latch to READY |
| `/amr/system_reset` | `std_srvs/Trigger` | Full reset of state machine and subsystems |
| `/amr/cancel_navigation` | `std_srvs/Trigger` | Cancels current Nav2 navigation goal |

---

## ROS 2 Actions

| Action | Type | Description |
|---|---|---|
| `/navigate_to_pose` | `nav2_msgs/action/NavigateToPose` | Autonomous navigation to target PoseStamped |
