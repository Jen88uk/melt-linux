# melt

Full melt hash control. Terminal-based Puffco controller.

```
 ███╗   ███╗███████╗██╗  ████████╗
 ████╗ ████║██╔════╝██║  ╚══██╔══╝
 ██╔████╔██║█████╗  ██║     ██║
 ██║╚██╔╝██║██╔══╝  ██║     ██║
 ██║ ╚═╝ ██║███████╗███████╗██║
 ╚═╝     ╚═╝╚══════╝╚══════╝╚═╝
```

## Install

Clone the repo and run the installer:

```bash
git clone https://github.com/jen88uk/melt-linux.git
cd melt-linux
chmod +x install.sh
./install.sh
```

The installer will:
- Install `bluez` and `bluez-utils` via `pacman`
- Enable the Bluetooth service
- Compile native dependencies
- Grant BLE permissions to Node.js (`setcap`)
- Install a `pacman` hook to preserve permissions on Node upgrades
- Register `melt` as a global command

> **Note:** You will need `sudo` access. Node.js 18+ must be installed beforehand (`sudo pacman -S nodejs npm`).

## Usage

```bash
melt              # show help
melt status       # battery, temp, dab count
melt profiles     # list heat profiles
melt heat 0       # heat with profile 0
melt stop         # stop heating
melt reset        # fix connection issues
```

**Tip:** If you have multiple Bluetooth adapters, select a specific one with:

```bash
NOBLE_HCI_DEVICE_ID=1 melt status
```

## Requirements

- Linux (Arch-based: Arch, Manjaro, EndeavourOS, etc.)
- Node.js 18+
- BlueZ (`bluez`, `bluez-utils`) — installed automatically by the installer
- Puffco Proxy (tested on latest firmware)

## Screenshot
<img width="705" height="1101" alt="image" src="https://github.com/user-attachments/assets/ae2bc2af-42ea-4532-b4d4-c4fa80fb23b0" />

## Credits

`melt` was originally created by **[ryleyio](https://github.com/ryleyio)** for macOS.  
This repository is a Linux port, adapted to run on Arch-based systems using `@abandonware/noble` and BlueZ.  
Full credit for the original application, protocol work, and UI goes to ryleyio.

## Disclaimer

Unofficial tool. Not affiliated with Puffco. Use at your own risk.

If you'd like to support the work that made this possible, you can buy the **original author (ryleyio)** a coffee:

<a href="https://buymeacoffee.com/ryleyio" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" 
       alt="Buy Me A Coffee" 
       style="height: 60px !important;width: 217px !important;" >
</a>
