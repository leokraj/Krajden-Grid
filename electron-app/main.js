const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Hide default application menu bar
Menu.setApplicationMenu(null);

// CRITICAL Windows Configuration:
// Standard solid dark background window (#0d0f12) ensures 100% reliable rendering across all Windows graphics drivers and DWM compositors without black screen issues.

let mainWindow = null;
const childWindows = {};

let currentAppUrl = '';

function startLocalWebServer() {
  const webDistPath = path.join(__dirname, 'web_dist');
  if (!fs.existsSync(webDistPath)) {
    console.log('[Electron] web_dist not found');
    return Promise.resolve(null);
  }

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp3': 'audio/mpeg',
    '.webm': 'video/webm'
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      let filePath = path.join(webDistPath, reqPath);

      // Prevent directory traversal
      if (!filePath.startsWith(webDistPath)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }

      // If an API request reaches the local standalone server, respond with real vault data
      if (reqPath.startsWith('/api/')) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id'
        });

        const loadLocalJson = (fileName) => {
          try {
            // Check userData directory first, fallback to app bundle data directory
            const userDir = app.getPath ? app.getPath('userData') : path.join(__dirname, 'data');
            const userFilePath = path.join(userDir, fileName);
            if (fs.existsSync(userFilePath)) {
              return JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));
            }
            const bundleFilePath = path.join(__dirname, 'data', fileName);
            if (fs.existsSync(bundleFilePath)) {
              return JSON.parse(fs.readFileSync(bundleFilePath, 'utf-8'));
            }
          } catch (e) {
            console.error('[Electron] Error reading', fileName, e.message);
          }
          return [];
        };

        if (reqPath.includes('battlemap')) {
          const maps = loadLocalJson('vault_battlemaps.json');
          const cleanMaps = (Array.isArray(maps) ? maps : []).filter(m => !String(m.id || '').startsWith('preset_map_'));
          return res.end(JSON.stringify({ battlemaps: cleanMaps }));
        } else if (reqPath.includes('clipart') || reqPath.includes('token')) {
          const cliparts = loadLocalJson('vault_cliparts.json');
          return res.end(JSON.stringify({ cliparts: Array.isArray(cliparts) ? cliparts : [] }));
        } else if (reqPath.includes('effect')) {
          const effects = loadLocalJson('vault_effects.json');
          return res.end(JSON.stringify({ effects: Array.isArray(effects) ? effects : [] }));
        }
        return res.end(JSON.stringify({ success: true }));
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // SPA fallback to index.html
          filePath = path.join(webDistPath, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
          if (readErr) {
            res.writeHead(500);
            return res.end('Error loading file');
          }
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          res.end(content);
        });
      });
    });

    server.on('error', (err) => {
      console.error('[Electron] Local web server error:', err);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[Electron] Local web server running on http://127.0.0.1:${port}`);
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function createMainWindow(targetUrl) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  if (targetUrl) {
    currentAppUrl = targetUrl;
  }

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    title: 'Krajden Grid',
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d0f12',
      symbolColor: '#caa055',
      height: 28,
    },
    movable: true,
    resizable: true,
    maximizable: true,
    backgroundColor: '#0d0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load the full tabletop grid app
  mainWindow.loadURL(currentAppUrl);

  // Fallback and recovery if URL loading fails
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Electron] Failed to load URL: ${errorCode} - ${errorDescription}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      const offlineHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Krajden Grid - Loading Error</title>
          <style>
            body {
              background: #0d0f12;
              color: #caa055;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            h2 { font-size: 22px; margin-bottom: 8px; color: #fff; }
            p { color: #a0a0a0; font-size: 13px; max-width: 420px; line-height: 1.5; margin-bottom: 16px; }
            button {
              background: #caa055;
              color: #000;
              border: none;
              padding: 10px 24px;
              font-size: 13px;
              font-weight: bold;
              border-radius: 6px;
              cursor: pointer;
              transition: background 0.2s;
            }
            button:hover { background: #d5b271; }
          </style>
        </head>
        <body>
          <h2>Krajden Grid Desktop App</h2>
          <p>Could not load the application bundle. Please click retry to reload.</p>
          <button onclick="window.location.reload()">Retry Loading</button>
        </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlineHtml)}`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Auto-close any open panel windows
    Object.values(childWindows).forEach(win => {
      if (win && !win.isDestroyed()) win.close();
    });
  });
}

function createChildWindow(mode, title, width = 450, height = 650, senderBounds = null) {
  if (childWindows[mode] && !childWindows[mode].isDestroyed()) {
    childWindows[mode].focus();
    return;
  }

  // Position on same monitor as the sender (controls window), not the grid
  let winX, winY;
  if (senderBounds) {
    const senderDisplay = screen.getDisplayMatching(senderBounds);
    const { x, y, width: dw, height: dh } = senderDisplay.workArea;
    // Center the child window on that display
    winX = x + Math.round((dw - width) / 2);
    winY = y + Math.round((dh - height) / 2);
  } else {
    const primary = screen.getPrimaryDisplay().workArea;
    winX = primary.x + Math.round((primary.width - width) / 2);
    winY = primary.y + Math.round((primary.height - height) / 2);
  }

  const win = new BrowserWindow({
    x: winX,
    y: winY,
    width,
    height,
    title,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d0f12',
      symbolColor: '#caa055',
      height: 28,
    },
    movable: true,
    resizable: true,
    alwaysOnTop: false,
    hasShadow: true,
    backgroundColor: '#0d0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Extract base domain to target the sub-routes in the SPA
  const baseUrl = currentAppUrl.split('/fullscreen')[0];
  const modeUrl = `${baseUrl}/fullscreen?electron=1&mode=${mode}`;
  win.loadURL(modeUrl);

  childWindows[mode] = win;

  win.on('closed', () => {
    delete childWindows[mode];
    // If the detached controls window closes for any reason (OS close button,
    // Alt+F4, etc.), tell the main window to show the embedded panel again.
    if (mode === 'controls' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-update', { settings: { controlsDetached: false } });
    }
  });
}

// IPC Relay: Broadcast messages from one window (e.g. controls/settings) to all others
ipcMain.on('broadcast', (event, channel, data) => {
  if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
  Object.keys(childWindows).forEach(mode => {
    const win = childWindows[mode];
    if (win && !win.isDestroyed() && event.sender !== win.webContents) {
      win.webContents.send(channel, data);
    }
  });
});

// IPC Screen / Display management
ipcMain.handle('get-displays', () => {
  try {
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;
    return displays.map((d, index) => ({
      id: d.id,
      name: d.label || `Display ${index + 1} (${d.bounds.width}x${d.bounds.height})`,
      bounds: d.bounds,
      isPrimary: d.id === primaryId
    }));
  } catch (err) {
    console.error('Error in get-displays:', err);
    return [];
  }
});

ipcMain.handle('get-current-display', () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const winBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(winBounds);
    return display ? display.id : null;
  } catch (err) {
    console.error('Error in get-current-display:', err);
    return null;
  }
});

ipcMain.handle('set-display', (event, displayId) => {
  try {
    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(d => d.id === Number(displayId) || d.id.toString() === displayId.toString());
    if (targetDisplay && mainWindow && !mainWindow.isDestroyed()) {
      const { x, y, width, height } = targetDisplay.bounds;
      mainWindow.setBounds({ x, y, width, height });
      mainWindow.webContents.send('display-updated', { displayId, bounds: targetDisplay.bounds });
      Object.values(childWindows).forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('display-updated', { displayId, bounds: targetDisplay.bounds });
        }
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error in set-display:', err);
    return false;
  }
});

// Move a specific window (main or child by mode) to a specific display
ipcMain.handle('move-window-to-display', (event, { windowMode, displayId }) => {
  try {
    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(d => d.id === Number(displayId) || d.id.toString() === displayId.toString());
    if (!targetDisplay) return false;
    const { x, y, width, height } = targetDisplay.bounds;

    const targetWin = windowMode === 'main'
      ? mainWindow
      : (childWindows[windowMode] && !childWindows[windowMode].isDestroyed() ? childWindows[windowMode] : null);

    if (targetWin && !targetWin.isDestroyed()) {
      targetWin.setBounds({ x, y, width, height });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error in move-window-to-display:', err);
    return false;
  }
});

// Snap main window to fullscreen on its current monitor
ipcMain.handle('snap-fullscreen', (event, windowMode) => {
  try {
    const targetWin = windowMode === 'main'
      ? mainWindow
      : (childWindows[windowMode] && !childWindows[windowMode].isDestroyed() ? childWindows[windowMode] : null);
    if (!targetWin || targetWin.isDestroyed()) return false;
    const display = screen.getDisplayMatching(targetWin.getBounds());
    const { x, y, width, height } = display.bounds;
    targetWin.setBounds({ x, y, width, height });
    return true;
  } catch (err) { return false; }
});

// Google & Social Auth flow interceptor
ipcMain.on('google-auth', (event, authUrl) => {
  const authWin = new BrowserWindow({
    width: 600,
    height: 700,
    title: 'Authenticate',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  authWin.loadURL(authUrl);

  const handleRedirect = (url) => {
    if (url.includes('session_id=')) {
      try {
        const parsedUrl = new URL(url);
        let sessionId = '';
        
        if (parsedUrl.hash) {
          sessionId = new URLSearchParams(parsedUrl.hash.substring(1)).get('session_id');
        } else {
          sessionId = parsedUrl.searchParams.get('session_id');
        }
        
        if (sessionId) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('google-session', sessionId);
          }
          authWin.close();
        }
      } catch (err) {
        console.error('Failed to parse redirect URL:', err);
      }
    }
  };

  authWin.webContents.on('will-navigate', (e, url) => handleRedirect(url));
  authWin.webContents.on('did-redirect-navigation', (e, url) => handleRedirect(url));
});

// Window creation actions requested by frontend panels
ipcMain.on('open-clipart-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  const bounds = senderWin ? senderWin.getBounds() : null;
  createChildWindow('clipart', 'Krajden Grid - Clipart & Token Library', 520, 720, bounds);
});

ipcMain.on('open-community-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  const bounds = senderWin ? senderWin.getBounds() : null;
  createChildWindow('clipart', 'Krajden Grid - Community Clipart', 600, 720, bounds);
});

ipcMain.on('open-layers-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  const bounds = senderWin ? senderWin.getBounds() : null;
  createChildWindow('layers', 'Krajden Grid - Battle Maps & Layers', 450, 650, bounds);
});

ipcMain.on('open-effects-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  const bounds = senderWin ? senderWin.getBounds() : null;
  createChildWindow('effects', 'Krajden Grid - Visual Effects Library', 480, 680, bounds);
});

ipcMain.on('open-scenes-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  const bounds = senderWin ? senderWin.getBounds() : null;
  createChildWindow('scenes', 'Krajden Grid - Saved Scenes', 450, 650, bounds);
});

ipcMain.on('open-controls-window', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  const bounds = senderWin ? senderWin.getBounds() : null;
  createChildWindow('controls', 'Krajden Grid - Controls', 420, 800, bounds);
});

ipcMain.on('close-controls-window', () => {
  const win = childWindows['controls'];
  if (win && !win.isDestroyed()) win.close();
});

app.whenReady().then(async () => {
  const localHostUrl = await startLocalWebServer();
  const initialUrl = localHostUrl ? `${localHostUrl}/fullscreen?electron=1` : 'http://127.0.0.1:3000/fullscreen?electron=1';
  
  createMainWindow(initialUrl);

  // Controls are detached by default — open the Controls window automatically
  // on startup so the grid window stays clean from the very first launch.
  // Wait briefly for the main window's display bounds to be available.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      createChildWindow('controls', 'Krajden Grid - Controls', 420, 800, bounds);
    }
  }, 400);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(initialUrl);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
