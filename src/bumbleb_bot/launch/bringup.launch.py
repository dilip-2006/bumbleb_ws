import os
from pathlib import Path
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, GroupAction
from launch.conditions import IfCondition, UnlessCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    pkg_bumbleb = get_package_share_directory("bumbleb_bot")

    # Launch Arguments
    simulation_arg = DeclareLaunchArgument(
        "simulation",
        default_value="true",
        description="Launch Gazebo simulation stack if true, else real robot hardware"
    )
    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="true",
        description="Use simulation (Gazebo) clock"
    )
    rviz_arg = DeclareLaunchArgument(
        "rviz",
        default_value="false",
        description="Start RViz2 alongside the system (dashboard is primary UI)"
    )
    use_rosbridge_arg = DeclareLaunchArgument(
        "use_rosbridge",
        default_value="true",
        description="Start rosbridge WebSocket server on port 9090"
    )
    use_system_mgr_arg = DeclareLaunchArgument(
        "use_system_manager",
        default_value="true",
        description="Start AMR System Manager node"
    )
    use_location_mgr_arg = DeclareLaunchArgument(
        "use_location_manager",
        default_value="true",
        description="Start AMR Location Manager node"
    )
    maps_dir_arg = DeclareLaunchArgument(
        "maps_dir",
        default_value=str(Path.home() / "bumbleb_data" / "maps"),
        description="Path to maps directory"
    )

    simulation = LaunchConfiguration("simulation")
    use_sim_time = LaunchConfiguration("use_sim_time")
    rviz = LaunchConfiguration("rviz")
    use_rosbridge = LaunchConfiguration("use_rosbridge")
    use_system_manager = LaunchConfiguration("use_system_manager")
    use_location_manager = LaunchConfiguration("use_location_manager")
    maps_dir = LaunchConfiguration("maps_dir")

    # 1. Simulation Bringup
    sim_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(pkg_bumbleb, "launch", "simulation.launch.py")),
        launch_arguments={
            "use_sim_time": use_sim_time,
            "rviz": rviz
        }.items(),
        condition=IfCondition(simulation)
    )

    # 2. Real Hardware Bringup
    real_robot_launch = GroupAction(
        condition=UnlessCondition(simulation),
        actions=[
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg_bumbleb, "launch", "real_robot.launch.py"))
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg_bumbleb, "launch", "lidar.launch.py"))
            )
        ]
    )

    # 3. rosbridge WebSocket Server
    rosbridge_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(pkg_bumbleb, "launch", "rosbridge.launch.py")),
        condition=IfCondition(use_rosbridge)
    )

    # 4. AMR System Manager
    system_mgr_node = Node(
        package="bumbleb_bot",
        executable="system_manager_node.py",
        name="amr_system_manager",
        output="screen",
        parameters=[{
            "use_sim_time": use_sim_time,
            "maps_dir": maps_dir,
            "auto_ready": True
        }],
        condition=IfCondition(use_system_manager)
    )

    # 5. AMR Location Manager
    location_mgr_node = Node(
        package="bumbleb_bot",
        executable="location_manager_node.py",
        name="amr_location_manager",
        output="screen",
        parameters=[{
            "locations_file": str(Path.home() / "bumbleb_data" / "locations" / "warehouse_locations.yaml"),
            "use_sim_time": use_sim_time,
            "map_frame": "map",
            "base_frame": "base_link"
        }],
        condition=IfCondition(use_location_manager)
    )

    return LaunchDescription([
        simulation_arg,
        use_sim_time_arg,
        rviz_arg,
        use_rosbridge_arg,
        use_system_mgr_arg,
        use_location_mgr_arg,
        maps_dir_arg,
        sim_launch,
        real_robot_launch,
        rosbridge_launch,
        system_mgr_node,
        location_mgr_node
    ])
