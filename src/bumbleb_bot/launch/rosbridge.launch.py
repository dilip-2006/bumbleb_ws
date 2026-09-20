from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    port_arg = DeclareLaunchArgument(
        'port',
        default_value='9090',
        description='Port for websocket server'
    )
    address_arg = DeclareLaunchArgument(
        'address',
        default_value='',
        description='Address for websocket server (empty string binds to all IPv4 and IPv6 interfaces)'
    )

    rosbridge_node = Node(
        package='rosbridge_server',
        executable='rosbridge_websocket',
        name='rosbridge_websocket',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'address': LaunchConfiguration('address'),
            'max_message_size': 20000000,
            'send_action_goals_in_new_thread': True,
            'call_services_in_new_thread': True,
            'unregister_timeout': 10.0
        }]
    )

    rosapi_node = Node(
        package='rosapi',
        executable='rosapi_node',
        name='rosapi',
        output='screen'
    )

    return LaunchDescription([
        port_arg,
        address_arg,
        rosbridge_node,
        rosapi_node
    ])
