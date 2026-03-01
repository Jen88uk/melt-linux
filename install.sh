#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  melt-linux installer
#  Installs melt and all required dependencies on
#  Arch-based Linux distributions (Arch, Manjaro, EndeavourOS, etc.)
#
#  After installation, a tailored uninstall.sh is generated
#  that only removes what THIS install actually changed.
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

# ─────────────────────────────────────────────────────────
# Change tracking — populated as we go
# ─────────────────────────────────────────────────────────

DID_INSTALL_BASE_DEVEL=false
DID_INSTALL_BLUEZ=false
DID_SETCAP=false
DID_PACMAN_HOOK=false
DID_UDEV_RULE=false
DID_NPM_LINK=false

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

if ! node -e "process.exit(parseInt(process.versions.node) >= 18 ? 0 : 1)" 2>/dev/null; then
  error "Node.js 18+ is required. Current version: $(node -v). Upgrade with: sudo pacman -S nodejs npm"
fi

if ! command -v npm &>/dev/null; then
  error "npm not found. Install it with: sudo pacman -S npm"
fi

success "Node.js $(node -v) and npm $(npm -v) found"

# ─────────────────────────────────────────────────────────
# 2. Check / install base-devel
# ─────────────────────────────────────────────────────────

if ! command -v gcc &>/dev/null || ! command -v make &>/dev/null; then
  warn "base-devel not detected (gcc/make missing) — required to compile native addons."
  read -rp "  Install base-devel now? [Y/n] " yn
  case "$yn" in
    [nN]*) error "Aborted. Install base-devel manually: sudo pacman -S base-devel" ;;
    *)
      sudo pacman -S --needed --noconfirm base-devel
      DID_INSTALL_BASE_DEVEL=true
      ;;
  esac
else
  success "Build tools (base-devel) already present"
fi

# ─────────────────────────────────────────────────────────
# 3. Install BlueZ (only if not already installed)
# ─────────────────────────────────────────────────────────

info "Checking Bluetooth stack..."

BLUEZ_MISSING=false
pacman -Q bluez &>/dev/null      || BLUEZ_MISSING=true
pacman -Q bluez-utils &>/dev/null || BLUEZ_MISSING=true

if $BLUEZ_MISSING; then
  info "Installing bluez and bluez-utils..."
  sudo pacman -S --needed --noconfirm bluez bluez-utils
  DID_INSTALL_BLUEZ=true
  success "BlueZ installed"
else
  success "BlueZ already installed — skipping"
fi

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
# 6. Grant BLE permissions to Node.js via setcap
# ─────────────────────────────────────────────────────────

info "Granting BLE raw socket permissions to Node.js (@stoprocent/noble requires cap_net_raw)..."
NODE_REAL="$(readlink -f "$(which node)")"

EXISTING_CAPS="$(getcap "$NODE_REAL" 2>/dev/null || true)"
if echo "$EXISTING_CAPS" | grep -q "cap_net_raw"; then
  success "BLE capabilities already set on $NODE_REAL — skipping"
else
  sudo setcap cap_net_raw+eip "$NODE_REAL"
  DID_SETCAP=true
  success "BLE permissions granted to $NODE_REAL"
  warn "NOTE: upgrading nodejs via pacman will strip this capability."
fi

# ─────────────────────────────────────────────────────────
# 7. Install pacman hook (only if we set the capability)
# ─────────────────────────────────────────────────────────

HOOK_DIR="/etc/pacman.d/hooks"
HOOK_FILE="$HOOK_DIR/melt-node-setcap.hook"

if $DID_SETCAP; then
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
Exec = /bin/bash -c 'setcap cap_net_raw+eip "$(readlink -f "$(which node)")"'
NeedsTargets
EOF
  DID_PACMAN_HOOK=true
  success "pacman hook installed at $HOOK_FILE"
else
  success "pacman hook — skipped (setcap was already present)"
fi

# ─────────────────────────────────────────────────────────
# 8. udev rule for Bluetooth adapter access
# ─────────────────────────────────────────────────────────

UDEV_FILE="/etc/udev/rules.d/99-melt-ble.rules"
if [ ! -f "$UDEV_FILE" ]; then
  info "Creating udev rule for Bluetooth adapter..."
  sudo tee "$UDEV_FILE" > /dev/null <<'EOF'
# Allow users in the 'bluetooth' group access to BT adapter (for melt)
KERNEL=="hci[0-9]*", SUBSYSTEM=="bluetooth", MODE="0660", GROUP="bluetooth"
EOF
  sudo udevadm control --reload-rules
  sudo udevadm trigger
  DID_UDEV_RULE=true
  success "udev rule created at $UDEV_FILE"

  # Ensure the bluetooth group exists (not always created on Arch if bluez was pre-installed)
  if ! getent group bluetooth &>/dev/null; then
    info "Creating 'bluetooth' group..."
    sudo groupadd bluetooth
    success "bluetooth group created"
  fi

  # Add user to bluetooth group if not already a member
  if ! groups "$USER" | grep -q '\bbluetooth\b'; then
    info "Adding $USER to the 'bluetooth' group..."
    sudo usermod -aG bluetooth "$USER" && \
      warn "You must log out and back in for group membership to take effect." || \
      warn "Could not add $USER to bluetooth group — you may need to do this manually."
  fi
else
  success "udev rule already exists — skipping"
fi

# ─────────────────────────────────────────────────────────
# 9. Make `melt` available globally via npm link
# ─────────────────────────────────────────────────────────

