# LiDAR Test Plan

The RPLIDAR provides 2D spatial context for SLAM and Nav2.

## Validation Steps
1. **Launch the LiDAR**:
   ```bash
   ros2 launch bumbleb_bot lidar.launch.py
   ```
2. **Verify Topic Output**:
   ```bash
   ros2 topic echo /scan --noarr
   ```
3. **Verify TF Frame**:
   The LiDAR should be publishing its scans in the `lidar_link` frame. Verify this with RViz2 by setting the Fixed Frame to `lidar_link` and adding a LaserScan display on `/scan`.
4. **Physical Placement**:
   Ensure `lidar_x`, `lidar_y`, and `lidar_z` inside `lidar.xacro` match the exact physical center of the LiDAR sensor relative to the center of the robot's floor footprint (`base_link`).
