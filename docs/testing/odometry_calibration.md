# Odometry Calibration Test Plan

To bring the robot out of open-loop dead-reckoning and activate closed-loop position feedback, you must physically measure the Encoder Counts Per Revolution (CPR).

## Staged Calibration Procedure
1. Prop the robot up so its drive wheels do not touch the ground, OR place a physical mark on the wheel and the floor.
2. Read the raw position of the left wheel (`0x20A7-0x20A8`) via a Modbus scanner or temporary ROS logging.
3. Physically rotate the wheel exactly one full revolution (360 degrees / 2π radians).
4. Read the raw position again.
5. The absolute difference is your **Encoder CPR**.
6. Open `/home/dk/bumbleb_ws/src/bumbleb_bot/description/control/real_hardware.xacro`.
7. Change `<xacro:property name="encoder_cpr" value="0"/>` to your measured value.
8. Rebuild the workspace using `colcon build`.

## Geometric Calibration
You must also measure the exact distance between the center-line of the left wheel contact patch to the right wheel contact patch, and update `<xacro:property name="wheel_separation" value="0.65"/>` in `wheels.xacro`.
