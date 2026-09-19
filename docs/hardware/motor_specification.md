# ZLAC8015D Motor Specifications

## Known Architecture
- Dual-channel hub motor controller.
- Feedback: Internal relative/absolute encoders.
- Native Command Protocol: Signed 16-bit Target Velocity (RPM).
- Safety: Integrated fault registries for overcurrent, overvoltage, and phase loss.

## Physical Integration
The exact wheel geometry (radius, separation, mass) is completely isolated in the `bumbleb_bot` URDF package (`wheels.xacro`). Do not hardcode motor specifications in the driver, as ZLAC drivers are used across multiple chassis form factors.
