#!/usr/bin/env python3
"""
BumbleB AMR Location Manager Node
Tracks robot pose, maintains warehouse locations, and dispatches Nav2 navigation goals.
"""

import os
from pathlib import Path
import re
import json
import math
import time
import yaml

import rclpy
from rclpy.executors import ExternalShutdownException
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.duration import Duration
from rclpy.time import Time
import tf2_ros

from geometry_msgs.msg import PoseStamped, PoseWithCovarianceStamped
from std_msgs.msg import String
from std_srvs.srv import Trigger
from bumbleb_bot.srv import NavigateToPose as NavigateToPoseService, SetInitialPose
from nav2_msgs.action import NavigateToPose


def euler_from_quaternion(x, y, z, w):
    t0 = +2.0 * (w * x + y * z)
    t1 = +1.0 - 2.0 * (x * x + y * y)
    roll_x = math.atan2(t0, t1)

    t2 = +2.0 * (w * y - z * x)
    t2 = +1.0 if t2 > +1.0 else t2
    t2 = -1.0 if t2 < -1.0 else t2
    pitch_y = math.asin(t2)

    t3 = +2.0 * (w * z + x * y)
    t4 = +1.0 - 2.0 * (y * y + z * z)
    yaw_z = math.atan2(t3, t4)

    return roll_x, pitch_y, yaw_z


def quaternion_from_euler(roll, pitch, yaw):
    cy = math.cos(yaw * 0.5)
    sy = math.sin(yaw * 0.5)
    cp = math.cos(pitch * 0.5)
    sp = math.sin(pitch * 0.5)
    cr = math.cos(roll * 0.5)
    sr = math.sin(roll * 0.5)

    q = [0.0, 0.0, 0.0, 1.0]
    q[0] = sr * cp * cy - cr * sp * sy
    q[1] = cr * sp * cy + sr * cp * sy
    q[2] = cr * cp * sy - sr * sp * cy
    q[3] = cr * cp * cy + sr * sp * sy
    return q


class LocationStorage:
    KEY_REGEX = re.compile(r'[^a-zA-Z0-9_]')

    def __init__(self, filepath: str = str(Path.home() / "bumbleb_data" / "locations" / "warehouse_locations.yaml")):
        self.filepath = filepath
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
        if not os.path.exists(self.filepath):
            self._write_yaml({"locations": {}})

    def _normalize_key(self, name: str) -> str:
        s = name.strip().lower().replace(' ', '_')
        return self.KEY_REGEX.sub('', s)

    def _read_yaml(self) -> dict:
        try:
            with open(self.filepath, 'r') as f:
                data = yaml.safe_load(f)
                if isinstance(data, dict) and "locations" in data and isinstance(data["locations"], dict):
                    return data
        except Exception:
            pass
        return {"locations": {}}

    def _write_yaml(self, data: dict) -> bool:
        try:
            with open(self.filepath, 'w') as f:
                yaml.dump(data, f, default_flow_style=False, sort_keys=False)
            return True
        except Exception:
            return False

    def list_locations(self) -> list[dict]:
        data = self._read_yaml()
        result = []
        for key, loc in data.get("locations", {}).items():
            entry = dict(loc)
            entry["id"] = key
            result.append(entry)
        return result

    def get_location(self, name_or_id: str) -> dict | None:
        data = self._read_yaml().get("locations", {})
        key = self._normalize_key(name_or_id)
        if key in data:
            entry = dict(data[key])
            entry["id"] = key
            return entry
        for k, v in data.items():
            if v.get("name", "").lower() == name_or_id.lower():
                entry = dict(v)
                entry["id"] = k
                return entry
        return None

    def save_location(self, name: str, loc_type: str, x: float, y: float, yaw: float, map_name: str = "") -> tuple[bool, str]:
        if not name or not name.strip():
            return False, "Location name cannot be empty"

        key = self._normalize_key(name)
        data = self._read_yaml()
        if "locations" not in data or not isinstance(data["locations"], dict):
            data["locations"] = {}

        data["locations"][key] = {
            "name": name.strip(),
            "type": loc_type.strip() or "shelf",
            "x": round(float(x), 3),
            "y": round(float(y), 3),
            "yaw": round(float(yaw), 4),
            "map": map_name.strip() if map_name else "warehouse_main"
        }

        if self._write_yaml(data):
            return True, f"Location '{name}' saved successfully"
        return False, "Failed to write locations file"

    def delete_location(self, name_or_id: str) -> tuple[bool, str]:
        key = self._normalize_key(name_or_id)
        data = self._read_yaml()
        locations = data.get("locations", {})

        target_key = None
        if key in locations:
            target_key = key
        else:
            for k, v in locations.items():
                if v.get("name", "").lower() == name_or_id.lower():
                    target_key = k
                    break

        if target_key:
            del locations[target_key]
            data["locations"] = locations
            if self._write_yaml(data):
                return True, f"Location '{name_or_id}' deleted"
            return False, "Failed to update locations file"
        return False, f"Location '{name_or_id}' not found"


