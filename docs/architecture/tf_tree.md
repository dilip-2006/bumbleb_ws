# Transform (TF) Tree

The BumbleB robot uses a standard ROS 2 transform hierarchy. Strict adherence to this tree ensures that SLAM and Nav2 function properly.

## Hierarchy

```text
map
 └── odom
      └── base_link
           ├── left_wheel
           ├── right_wheel
           ├── front_left_caster
           ├── front_right_caster
           ├── rear_left_caster
           ├── rear_right_caster
           └── lidar_link
```

## Frame Responsibilities
- **`map`**: The fixed, globally consistent coordinate frame. Published by `slam_toolbox` or `amcl`.
- **`odom`**: The continuous, drift-prone local odometry frame. Published dynamically by `/diff_drive_controller`.
- **`base_link`**: The center of the robot's footprint (chassis center, projected to the floor).
- **`lidar_link`**: The physical mounting point of the RPLIDAR. Transform published by `robot_state_publisher` via `lidar.xacro`.
