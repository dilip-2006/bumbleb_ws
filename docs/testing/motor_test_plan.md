# Motor Test Plan

This verifies basic hardware communication.

## Procedure
1. Launch the hardware:
   ```bash
   ros2 launch bumbleb_bot real_robot.launch.py
   ```
2. Open a separate terminal for Teleop:
   ```bash
   ros2 run teleop_twist_keyboard teleop_twist_keyboard
   ```
3. Press `i` to drive forward.
   - **Validation**: Do both wheels spin in the forward direction? If the robot spins in place, the wiring phases on one motor are reversed, or a software negation is needed in `ZlacSystemHardware`.
4. Press `k` to stop.
   - **Validation**: Motors must smoothly decelerate to zero velocity.
5. Press `,` to reverse.
   - **Validation**: Motors must reverse cleanly.
