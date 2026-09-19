#include "bumbleb_bot/drivetrain_node.hpp"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>
#include <mutex>
#include <stdexcept>

#include "geometry_msgs/msg/transform_stamped.hpp"

namespace bumbleb_bot
{

namespace
{

constexpr double kPi = 3.14159265358979323846;

// SOURCE_VERIFIED: ZLLG50ASM200 V2.0 motor parameter sheet peak speed.
// Duplicated here (rather than depending on zlac_drive) because this
// package must not depend on the hardware driver package - see
// project package-responsibility rules. Keep in sync with
// zlac_drive::driver::MotorLimits::kPeakRpm.
constexpr double kMotorPeakRpm = 350.0;

double rpm_to_rad_per_sec(const double rpm)
{
  return rpm * (2.0 * kPi / 60.0);
}

double clamp(const double value, const double limit)
{
  if (!std::isfinite(value)) {
    return 0.0;
  }

  return std::clamp(value, -limit, limit);
}

}  // namespace


DrivetrainNode::DrivetrainNode()
: rclcpp::Node("bumbleb_drivetrain_node")
{
  // ============================================================
  // Parameters - single source of truth is config/drivetrain.yaml.
  // ============================================================

  wheel_radius_m_ =
    declare_parameter<double>("wheel_radius", wheel_radius_m_);

  wheel_separation_m_ =
    declare_parameter<double>("wheel_separation", wheel_separation_m_);

  wheel_separation_verified_ =
    declare_parameter<bool>(
    "wheel_separation_verified", wheel_separation_verified_);

  max_linear_velocity_mps_ =
    declare_parameter<double>(
    "max_linear_velocity", max_linear_velocity_mps_);

  max_angular_velocity_radps_ =
    declare_parameter<double>(
    "max_angular_velocity", max_angular_velocity_radps_);

  cmd_vel_timeout_s_ =
    declare_parameter<double>("cmd_vel_timeout", cmd_vel_timeout_s_);

  control_frequency_hz_ =
    declare_parameter<double>(
    "control_frequency", control_frequency_hz_);

  left_wheel_joint_ =
    declare_parameter<std::string>("left_wheel_joint", left_wheel_joint_);

  right_wheel_joint_ =
    declare_parameter<std::string>(
    "right_wheel_joint", right_wheel_joint_);

  odom_frame_id_ =
    declare_parameter<std::string>("odom_frame_id", odom_frame_id_);

  base_frame_id_ =
    declare_parameter<std::string>("base_frame_id", base_frame_id_);

  publish_tf_ = declare_parameter<bool>("publish_tf", publish_tf_);

  const std::string wheel_command_topic =
    declare_parameter<std::string>(
    "wheel_command_topic",
    "/bumbleb_wheel_velocity_controller/commands");

  if (wheel_radius_m_ <= 0.0) {
    RCLCPP_ERROR(
      get_logger(),
      "wheel_radius must be positive; refusing to start with %.4f",
      wheel_radius_m_);

    throw std::invalid_argument("wheel_radius must be positive");
  }

  if (wheel_separation_m_ <= 0.0) {
    RCLCPP_ERROR(
      get_logger(),
      "wheel_separation must be positive; refusing to start with %.4f",
      wheel_separation_m_);

    throw std::invalid_argument("wheel_separation must be positive");
  }

  if (!wheel_separation_verified_) {
    RCLCPP_WARN(
      get_logger(),
      "wheel_separation (%.4f m) is CALIBRATION_REQUIRED: it has not "
      "been confirmed against the physical BumbleB chassis. Odometry "
      "and curvature commands derived from it will be inaccurate until "
      "it is measured and wheel_separation_verified is set to true.",
      wheel_separation_m_);
  }

  max_wheel_angular_velocity_radps_ =
    rpm_to_rad_per_sec(kMotorPeakRpm);

  // ============================================================
  // ROS interfaces
  // ============================================================

  cmd_vel_sub_ = create_subscription<geometry_msgs::msg::Twist>(
    "cmd_vel",
    rclcpp::QoS(10),
    std::bind(&DrivetrainNode::on_cmd_vel, this, std::placeholders::_1));

  joint_state_sub_ = create_subscription<sensor_msgs::msg::JointState>(
    "joint_states",
    rclcpp::QoS(10),
    std::bind(&DrivetrainNode::on_joint_states, this, std::placeholders::_1));

  wheel_command_pub_ =
    create_publisher<std_msgs::msg::Float64MultiArray>(
    wheel_command_topic, rclcpp::QoS(10));

  odom_pub_ = create_publisher<nav_msgs::msg::Odometry>(
    "odom", rclcpp::QoS(50));

  tf_broadcaster_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);

