#!/usr/bin/env python3
"""
BumbleB AMR System Manager Node
Coordinates the state machine, health monitoring, process supervision, map management,
and emergency stop safety protocols for the BumbleB autonomous mobile robot.
"""

import os
import re
import json
import time
import signal
import subprocess
from enum import Enum

import rclpy
from rclpy.node import Node
from rclpy.duration import Duration
from rclpy.time import Time
import tf2_ros

from std_msgs.msg import String
from std_srvs.srv import Trigger
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan, JointState, BatteryState
from nav_msgs.msg import Odometry, OccupancyGrid


class AMRState(Enum):
    OFF = "OFF"
    BOOTING = "BOOTING"
    READY = "READY"
    MAPPING = "MAPPING"
    MAP_SAVING = "MAP_SAVING"
    LOCALIZATION = "LOCALIZATION"
    NAVIGATION = "NAVIGATION"
    ERROR = "ERROR"
    EMERGENCY_STOP = "EMERGENCY_STOP"


class HealthStatus:
    OK = "OK"
    WARNING = "WARNING"
    ERROR = "ERROR"


class AMRStateMachine:
    VALID_TRANSITIONS = {
        AMRState.OFF: [AMRState.BOOTING, AMRState.READY, AMRState.MAPPING, AMRState.LOCALIZATION, AMRState.EMERGENCY_STOP],
        AMRState.BOOTING: [AMRState.READY, AMRState.ERROR, AMRState.EMERGENCY_STOP, AMRState.OFF],
        AMRState.READY: [AMRState.MAPPING, AMRState.LOCALIZATION, AMRState.NAVIGATION, AMRState.OFF, AMRState.ERROR, AMRState.EMERGENCY_STOP],
        AMRState.MAPPING: [AMRState.MAP_SAVING, AMRState.READY, AMRState.OFF, AMRState.ERROR, AMRState.EMERGENCY_STOP],
        AMRState.MAP_SAVING: [AMRState.MAPPING, AMRState.READY, AMRState.OFF, AMRState.ERROR, AMRState.EMERGENCY_STOP],
        AMRState.LOCALIZATION: [AMRState.NAVIGATION, AMRState.MAPPING, AMRState.READY, AMRState.OFF, AMRState.ERROR, AMRState.EMERGENCY_STOP],
        AMRState.NAVIGATION: [AMRState.LOCALIZATION, AMRState.MAPPING, AMRState.READY, AMRState.OFF, AMRState.ERROR, AMRState.EMERGENCY_STOP],
        AMRState.ERROR: [AMRState.READY, AMRState.OFF, AMRState.EMERGENCY_STOP],
        AMRState.EMERGENCY_STOP: [AMRState.READY, AMRState.OFF],
    }

    def __init__(self, initial_state: AMRState = AMRState.OFF):
        self._current_state = initial_state
        self._previous_state = initial_state
        self._error_reason = ""
        self._active_map = ""

    @property
    def current_state(self) -> AMRState:
        return self._current_state

    @property
    def previous_state(self) -> AMRState:
        return self._previous_state

    @property
    def error_reason(self) -> str:
        return self._error_reason

    @property
    def active_map(self) -> str:
        return self._active_map

    @active_map.setter
    def active_map(self, map_name: str):
        self._active_map = map_name

    def can_transition_to(self, new_state: AMRState) -> bool:
        return new_state in self.VALID_TRANSITIONS.get(self._current_state, [])

    def transition_to(self, new_state: AMRState, reason: str = "") -> tuple[bool, str]:
        if new_state == self._current_state:
            return True, f"Already in state {self._current_state.value}"

        if not self.can_transition_to(new_state):
            msg = (f"Invalid transition from {self._current_state.value} to {new_state.value}. "
                   f"Allowed targets: {[s.value for s in self.VALID_TRANSITIONS.get(self._current_state, [])]}")
            return False, msg

        self._previous_state = self._current_state
        self._current_state = new_state
        if new_state == AMRState.ERROR:
            self._error_reason = reason
        elif new_state in (AMRState.READY, AMRState.OFF):
            self._error_reason = ""

        return True, f"Transitioned from {self._previous_state.value} to {self._current_state.value}"

    def trigger_emergency_stop(self, reason: str = "Operator Triggered Emergency Stop") -> tuple[bool, str]:
        self._previous_state = self._current_state
        self._current_state = AMRState.EMERGENCY_STOP
        self._error_reason = reason
        return True, "Emergency Stop Activated"

    def reset_emergency_stop(self) -> tuple[bool, str]:
        if self._current_state != AMRState.EMERGENCY_STOP:
            return False, "Not in EMERGENCY_STOP state"
        self._previous_state = AMRState.EMERGENCY_STOP
        self._current_state = AMRState.READY
        self._error_reason = ""
        return True, "Emergency Stop Reset. System is READY"


