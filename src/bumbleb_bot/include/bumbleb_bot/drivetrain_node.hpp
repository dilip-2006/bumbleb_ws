#ifndef BUMBLEB_BOT__DRIVETRAIN_NODE_HPP_
#define BUMBLEB_BOT__DRIVETRAIN_NODE_HPP_

#include <memory>
#include <mutex>
#include <string>

#include "geometry_msgs/msg/twist.hpp"
#include "nav_msgs/msg/odometry.hpp"
#include "rclcpp/rclcpp.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "std_msgs/msg/float64_multi_array.hpp"
#include "tf2_ros/transform_broadcaster.h"

namespace bumbleb_bot
{

/**
 * @brief BumbleB differential-drive kinematics and odometry node.
 *
 * This node is the "BumbleB differential-drive kinematics" block in the
 * project architecture. It intentionally replaces
 * diff_drive_controller/DiffDriveController:
 *
 *   /cmd_vel -> this node -> per-wheel rad/s -> forward_command_controller
 *                                                  -> ros2_control
 *                                                       -> zlac_drive
 *
 * and, in the feedback direction:
 *
 *   /joint_states -> this node -> /odom, TF odom->base_link
 *
 * Wheel geometry (wheel_radius, wheel_separation) is loaded from a
 * single YAML file (config/drivetrain.yaml) and must not be duplicated
 * elsewhere; the same file's values are also passed into the xacro at
 * launch time so the URDF and this node never disagree.
 *
 * Command-timeout safety: a timer runs continuously at control_frequency
 * and re-publishes the wheel command every cycle (zero velocity if no
 * recent /cmd_vel has arrived), matching how diff_drive_controller
 * itself implements cmd_vel_timeout. Simply reacting to /cmd_vel
 * callbacks would leave the last non-zero command latched forever on
 * the forward_command_controller's command interface if /cmd_vel
 * stopped arriving.
 */
class DrivetrainNode : public rclcpp::Node
{
public:
  DrivetrainNode();

private:
  void on_cmd_vel(const geometry_msgs::msg::Twist::SharedPtr msg);

  void on_joint_states(const sensor_msgs::msg::JointState::SharedPtr msg);

  void on_control_timer();

  // ============================================================
  // Parameters (see config/drivetrain.yaml for defaults/status)
  // ============================================================

  double wheel_radius_m_{0.0655};

  double wheel_separation_m_{0.65};

  bool wheel_separation_verified_{false};

  double max_linear_velocity_mps_{0.5};

  double max_angular_velocity_radps_{1.0};

  /// Hard ceiling derived from the motor's peak RPM. Never exceeded
  /// regardless of linear/angular limit misconfiguration.
  double max_wheel_angular_velocity_radps_{0.0};

  double cmd_vel_timeout_s_{0.5};

  double control_frequency_hz_{50.0};

  std::string left_wheel_joint_{"left_joint"};

  std::string right_wheel_joint_{"right_joint"};

  std::string odom_frame_id_{"odom"};

  std::string base_frame_id_{"base_link"};

  bool publish_tf_{true};

  // ============================================================
  // Command-timeout watchdog state
  // ============================================================

  std::mutex cmd_vel_mutex_;

  double last_linear_x_{0.0};

  double last_angular_z_{0.0};

  rclcpp::Time last_cmd_vel_time_;

  bool cmd_vel_received_{false};

  bool timeout_warned_{false};

  // ============================================================
  // Odometry integration state
  // ============================================================

  double odom_x_{0.0};

  double odom_y_{0.0};

  double odom_theta_{0.0};

  rclcpp::Time last_odom_time_;

  bool have_last_odom_time_{false};

  // ============================================================
  // ROS interfaces
  // ============================================================

  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr cmd_vel_sub_;

  rclcpp::Subscription<sensor_msgs::msg::JointState>::SharedPtr
    joint_state_sub_;

  rclcpp::Publisher<std_msgs::msg::Float64MultiArray>::SharedPtr
    wheel_command_pub_;

  rclcpp::Publisher<nav_msgs::msg::Odometry>::SharedPtr odom_pub_;

  std::unique_ptr<tf2_ros::TransformBroadcaster> tf_broadcaster_;

  rclcpp::TimerBase::SharedPtr control_timer_;
};

}  // namespace bumbleb_bot

#endif  // BUMBLEB_BOT__DRIVETRAIN_NODE_HPP_
