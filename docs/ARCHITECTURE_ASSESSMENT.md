# AMR Warehouse Navigation & Web Dashboard — Architecture Assessment

## 1. What Already Exists

### Workspace & Core Setup
- **ROS 2 Distribution**: ROS 2 Humble (`/opt/ros/humble`)
- **Workspace**: `/home/dk/bumbleb_ws`
- **Existing Packages**:
  - `bumbleb_bot`: Primary robot integration package
  - `zlac_drive`: Real hardware interface for ZLAC8015D dual-channel brushless motor driver
  - `rosbridge_suite`: Cloned and compiled (`rosbridge_server`, `rosbridge_library`, `rosapi`, `rosbridge_msgs`)
- **Robot Description (URDF / Xacro)**:
  - `bumbleb.urdf.xacro`: Top-level model importing base, wheels, lidar, and simulation/hardware control
  - `base.xacro`: Chassis geometry (Box: length 0.60 m, width 0.40 m, height 0.10 m)
  - `wheels.xacro`: Two drive wheels (radius 0.0655 m, separation 0.65 m / 0.45 m) and four caster wheels
  - `lidar.xacro`: RPLIDAR mount position (x=0.22 m, y=0.0 m, z=0.18 m) with `lidar_link`
- **Gazebo Simulation**:
  - `simulation.launch.py`: Launches Gazebo Classic with `obstacle.world`, spawns `bumbleb`, loads controllers
  - `simulation.xacro`: `gazebo_ros2_control` plugin and 2D ray sensor plugin publishing `sensor_msgs/LaserScan` on `/scan` at 10 Hz
- **Drivetrain & Control**:
  - `controllers.yaml`: `forward_command_controller` for per-wheel velocity commands and `joint_state_broadcaster`
  - `drivetrain_node.cpp`: Kinematics (`/cmd_vel` -> wheel rad/s), watchdog timer, odometry integration (`/joint_states` -> `/odom`), TF broadcast `odom` -> `base_link`
  - Single source of truth: `config/drivetrain.yaml`
- **Existing Navigation / SLAM / RViz files**:
  - `config/nav2.yaml`: Nav2 configuration with DWB local planner, NavfnPlanner, costmaps with matching 0.60x0.40 m footprint
  - `config/slam.yaml`: SLAM Toolbox configuration
  - `config/localization.yaml`: Map Server and AMCL parameters
  - `rviz/*.rviz`: RViz configurations for simulation, slam, navigation, robot
  - `launch/slam.launch.py`, `launch/localization.launch.py`, `launch/navigation.launch.py`

---

## 2. What Is Missing

1. **AMR System Manager (`amr_system_manager`)**:
   - Formal finite state machine (`OFF`, `BOOTING`, `READY`, `MAPPING`, `MAP_SAVING`, `LOCALIZATION`, `NAVIGATION`, `ERROR`, `EMERGENCY_STOP`).
   - ROS service interfaces for starting/stopping mapping, localization, navigation, saving/loading maps, and emergency stop.
   - Pre-flight validation verifying `/scan`, `/odom`, TF availability before transitioning states.
   - Comprehensive diagnostic & health status publisher (`/amr/system_health`).
2. **AMR Location Manager (`amr_location_manager`)**:
   - Warehouse location storage and coordinate management (`locations.yaml`).
   - ROS interfaces for saving current robot pose as named location, listing locations, deleting locations, and dispatching Nav2 goals to saved locations.
3. **Map Management Service**:
   - Subsystem to trigger map saving via SLAM Toolbox / `map_saver` without terminal execution.
   - Map directory indexer providing list of available maps.
4. **rosbridge Launch Integration**:
   - Dedicated launch file (`rosbridge.launch.py`) in the robot stack exposing WebSocket on port 9090.
5. **Unified Bringup Launch**:
   - `bringup.launch.py` providing streamlined launch arguments (`simulation:=true`, `use_sim_time:=true`, `mode:=ready`, etc.).
6. **Web Dashboard Application**:
   - Modern, professional React-based web dashboard in a separate directory (`web_dashboard/`).
   - Clean roslibjs WebSocket integration.
   - Canvas-based Occupancy Grid `/map` visualization with real-time robot pose, laser scan points, path, and saved location markers.
   - Click-to-navigate action client dispatching to Nav2.
   - Mode switching & emergency stop controls.
   - Safe teleoperation with velocity clipping and heartbeat timeout.
   - Warehouse location management UI.
7. **Complete Documentation**:
   - `README.md`, `ARCHITECTURE.md`, `SETUP.md`, `SIMULATION.md`, `MAPPING.md`, `LOCALIZATION.md`, `NAVIGATION.md`, `WEB_DASHBOARD.md`, `HARDWARE_MIGRATION.md`.

---

## 3. What Will Be Reused

- **Robot Model & Kinematics**:
  - `bumbleb.urdf.xacro`, `base.xacro`, `wheels.xacro`, `lidar.xacro`
  - `bumbleb_drivetrain_node` (`src/drivetrain_node.cpp`)
  - `config/drivetrain.yaml` and `config/controllers.yaml`
- **Gazebo World & Sensor Setup**:
  - `obstacle.world` and `simulation.xacro` ray sensor
  - Existing `/scan`, `/odom`, and TF broadcast `odom` -> `base_link`
- **Nav2 & SLAM Configurations**:
  - `config/nav2.yaml`, `config/slam.yaml`, `config/localization.yaml` (updated with `use_sim_time` runtime support)
  - `rviz/*.rviz` configurations
- **rosbridge_suite**:
  - Built packages `rosbridge_server`, `rosbridge_library`, `rosapi`

---

## 4. What New Packages and Files Are Required

### New ROS Packages
1. **`amr_system_manager`** (ROS 2 Python package in `src/amr_system_manager/`):
   - `system_manager_node.py`: State machine, pre-flight checks, ROS services for mode control, `/amr/system_state`, `/amr/system_health`, emergency stop watchdog.
   - `map_manager.py`: Map listing, validated map saving/loading via SLAM Toolbox and Map Server lifecycle.
2. **`amr_location_manager`** (ROS 2 Python package in `src/amr_location_manager/`):
   - `location_manager_node.py`: Warehouse location storage (`locations/warehouse_locations.yaml`), pose capture, Nav2 action dispatch.

### New / Updated Files in `bumbleb_bot`
- `launch/rosbridge.launch.py`: Starts `rosbridge_websocket` on port 9090.
- `launch/bringup.launch.py`: Unified bringup incorporating simulation, drivetrain, rosbridge, system manager, location manager.
- Updated `launch/localization.launch.py`, `launch/slam.launch.py`, `launch/navigation.launch.py` to ensure consistent `use_sim_time` propagation.

### Maps and Locations Directories
- `/home/dk/bumbleb_ws/maps/`: Controlled directory for saved occupancy maps (`.yaml`, `.pgm`).
- `/home/dk/bumbleb_ws/locations/`: YAML database for warehouse shelf and station coordinates.

### Web Dashboard
- `/home/dk/bumbleb_ws/web_dashboard/`: Standalone modern React application
  - `src/ros/`: ROS WebSocket client, topic subscribers, service callers, action clients.
  - `src/components/`: Header, RobotStatus, SensorStatus, ModeSelector, MapViewer (canvas occupancy grid + laser + pose + goal + locations), LocationManager, MapManager, Teleop, EmergencyStop.
  - Responsive, industrial warehouse UI design.
