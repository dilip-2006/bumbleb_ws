# SLAM Test Plan

SLAM (Simultaneous Localization and Mapping) merges LiDAR and Odometry to create a static 2D map.

## Procedure
1. Launch hardware and LiDAR.
2. Launch SLAM Toolbox:
   ```bash
   ros2 launch bumbleb_bot slam.launch.py
   ```
3. Open RViz2 and add the Map display targeting `/map`.
4. Teleop the robot slowly around the environment.
5. **Validation**: The map should build cleanly without "smearing". Smearing typically indicates a poorly calibrated encoder CPR (Odometry issue) or incorrect `wheel_separation` kinematics.
6. Save the map:
   ```bash
   ros2 run nav2_map_server map_saver_cli -f ~/my_map
   ```