  last_cmd_vel_time_ = get_clock()->now();

  const auto period = std::chrono::duration<double>(
    1.0 / std::max(control_frequency_hz_, 1.0));

  control_timer_ = create_wall_timer(
    std::chrono::duration_cast<std::chrono::milliseconds>(period),
    std::bind(&DrivetrainNode::on_control_timer, this));

  RCLCPP_INFO(
    get_logger(),
    "BumbleB drivetrain node started: wheel_radius=%.4f m "
    "wheel_separation=%.4f m (%s) control_frequency=%.1f Hz "
    "cmd_vel_timeout=%.2f s",
    wheel_radius_m_,
    wheel_separation_m_,
    wheel_separation_verified_ ? "VERIFIED" : "CALIBRATION_REQUIRED",
    control_frequency_hz_,
    cmd_vel_timeout_s_);
}


void DrivetrainNode::on_cmd_vel(
  const geometry_msgs::msg::Twist::SharedPtr msg)
{
  std::lock_guard<std::mutex> lock(cmd_vel_mutex_);

  last_linear_x_ = msg->linear.x;
  last_angular_z_ = msg->angular.z;
  last_cmd_vel_time_ = get_clock()->now();
  cmd_vel_received_ = true;
  timeout_warned_ = false;
}


void DrivetrainNode::on_control_timer()
{
  double linear_x = 0.0;
  double angular_z = 0.0;

  {
    std::lock_guard<std::mutex> lock(cmd_vel_mutex_);

    const double age_s =
      cmd_vel_received_ ?
      (get_clock()->now() - last_cmd_vel_time_).seconds() :
      std::numeric_limits<double>::infinity();

    if (cmd_vel_received_ && age_s <= cmd_vel_timeout_s_) {
      linear_x = last_linear_x_;
      angular_z = last_angular_z_;
    } else if (cmd_vel_received_ && !timeout_warned_) {
      RCLCPP_WARN(
        get_logger(),
        "cmd_vel timeout (%.2f s > %.2f s): commanding zero wheel "
        "velocity until a new /cmd_vel message arrives",
        age_s,
        cmd_vel_timeout_s_);

      timeout_warned_ = true;
    }
  }

  // Safety clamp to the configured (tunable) operating limits.
  linear_x = clamp(linear_x, max_linear_velocity_mps_);
  angular_z = clamp(angular_z, max_angular_velocity_radps_);

  // Differential-drive inverse kinematics:
  //   v_left  = v - (w * L) / 2
  //   v_right = v + (w * L) / 2
  // converted from wheel linear speed (m/s) to wheel angular speed
  // (rad/s) via division by wheel radius.
  const double left_linear_mps =
    linear_x - (angular_z * wheel_separation_m_ / 2.0);

  const double right_linear_mps =
    linear_x + (angular_z * wheel_separation_m_ / 2.0);

  double left_wheel_radps = left_linear_mps / wheel_radius_m_;
  double right_wheel_radps = right_linear_mps / wheel_radius_m_;

  // Final hard ceiling: never command beyond the motor's physical peak
  // speed, even if linear/angular limits above were misconfigured.
  left_wheel_radps =
    clamp(left_wheel_radps, max_wheel_angular_velocity_radps_);

  right_wheel_radps =
    clamp(right_wheel_radps, max_wheel_angular_velocity_radps_);

  std_msgs::msg::Float64MultiArray command;
  command.data = {left_wheel_radps, right_wheel_radps};

  wheel_command_pub_->publish(command);
}


