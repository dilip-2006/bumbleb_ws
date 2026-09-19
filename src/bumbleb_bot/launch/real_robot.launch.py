import os

from ament_index_python.packages import get_package_share_directory

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, TimerAction
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

    # ============================================================
    # Package paths
    # ============================================================

    pkg_bumbleb_bot = get_package_share_directory(
        "bumbleb_bot"
    )

    xacro_file = os.path.join(
        pkg_bumbleb_bot,
        "description",
        "bumbleb.urdf.xacro"
    )

    controllers_file = os.path.join(
        pkg_bumbleb_bot,
        "config",
        "controllers.yaml"
    )

    wheel_controller_file = os.path.join(
        pkg_bumbleb_bot,
        "config",
        "wheel_velocity_controller.yaml"
    )

    drivetrain_file = os.path.join(
        pkg_bumbleb_bot,
        "config",
        "drivetrain.yaml"
    )

    wheel_radius, wheel_separation = _load_drivetrain_geometry(
        pkg_bumbleb_bot
    )

    # ============================================================
    # Launch arguments
    # ============================================================

    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="false",
        description="Use simulation clock"
    )

    use_sim_time = LaunchConfiguration(
        "use_sim_time"
    )

    # ============================================================
    # Real hardware robot description
    # ============================================================

    robot_description_content = Command([
        "xacro ",
        xacro_file,
        " use_sim:=false",
        " wheel_radius:=",
        wheel_radius,
        " wheel_separation:=",
        wheel_separation
    ])

    robot_description = ParameterValue(
        robot_description_content,
        value_type=str
    )

    # ============================================================
    # Robot State Publisher
    # ============================================================

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

    # ============================================================
    # ros2_control
    #
    # Hardware plugin:
    #
    # zlac_drive/ZlacSystemHardware
    # ============================================================

    control_node = Node(
        package="controller_manager",
        executable="ros2_control_node",
        name="controller_manager",
        output="screen",
        parameters=[
            {
                "robot_description": robot_description,
                "use_sim_time": use_sim_time,
                "update_rate": 50
            }
        ]
    )

    # ============================================================
    # Controllers
    #
    # bumbleb_wheel_velocity_controller (forward_command_controller)
    # only forwards per-wheel velocity commands to ros2_control. The
    # actual differential-drive kinematics and odometry are owned by
    # BumbleB's own bumbleb_drivetrain_node below - NOT by
    # diff_drive_controller.
    # ============================================================

    wheel_velocity_controller_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[
            "bumbleb_wheel_velocity_controller",
            "--controller-manager",
            "/controller_manager",
            "--controller-type",
            "forward_command_controller/ForwardCommandController",
            "--param-file",
            wheel_controller_file
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
            "--controller-type",
            "joint_state_broadcaster/JointStateBroadcaster"
        ],
        output="screen"
    )

    # ============================================================
    # BumbleB differential-drive kinematics + odometry
    # ============================================================

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

    return LaunchDescription([
        use_sim_time_arg,

        robot_state_publisher,

        control_node,

        TimerAction(
            period=5.0,
            actions=[wheel_velocity_controller_spawner]
        ),

        TimerAction(
            period=8.0,
            actions=[joint_state_broadcaster_spawner]
        ),

        drivetrain_node
    ])
