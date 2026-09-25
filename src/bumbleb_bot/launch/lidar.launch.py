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
        # Keep these explicit here.  This is the exact parameter set that
        # works with the A1 on the robot; do not pass a second YAML namespace
        # to the composable executable because it can select scan-mode setup
        # before the USB device is ready.
        parameters=[{
            "serial_port": "/dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0",
            "serial_baudrate": 115200,
            "frame_id": LaunchConfiguration("lidar_frame"),
            "inverted": False,
            # Leave scan-mode selection and angle compensation at the driver
            # defaults.  This A1 firmware accepts its native Sensitivity
            # mode, but rejects an explicit scan-mode/compensation request
            # during some USB startups.
        }],
        remappings=[("scan", "/scan_raw")],
        respawn=True,
        respawn_delay=3.0,
    )

    return LaunchDescription([
        DeclareLaunchArgument("lidar_frame", default_value="lidar_link"),
        # Give the USB serial adapter and ros2_control time to settle before
        # opening the lidar port.  This also prevents a simultaneous startup
        # command from leaving the A1 in a half-started scan state.
        TimerAction(period=3.0, actions=[lidar_node]),
        Node(
            package="bumbleb_bot",
            executable="front_scan_filter.py",
            name="front_scan_filter",
            output="screen",
        ),
    ])
