const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  broadcast: (channel, data) => {
    ipcRenderer.send('broadcast', channel, data);
  },
  
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  getDisplays: () => ipcRenderer.invoke('get-displays'),
  setDisplayId: (id) => ipcRenderer.invoke('set-display', id),
  getCurrentDisplayId: () => ipcRenderer.invoke('get-current-display'),
  
  googleAuth: (authUrl) => {
    ipcRenderer.send('google-auth', authUrl);
  },
  
  onGoogleSession: (callback) => {
    ipcRenderer.on('google-session', (event, sessionId) => callback(sessionId));
  },
  
  openClipartWindow: () => {
    ipcRenderer.send('open-clipart-window');
  },
  
  openCommunityWindow: () => {
    ipcRenderer.send('open-community-window');
  },
  
  openLayersWindow: () => {
    ipcRenderer.send('open-layers-window');
  },
  
  openEffectsWindow: () => {
    ipcRenderer.send('open-effects-window');
  },
  
  openScenesWindow: () => {
    ipcRenderer.send('open-scenes-window');
  },

  openControlsWindow: () => {
    ipcRenderer.send('open-controls-window');
  },

  closeControlsWindow: () => {
    ipcRenderer.send('close-controls-window');
  }
});
