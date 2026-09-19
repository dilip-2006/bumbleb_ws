import os

from ament_index_python.packages import get_package_share_directory

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, RegisterEventHandler, TimerAction
from launch.conditions import IfCondition
from launch.event_handlers import OnProcessExit
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

import yaml


def _load_drivetrain_geometry(pkg_share):
    """Read wheel geometry from the single source of truth (see
    config/drivetrain.yaml) so the URDF passed to robot_state_publisher
    never disagrees with bumbleb_drivetrain_node's kinematics/odometry."""

    drivetrain_yaml = os.path.join(
        pkg_share, "config", "drivetrain.yaml"
    )

    with open(drivetrain_yaml, "r") as f:
        params = yaml.safe_load(f)["bumbleb_drivetrain_node"]["ros__parameters"]

    return str(params["wheel_radius"]), str(params["wheel_separation"])


def generate_launch_description():

    pkg_bumbleb_bot = get_package_share_directory(
        "bumbleb_bot"
    )

    xacro_file = os.path.join(
        pkg_bumbleb_bot,
        "description",
        "bumbleb.urdf.xacro"
    )

    drivetrain_file = os.path.join(
        pkg_bumbleb_bot,
        "config",
        "drivetrain.yaml"
    )

    rviz_file = os.path.join(
        pkg_bumbleb_bot,
        "rviz",
        "simulation.rviz"
    )

    wheel_radius, wheel_separation = _load_drivetrain_geometry(
        pkg_bumbleb_bot
    )

    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="true",
        description="Use Gazebo's simulation clock"
    )

    use_sim_time = LaunchConfiguration("use_sim_time")

    rviz_arg = DeclareLaunchArgument(
        "rviz",
        default_value="true",
        description="Start RViz configured for Gazebo simulation time"
    )

    # ============================================================
    # Gazebo Classic robot description.  The selected control xacro uses
    # gazebo_ros2_control/GazeboSystem, so wheel commands drive physics.
    # ============================================================

    robot_description_content = Command([
        "bash -c \"xacro ",
        xacro_file,
        " use_sim:=true",
        " wheel_radius:=",
        wheel_radius,
        " wheel_separation:=",
        wheel_separation,
        # Humble's gazebo_ros2_control passes this value back through the
        # ROS parameter-argument parser. Xacro's informational comments
        # contain ':' and make that parser reject an otherwise valid URDF.
        # Remove comments from this runtime copy only.
        " | perl -0pe 's/<!--.*?-->//gs'\""
    ])

    robot_description = ParameterValue(
        robot_description_content,
        value_type=str
    )

    robot_state_publisher = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        name="robot_state_publisher",
        output="screen",
        parameters=[
            {
                "robot_description": robot_description,
                "use_sim_time": use_sim_time
            }
        ]
    )

    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(
            get_package_share_directory("gazebo_ros"),
            "launch",
            "gazebo.launch.py"
        )),
        launch_arguments={
            # obstacle.world contains static geometry so the simulated lidar
            # has finite returns as soon as the robot is spawned.
            "world": os.path.join(pkg_bumbleb_bot, "worlds", "obstacle.world"),
            "verbose": "false"
        }.items()
    )

    spawn_entity = Node(
        package="gazebo_ros",
        executable="spawn_entity.py",
        arguments=[
            "-entity", "bumbleb",
            "-topic", "robot_description",
            "-x", "0.0", "-y", "0.0", "-z", "0.10"
        ],
        output="screen"
    )

    joint_state_broadcaster_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[
            "joint_state_broadcaster",
            "--controller-manager",
            "/controller_manager",
            "--controller-manager-timeout", "60"
        ],
        output="screen"
    )

    wheel_velocity_controller_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[
            "bumbleb_wheel_velocity_controller",
            "--controller-manager",
            "/controller_manager",
            "--controller-manager-timeout", "60"
        ],
        output="screen"
    )

    drivetrain_node = Node(
        package="bumbleb_bot",
        executable="bumbleb_drivetrain_node",
        name="bumbleb_drivetrain_node",
        output="screen",
        parameters=[
            drivetrain_file,
            {"use_sim_time": use_sim_time}
        ]
    )

    rviz = Node(
        package="rviz2",
        executable="rviz2",
        arguments=["-d", rviz_file],
        output="screen",
        parameters=[{"use_sim_time": use_sim_time}],
        condition=IfCondition(LaunchConfiguration("rviz"))
    )

    return LaunchDescription([
        use_sim_time_arg,
        rviz_arg,
        robot_state_publisher,
        gazebo,
        spawn_entity,
        # The manager is created by Gazebo only when the model is inserted.
        # Starting spawners after insertion avoids the startup race.
        RegisterEventHandler(
            OnProcessExit(
                target_action=spawn_entity,
                on_exit=[TimerAction(
                    period=2.0,
                    actions=[
                        joint_state_broadcaster_spawner,
                        wheel_velocity_controller_spawner
                    ]
                )]
            )
        ),
        drivetrain_node,
        rviz
    ])
