import time
from pymodbus.client.sync import ModbusSerialClient

PORT = "/dev/ttyACM0"
SLAVE_ID = 1

MODE = 0x200D
CONTROL = 0x200E

LEFT_TARGET = 0x2088
RIGHT_TARGET = 0x2089

client = ModbusSerialClient(
    method="rtu",
    port=PORT,
    baudrate=115200,
    bytesize=8,
    parity="N",
    stopbits=1,
    timeout=1
)

if not client.connect():
    print("FAILED: Cannot connect")
    raise SystemExit(1)


def write(addr, value, name):
    r = client.write_register(
        addr,
        value,
        unit=SLAVE_ID
    )
    print(f"{name}: {r}")
    return not r.isError()


def read(addr, name):
    r = client.read_holding_registers(
        addr,
        1,
        unit=SLAVE_ID
    )

    if r.isError():
        print(f"{name}: ERROR {r}")
        return None

    v = r.registers[0]

    print(f"{name}: {v} (0x{v:04X})")

    return v


try:

    print("\n===== SET VELOCITY MODE =====")

    write(MODE, 3, "Velocity Mode")

    # The documented speed-mode sequence enables the motor with 0x08.
    write(CONTROL, 0x08, "Enable")

    time.sleep(1)

    print("\n===== STATUS BEFORE MOVEMENT =====")

    read(0x20A2, "Status")
    read(0x20A5, "Left Fault")
    read(0x20A6, "Right Fault")

    print("\n===== COMMANDING MOTORS =====")

    # Synchronous write:
    # 0x2088 = left RPM
    # 0x2089 = right RPM

    r = client.write_registers(
        LEFT_TARGET,
        [350, 350],
        unit=SLAVE_ID
    )

    print("Speed command:", r)

    print("\nMotors should run for 3 seconds...\n")

    for i in range(3):
        time.sleep(1)

        print(f"--- {i+1} second ---")

        left = read(0x20AB, "Left Actual Speed")
        right = read(0x20AC, "Right Actual Speed")

        if left is not None:
            if left >= 32768:
                left -= 65536
            print(f"Left RPM: {left / 10.0}")

        if right is not None:
            if right >= 32768:
                right -= 65536
            print(f"Right RPM: {right / 10.0}")

finally:

    print("\n===== STOPPING BOTH MOTORS =====")

    client.write_registers(
        LEFT_TARGET,
        [0, 0],
        unit=SLAVE_ID
    )

    client.close()

    print("DONE")
