from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, TimerAction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    """Launch the RPLIDAR A1 node directly against BumbleB's own
    config/lidar.yaml, which is the single source of truth for serial
    port, baud rate, and frame_id (see description/sensors/lidar.xacro
    for the matching TF frame). The raw full scan is cropped to the
    robot-forward 180-degree field before being published as /scan."""

    lidar_node = Node(
        package="rplidar_ros",
        executable="rplidar_composition",
        name="rplidar_node",
        output="screen",
        # Keep this parameter set identical to the known-good manual command
        # used on the robot. Some RPLIDAR A1 firmware revisions time out when
        # optional scan-mode parameters are sent during startup.
        parameters=[{
            "serial_port": "/dev/ttyUSB0",
            "serial_baudrate": 115200,
            "frame_id": LaunchConfiguration("lidar_frame"),
        }],
        remappings=[("scan", "/scan_raw")],
    )

    return LaunchDescription([
        DeclareLaunchArgument("lidar_frame", default_value="lidar_link"),
        # Give the USB serial adapter time to settle before the first scan
        # mode handshake, as in the known-good manual startup.
        TimerAction(period=3.0, actions=[lidar_node]),
        Node(
            package="bumbleb_bot",
            executable="front_scan_filter.py",
            name="front_scan_filter",
            output="screen",
        ),
    ])
