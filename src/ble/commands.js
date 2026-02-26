/**
 * High-level Puffco device commands
 */

const {
  PATHS,
  HEATER_STATES,
  temp,
  buildGetCommand,
  buildSetCommand,
  buildHeatCommand,
  parseResponse,
  parseUInt32LE,
  parseUInt16LE,
  parseFloat32LE,
  parseString
} = require('./protocol');

class PuffcoCommands {
  constructor(connection) {
    this.conn = connection;
    this.seq = 100; // Start after auth sequences
  }

  /**
   * Get next sequence number (16-bit, wraps at 65535)
   */
  nextSeq() {
    this.seq = (this.seq + 1) % 65535;
    return this.seq;
  }

  /**
   * Read a path and return parsed value
   */
  async read(path) {
    const cmd = buildGetCommand(this.nextSeq(), path);
    const response = await this.conn.sendCommand(cmd);
    return parseResponse(response);
  }

  /**
   * Write a value to a path
   */
  async write(path, value) {
    const cmd = buildSetCommand(this.nextSeq(), path, value);
    const response = await this.conn.sendCommand(cmd);
    return parseResponse(response);
  }

  // ═══════════════════════════════════════════════════════════════
  // Device Info
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get device info
   */
  async getDeviceInfo() {
    const fwApi = await this.read(PATHS.FW_API);
    const fwGit = await this.read(PATHS.FW_GIT);
    const dabCount = await this.read(PATHS.DAB_COUNT);

    return {
      firmwareApi: fwApi.data ? parseUInt16LE(fwApi.data) : 0,
      firmwareGit: fwGit.data ? parseString(fwGit.data) : 'unknown',
      dabCount: dabCount.data ? parseUInt32LE(dabCount.data) : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Battery
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get battery percentage (0-100)
   */
  async getBattery() {
    const result = await this.read(PATHS.BATTERY_SOC);
    if (result.data) {
      // Battery stored as int * 100 (e.g., 3227 = 32.27%)
      const raw = parseUInt32LE(result.data);
      return Math.round(raw / 100);
    }
    return 0;
  }

  /**
   * Get charging status
   */
  async getChargeStatus() {
    const result = await this.read(PATHS.CHARGE_STATUS);
    if (result.data) {
      return result.data[0]; // 0 = not charging, 1 = charging
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // Temperature
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current heater temperature in Fahrenheit
   */
  async getHeaterTemp() {
    const result = await this.read(PATHS.HEATER_TEMP);
    if (result.data) {
      // Temperature stored as decicelsius (°C × 10)
      const decicelsius = parseUInt32LE(result.data);
      return temp.toFahrenheit(decicelsius);
    }
    return 0;
  }

  /**
   * Get current target temperature in Fahrenheit
   */
  async getTargetTemp() {
    const result = await this.read(PATHS.TARGET_TEMP);
    if (result.data) {
      // Temperature stored as decicelsius (°C × 10)
      const decicelsius = parseUInt32LE(result.data);
      return temp.toFahrenheit(decicelsius);
    }
    return 0;
  }

  /**
   * Get heater state
   */
  async getHeaterState() {
    const result = await this.read(PATHS.HEATER_STATE);
    if (result.data) {
      const state = result.data[0];
      return {
        code: state,
        name: HEATER_STATES[state] || 'UNKNOWN'
      };
    }
    return { code: 0, name: 'UNKNOWN' };
  }

  // ═══════════════════════════════════════════════════════════════
  // Profiles
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get a heat profile (0-3)
   */
  async getProfile(index) {
    // Serialize reads to avoid overwhelming the device
    const tempResult = await this.read(PATHS.PROFILE_TEMP(index));
    const timeResult = await this.read(PATHS.PROFILE_TIME(index));
    const nameResult = await this.read(PATHS.PROFILE_NAME(index));
    const colorResult = await this.read(PATHS.PROFILE_COLOR(index));

    // Temp is in decicelsius (°C × 10), time is stored as seconds × 200
    const decicelsius = tempResult.data ? parseUInt32LE(tempResult.data) : 0;
    const rawTime = timeResult.data ? parseUInt32LE(timeResult.data) : 0;

    return {
      index,
      temp: temp.toFahrenheit(decicelsius),
      time: Math.round(rawTime / 200), // Convert to seconds
      name: nameResult.data ? parseString(nameResult.data) : `Profile ${index + 1}`,
      color: colorResult.data ? colorResult.data.slice(0, 4) : Buffer.alloc(4) // RGBA bytes
    };
  }

  /**
   * Get all profiles (serialized to avoid overwhelming device)
   */
  async getAllProfiles() {
    const profiles = [];
    for (let i = 0; i < 4; i++) {
      profiles.push(await this.getProfile(i));
    }
    return profiles;
  }

  /**
   * Set profile temperature
   */
  async setProfileTemp(index, fahrenheit) {
    const decicelsius = temp.toDecicelsius(fahrenheit);
    const value = Buffer.alloc(4);
    value.writeUInt32LE(decicelsius);
    return this.write(PATHS.PROFILE_TEMP(index), value);
  }

  /**
   * Set profile time (seconds)
   */
  async setProfileTime(index, seconds) {
    const value = Buffer.alloc(4);
    value.writeUInt32LE(seconds);
    return this.write(PATHS.PROFILE_TIME(index), value);
  }

  // ═══════════════════════════════════════════════════════════════
  // Heating Control
  // ═══════════════════════════════════════════════════════════════

  /**
   * Select a profile (0-3) as the active profile
   */
  async selectProfile(index) {
    const buf = Buffer.alloc(1);
    buf[0] = index;
    return this.write(PATHS.PROFILE_CURRENT, buf);
  }

  /**
   * Get current active profile index
   */
  async getCurrentProfile() {
    const result = await this.read(PATHS.PROFILE_CURRENT);
    if (result.data) {
      return result.data[0];
    }
    return 0;
  }

  /**
   * Start heating using a device profile (0-3)
   */
  async startHeatProfile(profileIndex = 0) {
    // Select the profile
    await this.selectProfile(profileIndex);

    // Send mode command to start heat cycle (7 = HEAT_CYCLE_START)
    const modeBuf = Buffer.alloc(1);
    modeBuf[0] = 7;
    return this.write(PATHS.MODE_COMMAND, modeBuf);
  }

  /**
   * Start heating to a custom target temperature
   */
  async startHeat(fahrenheit) {
    // First set target temp
    const decicelsius = temp.toDecicelsius(fahrenheit);
    const tempBuf = Buffer.alloc(4);
    tempBuf.writeUInt32LE(decicelsius);
    await this.write(PATHS.TARGET_TEMP, tempBuf);

    // Send mode command to start heat cycle (7 = HEAT_CYCLE_START)
    const modeBuf = Buffer.alloc(1);
    modeBuf[0] = 7;
    return this.write(PATHS.MODE_COMMAND, modeBuf);
  }

  /**
   * Stop heating
   */
  async stopHeat() {
    // Send mode command to abort heat cycle (8 = HEAT_CYCLE_ABORT)
    const modeBuf = Buffer.alloc(1);
    modeBuf[0] = 8;
    return this.write(PATHS.MODE_COMMAND, modeBuf);
  }

  /**
   * Get full device status
   */
  async getStatus() {
    const battery = await this.getBattery();
    const heaterTemp = await this.getHeaterTemp();
    const targetTemp = await this.getTargetTemp();
    const heaterState = await this.getHeaterState();
    const deviceInfo = await this.getDeviceInfo();

    return {
      battery,
      heaterTemp,
      targetTemp,
      heaterState,
      ...deviceInfo
    };
  }
}

module.exports = PuffcoCommands;
