const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
const childWindows = {};

// Default URL to load inside the Electron shell.
// IMPORTANT: This is a dev/preview URL — replace with stable production URL before launch.
const defaultUrl = 'https://ais-dev-uozjwodwx7ctzjsx4334de-668611332745.us-east1.run.app/fullscreen?electron=1';

function createMainWindow() {
  const displays = screen.getAllDisplays();
  
  // Calculate a bounding box that spans all active displays/monitors
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  displays.forEach(display => {
    const { x, y, width, height } = display.bounds;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });
  
  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  mainWindow = new BrowserWindow({
    x: minX,
    y: minY,
    width: totalWidth,
    height: totalHeight,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load the transparent full screen tabletop grid
  mainWindow.loadURL(defaultUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Auto-close any open panel windows
    Object.values(childWindows).forEach(win => {
      if (win && !win.isDestroyed()) win.close();
    });
  });
}

function createChildWindow(mode, title, width = 450, height = 650) {
  if (childWindows[mode] && !childWindows[mode].isDestroyed()) {
    childWindows[mode].focus();
    return;
  }

  const win = new BrowserWindow({
    width,
    height,
    title,
    frame: true,
    alwaysOnTop: true,
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Extract base domain to target the sub-routes in the SPA
  const baseUrl = defaultUrl.split('/fullscreen')[0];
  const modeUrl = `${baseUrl}/fullscreen?electron=1&mode=${mode}`;
  win.loadURL(modeUrl);

  childWindows[mode] = win;

  win.on('closed', () => {
    delete childWindows[mode];
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
ipcMain.on('open-clipart-window', () => {
  createChildWindow('clipart', 'Krajden Grid - Clipart Library', 500, 700);
});

ipcMain.on('open-community-window', () => {
  createChildWindow('clipart', 'Krajden Grid - Community Clipart', 600, 700);
});

ipcMain.on('open-layers-window', () => {
  createChildWindow('layers', 'Krajden Grid - Layers', 400, 600);
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
