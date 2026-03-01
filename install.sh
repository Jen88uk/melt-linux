#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  melt-linux installer
#  Installs melt and all required dependencies on
#  Arch-based Linux distributions (Arch, Manjaro, EndeavourOS, etc.)
# ─────────────────────────────────────────────────────────

set -e

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${CYAN}  →${RESET} $*"; }
success() { echo -e "${GREEN}  ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}  ⚠${RESET} $*"; }
error()   { echo -e "${RED}  ✗${RESET} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BOLD}  melt — Linux Installer${RESET}"
echo -e "  ${CYAN}Arch-based systems${RESET}"
echo ""

# ─────────────────────────────────────────────────────────
# 1. Check prerequisites
# ─────────────────────────────────────────────────────────

info "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install it with: sudo pacman -S nodejs npm"
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>/dev/null && echo ok || echo fail)
if [[ "$NODE_VER" == "fail" ]]; then
  error "Node.js 18+ is required. Current version: $(node -v). Install with: sudo pacman -S nodejs npm"
fi

if ! command -v npm &>/dev/null; then
  error "npm not found. Install it with: sudo pacman -S npm"
fi

success "Node.js $(node -v) and npm $(npm -v) found"

# ─────────────────────────────────────────────────────────
# 2. Check base-devel (needed to compile better-sqlite3)
# ─────────────────────────────────────────────────────────

if ! command -v gcc &>/dev/null || ! command -v make &>/dev/null; then
  warn "base-devel not detected (gcc/make missing)."
  warn "melt requires it to compile native addons."
  read -rp "  Install base-devel now? [Y/n] " yn
  case "$yn" in
    [nN]*) error "Aborted. Install base-devel manually: sudo pacman -S base-devel" ;;
    *) sudo pacman -S --needed --noconfirm base-devel ;;
  esac
fi

success "Build tools (base-devel) available"

# ─────────────────────────────────────────────────────────
# 3. Install BlueZ
# ─────────────────────────────────────────────────────────

info "Installing Bluetooth stack (bluez, bluez-utils)..."
sudo pacman -S --needed --noconfirm bluez bluez-utils
success "BlueZ installed"

# ─────────────────────────────────────────────────────────
# 4. Enable & start Bluetooth service
# ─────────────────────────────────────────────────────────

info "Enabling Bluetooth service..."
sudo systemctl enable --now bluetooth
success "Bluetooth service active"

# ─────────────────────────────────────────────────────────
# 5. Install npm dependencies
# ─────────────────────────────────────────────────────────

info "Installing npm dependencies (this compiles native addons)..."
cd "$SCRIPT_DIR"
npm install
success "npm dependencies installed"

# ─────────────────────────────────────────────────────────
# 6. Grant BLE permissions to Node.js
# ─────────────────────────────────────────────────────────
# On Arch, `node` is typically a symlink; setcap must target the real binary.

info "Granting BLE raw socket permissions to Node.js..."
NODE_REAL="$(readlink -f "$(which node)")"
sudo setcap cap_net_raw,cap_net_admin=eip "$NODE_REAL"
success "BLE permissions granted to $NODE_REAL"

warn "NOTE: upgrading nodejs via pacman will strip this capability."
warn "A pacman hook is included to re-apply it automatically (see docs)."

# ─────────────────────────────────────────────────────────
# 7. Install pacman hook to re-apply setcap after Node upgrades
# ─────────────────────────────────────────────────────────

HOOK_DIR="/etc/pacman.d/hooks"
HOOK_FILE="$HOOK_DIR/melt-node-setcap.hook"

info "Installing pacman post-upgrade hook for Node.js..."
sudo mkdir -p "$HOOK_DIR"
sudo tee "$HOOK_FILE" > /dev/null <<'EOF'
[Trigger]
Operation = Upgrade
Type = Package
Target = nodejs

[Action]
Description = Re-applying BLE capabilities to Node.js for melt...
When = PostTransaction
Exec = /bin/bash -c 'setcap cap_net_raw,cap_net_admin=eip "$(readlink -f "$(which node)")"'
NeedsTargets
EOF
success "pacman hook installed at $HOOK_FILE"

# ─────────────────────────────────────────────────────────
# 8. udev rule for Bluetooth adapter access
# ─────────────────────────────────────────────────────────

UDEV_FILE="/etc/udev/rules.d/99-melt-ble.rules"
info "Creating udev rule for Bluetooth adapter..."
sudo tee "$UDEV_FILE" > /dev/null <<'EOF'
# Allow users in the 'bluetooth' group access to BT adapter (for melt)
KERNEL=="hci[0-9]*", SUBSYSTEM=="bluetooth", MODE="0660", GROUP="bluetooth"
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger
success "udev rule created at $UDEV_FILE"

# Ensure current user is in the bluetooth group
if ! groups "$USER" | grep -q '\bbluetooh\b'; then
  info "Adding $USER to the 'bluetooth' group..."
  sudo usermod -aG bluetooth "$USER"
  warn "You must log out and back in for group membership to take effect."
fi

# ─────────────────────────────────────────────────────────
# 9. Make `melt` available globally via npm link
# ─────────────────────────────────────────────────────────

info "Linking melt to /usr/local/bin/melt..."
cd "$SCRIPT_DIR"
sudo npm link
success "melt command installed globally"

# ─────────────────────────────────────────────────────────
# 10. Verify
# ─────────────────────────────────────────────────────────

echo ""
if melt --version &>/dev/null; then
  echo -e "${GREEN}${BOLD}  ✓ Installation complete!${RESET}"
  echo ""
  echo -e "  Run ${CYAN}melt${RESET} to get started."
  echo ""
else
  error "Installation finished but 'melt --version' failed. Check the output above."
fi
