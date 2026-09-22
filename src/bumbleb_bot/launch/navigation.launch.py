import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    share = get_package_share_directory("bumbleb_bot")
    nav2_share = get_package_share_directory("nav2_bringup")
    params = os.path.join(share, "config", "nav2.yaml")
    return LaunchDescription([
        DeclareLaunchArgument("use_sim_time", default_value="false", description="Use simulation clock"),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(nav2_share, "launch", "navigation_launch.py")),
            launch_arguments={"use_sim_time": LaunchConfiguration("use_sim_time"), "params_file": params}.items(),
        ),
    ])
