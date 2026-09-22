# BumbleB Physical-Robot Operation

This is the normal operating procedure for the real robot. Do not use Gazebo values or simulation time on the physical machine.

## 1. Build and source

```bash
cd /home/dk/bumbleb_ws
source /opt/ros/humble/setup.bash
colcon build --symlink-install
source install/setup.bash
```

The ZLAC serial device is configured in the real hardware Xacro (`/dev/ttyACM0`). The RPLIDAR device and baud rate are configured in `config/lidar.yaml` (`/dev/ttyUSB0`, `115200`). Verify those device names before powering the robot.

## 2. Start the unified physical bringup

```bash
source /opt/ros/humble/setup.bash
source /home/dk/bumbleb_ws/install/setup.bash
ros2 launch bumbleb_bot bringup.launch.py
```

`bringup.launch.py` defaults to `simulation:=false` and `use_sim_time:=false`. It starts the hardware and always-on services:

| Component | Purpose |
|---|---|
| `real_robot.launch.py` | Robot description, fixed TF, ZLAC ros2_control, wheel controllers, drivetrain odometry |
| `lidar.launch.py` | RPLIDAR `/scan_raw` and filtered `/scan` |
| `rosbridge.launch.py` | WebSocket ROS bridge on port `9090` |
| `system_manager_node.py` | Safety FSM, health, process supervision, map operations |
| `location_manager_node.py` | Robot pose, locations, AMCL initial pose, Nav2 goals |

The backend owns the fixed frame contract:

```text
map -> odom -> base_link -> lidar_link
```

## 3. Start the dashboard

```bash
cd /home/dk/web_dashboard
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://<dashboard-computer>:5173`. If the dashboard computer is different from the robot, pass the robot host and port in the URL:

```text
http://<dashboard-computer>:5173/?ros_host=<robot-ip>&ros_port=9090
```

## 4. Mapping procedure

1. Check hardware topics and TF:

   ```bash
   ros2 topic echo /amr/system_health --once
   ros2 topic echo /odom --once
   ros2 topic echo /scan --once
   ros2 run tf2_ros tf2_echo odom base_link
   ```

2. Press **Start mapping**. This calls `/amr/set_mode` with `MAPPING`; the manager launches `mapping.launch.py`, which launches `slam.launch.py` and `async_slam_toolbox_node`.
3. Drive the robot slowly. SLAM publishes `/map` and `map -> odom`.
4. Enter a name and press **Save occupancy map**. This calls `/amr/map_operation` with `save_map` and creates `<name>.yaml` and `<name>.pgm`.
5. Press **Serialize graph**. This calls SLAM Toolbox and creates `<name>.posegraph` and `<name>.data`.
6. Press **Stop** to return to `READY`.

## 5. Localization and autonomous navigation

1. Select the saved map and press **Start AMCL**. The manager stops SLAM, launches `localization.launch.py`, starts map server and AMCL, and prevents simultaneous `map -> odom` publishers.
2. Set the initial pose from the map view or pose fields. The dashboard calls `/amr/set_initial_pose`, publishing `/initialpose` in the configured map frame.
3. Wait for the health panel to report AMCL pose output.
4. Press **Start Nav2**. The manager launches `navigation.launch.py` after localization is active.
5. Click a free map location or enter coordinates, then press **Send pose goal**. The dashboard calls `/amr/navigate_to_pose`; the location manager sends a `nav2_msgs/action/NavigateToPose` goal.
6. Use **Cancel goal** to call `/amr/cancel_navigation`.

## 6. Direct ROS service requests

```bash
# Mapping (mapping.launch.py -> slam.launch.py -> async SLAM)
ros2 service call /amr/set_mode bumbleb_bot/srv/SetMode \
  "{mode: MAPPING, map_name: ''}"

# Save map and serialize pose graph
ros2 service call /amr/map_operation bumbleb_bot/srv/MapOperation \
  "{operation: save_map, map_name: warehouse_main}"
ros2 service call /amr/map_operation bumbleb_bot/srv/MapOperation \
  "{operation: serialize_pose_graph, map_name: warehouse_main}"

# Stop feature processes
ros2 service call /amr/set_mode bumbleb_bot/srv/SetMode \
  "{mode: READY, map_name: ''}"

# AMCL/map server, initial pose, Nav2, and a goal
ros2 service call /amr/set_mode bumbleb_bot/srv/SetMode \
  "{mode: LOCALIZATION, map_name: warehouse_main}"
ros2 service call /amr/set_initial_pose bumbleb_bot/srv/SetInitialPose \
  "{x: 0.0, y: 0.0, yaw: 0.0}"
ros2 service call /amr/set_mode bumbleb_bot/srv/SetMode \
  "{mode: NAVIGATION, map_name: warehouse_main}"
ros2 service call /amr/navigate_to_pose bumbleb_bot/srv/NavigateToPose \
  "{x: 2.0, y: 1.0, yaw: 1.57}"
ros2 service call /amr/cancel_navigation std_srvs/srv/Trigger "{}"
```

The dashboard uses the same typed services through rosbridge:

```text
bumbleb_bot/srv/SetMode
bumbleb_bot/srv/MapOperation
bumbleb_bot/srv/SetInitialPose
bumbleb_bot/srv/NavigateToPose
std_srvs/srv/Trigger
```

Status topics are `/amr/system_state`, `/amr/system_health`, `/amr/maps`, `/amr/map_operation_result`, `/amr/navigation_status`, `/amr/robot_pose`, and `/map`.

## 7. Safety and shutdown

```bash
ros2 service call /amr/emergency_stop std_srvs/srv/Trigger "{}"
ros2 service call /amr/reset_emergency_stop std_srvs/srv/Trigger "{}"
```

Emergency stop continuously publishes zero velocity. Stop the unified bringup with `Ctrl+C`; do not manually kill SLAM, AMCL, or Nav2 while another feature is active.
