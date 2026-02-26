/**
 * Puffco Proxy BLE Protocol
 * Reverse engineered from captured BLE traffic
 */

const crypto = require('crypto');

// Auth keys (from PuffcoPC)
const DEVICE_HANDSHAKE_KEY = Buffer.from('FUrZc0WilhUBteT2JlCc+A==', 'base64');
const DEVICE_HANDSHAKE2_KEY = Buffer.from('ZMZFYlbyb1scoSc3pd1x+w==', 'base64');

// BLE Service UUIDs
const SERVICES = {
  MAIN: 'e276967f-ea8a-478a-a92e-d78f5dd15dd5',
  DEVICE: '420b9b40-457d-4abe-a3bf-71609d79581b'
};

// BLE Characteristic UUIDs
const CHARACTERISTICS = {
  // Main service
  AUTH_STATUS: '05434bca-cc7f-4ef6-bbb3-b1c520b9800c',    // Read
  NOTIFY_ALT: '43312cd1-7d34-46ce-a7d3-0a98fd9b4cb8',     // Notify
  COMMAND: '60133d5c-5727-4f2c-9697-d842c5292a3c',        // Write
  RESPONSE: '8dc5ec05-8f7d-45ad-99db-3fbde65dbd9c',       // Notify

  // Device service
  GIT_HASH: '4daad5ae-8a9e-417d-924d-b237ac64ad9c',       // Read
  DEVICE_STATE: '58b0a7aa-d89f-4bf2-961d-0d892d7439d8',   // Read
  SERIAL: 'a5fa5a5d-f28e-47d9-b95b-f82c06177503',         // Read
  DEVICE_WRITE: 'c830ee3e-0e32-4780-a51d-b1b0b38089a4'    // Write
};

// API Paths (REST-like API over BLE)
const PATHS = {
  // System info
  FW_API: '/p/sys/fw/api',
  FW_GIT: '/p/sys/fw/gith',
  HW_MODEL: '/p/sys/hw/mdcd',
  BT_MAC: '/p/sys/bt/mac',
  DEVICE_NAME: '/u/sys/name',
  BIRTHDAY: '/u/sys/bday',
  DAB_COUNT: '/p/app/odom/0/nc',

  // Battery
  BATTERY_SOC: '/p/bat/soc',
  BATTERY_MSOC: '/u/bat/msoc',
  BATTERY_CAP: '/p/bat/cap',
  CHARGE_STATUS: '/p/bat/chg/stat',
  CHARGE_ETF: '/p/bat/chg/etf',

  // Heater
  HEATER_TEMP: '/p/app/htr/temp',      // Current temp (decicelsius)
  HEATER_STATE: '/p/app/stat/id',      // Operating state (7=preheat, 8=active, 9=fade)
  MODE_COMMAND: '/p/app/mc',           // Mode command: 7=start heat, 8=stop
  TARGET_TEMP: '/p/app/thc/temp',      // Current target temp
  TARGET_TIME: '/p/app/thc/time',
  TARGET_INTENSITY: '/p/app/thc/intn',
  TARGET_COLOR: '/p/app/thc/colr',

  // Heat profiles (0-3)
  PROFILE_CURRENT: '/p/app/hcp',         // Current/active profile index
  PROFILE_TEMP: (n) => `/u/app/hc/${n}/temp`,
  PROFILE_TIME: (n) => `/u/app/hc/${n}/time`,
  PROFILE_NAME: (n) => `/u/app/hc/${n}/name`,
  PROFILE_COLOR: (n) => `/u/app/hc/${n}/colr`,
  PROFILE_INTENSITY: (n) => `/u/app/hc/${n}/intn`,

  // Bowl temp (real-time during session)
  BOWL_TEMP: '/u/app/hc/0/btmp',
  BOWL_TIME: '/u/app/hc/0/btim',

  // UI
  LED_BRIGHTNESS: '/u/app/ui/lbrt'
};

