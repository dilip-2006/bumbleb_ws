# Simulation Test Plan

The simulation pipeline uses Gazebo Classic and
`gazebo_ros2_control/GazeboSystem`; it drives the simulated wheel joints
through the same `forward_command_controller` used by BumbleB.

## Running the Simulation

1. **Launch the stack**:
   ```bash
   ros2 launch bumbleb_bot simulation.launch.py
   ```
2. **Verify control and physics**:
   In a separate terminal, echo the odometry:
   ```bash
   ros2 topic echo /odom
   ```
3. **Send Commands**:
   Send a twist command:
   ```bash
   ros2 launch bumbleb_bot teleop.launch.py
   ```
4. **Validation**:
   The BumbleB model should move in Gazebo and `/odom` should change with it.
