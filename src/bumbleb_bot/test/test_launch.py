from pathlib import Path


def test_required_launch_files_exist():
    root = Path(__file__).resolve().parents[1] / "launch"
    for name in (
        "real_robot.launch.py",
        "simulation.launch.py",
        "teleop.launch.py",
        "rsp.launch.py",
        "lidar.launch.py",
        "slam.launch.py",
        "localization.launch.py",
        "navigation.launch.py",
    ):
        assert (root / name).is_file()


def test_no_articubot_package_dependency():
    """Regression guard: articubot_one was used only as an architectural
    *reference* while building this workspace (design ideas, not code).
    No package manifest, build file, or launch file may actually depend
    on or reference the articubot_one *package* by name. (Prose mentions
    of "articubot" as a design reference, e.g. in README files or code
    comments, are not what this checks.)"""
    root = Path(__file__).resolve().parents[1]

    manifest_files = [root / "package.xml", root / "CMakeLists.txt"]
    for manifest in manifest_files:
        text = manifest.read_text(encoding="utf-8")
        assert "articubot_one" not in text, f"stale dependency in {manifest}"

    for launch_file in (root / "launch").glob("*.launch.py"):
        text = launch_file.read_text(encoding="utf-8")
        assert "articubot" not in text.lower(), f"stale reference in {launch_file}"


def test_no_diff_drive_controller_dependency():
    """Regression guard: BumbleB's drivetrain intentionally does not use
    diff_drive_controller/DiffDriveController - see drivetrain_node.hpp
    and config/controllers.yaml. Comments explaining this decision are
    fine; an actual controller_manager controller of this type is not."""
    controllers_yaml = (
        Path(__file__).resolve().parents[1] / "config" / "controllers.yaml"
    )
    text = controllers_yaml.read_text(encoding="utf-8")
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        assert "diff_drive_controller/DiffDriveController" not in stripped

    package_xml = Path(__file__).resolve().parents[1] / "package.xml"
    assert "diff_drive_controller" not in package_xml.read_text(encoding="utf-8")
