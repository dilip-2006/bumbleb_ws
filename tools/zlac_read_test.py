#!/usr/bin/env python3

from pymodbus.client.sync import ModbusSerialClient


# ==========================================================
# ZLTECH ZLAC8015D RS485 CONFIGURATION
# ==========================================================

PORT = "/dev/ttyACM0"
BAUDRATE = 115200
SLAVE_ID = 1


# ==========================================================
# HELPER: Convert two 16-bit registers to signed int32
# ==========================================================

def to_signed_32(high, low):

    value = (high << 16) | low

    if value & 0x80000000:
        value -= 0x100000000

    return value


# ==========================================================
# HELPER: Read Modbus holding registers
# ==========================================================

def read_register(client, address, count=1, name="Register"):

    print("\n----------------------------------------")
    print(f"Reading: {name}")
    print(f"Address: 0x{address:04X}")

    try:

        response = client.read_holding_registers(
            address=address,
            count=count,
            unit=SLAVE_ID
        )

        if response.isError():

            print(f"ERROR: {response}")
            return None

        print(f"Raw registers: {response.registers}")

        return response.registers

    except Exception as error:

        print(f"EXCEPTION: {error}")

        return None


# ==========================================================
# MAIN
# ==========================================================

def main():

    print("========================================")
    print(" ZLTECH ZLAC8015D RS485 READ-ONLY TEST")
    print("========================================")

    print(f"Port:     {PORT}")
    print(f"Baudrate: {BAUDRATE}")
    print(f"Slave ID: {SLAVE_ID}")

    # ------------------------------------------------------
    # Create Modbus RTU client
    # ------------------------------------------------------

    client = ModbusSerialClient(

        method="rtu",

        port=PORT,

        baudrate=BAUDRATE,

        bytesize=8,

        parity="N",

        stopbits=1,

        timeout=1
    )

    print("\nConnecting to serial port...")

    if not client.connect():

        print("FAILED: Cannot open serial port.")

        return

    print("SUCCESS: Serial port opened.")

    try:

        # ==================================================
        # DRIVER STATUS
        # Register: 0x20A2
        # ==================================================

        status = read_register(

            client,

            address=0x20A2,

            count=1,

            name="Driver Status"
        )

        if status:

            print(f"Driver Status Value: {status[0]}")

        


        # ==================================================
        # LEFT ENCODER POSITION
        #
        # High word: 0x20A7
        # Low word : 0x20A8
        # ==================================================

        left_encoder = read_register(

            client,

            address=0x20A7,

            count=2,

            name="Left Encoder Position"
        )

        if left_encoder is not None:

            position = to_signed_32(

                left_encoder[0],

                left_encoder[1]
            )

            print(f"Left Encoder Position: {position}")


        # ==================================================
        # RIGHT ENCODER POSITION
        #
        # High word: 0x20A9
        # Low word : 0x20AA
        # ==================================================

        right_encoder = read_register(

            client,

            address=0x20A9,

            count=2,

            name="Right Encoder Position"
        )

        if right_encoder is not None:

            position = to_signed_32(

                right_encoder[0],

                right_encoder[1]
            )

            print(f"Right Encoder Position: {position}")


        # ==================================================
        # LEFT MOTOR ACTUAL SPEED
        # Register: 0x20AB
        # ==================================================

        left_speed = read_register(

            client,

            address=0x20AB,

            count=1,

            name="Left Motor Actual Speed"
        )

        if left_speed:

            print(
                f"Left Motor Speed Raw: {left_speed[0]}"
            )


        # ==================================================
        # RIGHT MOTOR ACTUAL SPEED
        # Register: 0x20AC
        # ==================================================

        right_speed = read_register(

            client,

            address=0x20AC,

            count=1,

            name="Right Motor Actual Speed"
        )

        if right_speed:

            print(
                f"Right Motor Speed Raw: {right_speed[0]}"
            )

        left_fault = read_register(
            client,
            address=0x20A5,
            count=1,
            name="Left Motor Fault"
        )

        if left_fault is not None:
            print(f"Left Motor Fault Value: {left_fault[0]}")


        right_fault = read_register(
            client,
            address=0x20A6,
            count=1,
            name="Right Motor Fault"
        )

        if right_fault is not None:
            print(f"Right Motor Fault Value: {right_fault[0]}")


    finally:

        # --------------------------------------------------
        # Close serial connection
        # --------------------------------------------------

        client.close()

        print("\n========================================")
        print(" RS485 TEST FINISHED")
        print("========================================")


# ==========================================================
# PROGRAM ENTRY
# ==========================================================

if __name__ == "__main__":

    main()  
