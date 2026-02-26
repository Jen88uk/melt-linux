/**
 * Color themes and visual styling
 */

const chalk = require('chalk');
const gradient = require('gradient-string');

// ═══════════════════════════════════════════════════════════════
// Color Palettes
// ═══════════════════════════════════════════════════════════════

const PALETTES = {
  heat: ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#8e44ad'],
  cool: ['#74b9ff', '#81ecec', '#55efc4', '#00b894'],
  fire: ['#fdcb6e', '#e17055', '#d63031', '#6c5ce7'],
  purple: ['#a29bfe', '#6c5ce7', '#5f27cd', '#341f97'],
  matrix: ['#00ff00', '#00cc00', '#009900', '#006600'],
  sunset: ['#f8b500', '#ff6f61', '#d65db1', '#845ec2'],
  ocean: ['#00cec9', '#0984e3', '#6c5ce7', '#a29bfe']
};

// ═══════════════════════════════════════════════════════════════
// Gradient Generators
// ═══════════════════════════════════════════════════════════════

const gradients = {
  heat: gradient(PALETTES.heat),
  cool: gradient(PALETTES.cool),
  fire: gradient(PALETTES.fire),
  purple: gradient(PALETTES.purple),
  matrix: gradient(PALETTES.matrix),
  sunset: gradient(PALETTES.sunset),
  ocean: gradient(PALETTES.ocean),
  rainbow: gradient.rainbow,
  vice: gradient.vice,
  passion: gradient.passion
};

// ═══════════════════════════════════════════════════════════════
// Temperature-based colors
// ═══════════════════════════════════════════════════════════════

/**
 * Get color based on temperature
 */
function getTempColor(temp) {
  if (temp < 200) return chalk.hex('#3498db'); // Blue - cold
  if (temp < 350) return chalk.hex('#2ecc71'); // Green - warming
  if (temp < 450) return chalk.hex('#f1c40f'); // Yellow - warm
  if (temp < 520) return chalk.hex('#e67e22'); // Orange - hot
  if (temp < 580) return chalk.hex('#e74c3c'); // Red - very hot
  return chalk.hex('#8e44ad'); // Purple - extreme
}

/**
 * Get gradient text based on temperature
 */
function getTempGradient(text, temp) {
  if (temp < 300) return gradients.cool(text);
  if (temp < 450) return gradients.ocean(text);
  if (temp < 550) return gradients.sunset(text);
  return gradients.fire(text);
}

/**
 * Create a temperature progress bar
 */
function tempProgressBar(current, target, width = 30) {
  const percent = Math.min(current / target, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;

  const filledChar = '█';
  const emptyChar = '░';

  let bar = '';

  // Create gradient effect on filled portion
  for (let i = 0; i < filled; i++) {
    const tempAtPoint = (i / width) * target;
    bar += getTempColor(tempAtPoint)(filledChar);
  }

  bar += chalk.gray(emptyChar.repeat(empty));

  return bar;
}

// ═══════════════════════════════════════════════════════════════
// Box Drawing
// ═══════════════════════════════════════════════════════════════

const BOX = {
  // Single line
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',

  // Double line
  dTopLeft: '╔',
  dTopRight: '╗',
  dBottomLeft: '╚',
  dBottomRight: '╝',
  dHorizontal: '═',
  dVertical: '║',

  // Rounded
  rTopLeft: '╭',
  rTopRight: '╮',
  rBottomLeft: '╰',
  rBottomRight: '╯'
};

/**
 * Create a box around text
 */
function box(content, options = {}) {
  const {
    padding = 1,
    style = 'rounded',
    borderColor = 'white',
    titleColor = 'cyan',
    title = null
  } = options;

  const lines = content.split('\n');
  const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const width = maxLen + (padding * 2);

  let corners;
  if (style === 'double') {
    corners = { tl: BOX.dTopLeft, tr: BOX.dTopRight, bl: BOX.dBottomLeft, br: BOX.dBottomRight, h: BOX.dHorizontal, v: BOX.dVertical };
  } else if (style === 'rounded') {
    corners = { tl: BOX.rTopLeft, tr: BOX.rTopRight, bl: BOX.rBottomLeft, br: BOX.rBottomRight, h: BOX.horizontal, v: BOX.vertical };
  } else {
    corners = { tl: BOX.topLeft, tr: BOX.topRight, bl: BOX.bottomLeft, br: BOX.bottomRight, h: BOX.horizontal, v: BOX.vertical };
  }

  const colorFn = chalk[borderColor] || chalk.white;
  const titleFn = chalk[titleColor] || chalk.cyan;

  let top = corners.tl + corners.h.repeat(width) + corners.tr;
  if (title) {
    const titleText = ` ${title} `;
    const titleStart = Math.floor((width - titleText.length) / 2);
    top = corners.tl +
      corners.h.repeat(titleStart) +
      titleFn(titleText) +
      corners.h.repeat(width - titleStart - titleText.length) +
      corners.tr;
  }

  const bottom = corners.bl + corners.h.repeat(width) + corners.br;

  const paddedLines = lines.map(line => {
    const stripped = stripAnsi(line);
    const padRight = width - stripped.length - padding;
    return corners.v + ' '.repeat(padding) + line + ' '.repeat(Math.max(0, padRight)) + corners.v;
  });

  return colorFn([top, ...paddedLines, bottom].join('\n'));
}

// ═══════════════════════════════════════════════════════════════
// Status Icons
// ═══════════════════════════════════════════════════════════════

const ICONS = {
  fire: '🔥',
  temp: '🌡️',
  battery: '🔋',
  batteryLow: '🪫',
  bolt: '⚡',
  check: '✓',
  cross: '✗',
  star: '★',
  cloud: '☁️',
  smoke: '💨',
  timer: '⏱️',
  clock: '🕐',
  leaf: '🌿',
  sparkle: '✨',
  warning: '⚠️',
  signal: '📶',
  connected: '🔌',
  heat: '♨️'
};

// ═══════════════════════════════════════════════════════════════
// Spinners
// ═══════════════════════════════════════════════════════════════

const SPINNERS = {
  heating: {
    frames: ['🔥', '🔥', '🔥', '💨', '🔥', '🔥', '🔥', '💨'],
    interval: 120
  },
  dots: {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval: 80
  },
  pulse: {
    frames: ['█', '▓', '▒', '░', '▒', '▓'],
    interval: 100
  },
  wave: {
    frames: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
    interval: 80
  }
};

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Strip ANSI codes from string
 */
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Center text in given width
 */
function center(text, width) {
  const stripped = stripAnsi(text);
  const pad = Math.max(0, Math.floor((width - stripped.length) / 2));
  return ' '.repeat(pad) + text;
}

/**
 * Right-align text in given width
 */
function right(text, width) {
  const stripped = stripAnsi(text);
  const pad = Math.max(0, width - stripped.length);
  return ' '.repeat(pad) + text;
}

module.exports = {
  PALETTES,
  gradients,
  getTempColor,
  getTempGradient,
  tempProgressBar,
  BOX,
  box,
  ICONS,
  SPINNERS,
  stripAnsi,
  center,
  right
};
