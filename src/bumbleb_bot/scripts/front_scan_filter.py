#!/usr/bin/env python3

"""Publish only the forward 180 degrees of a full LaserScan."""

import math

import rclpy
from rclpy.node import Node
from rclpy.qos import (
    QoSProfile,
    ReliabilityPolicy,
    DurabilityPolicy,
    qos_profile_sensor_data,
)
from sensor_msgs.msg import LaserScan


class FrontScanFilter(Node):
    """Crop a scan to angles in [-pi/2, pi/2] around the +X axis."""

    def __init__(self):
        super().__init__("front_scan_filter")
        self.subscription = self.create_subscription(
            LaserScan,
            "scan_raw",
            self._scan_callback,
            qos_profile_sensor_data,
        )
        self.publisher = self.create_publisher(
            LaserScan,
            "scan",
            # The raw driver is consumed with sensor-data QoS, but the
            # filtered topic is also consumed by the system manager and some
            # Nav2 components using the default reliable QoS. A reliable
            # publisher is compatible with both subscriber types.
            QoSProfile(
                depth=10,
                reliability=ReliabilityPolicy.RELIABLE,
                durability=DurabilityPolicy.VOLATILE,
            ),
        )
        # Some A1 firmware modes produce several thousand samples per scan.
        # That is useful for the driver, but unnecessarily large for Nav2 and
        # especially for rosbridge/WebSocket clients.  Keep the ROS scan
        # bounded while retaining enough angular resolution for SLAM/Nav2.
        self.max_output_rays = int(self.declare_parameter("max_output_rays", 720).value)

    @staticmethod
    def _normalize(angle):
        return math.atan2(math.sin(angle), math.cos(angle))

    def _scan_callback(self, scan):
        # Normalizing and sorting handles drivers that report angles as either
        # [-pi, pi] or [0, 2*pi], including the forward-sector wraparound.
        selected = []
        for index, range_value in enumerate(scan.ranges):
            angle = self._normalize(scan.angle_min + index * scan.angle_increment)
            if -math.pi / 2 <= angle <= math.pi / 2:
                selected.append((angle, range_value, index))

        if not selected:
            self.get_logger().warning("Received a scan with no forward rays")
            return

        selected.sort(key=lambda item: item[0])
        sample_step = max(1, math.ceil(len(selected) / self.max_output_rays))
        selected = selected[::sample_step]
        output = LaserScan()
        output.header = scan.header
        output.angle_min = selected[0][0]
        output.angle_max = selected[-1][0]
        output.angle_increment = scan.angle_increment * sample_step
        output.time_increment = scan.time_increment
        output.scan_time = scan.scan_time
        output.range_min = scan.range_min
        output.range_max = scan.range_max
        output.ranges = [item[1] for item in selected]
        if scan.intensities:
            output.intensities = [scan.intensities[item[2]] for item in selected]
        self.publisher.publish(output)


def main(args=None):
    rclpy.init(args=args)
    node = FrontScanFilter()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
