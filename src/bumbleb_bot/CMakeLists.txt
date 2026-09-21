cmake_minimum_required(VERSION 3.8)

project(bumbleb_bot)

if(NOT CMAKE_CXX_STANDARD)
  set(CMAKE_CXX_STANDARD 17)
endif()

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  add_compile_options(
    -Wall
    -Wextra
    -Wpedantic
  )
endif()

find_package(ament_cmake REQUIRED)

find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_ros REQUIRED)

# ============================================================
# BumbleB differential-drive kinematics / odometry node
#
# This replaces diff_drive_controller/DiffDriveController - see project
# architecture decision to keep wheel-command kinematics owned by
# BumbleB rather than a canned ros2_control controller.
# ============================================================

add_executable(bumbleb_drivetrain_node
  src/drivetrain_node.cpp
)

target_include_directories(bumbleb_drivetrain_node
  PRIVATE
    include
)

target_compile_features(bumbleb_drivetrain_node
  PUBLIC
    cxx_std_17
)

ament_target_dependencies(bumbleb_drivetrain_node
  rclcpp
  geometry_msgs
  nav_msgs
  sensor_msgs
  std_msgs
  tf2
  tf2_ros
)

install(
  TARGETS
    bumbleb_drivetrain_node
  DESTINATION
    lib/${PROJECT_NAME}
)

# ============================================================
# Install robot resources
# ============================================================

install(
  DIRECTORY
    description
    launch
    config
    rviz
    worlds
    maps
  DESTINATION
    share/${PROJECT_NAME}
)

# ============================================================
# Install executable scripts, if present
# ============================================================

install(
  PROGRAMS
    scripts/system_manager_node.py
    scripts/location_manager_node.py
    scripts/front_scan_filter.py
  DESTINATION
    lib/${PROJECT_NAME}
)

# ============================================================
# Tests
# ============================================================

if(BUILD_TESTING)

  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()

  find_package(ament_cmake_pytest REQUIRED)

  ament_add_pytest_test(test_urdf test/test_urdf.py)
  ament_add_pytest_test(test_launch test/test_launch.py)

endif()

ament_package()