info "Linking melt to /usr/local/bin/melt..."
cd "$SCRIPT_DIR"
sudo npm link
DID_NPM_LINK=true
success "melt command installed globally"

# ─────────────────────────────────────────────────────────
# 10. Generate a tailored uninstall.sh for this machine
# ─────────────────────────────────────────────────────────

info "Generating uninstall script for this machine..."

UNINSTALL_FILE="$SCRIPT_DIR/uninstall.sh"

cat > "$UNINSTALL_FILE" <<UNINSTALL_HEADER
#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  melt-linux uninstaller (generated by install.sh)
#  Removes ONLY what was changed on this machine during install.
#  Generated: $(date -u '+%Y-%m-%d %H:%M UTC')
#  Node binary: $NODE_REAL
# ─────────────────────────────────────────────────────────

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

success() { echo -e "\${GREEN}  ✓\${RESET} \$*"; }
skip()    { echo -e "  – \$* (not installed by melt)"; }
warn()    { echo -e "\${YELLOW}  ⚠\${RESET} \$*"; }

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "\${BOLD}  melt — Uninstaller\${RESET}"
echo -e "  This script was generated for this specific machine."
echo ""
read -rp "  Continue? [y/N] " confirm
case "\$confirm" in
  [yY]*) ;;
  *) echo "  Aborted."; exit 0 ;;
esac
echo ""

UNINSTALL_HEADER

# -- Global melt command (always installed if we got this far)
if $DID_NPM_LINK; then
  cat >> "$UNINSTALL_FILE" <<'BLOCK'
# Remove global melt command
if [ -f /usr/bin/melt ] || [ -L /usr/bin/melt ]; then
  cd "$SCRIPT_DIR" && sudo npm unlink --global 2>/dev/null || sudo rm -f /usr/bin/melt
  success "Removed global 'melt' command"
fi

BLOCK
fi

# -- Pacman hook (only if we created it)
if $DID_PACMAN_HOOK; then
  cat >> "$UNINSTALL_FILE" <<BLOCK
# Remove pacman hook
if [ -f "$HOOK_FILE" ]; then
  sudo rm -f "$HOOK_FILE"
  success "Removed pacman hook ($HOOK_FILE)"
fi

BLOCK
fi

# -- udev rule (only if we created it)
if $DID_UDEV_RULE; then
  cat >> "$UNINSTALL_FILE" <<BLOCK
# Remove udev rule
if [ -f "$UDEV_FILE" ]; then
  sudo rm -f "$UDEV_FILE"
  sudo udevadm control --reload-rules && sudo udevadm trigger
  success "Removed udev rule ($UDEV_FILE)"
fi

BLOCK
fi

# -- setcap (only if we applied it)
if $DID_SETCAP; then
  cat >> "$UNINSTALL_FILE" <<BLOCK
# Remove BLE capabilities from Node.js
warn "Removing BLE capabilities from Node.js ($NODE_REAL)."
warn "If other apps use noble/BLE, they may stop working without sudo."
read -rp "  Remove? [y/N] " removecap
case "\$removecap" in
  [yY]*) sudo setcap -r "$NODE_REAL" && success "Removed BLE capabilities from $NODE_REAL" ;;
  *) echo "  – Node.js BLE capabilities left in place" ;;
esac

BLOCK
fi

# -- bluez (only if we installed it)
if $DID_INSTALL_BLUEZ; then
  cat >> "$UNINSTALL_FILE" <<'BLOCK'
# Remove bluez (installed by melt)
read -rp "  Remove bluez / bluez-utils (installed by melt)? [y/N] " rmbluez
case "$rmbluez" in
  [yY]*) sudo pacman -Rns --noconfirm bluez bluez-utils && success "Removed bluez / bluez-utils" ;;
  *) echo "  – bluez left in place" ;;
esac

BLOCK
fi

# -- base-devel (only if we installed it)
if $DID_INSTALL_BASE_DEVEL; then
  cat >> "$UNINSTALL_FILE" <<'BLOCK'
# Remove base-devel (installed by melt)
warn "base-devel was installed by melt. Removing it may affect other development tools."
read -rp "  Remove base-devel? [y/N] " rmdev
case "$rmdev" in
  [yY]*) sudo pacman -Rns --noconfirm base-devel && success "Removed base-devel" ;;
  *) echo "  – base-devel left in place" ;;
esac

BLOCK
fi

# -- node_modules (always)
cat >> "$UNINSTALL_FILE" <<'BLOCK'
# Remove project node_modules
if [ -d "$SCRIPT_DIR/node_modules" ]; then
  rm -rf "$SCRIPT_DIR/node_modules"
  success "Removed node_modules"
fi

echo ""
echo -e "${GREEN}${BOLD}  ✓ melt uninstalled.${RESET}"
echo ""
echo -e "  To fully remove the project, delete this directory:"
echo -e "    ${CYAN}rm -rf $SCRIPT_DIR${RESET}"
echo ""
BLOCK

chmod +x "$UNINSTALL_FILE"
success "Generated $UNINSTALL_FILE"

# ─────────────────────────────────────────────────────────
# 11. Verify
# ─────────────────────────────────────────────────────────

echo ""
if melt --version &>/dev/null; then
  echo -e "${GREEN}${BOLD}  ✓ Installation complete!${RESET}"
  echo ""
  echo -e "  Run ${CYAN}melt${RESET} to get started."
  echo -e "  To uninstall: ${CYAN}./uninstall.sh${RESET}"
  echo ""
else
  error "Installation finished but 'melt --version' failed. Check the output above."
fi
