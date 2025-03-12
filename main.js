const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Simple config storage
const configPath = path.join(__dirname, 'config.json');
const store = {
  get: (key, defaultValue) => {
    try {
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return data[key] !== undefined ? data[key] : defaultValue;
      }
    } catch (error) {
      console.error('Error reading config:', error);
    }
    return defaultValue;
  },
  set: (key, value) => {
    try {
      let data = {};
      if (fs.existsSync(configPath)) {
        data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      data[key] = value;
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }
};

const { startBot, stopBot } = require('./bot');

let mainWindow;
let botRunning = false;
let botProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
  createWindow();

  // Send saved config to renderer when requested
  ipcMain.handle('get-config', () => {
    return {
      token: store.get('token', ''),
      channel: store.get('channel', ''),
      botId: store.get('botId', '574652751745777665'), 
      interval: store.get('interval', 3000)
    };
  });

  // Save config from renderer
  ipcMain.handle('save-config', (event, config) => {
    store.set('token', config.token);
    store.set('channel', config.channel);
    store.set('botId', config.botId);
    store.set('interval', config.interval);
    return { success: true };
  });

  // Start fishing bot
  ipcMain.handle('start-bot', async (event, config) => {
    if (botRunning) return { success: false, message: 'Bot already running' };
    
    try {
      botProcess = await startBot(config, 
        // Log callback
        (message) => {
          mainWindow.webContents.send('log-message', message);
        },
        // Status callback
        (status) => {
          mainWindow.webContents.send('status-update', status);
        }
      );

      // Fixed: This code was using undefined callbacks
      botProcess.on('message', (message) => {
        if (message.type === 'status') {
          mainWindow.webContents.send('status-update', message.status);
        } else if (message.type === 'log') {
          mainWindow.webContents.send('log-message', message.content);
        } else if (message.type === 'embed') {
          // Forward embed messages to the renderer
          mainWindow.webContents.send('embed-message', message.content);
        }
      });
      
      botRunning = true;
      return { success: true };
    } catch (error) {
      console.error('Failed to start bot:', error);
      return { success: false, message: error.message };
    }
  });

  // Stop fishing bot
  ipcMain.handle('stop-bot', async () => {
    if (!botRunning) return { success: false, message: 'Bot is not running' };
    
    try {
      await stopBot();
      botRunning = false;
      return { success: true };
    } catch (error) {
      console.error('Failed to stop bot:', error);
      return { success: false, message: error.message };
    }
  });

  // Toggle fishing action
  ipcMain.handle('toggle-fishing', async () => {
    if (!botRunning) return { success: false, message: 'Bot is not running' };
    
    try {
      // Send a message to the bot process
      if (botProcess && botProcess.send) {
        botProcess.send({ command: 'toggle-fishing' });
        return { success: true };
      } else {
        return { success: false, message: 'Bot process not available' };
      }
    } catch (error) {
      console.error('Failed to toggle fishing:', error);
      return { success: false, message: error.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});