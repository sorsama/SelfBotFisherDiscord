const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
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
let tray = null;
let botRunning = false;
let botProcess = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame: false, // Remove default frame for custom title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#36393f', // Discord background color
    show: false // Don't show until ready
  });

  mainWindow.loadFile('index.html');
  
  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Handle close event to minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

// Set up tray
function createTray() {
  // Use different icon paths based on platform
  const iconPath = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Discord Fisher', 
      click: () => {
        mainWindow.show();
      }
    },
    { 
      label: 'Toggle Fishing',
      click: () => {
        if (botProcess && botProcess.send) {
          botProcess.send({ command: 'toggle-fishing' });
        }
      },
      enabled: botRunning
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Discord Fishing Bot');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      showNotification('Discord Fishing Bot', 'App minimized to system tray.', () => {
        mainWindow.show();
      });
    } else {
      mainWindow.show();
    }
  });
}

function showNotification(title, body, onClick = null) {
  // Don't show notifications on macOS when app is focused
  if (process.platform === 'darwin' && BrowserWindow.getAllWindows().some(win => win.isFocused())) {
    return;
  }
  
  const notification = new Notification({
    title: title,
    body: body,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: false
  });
  
  if (onClick) {
    notification.on('click', onClick);
  }
  
  notification.show();
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Window control handlers
  ipcMain.handle('minimize-window', () => {
    mainWindow.minimize();
    return { success: true };
  });
  
  ipcMain.handle('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { success: true, maximized: mainWindow.isMaximized() };
  });
  
  ipcMain.handle('close-window', () => {
    mainWindow.hide();
    showNotification('Discord Fishing Bot', 'App is still running in the system tray.', () => {
      mainWindow.show();
    });
    return { success: true };
  });
  
  ipcMain.handle('quit-app', () => {
    isQuitting = true;
    app.quit();
    return { success: true };
  });

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

      // Update tray menu when bot is running
      botRunning = true;
      const newMenu = Menu.buildFromTemplate([
        { 
          label: 'Show Discord Fisher', 
          click: () => {
            mainWindow.show();
          }
        },
        { 
          label: 'Toggle Fishing',
          click: () => {
            if (botProcess && botProcess.send) {
              botProcess.send({ command: 'toggle-fishing' });
            }
          },
          enabled: true
        },
        { type: 'separator' },
        { 
          label: 'Quit', 
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray.setContextMenu(newMenu);

      botProcess.on('message', (message) => {
        if (message.type === 'status') {
          mainWindow.webContents.send('status-update', message.status);
        } else if (message.type === 'log') {
          mainWindow.webContents.send('log-message', message.content);
        } else if (message.type === 'embed') {
          // Forward embed messages to the renderer
          mainWindow.webContents.send('embed-message', message.content);
          
          // Show notification if window is hidden and this is a fishing result
          if (!mainWindow.isVisible() && message.source === 'fishing-bot') {
            let notificationTitle = 'New Fishing Message';
            let notificationBody = 'You received a message from the fishing bot.';
            
            if (message.content.description) {
              // Try to extract a meaningful notification from the description
              const desc = message.content.description;
              
              // Check if it's a catch message
              if (desc.includes('caught') || desc.includes('fish')) {
                const catchMatch = desc.match(/(You caught:[^\n]+)/i);
                if (catchMatch) {
                  notificationTitle = 'Caught Something!';
                  notificationBody = catchMatch[1].replace(/<:[^:]+:[^>]+>/g, ''); // Remove emojis
                }
              }
              
              // Check if it's a verification message
              if (desc.toLowerCase().includes('verify')) {
                notificationTitle = '⚠️ Verification Required!';
                notificationBody = 'The fishing bot needs verification. Click to view.';
              }
            }
            
            showNotification(notificationTitle, notificationBody, () => {
              mainWindow.show();
            });
          }
        }
      });
      
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
      
      // Update tray menu when bot is stopped
      const newMenu = Menu.buildFromTemplate([
        { 
          label: 'Show Discord Fisher', 
          click: () => {
            mainWindow.show();
          }
        },
        { 
          label: 'Toggle Fishing',
          enabled: false
        },
        { type: 'separator' },
        { 
          label: 'Quit', 
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray.setContextMenu(newMenu);
      
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
        
        // We'll need to listen for a response to determine if fishing was started or stopped
        botProcess.once('message', (message) => {
          if (message.type === 'status') {
            if (message.status === 'Fishing') {
              showNotification('Fishing Started', 'The bot has started fishing.', () => {
                mainWindow.show();
              });
            } else if (message.status === 'Running (Not Fishing)') {
              showNotification('Fishing Stopped', 'The bot has stopped fishing.', () => {
                mainWindow.show();
              });
            }
          }
        });
        
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

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

// On macOS, recreate window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// Set the quitting flag when actually quitting
app.on('before-quit', () => {
  isQuitting = true;
});