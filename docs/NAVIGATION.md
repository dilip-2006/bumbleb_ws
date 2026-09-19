# Nav2 Autonomous Navigation Guide

## Overview

Autonomous warehouse navigation is implemented using **Nav2** configured specifically for the BumbleB robot footprint ($0.60\,\text{m}\times0.40\,\text{m}$) in `bumbleb_bot/config/nav2.yaml`.

---

## 1. Nav2 Stack Architecture

- **Global Planner**: `nav2_navfn_planner/NavfnPlanner` (A* / Dijkstra search on static global costmap)
- **Local Controller**: `dwb_core::DWBLocalPlanner` (Dynamic Window Approach trajectory rollout)
- **Costmaps**:
  - Global: Static layer + Obstacle layer (/scan) + Inflation layer (radius 0.55m)
  - Local: Rolling window (4m x 4m) + Obstacle layer + Inflation layer
- **Footprint**: Matches the exact chassis model:
  `"[ [0.3, 0.2], [0.3, -0.2], [-0.3, -0.2], [-0.3, 0.2] ]"`
- **Behavior Server**: Recovery behaviors (`Spin`, `BackUp`, `Wait`)
- **BT Navigator**: Behavior Tree executor for goal planning and replanning

---

## 2. Setting Goals from Web Dashboard

### Method A: Interactive Map Click
1. Select **"Set Nav Goal"** on the Map Viewer toolbar.
2. Click any location on the occupancy grid map.
3. The dashboard calculates map coordinates and sends an action goal to `/navigate_to_pose`.
4. Real-time feedback displays:
   - Status: `PLANNING` $\to$ `NAVIGATING` $\to$ `SUCCEEDED`
   - Distance remaining (meters)
   - Estimated trajectory line in emerald green on the map

### Method B: Saved Warehouse Locations
1. Open the **Warehouse Locations** panel on the dashboard.
2. Find the desired target (e.g. `Shelf 1` or `Charging Station`).
3. Click the **[ GO ]** button.
4. The location manager dispatches the goal directly to Nav2.

---

## 3. Canceling or Pausing Navigation

- Click **[ STOP NAVIGATION ]** in the Mode Selector or the Emergency Stop button.
- The active goal is immediately canceled via the Nav2 action interface.
