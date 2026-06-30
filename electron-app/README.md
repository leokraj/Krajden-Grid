# Krajden Grid - Desktop Application Launcher

This is the lightweight Electron desktop wrapper for **Krajden Grid**. It embeds the live tabletop canvas into an always-on-top, click-through transparent screen overlay, with fully synchronized draggable floating windows.

## Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your computer.

## How to Run & Test

1. **Download / Export code**: Export this applet from the **Settings (Gear Icon) -> Export as ZIP** in the AI Studio sidebar, or clone the project files.
2. Unpack the zip file.
3. Open a terminal (Command Prompt, PowerShell, or macOS/Linux Terminal) and navigate to the `electron-app` folder:
   ```bash
   cd electron-app
   ```
4. Install the required dependencies:
   ```bash
   npm install
   ```
5. Launch the desktop application wrapper for instant preview:
   ```bash
   npm start
   ```

## How to Build the Professional Windows Installer (.exe)

You can compile a professional-looking, custom **NSIS Windows Installer (`.exe`)** with choosing installation folders, desktop/start-menu shortcuts, and automatic uninstallation registry entries.

1. Open a terminal in the `electron-app` folder.
2. Run the distribution command:
   ```bash
   npm run dist
   ```
3. Once completed, your custom Windows Installer `.exe` will be located inside the newly generated `dist/` folder:
   - **Installer path**: `electron-app/dist/OverGrid Setup 1.0.0.exe`

*Note: You can run the build from Windows, macOS, or Linux! It targets Windows 64-bit systems.*

## Key Desktop Features Loaded

- **Multi-Monitor Transparency Overlay**: Spans all connected monitors and allows you to look at any map background beneath.
- **Detachable Panel Architecture**: Supports launching Clipart, Community Cliparts, and Background Layers as independent floating companion panels.
- **Secure Google Authentication**: Employs an Electron pop-up proxy to login securely and seamlessly link back to your web session.
