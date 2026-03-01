# Contributing to melt-linux

First off, thank you for considering contributing to `melt-linux`! It's people like you that make expanding hardware control to Linux possible.

This document serves as a set of guidelines for contributing to `melt-linux` and its packages. These are guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Code Style](#code-style)

## Code of Conduct

This project and everyone participating in it is governed by the [melt-linux Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

*   **A clear, descriptive title.**
*   **Exact steps to reproduce the issue.**
*   **Expected behavior vs actual behavior.**
*   **Your Environment:**
    *   Linux Distribution and Version
    *   Node.js version (`node -v`)
    *   Information about your Bluetooth adapter if it's a connection issue (e.g. output of `hciconfig -a` or `bluetoothctl show`)
*   **Relevant logs or error messages.** Try running `melt` commands to capture the exact error output.

> **Note on Bluetooth Issues:** Linux BLE (`BlueZ` + `node-noble`) can be finicky. If your device refuses to connect, try restarting the bluetooth service: `sudo systemctl restart bluetooth` or running with `NOBLE_REPORT_ALL_HCI_EVENTS=1 melt status` before filing a bug.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When you create an enhancement suggestion, please provide:

*   A clear and descriptive title.
*   A detailed description of the proposed enhancement.
*   Specific examples of how the enhancement would be used.
*   Why this enhancement would be useful to most `melt-linux` users.

### Pull Requests

1.  Fork the repo and create your branch from `main`.
2.  If you've added code that should be tested, ensure it works against a real Puffco Proxy device if possible. BLE mock tests are great but hardware behaves unpredictably.
3.  Ensure your code follows the existing style conventions.
4.  Issue that pull request!

## Development Setup

`melt-linux` is a Node.js CLI tool communicating over Bluetooth Low Energy.

### Prerequisites

- Node.js 18+
- `bluez` and `bluez-utils`
- `base-devel` (for compiling native bluetooth bindings)

### Local Build

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/melt-linux.git
   cd melt-linux
   ```
2. Install dependencies (this will take a moment as it compiles native bindings):
   ```bash
   npm install
   ```
3. Run the tool locally:
   ```bash
   node bin/melt.js status
   ```

*Note: You may need to run `sudo setcap cap_net_raw+eip $(readlink -f $(which node))` manually to give your local Node binary permission to access the Bluetooth adapter without root.*

## Code Style

- **Language:** JavaScript (Node.js)
- **Formatting:** 
  - 2-space indentation
  - Single quotes for strings
  - Semi-colons included
- We generally follow standard modern JS conventions. If you're modifying a file, match its existing style.