void DrivetrainNode::on_joint_states(
  const sensor_msgs::msg::JointState::SharedPtr msg)
{
  int left_index = -1;
  int right_index = -1;

  for (std::size_t i = 0; i < msg->name.size(); ++i) {
    if (msg->name[i] == left_wheel_joint_) {
      left_index = static_cast<int>(i);
    } else if (msg->name[i] == right_wheel_joint_) {
      right_index = static_cast<int>(i);
    }
  }

  if (left_index < 0 || right_index < 0) {
    RCLCPP_WARN_THROTTLE(
      get_logger(),
      *get_clock(),
      5000,
      "Waiting for joint_states to contain '%s' and '%s'",
      left_wheel_joint_.c_str(),
      right_wheel_joint_.c_str());

    return;
  }

  if (msg->velocity.size() <= static_cast<std::size_t>(left_index) ||
    msg->velocity.size() <= static_cast<std::size_t>(right_index))
  {
    return;
  }

  const double left_wheel_radps = msg->velocity[left_index];
  const double right_wheel_radps = msg->velocity[right_index];

  // Odometry is computed by integrating VELOCITY feedback rather than
  // position feedback. This is a deliberate choice: the ZLAC8015D
  // position registers require a CALIBRATION_REQUIRED
  // counts-per-wheel-revolution scale (see zlac_drive/README.md) that
  // may not yet be verified, whereas the velocity scale (RPM) is
  // PHYSICALLY_VERIFIED. This is an open-loop-on-position /
  // closed-loop-on-velocity dead-reckoning odometry source and will
  // accumulate drift like any dead-reckoning estimate - it is not a
  // substitute for SLAM/AMCL correction of map->odom.
  const double linear_mps =
    wheel_radius_m_ * (right_wheel_radps + left_wheel_radps) / 2.0;

  const double angular_radps =
    wheel_radius_m_ * (right_wheel_radps - left_wheel_radps) /
    wheel_separation_m_;

  const rclcpp::Time stamp(msg->header.stamp);

  if (!have_last_odom_time_) {
    last_odom_time_ = stamp;
    have_last_odom_time_ = true;
    return;
  }

  const double dt = (stamp - last_odom_time_).seconds();

  last_odom_time_ = stamp;

  if (dt <= 0.0 || dt > 1.0) {
    // Ignore non-positive or implausibly large gaps (e.g. clock jumps,
    // startup) rather than integrating a bogus pose delta.
    return;
  }

  odom_theta_ += angular_radps * dt;
  odom_x_ += linear_mps * std::cos(odom_theta_) * dt;
  odom_y_ += linear_mps * std::sin(odom_theta_) * dt;

  const double half_theta = odom_theta_ / 2.0;
  const double qz = std::sin(half_theta);
  const double qw = std::cos(half_theta);

  nav_msgs::msg::Odometry odom;
  odom.header.stamp = stamp;
  odom.header.frame_id = odom_frame_id_;
  odom.child_frame_id = base_frame_id_;

  odom.pose.pose.position.x = odom_x_;
  odom.pose.pose.position.y = odom_y_;
  odom.pose.pose.position.z = 0.0;
  odom.pose.pose.orientation.z = qz;
  odom.pose.pose.orientation.w = qw;

  odom.twist.twist.linear.x = linear_mps;
  odom.twist.twist.angular.z = angular_radps;

  odom_pub_->publish(odom);

  if (publish_tf_) {
    geometry_msgs::msg::TransformStamped transform;
    transform.header.stamp = stamp;
    transform.header.frame_id = odom_frame_id_;
    transform.child_frame_id = base_frame_id_;
    transform.transform.translation.x = odom_x_;
    transform.transform.translation.y = odom_y_;
    transform.transform.translation.z = 0.0;
    transform.transform.rotation.z = qz;
    transform.transform.rotation.w = qw;

    tf_broadcaster_->sendTransform(transform);
  }
}

}  // namespace bumbleb_bot


int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);

  rclcpp::spin(std::make_shared<bumbleb_bot::DrivetrainNode>());

  rclcpp::shutdown();

  return 0;
}
