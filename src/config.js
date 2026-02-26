/**
 * User configuration
 */

const Conf = require('conf');

const config = new Conf({
  projectName: 'melt',
  defaults: {
    // Display preferences
    tempUnit: 'F', // F or C
    theme: 'dark',
    soundEnabled: false,
    showTerpInfo: true,

    // Default profile
    defaultProfile: 0,
    lastTemp: 490,
    lastTime: 60,
    lastConcentrateType: 'hash_rosin',

    // Quick heat settings
    quickHeatTemp: 490,
    quickHeatTime: 60,

    // Session settings
    autoLogSessions: true,
    cooldownAlert: true,
    cooldownTemp: 200, // Alert when bowl cools to this temp
    readySound: true,

    // Device
    lastDeviceId: null,
    autoConnect: true
  }
});

module.exports = {
  config,

  // Getters
  get(key) {
    return config.get(key);
  },

  // Setters
  set(key, value) {
    config.set(key, value);
  },

  // Temperature display
  displayTemp(fahrenheit) {
    if (config.get('tempUnit') === 'C') {
      return Math.round((fahrenheit - 32) * 5 / 9) + '°C';
    }
    return fahrenheit + '°F';
  },

  // Get temp in preferred unit
  getTempValue(fahrenheit) {
    if (config.get('tempUnit') === 'C') {
      return Math.round((fahrenheit - 32) * 5 / 9);
    }
    return fahrenheit;
  },

  // Parse temp input (handles both F and C)
  parseTemp(input) {
    const value = parseInt(input);
    if (isNaN(value)) return null;

    // If user is in Celsius mode or temp is obviously Celsius
    if (config.get('tempUnit') === 'C' || value < 300) {
      // Assume Celsius, convert to Fahrenheit
      return Math.round(value * 9 / 5 + 32);
    }

    return value;
  },

  // Reset to defaults
  reset() {
    config.clear();
  }
};