// Command types (Lorax protocol)
const COMMANDS = {
  GET_ACCESS_SEED: 0x00,  // Request auth seed
  UNLOCK_ACCESS: 0x01,    // Send auth token
  GET_LIMITS: 0x02,       // Get device limits
  GET: 0x10,              // Read a path (READ_SHORT)
  SET: 0x11,              // Write to a path (WRITE_SHORT)
  SUBSCRIBE: 0x20,        // Subscribe to updates
  WRITE: 0x22,            // Write buffer
};

// Operating states (from PuffcoPC)
const HEATER_STATES = {
  0: 'IDLE',
  1: 'VERSION_CHECK',
  2: 'DEVICE_INIT',
  3: 'TEMP_SELECT',
  4: 'PREHEAT_PENDING',
  5: 'STANDBY',
  6: 'STEALTH_STANDBY',
  7: 'HEAT_PREHEAT',      // Heating up
  8: 'HEAT_ACTIVE',       // At temp, session active
  9: 'HEAT_FADE',         // Cooling down after session
  10: 'LANTERN_ACTIVE'
};

/**
 * Temperature conversion utilities
 */
const temp = {
  // Convert decicelsius (device storage) to Fahrenheit
  toFahrenheit: (decicelsius) => {
    const celsius = decicelsius / 10;
    return Math.round(celsius * 9 / 5 + 32);
  },

  // Convert Fahrenheit to decicelsius (device storage)
  toDecicelsius: (fahrenheit) => {
    const celsius = (fahrenheit - 32) * 5 / 9;
    return Math.round(celsius * 10);
  },

  // Convert Fahrenheit to Celsius
  toCelsius: (fahrenheit) => {
    return Math.round((fahrenheit - 32) * 5 / 9);
  }
};

/**
 * Build a GET (READ_SHORT) command packet
 * Format: [seq_lo, seq_hi, opcode, payload...]
 * Payload: [flags_lo, flags_hi, maxPayload_lo, maxPayload_hi, ...path]
 */
function buildGetCommand(seq, path, maxPayload = 125) {
  const pathBytes = Buffer.from(path, 'ascii');
  // Header (3 bytes: seq + opcode) + payload (4 bytes: flags + maxPayload) + path
  const packet = Buffer.alloc(3 + 4 + pathBytes.length);

  packet.writeUInt16LE(seq, 0);          // 16-bit sequence ID
  packet[2] = COMMANDS.GET;               // Command type (READ_SHORT = 0x10)
  packet.writeUInt16LE(0, 3);             // Flags (always 0)
  packet.writeUInt16LE(maxPayload, 5);    // Max payload size
  pathBytes.copy(packet, 7);

  return packet;
}

/**
 * Build a SET (WRITE_SHORT) command packet
 * Format: [seq_lo, seq_hi, opcode, payload...]
 * Payload: [flags_lo, flags_hi, mode, ...path, 0x00, ...value]
 * Captured format: 8f 00 11 00 00 04 2f 70... (has extra 04 byte)
 */
function buildSetCommand(seq, path, value, flags = 0, mode = 4) {
  const pathBytes = Buffer.from(path, 'ascii');
  const valueBytes = Buffer.isBuffer(value) ? value : Buffer.from([value]);

  // Header (3 bytes) + flags (2 bytes) + mode (1 byte) + path + null + value
  const packet = Buffer.alloc(3 + 2 + 1 + pathBytes.length + 1 + valueBytes.length);

  packet.writeUInt16LE(seq, 0);          // 16-bit sequence ID
  packet[2] = COMMANDS.SET;               // Command type (WRITE_SHORT = 0x11)
  packet.writeUInt16LE(flags, 3);         // Flags
  packet[5] = mode;                        // Mode byte (usually 4)
  pathBytes.copy(packet, 6);
  packet[6 + pathBytes.length] = 0x00;    // Null terminator for path
  valueBytes.copy(packet, 6 + pathBytes.length + 1);

  return packet;
}

/**
 * Build a heat start command
 */
