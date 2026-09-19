# RS-485 / USB Wiring Guidelines

The BumbleB robot connects its host computer to the ZLAC8015D controller via a standard RS-485 to USB converter.

## Linux Device Mapping
The default mapped device in the URDF configuration is `/dev/ttyACM0`.

## Troubleshooting Permissions
If `ZlacSystemHardware` fails to activate with a connection error during `real_robot.launch.py`:
1. Check if the device exists: `ls -l /dev/ttyACM0`
2. Check user permissions: `groups`
3. If you are not in the `dialout` group, add yourself: `sudo usermod -aG dialout $USER`.
4. Log out and back in to apply the group change.

## Modbus RTU Signal Requirements
- Ensure Data `A+` and `B-` lines are securely fastened to the controller.
- Use terminating resistors (120 Ohm) if experiencing CRC errors on longer communication wire runs.
