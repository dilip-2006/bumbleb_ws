# BumbleB Bot

ROS 2 Humble robot integration package for the BumbleB differential-drive AMR (RPLIDAR A1, SLAM Toolbox, AMCL, Nav2). Low-level ZLAC8015D Modbus communication lives in the separate `zlac_drive` package - this package owns robot geometry, TF frames, ros2_control wiring, drivetrain kinematics/odometry, and navigation launch/configuration.

## Architecture

```
RPLIDAR A1 --/scan--> SLAM Toolbox --map->odom--> Nav2 --/cmd_vel-->
                                                              |
                                                              v
                                          bumbleb_drivetrain_node
                                     (differential-drive kinematics,
                                      cmd_vel timeout watchdog)
                                                              |
                                          per-wheel rad/s, published to
                                   /bumbleb_wheel_velocity_controller/commands
                                                              |
                                                              v
                              forward_command_controller (ros2_control)
                                                              |
                                                              v
                                   zlac_drive/ZlacSystemHardware -> Modbus RTU -> ZLAC8015D
                                                              |
                                                              v
                                                joint_states (position/velocity)
                                                              |
                                                              v
                                          bumbleb_drivetrain_node
                                   (velocity-integration odometry, odom->base_link)
```

**`diff_drive_controller` is intentionally not used.** Wheel-command kinematics and odometry are owned directly by BumbleB's own `bumbleb_drivetrain_node` (`src/drivetrain_node.cpp`); `ros2_control` only forwards the resulting per-wheel velocity commands via `forward_command_controller`.

## Single source of truth for wheel geometry

`config/drivetrain.yaml` is the only place `wheel_radius` and `wheel_separation` are defined. Launch files read it and pass both values into the xacro command line (`description/wheels/wheels.xacro` consumes them as `xacro:arg`s with matching defaults), and `bumbleb_drivetrain_node` loads the same file as its ROS parameters file. Do not hard-code either value anywhere else.

- `wheel_radius = 0.0655 m`: `DERIVED` from the ZLLG50ASM200 V2.0 wheel diameter (131 +-2 mm, `SOURCE_VERIFIED`) / 2.
- `wheel_separation = 0.65 m`: `CALIBRATION_REQUIRED` - carried over from the existing chassis model, **not yet confirmed** against the physical BumbleB wheel-center separation. Measure it and set `wheel_separation_verified: true` in `config/drivetrain.yaml` once confirmed; until then, odometry heading and curvature commands will be inaccurate.

## Odometry approach

`bumbleb_drivetrain_node` integrates **wheel velocity** feedback (`/joint_states`, RPM-derived rad/s, `PHYSICALLY_VERIFIED` scale) rather than position feedback, because the ZLAC8015D position-register scale is `CALIBRATION_REQUIRED` (see `zlac_drive/README.md`). This is a deliberate open-loop-on-position / closed-loop-on-velocity dead-reckoning source; like any dead-reckoning estimate it will drift and is corrected by SLAM Toolbox/AMCL publishing `map -> odom`, never by this node.

## TF tree

```
map -> odom      (SLAM Toolbox while mapping, AMCL while localizing - never both at once)
odom -> base_link (bumbleb_drivetrain_node)
base_link -> lidar_link (robot_state_publisher, from the URDF)
```

## Safety: command timeout

`bumbleb_drivetrain_node` runs a timer at `control_frequency` (default matches `controller_manager`'s `update_rate`, 50 Hz) that re-publishes the wheel command **every cycle** - zero velocity if no `/cmd_vel` has arrived within `cmd_vel_timeout` (default 0.5 s). This mirrors how `diff_drive_controller` itself implements `cmd_vel_timeout`; simply reacting to `/cmd_vel` callbacks would leave the last non-zero command latched on the `forward_command_controller` command interface forever if `/cmd_vel` stopped arriving.

Independently, every wheel command is hard-clamped inside the node to the motor's physical peak speed (350 RPM, converted to rad/s) regardless of the configured `max_linear_velocity`/`max_angular_velocity`.

## Build and test

```bash
cd ~/bumbleb_ws
rosdep install --from-paths src --ignore-src -r -y
colcon build --symlink-install
source install/setup.bash
colcon test
colcon test-result --verbose
```

## Bring-up sequence (real hardware)

```bash
ros2 launch bumbleb_bot real_robot.launch.py
ros2 launch bumbleb_bot lidar.launch.py
ros2 launch bumbleb_bot slam.launch.py
# drive the robot around, then:
ros2 run nav2_map_server map_saver_cli -f ~/bumbleb_ws/src/bumbleb_bot/maps/my_map
```

For saved-map localization + navigation:

```bash
ros2 launch bumbleb_bot real_robot.launch.py
ros2 launch bumbleb_bot lidar.launch.py
ros2 launch bumbleb_bot localization.launch.py map:=/absolute/path/to/my_map.yaml
ros2 launch bumbleb_bot navigation.launch.py
```

## Bring-up sequence (Gazebo simulation)

```bash
ros2 launch bumbleb_bot simulation.launch.py
```

This starts Gazebo Classic with `gazebo_ros2_control/GazeboSystem`, inserts BumbleB onto a ground plane, and loads the wheel controllers. In a second terminal, source the workspace and run:

```bash
ros2 launch bumbleb_bot teleop.launch.py
```

Use the displayed `teleop_twist_keyboard` keys to publish `/cmd_vel`. Gazebo is useful for physics and integration testing, but the wheel separation and physical sensor/motor calibrations still require real-robot validation.

The Gazebo-only 2-D ray sensor publishes `sensor_msgs/LaserScan` on `/scan`
with `lidar_link` as its frame at 10 Hz. It is separate from
`lidar.launch.py`, which is only for the physical RPLIDAR.

The default `obstacle.world` has static objects, so `/scan` includes finite
ranges immediately. For command-line inspection, use sensor-data QoS:

```bash
ros2 topic echo /scan --qos-reliability best_effort
```

Gazebo draws the scan fan when its GUI is enabled. The small red marker on the
lidar body points along `lidar_link` +X, which is both the robot-forward and
the `/scan` zero-angle direction. In RViz, use a `LaserScan` display with
`/scan`, **Best Effort** reliability, and a fixed frame of `odom`,
`base_link`, or `lidar_link`.

## Remaining calibration before autonomous navigation

1. Measure wheel-center separation and set `wheel_separation_verified: true` in `config/drivetrain.yaml`.
2. Verify left/right motor direction against ROS forward-motion convention (`zlac_drive` `left_motor_inverted`/`right_motor_inverted`).
3. Calibrate effective encoder counts per wheel revolution (see `zlac_drive/README.md`) if position-based feedback is ever required.
4. Measure the LiDAR mounting transform (`description/sensors/lidar.xacro`).
5. Validate `/odom`, `odom -> base_link`, and `/scan` together in RViz before running SLAM.
6. Run SLAM, save a map, then validate AMCL and Nav2 end to end.
