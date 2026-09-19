# BumbleB AMR System Architecture

The software architecture of the BumbleB robot strictly follows a bottom-up hierarchical hardware abstraction pattern.

## Control Flow Architecture

1. **Hardware Layer (ZLAC8015D Controller)**: The dual-channel motor driver connected to left and right hub motors.
2. **Transport Layer (Modbus RTU)**: A standard RS-485 serial implementation (`modbus_client.cpp`) that handles raw byte transmission and CRC verification.
3. **Driver Layer (`ZlacDriveDriver`)**: Translates high-level motor commands into specific ZLAC registry addresses (e.g., Mode 3, Enable 0x08).
4. **Hardware Interface (`ZlacSystemHardware`)**: The `ros2_control` C++ plugin. It parses URDF parameters (`serial_port`, `encoder_cpr`) and converts `rad/s` to `RPM` using the `Motor` utility class.
5. **Controller Layer (`diff_drive_controller`)**: The standard ROS 2 kinematic controller. Converts standard `geometry_msgs/Twist` messages into individual wheel joint commands.
6. **Application Layer (Nav2 / SLAM)**: Generates the global and local trajectories based on LiDAR `/scan` and `/odom`.