class AMRProcessSupervisor:
    def __init__(self, node: Node, use_sim_time: bool = True):
        self.node = node
        self.use_sim_time = use_sim_time
        self.processes: dict[str, subprocess.Popen] = {}

    def is_running(self, name: str) -> bool:
        proc = self.processes.get(name)
        if proc is None:
            return False
        return proc.poll() is None

    def start_slam(self) -> tuple[bool, str]:
        if self.is_running("slam"):
            return True, "SLAM Toolbox is already running"

        self.stop_navigation()
        self.stop_localization()

        cmd = [
            "ros2", "launch", "bumbleb_bot", "slam.launch.py",
            f"use_sim_time:={'true' if self.use_sim_time else 'false'}"
        ]
        self.node.get_logger().info(f"Starting SLAM: {' '.join(cmd)}")
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid
            )
            self.processes["slam"] = proc
            return True, "SLAM Toolbox process launched"
        except Exception as e:
            return False, f"Failed to start SLAM: {str(e)}"

    def stop_slam(self) -> tuple[bool, str]:
        return self._stop_process("slam")

    def start_localization(self, map_yaml_path: str) -> tuple[bool, str]:
        if not os.path.exists(map_yaml_path):
            return False, f"Map file does not exist: {map_yaml_path}"

        self.stop_slam()
        if self.is_running("localization"):
            self.stop_localization()

        cmd = [
            "ros2", "launch", "bumbleb_bot", "localization.launch.py",
            f"map:={map_yaml_path}",
            f"use_sim_time:={'true' if self.use_sim_time else 'false'}"
        ]
        self.node.get_logger().info(f"Starting Localization: {' '.join(cmd)}")
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid
            )
            self.processes["localization"] = proc
            return True, "Localization (Map Server + AMCL) process launched"
        except Exception as e:
            return False, f"Failed to start localization: {str(e)}"

    def stop_localization(self) -> tuple[bool, str]:
        self.stop_navigation()
        return self._stop_process("localization")

    def start_navigation(self) -> tuple[bool, str]:
        if self.is_running("navigation"):
            return True, "Nav2 navigation stack is already running"

        if not self.is_running("localization"):
            return False, "Cannot start navigation without active localization"

        cmd = [
            "ros2", "launch", "bumbleb_bot", "navigation.launch.py",
            f"use_sim_time:={'true' if self.use_sim_time else 'false'}"
        ]
        self.node.get_logger().info(f"Starting Navigation: {' '.join(cmd)}")
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid
            )
            self.processes["navigation"] = proc
            return True, "Nav2 navigation stack process launched"
        except Exception as e:
            return False, f"Failed to start navigation: {str(e)}"

    def stop_navigation(self) -> tuple[bool, str]:
        return self._stop_process("navigation")

    def stop_all(self):
        for name in list(self.processes.keys()):
            self._stop_process(name)

    def _stop_process(self, name: str) -> tuple[bool, str]:
        proc = self.processes.get(name)
        if proc is None:
            return True, f"Process {name} not running"

        if proc.poll() is not None:
            del self.processes[name]
            return True, f"Process {name} already terminated"

        self.node.get_logger().info(f"Stopping process {name} (PID {proc.pid})")
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGINT)
            for _ in range(30):
                if proc.poll() is not None:
                    break
                time.sleep(0.1)

            if proc.poll() is None:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                time.sleep(0.5)

            if proc.poll() is None:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        except Exception as e:
            self.node.get_logger().warn(f"Error terminating {name}: {e}")

        if name in self.processes:
            del self.processes[name]
        return True, f"Process {name} stopped successfully"


