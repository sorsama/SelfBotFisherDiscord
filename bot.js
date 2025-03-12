const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');

let botProcess = null;
let logCallback = null;
let statusCallback = null;

// Get the correct path to index.js in both dev and production
const getIndexPath = () => {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, 'index.js');
  } else {
    return path.join(process.resourcesPath, 'app', 'index.js');
  }
};

// Start the Discord bot as a child process
const startBot = async (config, logCb, statusCb) => {
  if (botProcess) {
    throw new Error('Bot is already running');
  }
  
  // Set up callbacks
  logCallback = logCb;
  statusCallback = statusCb;
  
  logCallback('Initializing Discord bot...');
  
  // Prepare environment variables for the child process
  const env = {
    ...process.env,
    DISCORD_TOKEN: config.token,
    CHANNEL_TYPE: config.channelType,
    DISCORD_BOT_CHANNEL: config.channel || '',
    DISCORD_USER_ID: (config.channelType === 'dm' && !config.userId) 
      ? config.botId 
      : (config.userId || ''),
    DISCORD_BOT_ID: config.botId,
    FISHING_INTERVAL: config.interval.toString(),
    AUTO_START_FISHING: config.autoStart ? 'true' : 'false'
  };

  // Get the correct path to index.js
  const indexPath = getIndexPath();
  logCallback(`Starting bot using index.js at: ${indexPath}`);
  
  // Spawn the bot process with the environment variables
  botProcess = spawn('node', [indexPath], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: env
  });
  
  // Handle process output
  botProcess.stdout.on('data', (data) => {
    const messages = data.toString().trim().split('\n');
    messages.forEach(message => {
      if (message) logCallback(message);
    });
  });
  
  botProcess.stderr.on('data', (data) => {
    const messages = data.toString().trim().split('\n');
    messages.forEach(message => {
      if (message) logCallback(`ERROR: ${message}`);
    });
  });
  
  botProcess.on('close', (code) => {
    logCallback(`Bot process exited with code ${code}`);
    statusCallback('Stopped');
    botProcess = null;
  });

  botProcess.on('error', (err) => {
    logCallback(`Bot process error: ${err.message}`);
    statusCallback('Stopped');
    botProcess = null;
  });

  // Set up a timeout to check if the bot is ready
  const timeout = setTimeout(() => {
    if (botProcess) {
      logCallback('Bot startup timed out, but process is still running');
      statusCallback('Running (Timed out)');
    }
  }, 10000);

  // Wait for the ready signal from the bot
  return new Promise((resolve, reject) => {
    botProcess.on('message', function onReady(message) {
      if (message && message.type === 'ready') {
        clearTimeout(timeout);
        statusCallback('Running');
        botProcess.removeListener('message', onReady);
        resolve(botProcess);
      }
    });
    
    // Also handle process exit during startup
    botProcess.on('exit', function onExit(code) {
      clearTimeout(timeout);
      reject(new Error(`Bot process exited during startup with code ${code}`));
      botProcess.removeListener('exit', onExit);
    });
  });
};

// Stop the bot process
const stopBot = async () => {
  return new Promise((resolve, reject) => {
    if (!botProcess) {
      return resolve();
    }
    
    try {
      // First try to gracefully exit
      if (botProcess.connected) {
        botProcess.send({ command: 'shutdown' });
        
        // Give it a moment to shut down gracefully
        setTimeout(() => {
          if (botProcess) {
            botProcess.kill();
            botProcess = null;
          }
          resolve();
        }, 1000);
      } else {
        // If not connected, force kill
        botProcess.kill();
        botProcess = null;
        resolve();
      }
    } catch (error) {
      // If any error occurs, force kill
      try {
        if (botProcess) botProcess.kill();
      } catch (e) {
        console.error('Error killing process:', e);
      }
      botProcess = null;
      reject(error);
    }
  });
};

module.exports = { startBot, stopBot };