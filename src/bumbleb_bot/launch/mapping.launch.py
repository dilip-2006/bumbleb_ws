import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    pkg_share = get_package_share_directory("bumbleb_bot")
    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="false",
        description="Use simulation clock"
    )
    map_frame_arg = DeclareLaunchArgument("map_frame", default_value="map")
    odom_frame_arg = DeclareLaunchArgument("odom_frame", default_value="odom")
    base_frame_arg = DeclareLaunchArgument("base_frame", default_value="base_link")
    scan_topic_arg = DeclareLaunchArgument("scan_topic", default_value="/scan")

    slam_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(pkg_share, "launch", "slam.launch.py")),
        launch_arguments={
            "use_sim_time": LaunchConfiguration("use_sim_time"),
            "map_frame": LaunchConfiguration("map_frame"),
            "odom_frame": LaunchConfiguration("odom_frame"),
            "base_frame": LaunchConfiguration("base_frame"),
            "scan_topic": LaunchConfiguration("scan_topic")
        }.items()
    )

    return LaunchDescription([
        use_sim_time_arg,
        map_frame_arg,
        odom_frame_arg,
        base_frame_arg,
        scan_topic_arg,
        slam_launch
    ])
