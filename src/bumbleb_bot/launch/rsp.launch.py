from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

from ament_index_python.packages import get_package_share_directory

import os
import yaml


def _load_drivetrain_geometry(pkg_share):
    """Read wheel geometry from the single source of truth so the URDF
    never disagrees with bumbleb_drivetrain_node. See
    config/drivetrain.yaml."""

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

    wheel_radius, wheel_separation = _load_drivetrain_geometry(
        pkg_bumbleb_bot
    )

    # ============================================================
    # Launch arguments
    # ============================================================

    use_sim_arg = DeclareLaunchArgument(
        "use_sim",
        default_value="false",
        description="Use simulation robot description"
    )

    use_sim = LaunchConfiguration("use_sim")

    # ============================================================
    # Robot description
    # ============================================================

    robot_description_content = Command([
        "xacro ",
        xacro_file,
        " use_sim:=",
        use_sim,
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
                "robot_description": robot_description
            }
        ]
    )

    return LaunchDescription([
        use_sim_arg,
        robot_state_publisher
    ])