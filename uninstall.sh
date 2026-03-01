#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  melt-linux uninstaller
#  Removes only what the melt installer added.
#  Does NOT touch: nodejs, npm, bluez, or the bluetooth service.
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
skip()    { echo -e "  ${RESET}–${RESET} $* (skipped, not found)"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BOLD}  melt — Uninstaller${RESET}"
echo ""
echo -e "  This will remove melt and its installer additions only."
echo -e "  ${YELLOW}Node.js, npm, bluez, and the Bluetooth service will not be touched.${RESET}"
echo ""
read -rp "  Continue? [y/N] " confirm
case "$confirm" in
  [yY]*) ;;
  *) echo "  Aborted."; exit 0 ;;
esac
echo ""

# ─────────────────────────────────────────────────────────
# 1. Remove global `melt` command (npm unlink)
# ─────────────────────────────────────────────────────────

info "Removing global 'melt' command..."
if [ -f /usr/bin/melt ] || [ -L /usr/bin/melt ]; then
  cd "$SCRIPT_DIR"
  sudo npm unlink --global 2>/dev/null || sudo rm -f /usr/bin/melt
  success "Removed /usr/bin/melt"
else
  skip "/usr/bin/melt"
fi

# ─────────────────────────────────────────────────────────
# 2. Remove pacman hook
# ─────────────────────────────────────────────────────────

HOOK_FILE="/etc/pacman.d/hooks/melt-node-setcap.hook"
info "Removing pacman hook..."
if [ -f "$HOOK_FILE" ]; then
  sudo rm -f "$HOOK_FILE"
  success "Removed $HOOK_FILE"
else
  skip "$HOOK_FILE"
fi

# ─────────────────────────────────────────────────────────
# 3. Remove udev rule
# ─────────────────────────────────────────────────────────

UDEV_FILE="/etc/udev/rules.d/99-melt-ble.rules"
info "Removing udev rule..."
if [ -f "$UDEV_FILE" ]; then
  sudo rm -f "$UDEV_FILE"
  sudo udevadm control --reload-rules
  sudo udevadm trigger
  success "Removed $UDEV_FILE"
else
  skip "$UDEV_FILE"
fi

# ─────────────────────────────────────────────────────────
# 4. Remove setcap capabilities from Node binary
#    Only removes if the hook file existed (i.e. we set it).
#    Warns the user so they can decide if other tools rely on this.
# ─────────────────────────────────────────────────────────

NODE_REAL="$(readlink -f "$(which node)" 2>/dev/null || true)"
if [ -n "$NODE_REAL" ]; then
  CURRENT_CAPS="$(getcap "$NODE_REAL" 2>/dev/null || true)"
  if echo "$CURRENT_CAPS" | grep -q "cap_net_raw"; then
    warn "Node.js has BLE capabilities set (cap_net_raw,cap_net_admin)."
    warn "These were applied by the melt installer."
    warn "Removing them will prevent other tools that use noble/BLE from working without sudo."
    echo ""
    read -rp "  Remove BLE capabilities from Node.js? [y/N] " removecap
    case "$removecap" in
      [yY]*)
        sudo setcap -r "$NODE_REAL"
        success "Removed BLE capabilities from $NODE_REAL"
        ;;
      *)
        skip "Node.js BLE capabilities (left in place)"
        ;;
    esac
  else
    skip "No BLE capabilities found on $NODE_REAL"
  fi
fi

# ─────────────────────────────────────────────────────────
# 5. Remove node_modules from project directory
# ─────────────────────────────────────────────────────────

info "Removing project node_modules..."
if [ -d "$SCRIPT_DIR/node_modules" ]; then
  rm -rf "$SCRIPT_DIR/node_modules"
  success "Removed $SCRIPT_DIR/node_modules"
else
  skip "$SCRIPT_DIR/node_modules"
fi

# ─────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}  ✓ melt has been uninstalled.${RESET}"
echo ""
echo -e "  The following were ${YELLOW}intentionally left untouched${RESET}:"
echo -e "    - nodejs / npm"
echo -e "    - bluez / bluez-utils"
echo -e "    - Bluetooth service"
echo -e "    - Project source files (this directory)"
echo ""
echo -e "  To fully remove the project, delete this directory:"
echo -e "    ${CYAN}rm -rf $SCRIPT_DIR${RESET}"
echo ""
