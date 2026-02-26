/**
 * Concentrate type presets for the hash connoisseur
 */

const PRESETS = {
  // ═══════════════════════════════════════════════════════════════
  // Solventless (The Good Stuff)
  // ═══════════════════════════════════════════════════════════════
  hash_rosin: {
    temp: 490,
    time: 60,
    name: 'Hash Rosin',
    desc: 'Full melt perfection - low temp to preserve those terps',
    color: 0xFFD700, // Gold
    category: 'solventless'
  },
  live_rosin: {
    temp: 500,
    time: 75,
    name: 'Live Rosin',
    desc: 'Fresh frozen goodness - terpy and flavorful',
    color: 0x90EE90, // Light green
    category: 'solventless'
  },
  bubble_hash: {
    temp: 480,
    time: 60,
    name: 'Bubble Hash',
    desc: 'Ice water extraction - old school flavor',
    color: 0xDEB887, // Burlywood
    category: 'solventless'
  },
  dry_sift: {
    temp: 485,
    time: 55,
    name: 'Dry Sift',
    desc: 'Trichome heads only - sandy goodness',
    color: 0xF4A460, // Sandy brown
    category: 'solventless'
  },

  // ═══════════════════════════════════════════════════════════════
  // BHO / Hydrocarbon
  // ═══════════════════════════════════════════════════════════════
  live_resin: {
    temp: 520,
    time: 60,
    name: 'Live Resin',
    desc: 'Balanced flavor and vapor - the daily driver',
    color: 0xFFA500, // Orange
    category: 'bho'
  },
  diamonds: {
    temp: 550,
    time: 45,
    name: 'Diamonds',
    desc: 'Pure THCa crystals - face melting potency',
    color: 0xE0FFFF, // Light cyan (diamond sparkle)
    category: 'bho'
  },
  sauce: {
    temp: 510,
    time: 55,
    name: 'Sauce',
    desc: 'Terp soup with crystals - best of both worlds',
    color: 0xFFE4B5, // Moccasin
    category: 'bho'
  },
  badder: {
    temp: 510,
    time: 60,
    name: 'Badder',
    desc: 'Whipped and creamy - smooth clouds',
    color: 0xFFFACD, // Lemon chiffon
    category: 'bho'
  },
  sugar: {
    temp: 530,
    time: 50,
    name: 'Sugar',
    desc: 'Crystalline texture - sweet hits',
    color: 0xFFFFE0, // Light yellow
    category: 'bho'
  },
  shatter: {
    temp: 540,
    time: 45,
    name: 'Shatter',
    desc: 'Glass-like classic - clean and potent',
    color: 0xFFD700, // Gold
    category: 'bho'
  },
  crumble: {
    temp: 525,
    time: 50,
    name: 'Crumble',
    desc: 'Honeycomb texture - easy to work with',
    color: 0xDEB887, // Burlywood
    category: 'bho'
  },

  // ═══════════════════════════════════════════════════════════════
  // Special Modes
  // ═══════════════════════════════════════════════════════════════
  cold_start: {
    temp: 450,
    time: 90,
    name: 'Cold Start',
    desc: 'Low and slow terp ride - load before heat',
    color: 0x87CEEB, // Sky blue
    category: 'special'
  },
  flavor_chaser: {
    temp: 470,
    time: 45,
    name: 'Flavor Chaser',
    desc: 'Pure terp expression - connoisseur mode',
    color: 0x98FB98, // Pale green
    category: 'special'
  },
  cloud_mode: {
    temp: 560,
    time: 40,
    name: 'Cloud Mode',
    desc: 'Maximum vapor production - chunky clouds',
    color: 0xB0C4DE, // Light steel blue
    category: 'special'
  },
  ripper: {
    temp: 580,
    time: 30,
    name: 'Ripper',
    desc: 'Face melter - not for the faint of heart',
    color: 0xFF4500, // Orange red
    category: 'special'
  },
  sesh_mode: {
    temp: 500,
    time: 120,
    name: 'Sesh Mode',
    desc: 'Extended session - keep it warm for the homies',
    color: 0x9370DB, // Medium purple
    category: 'special'
  }
};

// Temperature ranges for different effects
const TEMP_RANGES = {
  terpy: { min: 450, max: 500, desc: 'Maximum flavor, light vapor' },
  balanced: { min: 500, max: 540, desc: 'Good flavor and vapor' },
  cloudy: { min: 540, max: 580, desc: 'Maximum vapor, less flavor' },
  ripper: { min: 580, max: 620, desc: 'Cough city - use with caution' }
};

// Terpene boiling points (for the true connoisseur)
const TERPENES = {
  myrcene: { boilPoint: 334, effects: 'Relaxing, sedative', aroma: 'Earthy, musky' },
  limonene: { boilPoint: 349, effects: 'Uplifting, energetic', aroma: 'Citrus' },
  pinene: { boilPoint: 311, effects: 'Alert, focused', aroma: 'Pine' },
  linalool: { boilPoint: 388, effects: 'Calming, anti-anxiety', aroma: 'Floral, lavender' },
  caryophyllene: { boilPoint: 320, effects: 'Anti-inflammatory', aroma: 'Spicy, peppery' },
  humulene: { boilPoint: 388, effects: 'Appetite suppressant', aroma: 'Hoppy, earthy' },
  terpinolene: { boilPoint: 365, effects: 'Uplifting, creative', aroma: 'Herbal, floral' }
};

/**
 * Get preset by name
 */
function getPreset(name) {
  const key = name.toLowerCase().replace(/[^a-z_]/g, '_');
  return PRESETS[key] || null;
}

/**
 * Get all presets in a category
 */
function getPresetsByCategory(category) {
  return Object.entries(PRESETS)
    .filter(([_, preset]) => preset.category === category)
    .map(([key, preset]) => ({ key, ...preset }));
}

/**
 * Get suggested temp range based on target effect
 */
function getTempRange(effect) {
  return TEMP_RANGES[effect] || TEMP_RANGES.balanced;
}

/**
 * Get terpenes that would be preserved at a given temp
 */
function getPreservedTerpenes(fahrenheit) {
  return Object.entries(TERPENES)
    .filter(([_, terp]) => terp.boilPoint <= fahrenheit)
    .map(([name, info]) => ({ name, ...info }));
}

module.exports = {
  PRESETS,
  TEMP_RANGES,
  TERPENES,
  getPreset,
  getPresetsByCategory,
  getTempRange,
  getPreservedTerpenes
};
