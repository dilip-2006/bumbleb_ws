# Gazebo to Physical AMR Hardware Migration Guide

## Overview

The BumbleB AMR software stack is designed following strict separation of concerns. The navigation, localization, location management, and web dashboard layers consume only standard ROS 2 interfaces and are **completely decoupled from Gazebo**.

---

## 1. Interface Boundary

```text
+--------------------------------------------------------------+
|     Navigation, Localization, System Manager, Dashboard      |
+------------------------------+-------------------------------+
                               | Standard ROS 2 Topics & TF
                               | (/cmd_vel, /odom, /scan, TF)
+------------------------------+-------------------------------+
|      Simulation Layer        |       Physical Robot Layer    |
|   (simulation.launch.py)     |      (real_robot.launch.py)   |
+------------------------------+-------------------------------+
|  Gazebo Classic              |  Physical Chassis             |
|  gazebo_ros2_control         |  zlac_drive (ZLAC8015D Modbus)|
|  Simulated 2D Ray Sensor     |  Physical RPLIDAR A1          |
|  Simulated Wheel Encoders    |  Hardware Hall Encoders       |
+------------------------------+-------------------------------+
```

---

## 2. Transition Steps

To deploy on physical hardware:

1. **Verify Baseline Wheel Geometry**:
   Measure wheel center-to-center distance on the physical chassis.
   Update `wheel_separation` in `bumbleb_bot/config/drivetrain.yaml` and set `wheel_separation_verified: true`.

2. **Verify Motor Inversions**:
   Ensure wheel rotations match the forward ROS coordinate frame convention (+X forward, +Y left).
   Adjust `left_motor_inverted` / `right_motor_inverted` in `zlac_drive/config/zlac_drive_defaults.yaml`.

3. **Measure LiDAR Mounting Offset**:
   Confirm physical mounting coordinates of the RPLIDAR A1 relative to `base_link` and update `bumbleb_bot/description/sensors/lidar.xacro`.

4. **Launch with `simulation:=false`**:

   ```bash
   ros2 launch bumbleb_bot bringup.launch.py simulation:=false use_sim_time:=false
   ```

5. **Web Dashboard**:
   The web dashboard connects to the physical robot's `rosbridge_server` without modifying a single line of frontend code. Point the browser to `http://<robot-ip>:3000`.
