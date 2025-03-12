const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let botProcess = null;
let logCallback = null;
let statusCallback = null;

// Update the setupEnv function to use botId as userId for DM mode
const setupEnv = (config) => {
  return new Promise((resolve, reject) => {
    try {
      // If in DM mode and userId is empty, use the botId as the userId
      const userId = (config.channelType === 'dm' && !config.userId) ? config.botId : (config.userId || '');
      
      const envContent = 
        `DISCORD_TOKEN=${config.token}\n` +
        `CHANNEL_TYPE=${config.channelType}\n` +
        `DISCORD_BOT_CHANNEL=${config.channel || ''}\n` +
        `DISCORD_USER_ID=${userId}\n` +
        `DISCORD_BOT_ID=${config.botId}\n` +
        `FISHING_INTERVAL=${config.interval}\n` +
        `AUTO_START_FISHING=false`;
        
      fs.writeFileSync(path.join(__dirname, '.env'), envContent);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

// Start the Discord bot as a child process
const startBot = async (config, logCb, statusCb) => {
  if (botProcess) {
    throw new Error('Bot is already running');
  }
  
  // Set up callbacks
  logCallback = logCb;
  statusCallback = statusCb;
  
  // Save configuration to .env file
  await setupEnv(config);
  
  logCallback('Initializing Discord bot...');
  
  // Spawn the bot process
  botProcess = spawn('node', [path.join(__dirname, 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
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
  
  // Handle process events - DON'T use statusCallback/logCallback directly here
  // The main process will handle these messages and call the appropriate callbacks
  
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