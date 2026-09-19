import { useState, useEffect } from 'react';
import rosConnection from '../ros/rosConnection';

export function useRos() {
  const [connected, setConnected] = useState(rosConnection.connected);
  const [systemState, setSystemState] = useState({
    state: 'OFF',
    previous_state: 'OFF',
    active_map: 'warehouse_main',
    is_emergency_stop: false,
    error_reason: ''
  });
  const [systemHealth, setSystemHealth] = useState(null);
  const [robotPose, setRobotPose] = useState({ x: 0.0, y: 0.0, yaw: 0.0, yaw_deg: 0, valid: false });
  const [navStatus, setNavStatus] = useState({ status: 'IDLE', target: '', distance_remaining: 0.0 });
  const [locations, setLocations] = useState([]);
  const [maps, setMaps] = useState([]);
  const [battery, setBattery] = useState({ percentage: 0.95, voltage: 25.4 });
  const [mapData, setMapData] = useState(null);
  const [laserScan, setLaserScan] = useState(null);
  const [globalPath, setGlobalPath] = useState(null);
  const [velocity, setVelocity] = useState({ linear: 0.0, angular: 0.0 });

  useEffect(() => {
    rosConnection.connect();

    const onConn = () => setConnected(true);
    const onClose = () => setConnected(false);
    const onState = (data) => setSystemState(data);
    const onHealth = (data) => setSystemHealth(data);
    const onNav = (data) => {
      setNavStatus(data);
      if (data.robot_pose) {
        setRobotPose(data.robot_pose);
      }
    };
    const onLocs = (data) => setLocations(Array.isArray(data) ? data : []);
    const onMaps = (data) => setMaps(Array.isArray(data) ? data : []);
    const onBat = (data) => setBattery({ percentage: data.percentage, voltage: data.voltage });
    const onMap = (data) => setMapData(data);
    const onScan = (data) => setLaserScan(data);
    const onPlan = (data) => setGlobalPath(data);
    const onOdom = (data) => {
      if (data.twist && data.twist.twist) {
        setVelocity({
          linear: data.twist.twist.linear.x,
          angular: data.twist.twist.angular.z
        });
      }
    };

    rosConnection.on('connection', onConn);
    rosConnection.on('close', onClose);
    rosConnection.on('state', onState);
    rosConnection.on('health', onHealth);
    rosConnection.on('navStatus', onNav);
    rosConnection.on('locations', onLocs);
    rosConnection.on('maps', onMaps);
    rosConnection.on('battery', onBat);
    rosConnection.on('map', onMap);
    rosConnection.on('scan', onScan);
    rosConnection.on('plan', onPlan);
    rosConnection.on('odom', onOdom);

    return () => {
      rosConnection.off('connection', onConn);
      rosConnection.off('close', onClose);
      rosConnection.off('state', onState);
      rosConnection.off('health', onHealth);
      rosConnection.off('navStatus', onNav);
      rosConnection.off('locations', onLocs);
      rosConnection.off('maps', onMaps);
      rosConnection.off('battery', onBat);
      rosConnection.off('map', onMap);
      rosConnection.off('scan', onScan);
      rosConnection.off('plan', onPlan);
      rosConnection.off('odom', onOdom);
    };
  }, []);

  return {
    connected,
    systemState,
    systemHealth,
    robotPose,
    navStatus,
    locations,
    maps,
    battery,
    mapData,
    laserScan,
    globalPath,
    velocity,
    sendCommand: (cmd) => rosConnection.sendCommand(cmd),
    sendLocationCommand: (cmd) => rosConnection.sendLocationCommand(cmd),
    sendGoal: (x, y, yaw, frame) => rosConnection.sendGoal(x, y, yaw, frame),
    sendVelocity: (vx, wz) => rosConnection.sendVelocity(vx, wz)
  };
}
