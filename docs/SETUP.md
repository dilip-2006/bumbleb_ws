# Setup and Installation Guide

## 1. System Requirements

- **Operating System**: Ubuntu 22.04 LTS
- **ROS Distribution**: ROS 2 Humble Hawksbill (`/opt/ros/humble`)
- **Node.js**: v18.0+ or v20.0+ (with npm)
- **Python**: 3.10+
- **Simulation**: Gazebo Classic 11 (`gazebo_ros_pkgs`)

---

## 2. Dependencies Installation

Install required ROS 2 Humble packages:

```bash
sudo apt-get update
sudo apt-get install -y \
  ros-humble-desktop \
  ros-humble-gazebo-ros-pkgs \
  ros-humble-gazebo-ros2-control \
  ros-humble-slam-toolbox \
  ros-humble-nav2-bringup \
  ros-humble-navigation2 \
  ros-humble-tf2-ros \
  ros-humble-tf2-geometry-msgs
```

Install Python WebSocket dependencies for rosbridge:

```bash
pip install --user tornado pymongo autobahn twisted
```

---

## 3. rosbridge Underlay Setup

`rosbridge_suite` is placed in an isolated underlay workspace at `/home/dk/rosbridge_ws`:

```bash
mkdir -p /home/dk/rosbridge_ws/src
cd /home/dk/rosbridge_ws/src
git clone --branch humble --depth 1 https://github.com/RobotWebTools/rosbridge_suite.git

cd /home/dk/rosbridge_ws
source /opt/ros/humble/setup.bash
colcon build --symlink-install --cmake-args -DBUILD_TESTING=OFF
```

Add the underlay setup to `~/.bashrc`:

```bash
echo "source /home/dk/rosbridge_ws/install/setup.bash" >> ~/.bashrc
```

---

## 4. Robot Workspace Setup

Build `bumbleb_ws`:

```bash
cd /home/dk/bumbleb_ws
source /opt/ros/humble/setup.bash
source /home/dk/rosbridge_ws/install/setup.bash

colcon build --symlink-install --cmake-args -DBUILD_TESTING=OFF
source install/setup.bash
```

Verify that only the two expected packages are in the workspace:

```bash
colcon list
# Outputs:
# bumbleb_bot
# zlac_drive
```

---

## 5. Physical Robot Bringup

The unified real-robot bringup starts the ZLAC hardware, fixed robot TF, RPLIDAR, rosbridge, and the dashboard/system managers:

```bash
ros2 launch bumbleb_bot bringup.launch.py
```

It defaults to `simulation:=false` and `use_sim_time:=false`. The dashboard then starts asynchronous SLAM, AMCL localization, and Nav2 through the corresponding launch files. For Gazebo only, explicitly use `simulation:=true use_sim_time:=true`.

See [Physical Robot Operation](REAL_ROBOT_OPERATION.md) for the dashboard workflow and direct ROS/rosbridge service requests.

## 6. Web Dashboard Setup

```bash
cd /home/dk/web_dashboard
npm install
npm run build
```

The web dashboard is now ready for both development (`npm run dev`) and production serving.
