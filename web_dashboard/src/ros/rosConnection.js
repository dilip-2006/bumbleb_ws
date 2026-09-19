/**
 * ROS 2 Bridge WebSocket Manager using roslibjs
 * Connects to rosbridge_server (port 9090) and manages subscriptions/publishers.
 */

import ROSLIB from 'roslib';

class ROSConnectionManager {
  constructor() {
    this.ros = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.callbacks = {
      connection: [],
      error: [],
      close: [],
      state: [],
      health: [],
      pose: [],
      navStatus: [],
      locations: [],
      maps: [],
      battery: [],
      map: [],
      scan: [],
      plan: [],
      odom: []
    };

    this.topics = {};
    this.url = `ws://${window.location.hostname || 'localhost'}:9090`;
  }

  connect(customUrl = null) {
    if (customUrl) {
      this.url = customUrl;
    }
    if (this.ros && (this.connected || this.connecting)) {
      return;
    }

    this.connecting = true;
    try {
      this.ros = new ROSLIB.Ros({ url: this.url });

      this.ros.on('connection', () => {
        this.connected = true;
        this.connecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this._setupTopics();
        this._emit('connection');
      });

      this.ros.on('error', (error) => {
        this.connecting = false;
        this._emit('error', error);
      });

      this.ros.on('close', () => {
        this.connected = false;
        this.connecting = false;
        this._emit('close');
        this._scheduleReconnect();
      });
    } catch (err) {
      this.connecting = false;
      this._emit('error', err);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  _setupTopics() {
    if (!this.ros) return;

    // 1. System State
    this.topics.state = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/system_state',
      messageType: 'std_msgs/String'
    });
    this.topics.state.subscribe((msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        this._emit('state', parsed);
      } catch (e) {
        console.warn('Failed to parse system_state', e);
      }
    });

    // 2. System Health
    this.topics.health = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/system_health',
      messageType: 'std_msgs/String'
    });
    this.topics.health.subscribe((msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        this._emit('health', parsed);
      } catch (e) {
        console.warn('Failed to parse system_health', e);
      }
    });

    // 3. Robot Pose
    this.topics.pose = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/robot_pose',
      messageType: 'geometry_msgs/PoseStamped'
    });
    this.topics.pose.subscribe((msg) => {
      this._emit('pose', msg);
    });

    // 4. Navigation Status
    this.topics.navStatus = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/navigation_status',
      messageType: 'std_msgs/String'
    });
    this.topics.navStatus.subscribe((msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        this._emit('navStatus', parsed);
      } catch (e) {
        console.warn('Failed to parse navigation_status', e);
      }
    });

    // 5. Locations list
    this.topics.locations = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/locations',
      messageType: 'std_msgs/String'
    });
    this.topics.locations.subscribe((msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        this._emit('locations', parsed);
      } catch (e) {
        console.warn('Failed to parse locations', e);
      }
    });

    // 6. Available Maps
    this.topics.maps = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/maps',
      messageType: 'std_msgs/String'
    });
    this.topics.maps.subscribe((msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        this._emit('maps', parsed);
      } catch (e) {
        console.warn('Failed to parse maps', e);
      }
    });

    // 7. Battery State
    this.topics.battery = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/battery_state',
      messageType: 'sensor_msgs/BatteryState'
    });
    this.topics.battery.subscribe((msg) => {
      this._emit('battery', msg);
    });

    // 8. Map (OccupancyGrid)
    this.topics.map = new ROSLIB.Topic({
      ros: this.ros,
      name: '/map',
      messageType: 'nav_msgs/OccupancyGrid',
      compression: 'cbor'
    });
    this.topics.map.subscribe((msg) => {
      this._emit('map', msg);
    });

    // 9. LaserScan
    this.topics.scan = new ROSLIB.Topic({
      ros: this.ros,
      name: '/scan',
      messageType: 'sensor_msgs/LaserScan',
      throttle_rate: 100 // limit to 10Hz in browser
    });
    this.topics.scan.subscribe((msg) => {
      this._emit('scan', msg);
    });

    // 10. Nav2 Global Path
    this.topics.plan = new ROSLIB.Topic({
      ros: this.ros,
      name: '/plan',
      messageType: 'nav_msgs/Path'
    });
    this.topics.plan.subscribe((msg) => {
      this._emit('plan', msg);
    });

    // 11. Odometry (for current linear/angular speed)
    this.topics.odom = new ROSLIB.Topic({
      ros: this.ros,
      name: '/odom',
      messageType: 'nav_msgs/Odometry',
      throttle_rate: 100
    });
    this.topics.odom.subscribe((msg) => {
      this._emit('odom', msg);
    });

    // Publishers
    this.topics.cmdVel = new ROSLIB.Topic({
      ros: this.ros,
      name: '/cmd_vel',
      messageType: 'geometry_msgs/Twist'
    });

    this.topics.command = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/command',
      messageType: 'std_msgs/String'
    });

    this.topics.locationCommand = new ROSLIB.Topic({
      ros: this.ros,
      name: '/amr/location_command',
      messageType: 'std_msgs/String'
    });

    this.topics.goalPose = new ROSLIB.Topic({
      ros: this.ros,
      name: '/goal_pose',
      messageType: 'geometry_msgs/PoseStamped'
    });
  }

  // Event Subscription
  on(event, cb) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(cb);
    }
  }

  off(event, cb) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(fn => fn !== cb);
    }
  }

  _emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      });
    }
  }

  // Velocity Publisher
  sendVelocity(linearX, angularZ) {
    if (!this.connected || !this.topics.cmdVel) return;
    const twist = new ROSLIB.Message({
      linear: { x: Number(linearX) || 0.0, y: 0.0, z: 0.0 },
      angular: { x: 0.0, y: 0.0, z: Number(angularZ) || 0.0 }
    });
    this.topics.cmdVel.publish(twist);
  }

  // System & Mode Control Commands
  sendCommand(payload) {
    if (!this.connected || !this.topics.command) return;
    const msg = new ROSLIB.Message({
      data: JSON.stringify(payload)
    });
    this.topics.command.publish(msg);
  }

  // Location Management Commands
  sendLocationCommand(payload) {
    if (!this.connected || !this.topics.locationCommand) return;
    const msg = new ROSLIB.Message({
      data: JSON.stringify(payload)
    });
    this.topics.locationCommand.publish(msg);
  }

  // Send Navigation Goal to /goal_pose or Nav2
  sendGoal(x, y, yaw = 0.0, frameId = 'map') {
    if (!this.connected || !this.topics.goalPose) return;
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);

    const goal = new ROSLIB.Message({
      header: {
        stamp: { sec: 0, nanosec: 0 },
        frame_id: frameId
      },
      pose: {
        position: { x: Number(x), y: Number(y), z: 0.0 },
        orientation: { x: 0.0, y: 0.0, z: sy, w: cy }
      }
    });
    this.topics.goalPose.publish(goal);
  }

  // Service call helper
  callService(serviceName, serviceType, requestData = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ros) {
        return reject(new Error('ROS is not connected'));
      }
      const client = new ROSLIB.Service({
        ros: this.ros,
        name: serviceName,
        serviceType: serviceType
      });
      const request = new ROSLIB.ServiceRequest(requestData);
      client.callService(request, (result) => {
        resolve(result);
      }, (error) => {
        reject(error);
      });
    });
  }
}

export const rosConnection = new ROSConnectionManager();
export default rosConnection;