function buildHeatCommand(seq, targetTemp) {
  // Convert to little-endian 16-bit
  const tempLE = Buffer.alloc(2);
  tempLE.writeUInt16LE(targetTemp);

  const packet = Buffer.alloc(6);
  packet[0] = seq & 0xFF;
  packet[1] = 0x00;
  packet[2] = COMMANDS.HEAT_CMD;
  packet[3] = tempLE[0];  // Temp low byte
  packet[4] = tempLE[1];  // Temp high byte
  packet[5] = 0x00;

  return packet;
}

/**
 * Parse a response packet
 * Format: [seq_lo, seq_hi, status, ...data]
 */
function parseResponse(data) {
  if (data.length < 3) {
    return { seq: 0, status: 255, data: null };
  }

  const seq = data.readUInt16LE(0);  // 16-bit sequence ID
  const status = data[2];             // 0 = success

  if (data.length > 3) {
    const payload = data.slice(3);
    return { seq, status, data: payload };
  }

  return { seq, status, data: null };
}

/**
 * Parse a 32-bit little-endian integer from response
 */
function parseUInt32LE(data) {
  if (!data || data.length < 4) return 0;
  return data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
}

/**
 * Parse a 16-bit little-endian integer from response
 */
function parseUInt16LE(data) {
  if (!data || data.length < 2) return 0;
  return data[0] | (data[1] << 8);
}

/**
 * Parse string from response
 */
function parseString(data) {
  if (!data) return '';
  return data.toString('ascii').replace(/\0/g, '');
}

/**
 * Parse a 32-bit float from response (little-endian)
 */
function parseFloat32LE(data) {
  if (!data || data.length < 4) return 0;
  return data.readFloatLE(0);
}

/**
 * Create auth token from access seed
 * Algorithm: SHA256(handshakeKey + accessSeed)[:16]
 * Note: Uses DEVICE_HANDSHAKE2_KEY by default (required for newer firmware)
 */
function createAuthToken(accessSeed, handshakeKey = DEVICE_HANDSHAKE2_KEY) {
  // Concatenate key (16 bytes) + seed (16 bytes)
  const combined = Buffer.alloc(32);
  handshakeKey.copy(combined, 0, 0, 16);
  accessSeed.copy(combined, 16, 0, 16);

  // SHA256 hash and take first 16 bytes
  const hash = crypto.createHash('sha256').update(combined).digest();
  return hash.slice(0, 16);
}

/**
 * Build a command packet with 16-bit sequence ID
 * Format: [seq_lo, seq_hi, opcode, ...payload]
 */
function buildCommand(seq, opcode, payload = null) {
  const headerLen = 3; // 2 bytes seq + 1 byte opcode
  const payloadLen = payload ? payload.length : 0;
  const packet = Buffer.alloc(headerLen + payloadLen);

  packet.writeUInt16LE(seq, 0);  // 16-bit sequence ID (little endian)
  packet[2] = opcode;

  if (payload) {
    payload.copy(packet, 3);
  }

  return packet;
}

/**
 * Build GET_ACCESS_SEED command (request auth challenge)
 */
function buildGetAccessSeedCommand(seq) {
  return buildCommand(seq, COMMANDS.GET_ACCESS_SEED);
}

/**
 * Build UNLOCK_ACCESS command (send auth token)
 */
function buildUnlockAccessCommand(seq, authToken) {
  return buildCommand(seq, COMMANDS.UNLOCK_ACCESS, authToken);
}

/**
 * Build GET_LIMITS command (get protocol limits)
 */
function buildGetLimitsCommand(seq) {
  return buildCommand(seq, COMMANDS.GET_LIMITS);
}

module.exports = {
  SERVICES,
  CHARACTERISTICS,
  PATHS,
  COMMANDS,
  HEATER_STATES,
  DEVICE_HANDSHAKE_KEY,
  DEVICE_HANDSHAKE2_KEY,
  temp,
  buildCommand,
  buildGetCommand,
  buildSetCommand,
  buildHeatCommand,
  buildGetAccessSeedCommand,
  buildUnlockAccessCommand,
  buildGetLimitsCommand,
  createAuthToken,
  parseResponse,
  parseUInt32LE,
  parseUInt16LE,
  parseFloat32LE,
  parseString
};
