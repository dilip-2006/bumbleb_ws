import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    share = get_package_share_directory("bumbleb_bot")
    params = os.path.join(share, "config", "slam.yaml")
    return LaunchDescription([
        DeclareLaunchArgument("use_sim_time", default_value="false", description="Use simulation clock"),
        DeclareLaunchArgument("map_frame", default_value="map"),
        DeclareLaunchArgument("odom_frame", default_value="odom"),
        DeclareLaunchArgument("base_frame", default_value="base_link"),
        DeclareLaunchArgument("scan_topic", default_value="/scan"),
        Node(
            package="slam_toolbox",
            executable="async_slam_toolbox_node",
            name="slam_toolbox",
            output="screen",
            parameters=[params, {"use_sim_time": LaunchConfiguration("use_sim_time"),
                                 "map_frame": LaunchConfiguration("map_frame"),
                                 "odom_frame": LaunchConfiguration("odom_frame"),
                                 "base_frame": LaunchConfiguration("base_frame"),
                                 "scan_topic": LaunchConfiguration("scan_topic")}]
        ),
    ])
