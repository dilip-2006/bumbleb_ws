# Gazebo Simulation Guide

## Overview

The BumbleB simulation is built on **Gazebo Classic** with `gazebo_ros2_control` and a high-fidelity warehouse environment (`obstacle.world`).

---

## 1. Simulation Architecture

```text
gazebo_ros (gzserver + gzclient)
  ├── World: obstacle.world (static warehouse obstacles, walls, pillars)
  ├── Model: bumbleb (spawned via robot_description)
  ├── Controllers:
  │     ├── joint_state_broadcaster
  │     └── bumbleb_wheel_velocity_controller (forward_command_controller)
  └── Sensors:
        └── Ray Sensor Plugin -> /scan (10 Hz, 360 beams, 12m max range)
```

---

## 2. Drivetrain & Kinematics Single Source of Truth

The robot's physical wheel geometry is configured in **only one place**:

```yaml
# bumbleb_bot/config/drivetrain.yaml
bumbleb_drivetrain_node:
  ros__parameters:
    wheel_radius: 0.0655        # ZLLG50ASM200 V2.0 hub motor
    wheel_separation: 0.65      # Wheel-center baseline
    max_linear_velocity: 0.5    # m/s
    max_angular_velocity: 1.0   # rad/s
    cmd_vel_timeout: 0.5        # Watchdog timeout (seconds)
    control_frequency: 50.0     # Hz
```

The launch file loads this YAML and dynamically passes `wheel_radius` and `wheel_separation` into the URDF/Xacro, ensuring the visual/collision physics and odometry calculations are always 100% in agreement.

---

## 3. Starting Simulation

To run simulation standalone:

```bash
ros2 launch bumbleb_bot simulation.launch.py use_sim_time:=true rviz:=true
```

To run with the complete warehouse system (recommended):

```bash
ros2 launch bumbleb_bot bringup.launch.py simulation:=true rviz:=false
```

---

## 4. Verifying Sensor Data

Verify `/scan` output:

```bash
ros2 topic echo /scan --qos-reliability best_effort
```

Verify `/odom` output:

```bash
ros2 topic echo /odom
```

Verify TF transform:

```bash
ros2 run tf2_ros tf2_echo odom base_link
```
