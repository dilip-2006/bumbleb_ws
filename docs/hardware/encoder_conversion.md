# Encoder Conversion

The ZLAC8015D provides internal position feedback as signed 32-bit integers via registers `0x20A7-0x20AA`.

## Default Configuration
By default, the `ros2_control` hardware interface strictly disables position conversions by ignoring the raw counts. This is because **guessing an encoder scaling factor is strictly prohibited**. 

## Activating Encoder Scaling
Once you have physically performed the Odometry Calibration (see `odometry_calibration.md`), you must update `real_hardware.xacro` with the verified count values:

```xml
  <xacro:property name="encoder_cpr" value="YOUR_VERIFIED_VALUE"/>
```

When `encoder_cpr > 0`, the `ZlacSystemHardware` plugin will automatically route the Modbus position registers through the `Motor::encoder_counts_to_radians()` math utility, effectively bringing your `/odom` topic online with true closed-loop position feedback.
