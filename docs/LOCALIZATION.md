# AMCL Localization Guide

## Overview

Localization uses **Nav2 Map Server** and **AMCL** (Adaptive Monte Carlo Localization) configured in `bumbleb_bot/config/localization.yaml`.

---

## 1. Localization Workflow

```text
Select Map in Dashboard (e.g. warehouse_main)
       ↓
Click [ LOCALIZATION (AMCL) ]
       ↓
SLAM Toolbox Stopped (preventing TF conflict)
       ↓
Map Server loads <map>.yaml and publishes /map
       ↓
AMCL node initializes particle filter
       ↓
Lifecycle Manager activates map_server and amcl
       ↓
Robot Pose published on /amcl_pose and /amr/robot_pose
       ↓
TF map -> odom broadcast active
```

---

## 2. Parameter Tuning for BumbleB

Key parameters tuned in `bumbleb_bot/config/localization.yaml`:

```yaml
amcl:
  ros__parameters:
    use_sim_time: true
    base_frame_id: base_link
    global_frame_id: map
    odom_frame_id: odom
    scan_topic: /scan
    min_particles: 500
    max_particles: 2000
    update_min_d: 0.05       # Updates after 5 cm motion
    update_min_a: 0.05       # Updates after ~2.8 deg rotation
    laser_model_type: likelihood_field
```

---

## 3. Initial Pose Setting

If the robot's initial position is not at $(0, 0)$, you can set the initial pose by publishing to `/initialpose` or using the 2D Pose Estimate tool in RViz:

```bash
ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped '{
  header: {frame_id: "map"},
  pose: {
    pose: {
      position: {x: 0.0, y: 0.0, z: 0.0},
      orientation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}
    },
    covariance: [0.25, 0, 0, 0, 0, 0,
                 0, 0.25, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0.068]
  }
}'
```
