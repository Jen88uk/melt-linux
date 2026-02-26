/**
 * MELT - ASCII Art and visual elements
 */

const chalk = require('chalk');
const gradient = require('gradient-string');

// Custom gradient for melt aesthetic
const meltGradient = gradient(['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff']);
const heatGradient = gradient(['#fdcb6e', '#e17055', '#d63031']);
const coolGradient = gradient(['#74b9ff', '#0984e3', '#6c5ce7']);

// ═══════════════════════════════════════════════════════════════
// Logo
// ═══════════════════════════════════════════════════════════════

const LOGO = `
 ███╗   ███╗███████╗██╗  ████████╗
 ████╗ ████║██╔════╝██║  ╚══██╔══╝
 ██╔████╔██║█████╗  ██║     ██║
 ██║╚██╔╝██║██╔══╝  ██║     ██║
 ██║ ╚═╝ ██║███████╗███████╗██║
 ╚═╝     ╚═╝╚══════╝╚══════╝╚═╝
`;

const LOGO_MINI = `┃ MELT ┃`;

const TAGLINE = 'full melt hash control';

// ═══════════════════════════════════════════════════════════════
// Display Functions
// ═══════════════════════════════════════════════════════════════

function getLogo() {
  return meltGradient(LOGO) + '\n' + chalk.gray(`  ${TAGLINE}\n`);
}

function getLogoMini() {
  return meltGradient(LOGO_MINI);
}

function header(text) {
  const line = '─'.repeat(40);
  return chalk.gray(line) + '\n' + meltGradient.multiline(`  ${text}`) + '\n' + chalk.gray(line);
}

// ═══════════════════════════════════════════════════════════════
// Status Components
// ═══════════════════════════════════════════════════════════════

function batteryBar(percent) {
  const width = 10;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  let color;
  let icon;
  if (percent > 60) {
    color = chalk.green;
    icon = '●';
  } else if (percent > 30) {
    color = chalk.yellow;
    icon = '●';
  } else if (percent > 10) {
    color = chalk.red;
    icon = '●';
  } else {
    color = chalk.red;
    icon = '○';
  }

  const bar = color(icon.repeat(filled)) + chalk.gray('○'.repeat(empty));
  return `${bar} ${color(percent + '%')}`;
}

function tempBar(current, target, width = 20) {
  if (!target || target === 0) {
    return chalk.gray('─'.repeat(width));
  }

  const percent = Math.min(current / target, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;

  // Color based on how close to target
  let barColor;
  if (percent < 0.5) barColor = chalk.cyan;
  else if (percent < 0.8) barColor = chalk.yellow;
  else if (percent < 1) barColor = chalk.hex('#e67e22');
  else barColor = chalk.green;

  return barColor('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function stateLabel(stateCode, stateName) {
  const labels = {
    0: chalk.gray('idle'),
    5: chalk.gray('standby'),
    7: chalk.yellow('heating'),
    8: chalk.green('ready'),
    9: chalk.cyan('cooling')
  };
  return labels[stateCode] || chalk.gray(stateName?.toLowerCase() || 'unknown');
}

// ═══════════════════════════════════════════════════════════════
// Heat Curve Visualization
// ═══════════════════════════════════════════════════════════════

function heatCurve(temps, width = 40, height = 8) {
  if (!temps || temps.length === 0) return chalk.gray('  no data');

  const max = Math.max(...temps);
  const min = Math.min(...temps);
  const range = max - min || 1;

  const lines = [];

  for (let y = height - 1; y >= 0; y--) {
    const threshold = min + (range * y / (height - 1));
    let line = chalk.gray(Math.round(threshold).toString().padStart(4) + ' │');

    for (let x = 0; x < width; x++) {
      const idx = Math.floor((x / width) * temps.length);
      const temp = temps[idx] || 0;

      if (temp >= threshold) {
        if (temp > 500) line += chalk.red('█');
        else if (temp > 400) line += chalk.yellow('█');
        else if (temp > 300) line += chalk.cyan('█');
        else line += chalk.blue('█');
      } else {
        line += ' ';
      }
    }
    lines.push(line);
  }

  lines.push(chalk.gray('     └' + '─'.repeat(width)));

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// Box Drawing
// ═══════════════════════════════════════════════════════════════

function box(content, title = null) {
  const lines = content.split('\n');
  const width = Math.max(...lines.map(l => stripAnsi(l).length), title ? title.length + 4 : 0);

  let top = chalk.gray('╭' + '─'.repeat(width + 2) + '╮');
  if (title) {
    const pad = Math.floor((width - title.length) / 2);
    top = chalk.gray('╭─') + meltGradient(title) + chalk.gray('─'.repeat(width - title.length) + '╮');
  }

  const middle = lines.map(line => {
    const stripped = stripAnsi(line);
    const padding = width - stripped.length;
    return chalk.gray('│ ') + line + ' '.repeat(padding) + chalk.gray(' │');
  });

  const bottom = chalk.gray('╰' + '─'.repeat(width + 2) + '╯');

  return [top, ...middle, bottom].join('\n');
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = {
  LOGO,
  LOGO_MINI,
  TAGLINE,
  getLogo,
  getLogoMini,
  header,
  batteryBar,
  tempBar,
  stateLabel,
  heatCurve,
  box,
  stripAnsi,
  meltGradient,
  heatGradient,
  coolGradient
};