class AMRLocationManager(Node):
    def __init__(self):
        super().__init__('amr_location_manager')

        for param_name, default_val in [
            ('use_sim_time', True),
            ('locations_file', str(Path.home() / 'bumbleb_data' / 'locations' / 'warehouse_locations.yaml')),
            ('map_frame', 'map'),
            ('odom_frame', 'odom'),
            ('base_frame', 'base_link'),
        ]:
            if not self.has_parameter(param_name):
                self.declare_parameter(param_name, default_val)

        filepath = self.get_parameter('locations_file').get_parameter_value().string_value
        self.map_frame = self.get_parameter('map_frame').get_parameter_value().string_value
        self.odom_frame = self.get_parameter('odom_frame').get_parameter_value().string_value
        self.base_frame = self.get_parameter('base_frame').get_parameter_value().string_value

        self.storage = LocationStorage(filepath=filepath)
        self.get_logger().info(f"BumbleB Location Manager initialized with {filepath}")

        # TF Buffer
        self.tf_buffer = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buffer, self)

        # Pose state
        self.current_x = 0.0
        self.current_y = 0.0
        self.current_yaw = 0.0
        self.pose_valid = False
        self.active_map = "warehouse_main"

        # Action Client for Nav2 NavigateToPose
        self.nav_action_client = ActionClient(self, NavigateToPose, '/navigate_to_pose')
        self.current_goal_handle = None
        self.nav_status = "IDLE"
        self.nav_distance_remaining = 0.0
        self.active_target_name = ""

        # Subscriptions
        self.sub_amcl = self.create_subscription(PoseWithCovarianceStamped, '/amcl_pose', self._amcl_cb, 10)
        self.sub_goal_pose = self.create_subscription(PoseStamped, '/goal_pose', self._external_goal_pose_cb, 10)
        self.sub_cmd = self.create_subscription(String, '/amr/location_command', self._command_cb, 10)
        self.sub_system_cmd = self.create_subscription(String, '/amr/command', self._system_command_cb, 10)
        self.sub_state = self.create_subscription(String, '/amr/system_state', self._system_state_cb, 10)

        # Publishers
        self.locations_pub = self.create_publisher(String, '/amr/locations', 10)
        self.pose_pub = self.create_publisher(PoseStamped, '/amr/robot_pose', 10)
        self.nav_status_pub = self.create_publisher(String, '/amr/navigation_status', 10)
        self.initial_pose_pub = self.create_publisher(PoseWithCovarianceStamped, '/initialpose', 10)

        # Services
        self.srv_cancel_nav = self.create_service(Trigger, '/amr/cancel_navigation', self._handle_cancel_nav)
        self.srv_navigate_to_pose = self.create_service(
            NavigateToPoseService, '/amr/navigate_to_pose', self._handle_navigate_to_pose)
        self.srv_initial_pose = self.create_service(
            SetInitialPose, '/amr/set_initial_pose', self._handle_initial_pose)

        # Timers
        # Publish continuously enough for the dashboard and teleoperation UI
        # to track odom motion between lidar/AMCL updates. TF2 still supplies
        # the authoritative map->base_link transform.
        self.pose_timer = self.create_timer(1.0 / 30.0, self._update_pose_loop)
        self.broadcast_timer = self.create_timer(1.0, self._broadcast_locations)
        self.nav_pub_timer = self.create_timer(0.2, self._publish_nav_status)

    def _external_goal_pose_cb(self, msg: PoseStamped):
        x = msg.pose.position.x
        y = msg.pose.position.y
        q = msg.pose.orientation
        _, _, yaw = euler_from_quaternion(q.x, q.y, q.z, q.w)
        # The dashboard publishes map-click goals on /goal_pose. Forward the
        # pose to Nav2 instead of only changing the UI status.
        self._dispatch_pose_goal(x, y, yaw, f"({x:.2f}, {y:.2f})")

    def _system_state_cb(self, msg: String):
        try:
            data = json.loads(msg.data)
            self.active_map = data.get("active_map", "warehouse_main")
            if data.get("is_emergency_stop", False) and self.current_goal_handle:
                self.get_logger().warn("Emergency stop active, cancelling current Nav2 goal")
                self.current_goal_handle.cancel_goal_async()
                self.nav_status = "CANCELED"
        except Exception:
            pass

    def _amcl_cb(self, msg: PoseWithCovarianceStamped):
        self.current_x = msg.pose.pose.position.x
        self.current_y = msg.pose.pose.position.y
        _, _, yaw = euler_from_quaternion(
            msg.pose.pose.orientation.x,
            msg.pose.pose.orientation.y,
            msg.pose.pose.orientation.z,
            msg.pose.pose.orientation.w
        )
        self.current_yaw = yaw
        self.pose_valid = True

    def _update_pose_loop(self):
        # Prefer the localized map pose. During READY/teleoperation there may
        # be no SLAM or AMCL node running yet, so map->base_link does not
        # exist. In that state odom->base_link is the correct live-motion
        # source; without this fallback the dashboard remains frozen while
        # the physical robot is moving.
        pose_frame = self.map_frame
        try:
            transform = self.tf_buffer.lookup_transform(
                self.map_frame,
                self.base_frame,
                Time(),
                timeout=Duration(seconds=0.05)
            )
        except Exception:
            try:
                transform = self.tf_buffer.lookup_transform(
                    self.odom_frame,
                    self.base_frame,
                    Time(),
                    timeout=Duration(seconds=0.05)
                )
                pose_frame = self.odom_frame
            except Exception:
                # Neither localization nor odometry TF is available yet.
                return

        self.current_x = transform.transform.translation.x
        self.current_y = transform.transform.translation.y
        _, _, yaw = euler_from_quaternion(
            transform.transform.rotation.x,
            transform.transform.rotation.y,
            transform.transform.rotation.z,
            transform.transform.rotation.w
        )
        self.current_yaw = yaw
        self.pose_valid = True

        p_msg = PoseStamped()
        # Preserve the TF sample time. Stamping this with the publication time
        # makes a delayed WebSocket consumer treat an old pose as current.
        p_msg.header.stamp = transform.header.stamp
        p_msg.header.frame_id = pose_frame
        p_msg.pose.position.x = self.current_x
        p_msg.pose.position.y = self.current_y
        p_msg.pose.position.z = 0.0
        p_msg.pose.orientation = transform.transform.rotation
        self.pose_pub.publish(p_msg)

    def _broadcast_locations(self):
        locs = self.storage.list_locations()
        msg = String()
        msg.data = json.dumps(locs)
        self.locations_pub.publish(msg)

    def _publish_nav_status(self):
        status_data = {
            "status": self.nav_status,
            "target": self.active_target_name,
            "distance_remaining": round(self.nav_distance_remaining, 2),
            "robot_pose": {
                "x": round(self.current_x, 3),
                "y": round(self.current_y, 3),
                "yaw": round(self.current_yaw, 4),
                "yaw_deg": round(math.degrees(self.current_yaw), 1),
                "valid": self.pose_valid
            },
            "timestamp": time.time()
        }
        msg = String()
        msg.data = json.dumps(status_data)
        self.nav_status_pub.publish(msg)

    def _command_cb(self, msg: String):
        try:
            cmd = json.loads(msg.data)
            action = cmd.get("action", "").lower()
            if action == "save_location":
                name = cmd.get("name", "")
                loc_type = cmd.get("type", "shelf")
                use_current = cmd.get("use_current_pose", True)
                if use_current:
                    x = self.current_x
                    y = self.current_y
                    yaw = self.current_yaw
                else:
                    x = float(cmd.get("x", 0.0))
                    y = float(cmd.get("y", 0.0))
                    yaw = float(cmd.get("yaw", 0.0))
                self.storage.save_location(name, loc_type, x, y, yaw, self.active_map)
                self._broadcast_locations()

            elif action == "delete_location":
                name = cmd.get("name", "")
                self.storage.delete_location(name)
                self._broadcast_locations()

            elif action == "navigate_to_location":
                name = cmd.get("name", "")
                self._dispatch_goal(name)

            elif action == "cancel_navigation":
                self._cancel_goal()
        except Exception as e:
            self.get_logger().error(f"Error handling location command: {e}")

    def _system_command_cb(self, msg: String):
        """Handle dashboard commands that are not location-file operations."""
        try:
            cmd = json.loads(msg.data)
            action = cmd.get("action", "").lower()
            if action == "navigate_to_pose":
                self._dispatch_pose_goal(float(cmd.get("x", 0.0)), float(cmd.get("y", 0.0)),
                                         float(cmd.get("yaw", 0.0)), "dashboard goal")
            elif action == "cancel_navigation":
                self._cancel_goal()
            elif action == "set_initial_pose":
                self._publish_initial_pose(float(cmd.get("x", 0.0)), float(cmd.get("y", 0.0)),
                                           float(cmd.get("yaw", 0.0)))
        except Exception as exc:
            self.get_logger().error(f"Error handling dashboard navigation command: {exc}")

    def _handle_cancel_nav(self, request, response):
        ok, msg = self._cancel_goal()
        response.success = ok
        response.message = msg
        return response

    def _handle_navigate_to_pose(self, request, response):
        response.success, response.message = self._dispatch_pose_goal(
            request.x, request.y, request.yaw, "dashboard goal")
        return response

    def _handle_initial_pose(self, request, response):
        self._publish_initial_pose(request.x, request.y, request.yaw)
        response.success = True
        response.message = "Initial AMCL pose published."
        return response

    def _dispatch_goal(self, name_or_id: str) -> tuple[bool, str]:
        loc = self.storage.get_location(name_or_id)
        if not loc:
            return False, f"Location '{name_or_id}' not found"

        if not self.nav_action_client.wait_for_server(timeout_sec=2.0):
            return False, "Nav2 action server /navigate_to_pose unavailable. Verify Navigation mode is running."

        return self._dispatch_pose_goal(float(loc["x"]), float(loc["y"]), float(loc["yaw"]), loc["name"])

    def _dispatch_pose_goal(self, x: float, y: float, yaw: float, target_name: str) -> tuple[bool, str]:
        if not self.nav_action_client.wait_for_server(timeout_sec=2.0):
            return False, "Nav2 action server /navigate_to_pose unavailable. Start Navigation mode first."
        goal_msg = NavigateToPose.Goal()
        goal_msg.pose.header.frame_id = self.map_frame
        goal_msg.pose.header.stamp = self.get_clock().now().to_msg()
        goal_msg.pose.pose.position.x = x
        goal_msg.pose.pose.position.y = y
        goal_msg.pose.pose.position.z = 0.0

        q = quaternion_from_euler(0.0, 0.0, yaw)
        goal_msg.pose.pose.orientation.x = q[0]
        goal_msg.pose.pose.orientation.y = q[1]
        goal_msg.pose.pose.orientation.z = q[2]
        goal_msg.pose.pose.orientation.w = q[3]

        self.get_logger().info(f"Dispatching goal to '{target_name}' at ({x}, {y})")
        self.nav_status = "PLANNING"
        self.active_target_name = target_name

        send_future = self.nav_action_client.send_goal_async(goal_msg, feedback_callback=self._nav_feedback_cb)
        send_future.add_done_callback(self._goal_response_cb)
        return True, f"Goal dispatched to '{target_name}'"

    def _publish_initial_pose(self, x: float, y: float, yaw: float):
        q = quaternion_from_euler(0.0, 0.0, yaw)
        # AMCL can miss one message while its lifecycle node is becoming
        # active. Publish a short burst with fresh, slightly-past timestamps
        # so the operator's initial pose is reliably applied.
        for _ in range(5):
            msg = PoseWithCovarianceStamped()
            msg.header.stamp = (self.get_clock().now() - Duration(seconds=0.2)).to_msg()
            msg.header.frame_id = self.map_frame
            msg.pose.pose.position.x = x
            msg.pose.pose.position.y = y
            msg.pose.pose.orientation.x, msg.pose.pose.orientation.y = q[0], q[1]
            msg.pose.pose.orientation.z, msg.pose.pose.orientation.w = q[2], q[3]
            msg.pose.covariance[0] = 0.25
            msg.pose.covariance[7] = 0.25
            msg.pose.covariance[35] = 0.068
            self.initial_pose_pub.publish(msg)
            time.sleep(0.1)
        self.get_logger().info(f"Published initial pose ({x}, {y}, {yaw})")

    def _goal_response_cb(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().warn("Nav2 rejected the navigation goal")
            self.nav_status = "FAILED"
            self.active_target_name = ""
            return

        self.get_logger().info("Nav2 accepted navigation goal")
        self.current_goal_handle = goal_handle
        self.nav_status = "NAVIGATING"

        res_future = goal_handle.get_result_async()
        res_future.add_done_callback(self._goal_result_cb)

    def _nav_feedback_cb(self, feedback_msg):
        feedback = feedback_msg.feedback
        self.nav_distance_remaining = feedback.distance_remaining
        self.nav_status = "NAVIGATING"

    def _goal_result_cb(self, future):
        result = future.result()
        status = result.status
        self.current_goal_handle = None
        if status == 4:
            self.get_logger().info("Navigation goal succeeded!")
            self.nav_status = "SUCCEEDED"
        elif status == 5:
            self.get_logger().warn("Navigation goal canceled")
            self.nav_status = "CANCELED"
        else:
            self.get_logger().warn(f"Navigation goal finished with status {status}")
            self.nav_status = "FAILED"
        self.active_target_name = ""

    def _cancel_goal(self) -> tuple[bool, str]:
        if self.current_goal_handle is not None:
            self.current_goal_handle.cancel_goal_async()
            self.nav_status = "CANCELED"
            self.active_target_name = ""
            return True, "Navigation goal cancellation requested"
        return True, "No active goal to cancel"


def main(args=None):
    rclpy.init(args=args)
    node = AMRLocationManager()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
