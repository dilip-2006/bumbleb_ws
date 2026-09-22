import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    """Launch the RPLIDAR A1 node directly against BumbleB's own
    config/lidar.yaml, which is the single source of truth for serial
    port, baud rate, and frame_id (see description/sensors/lidar.xacro
    for the matching TF frame). The raw full scan is cropped to the
    robot-forward 180-degree field before being published as /scan."""

    share = get_package_share_directory("bumbleb_bot")
    lidar_params = os.path.join(share, "config", "lidar.yaml")

    return LaunchDescription([
        DeclareLaunchArgument("lidar_frame", default_value="lidar_link"),
        Node(
            package="rplidar_ros",
            executable="rplidar_node",
            name="rplidar_node",
            output="screen",
            parameters=[lidar_params, {"frame_id": LaunchConfiguration("lidar_frame")}],
            remappings=[("scan", "/scan_raw")],
        ),
        Node(
            package="bumbleb_bot",
            executable="front_scan_filter.py",
            name="front_scan_filter",
            output="screen",
        ),
    ])
