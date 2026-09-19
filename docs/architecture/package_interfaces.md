# Package Interfaces

The BumbleB workspace is divided into two primary ROS 2 packages, establishing a strict separation of concerns between reusable hardware drivers and robot-specific configuration.

## 1. `zlac_drive`
This package is a **reusable hardware driver**. It is agnostic to the robot's physical dimensions, wheel separation, or navigation goals.
- **Inputs**: `hardware_interface::HW_IF_VELOCITY` command arrays from `ros2_control`.
- **Outputs**: `hardware_interface::HW_IF_POSITION` and `hardware_interface::HW_IF_VELOCITY` state arrays.
- **Internal**: Handles raw Modbus RTU serial frame generation, Modbus CRC calculations, and ZLAC8015D specific registry writes.

## 2. `bumbleb_bot`
This is the **robot integration package**. It owns all physical traits and ROS 2 application-level configurations.
- **URDF/Xacro**: Defines the physical `base.xacro` (0.6x0.4m box), `wheels.xacro`, and `lidar.xacro`.
- **Controllers**: Configures `diff_drive_controller` and `joint_state_broadcaster`.
- **Navigation/SLAM**: Owns the Nav2 behavior trees, costmap parameters, and `slam_toolbox` mapping configurations.