class AMRSystemManager(Node):
    VALID_MAP_PATTERN = re.compile(r'^[a-zA-Z0-9_\-]+$')

    def __init__(self):
        super().__init__('amr_system_manager')

        for param_name, default_val in [
            ('use_sim_time', True),
            ('maps_dir', '/home/dk/bumbleb_ws/maps'),
            ('auto_ready', True),
        ]:
            if not self.has_parameter(param_name):
                self.declare_parameter(param_name, default_val)

        self.use_sim_time = self.get_parameter('use_sim_time').get_parameter_value().bool_value
        self.maps_dir = self.get_parameter('maps_dir').get_parameter_value().string_value
        auto_ready = self.get_parameter('auto_ready').get_parameter_value().bool_value

        os.makedirs(self.maps_dir, exist_ok=True)
        self.pkg_maps_dir = "/home/dk/bumbleb_ws/src/bumbleb_bot/maps"
        os.makedirs(self.pkg_maps_dir, exist_ok=True)

        self.get_logger().info(f"AMR System Manager starting (use_sim_time={self.use_sim_time}, maps_dir={self.maps_dir})")

        # TF Buffer & Listener
        self.tf_buffer = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buffer, self)

        # Components
        self.state_machine = AMRStateMachine(AMRState.OFF)
        self.supervisor = AMRProcessSupervisor(self, use_sim_time=self.use_sim_time)

        # Telemetry tracking
        self.last_scan_time = 0.0
        self.last_odom_time = 0.0
        self.last_joint_states_time = 0.0
        self.last_map_time = 0.0
        self.map_received = False
        self.battery_pct = 95.0
        self.battery_voltage = 25.4

        # Subscriptions
        self.sub_scan = self.create_subscription(LaserScan, "/scan", self._scan_cb, rclpy.qos.qos_profile_sensor_data)
        self.sub_odom = self.create_subscription(Odometry, "/odom", self._odom_cb, 10)
        self.sub_joints = self.create_subscription(JointState, "/joint_states", self._joint_cb, 10)
        self.sub_map = self.create_subscription(OccupancyGrid, "/map", self._map_cb, rclpy.qos.qos_profile_sensor_data)
        self.cmd_sub = self.create_subscription(String, '/amr/command', self._command_callback, 10)

        # Publishers
        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.state_pub = self.create_publisher(String, '/amr/system_state', 10)
        self.health_pub = self.create_publisher(String, '/amr/system_health', 10)
        self.maps_pub = self.create_publisher(String, '/amr/maps', 10)
        self.battery_pub = self.create_publisher(BatteryState, '/amr/battery_state', 10)

        # Standard Trigger Services for ROS and Dashboard
        self.srv_start_robot = self.create_service(Trigger, '/amr/start_robot', self._srv_start_robot)
        self.srv_stop_robot = self.create_service(Trigger, '/amr/stop_robot', self._srv_stop_robot)
        self.srv_start_mapping = self.create_service(Trigger, '/amr/start_mapping', self._srv_start_mapping)
        self.srv_stop_mapping = self.create_service(Trigger, '/amr/stop_mapping', self._srv_stop_mapping)
        self.srv_start_localization = self.create_service(Trigger, '/amr/start_localization', self._srv_start_localization)
        self.srv_stop_localization = self.create_service(Trigger, '/amr/stop_localization', self._srv_stop_localization)
        self.srv_start_navigation = self.create_service(Trigger, '/amr/start_navigation', self._srv_start_navigation)
        self.srv_stop_navigation = self.create_service(Trigger, '/amr/stop_navigation', self._srv_stop_navigation)
        self.srv_estop = self.create_service(Trigger, '/amr/emergency_stop', self._srv_emergency_stop)
        self.srv_reset_estop = self.create_service(Trigger, '/amr/reset_emergency_stop', self._srv_reset_emergency_stop)
        self.srv_system_reset = self.create_service(Trigger, '/amr/system_reset', self._srv_system_reset)

        # Timers
        self.state_timer = self.create_timer(0.2, self._publish_state)
        self.health_timer = self.create_timer(0.5, self._publish_health)
        self.maps_timer = self.create_timer(2.0, self._publish_maps)
        self.battery_timer = self.create_timer(1.0, self._publish_battery)
        self.estop_watchdog = self.create_timer(0.05, self._estop_safety_loop)

        # Initialize to READY
        if auto_ready:
            self.state_machine.transition_to(AMRState.BOOTING)
            self.state_machine.transition_to(AMRState.READY)
            self.get_logger().info("System auto-transitioned to READY")

    def _scan_cb(self, msg: LaserScan):
        self.last_scan_time = time.time()

    def _odom_cb(self, msg: Odometry):
        self.last_odom_time = time.time()

    def _joint_cb(self, msg: JointState):
        self.last_joint_states_time = time.time()

    def _map_cb(self, msg: OccupancyGrid):
        self.last_map_time = time.time()
        self.map_received = True

    def _estop_safety_loop(self):
        if self.state_machine.current_state == AMRState.EMERGENCY_STOP:
            self.cmd_vel_pub.publish(Twist())

    def check_tf(self, target_frame: str, source_frame: str) -> tuple[bool, str]:
        try:
            can_tf = self.tf_buffer.can_transform(target_frame, source_frame, Time(), timeout=Duration(seconds=0.1))
            if can_tf:
                return True, f"Transform {source_frame} -> {target_frame} OK"
            return False, f"Transform {source_frame} -> {target_frame} unavailable in TF tree"
        except Exception as e:
            return False, f"Transform {source_frame} -> {target_frame} error: {str(e)}"

    def _validate_preflight_mapping(self) -> tuple[bool, str]:
        now = time.time()
        if self.last_scan_time == 0 or (now - self.last_scan_time) > 2.0:
            return False, "Pre-flight failed: LiDAR topic /scan is not actively publishing"
        if self.last_odom_time == 0 or (now - self.last_odom_time) > 2.0:
            return False, "Pre-flight failed: Odometry topic /odom is not actively publishing"
        ok_tf, tf_msg = self.check_tf("odom", "base_link")
        if not ok_tf:
            return False, f"Pre-flight failed: {tf_msg}"
        ok_lidar, lidar_msg = self.check_tf("base_link", "lidar_link")
        if not ok_lidar:
            return False, f"Pre-flight failed: {lidar_msg}"
        return True, "All mapping prerequisites satisfied."

    def list_maps(self) -> list[str]:
        maps = set()
        for directory in [self.maps_dir, self.pkg_maps_dir]:
            if os.path.exists(directory):
                for f in os.listdir(directory):
                    if f.endswith('.yaml') and not f.startswith('.'):
                        maps.add(f[:-5])
        return sorted(list(maps))

    def get_map_path(self, map_name: str) -> str | None:
        name = map_name.strip()
        p1 = os.path.join(self.maps_dir, f"{name}.yaml")
        if os.path.exists(p1):
            return p1
        p2 = os.path.join(self.pkg_maps_dir, f"{name}.yaml")
        if os.path.exists(p2):
            return p2
        return None

    def save_map(self, map_name: str) -> tuple[bool, str]:
        name = map_name.strip()
        if not name or not self.VALID_MAP_PATTERN.match(name):
            return False, "Invalid map name. Only letters, numbers, underscores, and hyphens are allowed."

        target_base = os.path.join(self.maps_dir, name)
        self.get_logger().info(f"Saving map to target: {target_base}")
        try:
            cmd = [
                "ros2", "run", "nav2_map_server", "map_saver_cli",
                "-f", target_base,
                "--ros-args", "-p", f"use_sim_time:={str(self.use_sim_time).lower()}",
                "-p", "save_map_timeout:=10.0"
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if proc.returncode == 0:
                pkg_target = os.path.join(self.pkg_maps_dir, f"{name}.yaml")
                if not os.path.exists(pkg_target) and os.path.exists(f"{target_base}.yaml"):
                    try:
                        import shutil
                        shutil.copy(f"{target_base}.yaml", f"{self.pkg_maps_dir}/")
                        if os.path.exists(f"{target_base}.pgm"):
                            shutil.copy(f"{target_base}.pgm", f"{self.pkg_maps_dir}/")
                    except Exception:
                        pass
                return True, f"Map '{name}' saved successfully"
            else:
                err_msg = proc.stderr.strip() or proc.stdout.strip() or "map_saver_cli returned non-zero code"
                return False, f"Map saving failed: {err_msg}"
        except subprocess.TimeoutExpired:
            return False, "Map saving timed out after 10s. Verify /map topic is active."
        except Exception as e:
            return False, f"Error saving map: {str(e)}"

    def _publish_state(self):
        data = {
            "state": self.state_machine.current_state.value,
            "previous_state": self.state_machine.previous_state.value,
            "error_reason": self.state_machine.error_reason,
            "active_map": self.state_machine.active_map,
            "is_emergency_stop": (self.state_machine.current_state == AMRState.EMERGENCY_STOP),
            "timestamp": time.time(),
            "active_processes": {
                "slam": self.supervisor.is_running("slam"),
                "localization": self.supervisor.is_running("localization"),
                "navigation": self.supervisor.is_running("navigation")
            }
        }
        msg = String()
        msg.data = json.dumps(data)
        self.state_pub.publish(msg)

    def _publish_health(self):
        now = time.time()
        components = {}

        # LiDAR
        lidar_dt = now - self.last_scan_time if self.last_scan_time > 0 else 999.0
        components["lidar"] = {
            "status": HealthStatus.OK if lidar_dt < 1.5 else (HealthStatus.WARNING if lidar_dt < 5.0 else HealthStatus.ERROR),
            "message": "LiDAR publishing normally (~10Hz)" if lidar_dt < 1.5 else f"Delayed ({lidar_dt:.1f}s ago)",
            "last_seen_sec": round(lidar_dt, 2)
        }

        # Odometry
        odom_dt = now - self.last_odom_time if self.last_odom_time > 0 else 999.0
        components["odometry"] = {
            "status": HealthStatus.OK if odom_dt < 1.0 else (HealthStatus.WARNING if odom_dt < 4.0 else HealthStatus.ERROR),
            "message": "Odometry publishing normally" if odom_dt < 1.0 else f"Delayed ({odom_dt:.1f}s ago)",
            "last_seen_sec": round(odom_dt, 2)
        }

        # Drivetrain
        joints_dt = now - self.last_joint_states_time if self.last_joint_states_time > 0 else 999.0
        components["controller"] = {
            "status": HealthStatus.OK if joints_dt < 1.5 else HealthStatus.WARNING,
            "message": "Active joint states" if joints_dt < 1.5 else "Waiting for joint states",
            "last_seen_sec": round(joints_dt, 2)
        }

        # TF
        tf_odom_base, msg_odom_base = self.check_tf("odom", "base_link")
        tf_base_lidar, msg_base_lidar = self.check_tf("base_link", "lidar_link")
        components["tf"] = {
            "status": HealthStatus.OK if (tf_odom_base and tf_base_lidar) else HealthStatus.ERROR,
            "message": "Base TF tree valid" if (tf_odom_base and tf_base_lidar) else (msg_odom_base if not tf_odom_base else msg_base_lidar),
            "details": {"odom_to_base": tf_odom_base, "base_to_lidar": tf_base_lidar}
        }

        # Map
        map_dt = now - self.last_map_time if self.last_map_time > 0 else 999.0
        components["map"] = {
            "status": HealthStatus.OK if (self.map_received and map_dt < 5.0) else (
                HealthStatus.WARNING if self.state_machine.current_state in (AMRState.MAPPING, AMRState.LOCALIZATION) else HealthStatus.OK
            ),
            "message": "Occupancy grid available" if (self.map_received and map_dt < 5.0) else "Idle",
            "last_seen_sec": round(map_dt, 2) if self.map_received else -1
        }

        # Subsystems
        components["slam_toolbox"] = {
            "status": HealthStatus.OK if self.supervisor.is_running("slam") else HealthStatus.OK,
            "running": self.supervisor.is_running("slam"),
            "message": "Running" if self.supervisor.is_running("slam") else "Stopped"
        }
        components["map_server"] = {
            "status": HealthStatus.OK if self.supervisor.is_running("localization") else HealthStatus.OK,
            "running": self.supervisor.is_running("localization"),
            "message": "Running" if self.supervisor.is_running("localization") else "Stopped"
        }
        components["amcl"] = {
            "status": HealthStatus.OK if self.supervisor.is_running("localization") else HealthStatus.OK,
            "running": self.supervisor.is_running("localization"),
            "message": "Running" if self.supervisor.is_running("localization") else "Stopped"
        }
        components["nav2"] = {
            "status": HealthStatus.OK if self.supervisor.is_running("navigation") else HealthStatus.OK,
            "running": self.supervisor.is_running("navigation"),
            "message": "Ready" if self.supervisor.is_running("navigation") else "Stopped"
        }

        has_error = any(v.get("status") == HealthStatus.ERROR for k, v in components.items() if k in ("lidar", "odometry", "tf"))
        has_warn = any(v.get("status") == HealthStatus.WARNING for v in components.values())

        health_data = {
            "overall": HealthStatus.ERROR if has_error else (HealthStatus.WARNING if has_warn else HealthStatus.OK),
            "current_mode": self.state_machine.current_state.value,
            "components": components,
            "timestamp": now
        }
        msg = String()
        msg.data = json.dumps(health_data)
        self.health_pub.publish(msg)

    def _publish_maps(self):
        msg = String()
        msg.data = json.dumps(self.list_maps())
        self.maps_pub.publish(msg)

    def _publish_battery(self):
        if self.state_machine.current_state in (AMRState.MAPPING, AMRState.NAVIGATION):
            self.battery_pct = max(10.0, self.battery_pct - 0.01)
            self.battery_voltage = 22.0 + (self.battery_pct / 100.0) * 3.4
        b_msg = BatteryState()
        b_msg.percentage = float(self.battery_pct / 100.0)
        b_msg.voltage = float(self.battery_voltage)
        b_msg.current = -1.5 if self.state_machine.current_state == AMRState.NAVIGATION else -0.3
        b_msg.power_supply_status = BatteryState.POWER_SUPPLY_STATUS_DISCHARGING
        b_msg.power_supply_technology = BatteryState.POWER_SUPPLY_TECHNOLOGY_LION
        b_msg.present = True
        self.battery_pub.publish(b_msg)

    def _command_callback(self, msg: String):
        try:
            data = json.loads(msg.data)
            action = data.get("action", "").lower()
            self.get_logger().info(f"Executing JSON command: {action}")

            if action == "start_robot":
                self._srv_start_robot(Trigger.Request(), Trigger.Response())
            elif action == "stop_robot":
                self._srv_stop_robot(Trigger.Request(), Trigger.Response())
            elif action == "start_mapping":
                self._srv_start_mapping(Trigger.Request(), Trigger.Response())
            elif action == "stop_mapping":
                self._srv_stop_mapping(Trigger.Request(), Trigger.Response())
            elif action == "save_map":
                map_name = data.get("map_name", "warehouse_map")
                self.save_map(map_name)
            elif action == "load_map" or action == "set_mode" and data.get("mode") == "LOCALIZATION":
                map_name = data.get("map_name", "")
                self._switch_mode("LOCALIZATION", map_name)
            elif action == "start_localization":
                map_name = data.get("map_name", "")
                self._switch_mode("LOCALIZATION", map_name)
            elif action == "stop_localization":
                self._srv_stop_localization(Trigger.Request(), Trigger.Response())
            elif action == "start_navigation":
                self._switch_mode("NAVIGATION")
            elif action == "stop_navigation":
                self._srv_stop_navigation(Trigger.Request(), Trigger.Response())
            elif action == "emergency_stop":
                self._srv_emergency_stop(Trigger.Request(), Trigger.Response())
            elif action == "reset_emergency_stop":
                self._srv_reset_emergency_stop(Trigger.Request(), Trigger.Response())
            elif action == "system_reset":
                self._srv_system_reset(Trigger.Request(), Trigger.Response())
            elif action == "set_mode":
                mode = data.get("mode", "")
                map_name = data.get("map_name", "")
                self._switch_mode(mode, map_name)
        except Exception as e:
            self.get_logger().error(f"Error handling JSON command: {e}")

    def _switch_mode(self, mode: str, map_name: str = "") -> tuple[bool, str]:
        target = mode.upper()
        if self.state_machine.current_state == AMRState.EMERGENCY_STOP and target != "EMERGENCY_STOP":
            return False, "System in EMERGENCY_STOP. Call reset_emergency_stop first."

        if target == "READY":
            self.supervisor.stop_all()
            return self.state_machine.transition_to(AMRState.READY)

        elif target == "MAPPING":
            ok_pf, pf_msg = self._validate_preflight_mapping()
            if not ok_pf:
                return False, pf_msg
            ok, msg = self.state_machine.transition_to(AMRState.MAPPING)
            if not ok:
                return False, msg
            p_ok, p_msg = self.supervisor.start_slam()
            return p_ok, f"{msg}. {p_msg}"

        elif target == "LOCALIZATION":
            chosen_map = map_name or self.state_machine.active_map
            if not chosen_map:
                maps = self.list_maps()
                if maps:
                    chosen_map = maps[0]
                else:
                    return False, "No map specified and no maps found."
            map_path = self.get_map_path(chosen_map)
            if not map_path:
                return False, f"Map '{chosen_map}' not found."

            self.state_machine.active_map = chosen_map
            if self.state_machine.current_state == AMRState.MAPPING:
                self.supervisor.stop_slam()
                self.state_machine.transition_to(AMRState.READY)

            ok, msg = self.state_machine.transition_to(AMRState.LOCALIZATION)
            if not ok:
                return False, msg
            p_ok, p_msg = self.supervisor.start_localization(map_path)
            return p_ok, f"{msg}. Active map: {chosen_map}. {p_msg}"

        elif target == "NAVIGATION":
            if self.state_machine.current_state != AMRState.LOCALIZATION:
                s_ok, s_msg = self._switch_mode("LOCALIZATION", map_name)
                if not s_ok:
                    return False, f"Prerequisite localization failed: {s_msg}"
                time.sleep(1.0)
            ok, msg = self.state_machine.transition_to(AMRState.NAVIGATION)
            if not ok:
                return False, msg
            p_ok, p_msg = self.supervisor.start_navigation()
            return p_ok, f"{msg}. {p_msg}"

        elif target == "EMERGENCY_STOP":
            self.supervisor.stop_navigation()
            for _ in range(5):
                self.cmd_vel_pub.publish(Twist())
            return self.state_machine.trigger_emergency_stop()

        elif target == "OFF":
            self.supervisor.stop_all()
            self.cmd_vel_pub.publish(Twist())
            return self.state_machine.transition_to(AMRState.OFF)

        return False, f"Unknown mode {target}"

    def _srv_start_robot(self, request, response):
        if self.state_machine.current_state == AMRState.OFF:
            self.state_machine.transition_to(AMRState.BOOTING)
            ok, msg = self.state_machine.transition_to(AMRState.READY)
            response.success = ok
            response.message = "Robot booted and ready."
        else:
            response.success = True
            response.message = f"Robot is online (State: {self.state_machine.current_state.value})"
        return response

    def _srv_stop_robot(self, request, response):
        self.supervisor.stop_all()
        self.cmd_vel_pub.publish(Twist())
        ok, msg = self.state_machine.transition_to(AMRState.OFF)
        response.success = ok
        response.message = "Robot software state transitioned to OFF."
        return response

    def _srv_start_mapping(self, request, response):
        ok, msg = self._switch_mode("MAPPING")
        response.success = ok
        response.message = msg
        return response

    def _srv_stop_mapping(self, request, response):
        self.supervisor.stop_slam()
        ok, msg = self.state_machine.transition_to(AMRState.READY)
        response.success = ok
        response.message = "Mapping stopped. System is READY."
        return response

    def _srv_start_localization(self, request, response):
        ok, msg = self._switch_mode("LOCALIZATION")
        response.success = ok
        response.message = msg
        return response

    def _srv_stop_localization(self, request, response):
        self.supervisor.stop_localization()
        ok, msg = self.state_machine.transition_to(AMRState.READY)
        response.success = ok
        response.message = "Localization stopped. System is READY."
        return response

    def _srv_start_navigation(self, request, response):
        ok, msg = self._switch_mode("NAVIGATION")
        response.success = ok
        response.message = msg
        return response

    def _srv_stop_navigation(self, request, response):
        self.supervisor.stop_navigation()
        if self.state_machine.current_state == AMRState.NAVIGATION:
            self.state_machine.transition_to(AMRState.LOCALIZATION)
        response.success = True
        response.message = "Navigation stopped. Subsystem in LOCALIZATION."
        return response

    def _srv_emergency_stop(self, request, response):
        self.get_logger().warn("EMERGENCY STOP TRIGGERED!")
        ok, msg = self._switch_mode("EMERGENCY_STOP")
        response.success = ok
        response.message = msg
        return response

    def _srv_reset_emergency_stop(self, request, response):
        self.get_logger().info("Resetting emergency stop")
        ok, msg = self.state_machine.reset_emergency_stop()
        response.success = ok
        response.message = msg
        return response

    def _srv_system_reset(self, request, response):
        self.supervisor.stop_all()
        self.cmd_vel_pub.publish(Twist())
        self.state_machine.reset_emergency_stop()
        self.state_machine.transition_to(AMRState.READY)
        response.success = True
        response.message = "System fully reset to READY."
        return response


def main(args=None):
    rclpy.init(args=args)
    node = AMRSystemManager()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.supervisor.stop_all()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
