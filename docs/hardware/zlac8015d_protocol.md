# ZLAC8015D Modbus RTU Protocol

This document contains the verified Modbus RTU register mappings for the ZLAC8015D dual motor controller.

## Connection Parameters
*   **Baud Rate**: 115200 (Configurable, 115200 is verified on BumbleB)
*   **Data Bits**: 8
*   **Stop Bits**: 1
*   **Parity**: None
*   **Default Slave ID**: 1

## Verified Registers

### Control Mode (0x200D)
*   **Address**: 0x200D
*   **Type**: Write Single Register (0x06)
*   **Value**:
    *   `3`: Velocity Control Mode

### Control Command (0x200E)
*   **Address**: 0x200E
*   **Type**: Write Single Register (0x06)
*   **Value**:
    *   `0x0008`: Enable Motors

### Target Velocity (0x2088 - 0x2089)
*   **Address (Left)**: 0x2088
*   **Address (Right)**: 0x2089
*   **Type**: Write Multiple Registers (0x10)
*   **Unit**: RPM (Signed 16-bit)
*   **Note**: Supports contiguous block writes for synchronized dual-motor velocity commands.

### Feedback: Actual Velocity (0x20AB - 0x20AC)
*   **Address (Left)**: 0x20AB
*   **Address (Right)**: 0x20AC
*   **Type**: Read Holding Registers (0x03)
*   **Unit**: 0.1 RPM (Signed 16-bit). Divide raw value by `10.0` to get RPM.

### Feedback: Encoder Position (0x20A7 - 0x20AA)
*   **Left High Word**: 0x20A7
*   **Left Low Word**: 0x20A8
*   **Right High Word**: 0x20A9
*   **Right Low Word**: 0x20AA
*   **Type**: Read Holding Registers (0x03)
*   **Unit**: Raw encoder counts (Signed 32-bit). Combine `(High << 16) | Low`.
*   **Note**: Conversion to radians requires encoder calibration (Counts Per Revolution is pending verification).

### Diagnostics (0x20A2, 0x20A5, 0x20A6)
*   **Driver Status**: 0x20A2 (e.g., `0x4040` observed during healthy operation).
*   **Left Fault**: 0x20A5 (`0` indicates healthy).
*   **Right Fault**: 0x20A6 (`0` indicates healthy).

## Safe Operations
To safely stop the motors, command a target velocity of `0` RPM to both wheels rather than guessing unverified disable commands.
