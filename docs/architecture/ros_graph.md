# ROS 2 Computation Graph

When the physical robot is launched via `ros2 launch bumbleb_bot real_robot.launch.py`, the following graph is established.

## Active Nodes
- `/controller_manager`: The core `ros2_control` loop running at 50Hz.
- `/robot_state_publisher`: Parses the URDF and broadcasts static transforms.
- `/diff_drive_controller`: The kinematic controller mapping velocity to wheel commands.
- `/joint_state_broadcaster`: Publishes `sensor_msgs/JointState`.
- `/rplidar_node`: Hardware driver for the LiDAR (when `lidar.launch.py` is active).

## Core Topics
- `/cmd_vel` (`geometry_msgs/Twist`): Target velocity issued by teleop or Nav2. Consumed by `/diff_drive_controller`.
- `/odom` (`nav_msgs/Odometry`): Robot odometry broadcast by `/diff_drive_controller`.
- `/tf` and `/tf_static` (`tf2_msgs/TFMessage`): Coordinate frame transformations.
- `/scan` (`sensor_msgs/LaserScan`): 2D laser scan data.
- `/joint_states` (`sensor_msgs/JointState`): Wheel encoder positions and velocities.
