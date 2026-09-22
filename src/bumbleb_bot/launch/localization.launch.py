import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    share = get_package_share_directory("bumbleb_bot")
    params = os.path.join(share, "config", "localization.yaml")
    
    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="false",
        description="Use simulation clock"
    )
    map_arg = DeclareLaunchArgument(
        "map",
        description="Absolute path to a saved map YAML"
    )
    map_frame_arg = DeclareLaunchArgument("map_frame", default_value="map")
    odom_frame_arg = DeclareLaunchArgument("odom_frame", default_value="odom")
    base_frame_arg = DeclareLaunchArgument("base_frame", default_value="base_link")
    scan_topic_arg = DeclareLaunchArgument("scan_topic", default_value="/scan")

    use_sim_time = LaunchConfiguration("use_sim_time")
    map_path = LaunchConfiguration("map")

    return LaunchDescription([
        use_sim_time_arg,
        map_arg,
        map_frame_arg,
        odom_frame_arg,
        base_frame_arg,
        scan_topic_arg,
        Node(
            package="nav2_map_server",
            executable="map_server",
            name="map_server",
            output="screen",
            parameters=[params, {"yaml_filename": map_path, "use_sim_time": use_sim_time,
                                 "frame_id": LaunchConfiguration("map_frame")}]
        ),
        Node(
            package="nav2_amcl",
            executable="amcl",
            name="amcl",
            output="screen",
            parameters=[params, {"use_sim_time": use_sim_time,
                                 "global_frame_id": LaunchConfiguration("map_frame"),
                                 "odom_frame_id": LaunchConfiguration("odom_frame"),
                                 "base_frame_id": LaunchConfiguration("base_frame"),
                                 "scan_topic": LaunchConfiguration("scan_topic")}]
        ),
        Node(
            package="nav2_lifecycle_manager",
            executable="lifecycle_manager",
            name="lifecycle_manager_localization",
            output="screen",
            parameters=[{"autostart": True, "node_names": ["map_server", "amcl"], "use_sim_time": use_sim_time}]
        ),
    ])
