import xml.etree.ElementTree as ET
from pathlib import Path

import xacro


def _xacro_path():
    return (
        Path(__file__).resolve().parents[1]
        / "description"
        / "bumbleb.urdf.xacro"
    )


def test_robot_description_files_exist():
    root = Path(__file__).resolve().parents[1]
    assert (root / "description" / "bumbleb.urdf.xacro").is_file()
    assert (
        root / "description" / "control" / "bumbleb.ros2_control.xacro"
    ).is_file()


def _process(use_sim):
    doc = xacro.process_file(
        str(_xacro_path()),
        mappings={
            "use_sim": use_sim,
            "wheel_radius": "0.0655",
            "wheel_separation": "0.65",
        },
    )
    return ET.fromstring(doc.toxml())


def test_real_hardware_urdf_is_valid_and_has_wheel_joints():
    root = _process("false")

    assert root.tag == "robot"

    joint_names = {j.get("name") for j in root.findall("joint")}
    assert "left_joint" in joint_names
    assert "right_joint" in joint_names

    link_names = {link.get("name") for link in root.findall("link")}
    assert "base_link" in link_names
    assert "left_wheel" in link_names
    assert "right_wheel" in link_names
    assert "lidar_link" in link_names


def test_real_hardware_urdf_uses_zlac_drive_plugin():
    root = _process("false")

    ros2_control = root.find("ros2_control")
    assert ros2_control is not None

    plugin = ros2_control.find("hardware/plugin")
    assert plugin is not None
    assert plugin.text.strip() == "zlac_drive/ZlacSystemHardware"

    joint_names = {
        j.get("name") for j in ros2_control.findall("joint")
    }
    assert joint_names == {"left_joint", "right_joint"}

    for joint in ros2_control.findall("joint"):
        command_interfaces = {
            c.get("name") for c in joint.findall("command_interface")
        }
        state_interfaces = {
            s.get("name") for s in joint.findall("state_interface")
        }
        assert command_interfaces == {"velocity"}
        assert state_interfaces == {"position", "velocity"}


def test_simulation_urdf_uses_gazebo_hardware_not_zlac_drive():
    root = _process("true")

    ros2_control = root.find("ros2_control")
    assert ros2_control is not None

    plugin = ros2_control.find("hardware/plugin")
    assert plugin is not None
    # Simulation must use Gazebo hardware, never the real ZLAC driver.
    assert plugin.text.strip() != "zlac_drive/ZlacSystemHardware"
    assert plugin.text.strip() == "gazebo_ros2_control/GazeboSystem"

    gazebo_plugin = root.find("gazebo/plugin")
    assert gazebo_plugin is not None
    assert gazebo_plugin.get("filename") == "libgazebo_ros2_control.so"

    lidar_sensor = root.find("gazebo[@reference='lidar_link']/sensor")
    assert lidar_sensor is not None
    assert lidar_sensor.get("type") == "ray"
    lidar_plugin = lidar_sensor.find("plugin")
    assert lidar_plugin is not None
    assert lidar_plugin.get("filename") == "libgazebo_ros_ray_sensor.so"

    horizontal_scan = lidar_sensor.find("ray/scan/horizontal")
    assert horizontal_scan is not None
    assert horizontal_scan.findtext("samples") == "180"
    assert horizontal_scan.findtext("min_angle") == "-1.57079632679"
    assert horizontal_scan.findtext("max_angle") == "1.57079632679"
