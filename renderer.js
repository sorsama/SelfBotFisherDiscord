document.addEventListener('DOMContentLoaded', () => {
  console.log('Renderer loaded');
  
  // Get DOM elements
  const tokenInput = document.getElementById('token');
  const channelInput = document.getElementById('channel');
  const botIdInput = document.getElementById('botId');
  const intervalInput = document.getElementById('interval');
  const saveBtn = document.getElementById('saveBtn');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const toggleFishingBtn = document.getElementById('toggleFishingBtn');
  const logOutput = document.getElementById('logOutput');
  const statusElement = document.getElementById('botStatus');
  
  // Helper functions
  function addToLog(message) {
    const line = document.createElement('div');
    line.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    line.textContent = `[${timestamp}] ${message}`;
    
    logOutput.appendChild(line);
    logOutput.scrollTop = logOutput.scrollHeight;
  }
  
  function updateStatus(status) {
    statusElement.textContent = status;
    statusElement.className = 'status';
    
    if (status.toLowerCase().includes('running')) {
      statusElement.classList.add('running');
    } else if (status.toLowerCase().includes('stopped')) {
      statusElement.classList.add('stopped');
    } else if (status.toLowerCase().includes('fishing')) {
      statusElement.classList.add('fishing');  
    } else if (status.toLowerCase().includes('starting')) {
      statusElement.classList.add('starting');
    } else if (status.toLowerCase().includes('stopping')) {
      statusElement.classList.add('stopping');
    }
  }
  
  // Load initial config
  async function loadConfig() {
    try {
      if (!window.electronAPI) {
        addToLog('ERROR: electronAPI not available. Preload script may not be loaded correctly.');
        return;
      }
      
      const config = await window.electronAPI.getConfig();
      tokenInput.value = config.token || '';
      channelInput.value = config.channel || '';
      botIdInput.value = config.botId || '574652751745777665'; // Virtual Fisher default
      intervalInput.value = config.interval || 3000;
      addToLog('Configuration loaded successfully');
    } catch (error) {
      addToLog(`ERROR loading config: ${error.message}`);
    }
  }
  
  // Check if electronAPI is available (properly preloaded)
  if (!window.electronAPI) {
    addToLog('ERROR: electronAPI is not available. Check your preload script configuration.');
  } else {
    addToLog('electronAPI is available');
    loadConfig();
  }
  
  // Save config
  saveBtn.addEventListener('click', async () => {
    try {
      if (!window.electronAPI) {
        addToLog('ERROR: electronAPI not available');
        return;
      }
      
      const config = {
        token: tokenInput.value,
        channel: channelInput.value,
        botId: botIdInput.value || '574652751745777665',
        interval: parseInt(intervalInput.value) || 3000
      };
      
      const result = await window.electronAPI.saveConfig(config);
      
      if (result.success) {
        addToLog('Configuration saved successfully');
      } else {
        addToLog('Failed to save configuration: ' + result.message);
      }
    } catch (error) {
      addToLog(`ERROR saving config: ${error.message}`);
    }
  });
  
  // Start bot
  startBtn.addEventListener('click', async () => {
    try {
      const config = {
        token: tokenInput.value,
        channel: channelInput.value,
        botId: botIdInput.value || '574652751745777665',
        interval: parseInt(intervalInput.value) || 3000
      };
      
      if (!config.token) {
        addToLog('ERROR: Discord token is required');
        return;
      }
      
      if (!config.channel) {
        addToLog('ERROR: Channel ID is required');
        return;
      }
      
      const result = await window.electronAPI.startBot(config);
      
      if (result.success) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        toggleFishingBtn.disabled = false;
        updateStatus('Starting...');
        addToLog('Bot starting...');
      } else {
        addToLog('Failed to start bot: ' + result.message);
      }
    } catch (error) {
      addToLog(`ERROR starting bot: ${error.message}`);
    }
  });
  
  // Stop bot
  stopBtn.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.stopBot();
      
      if (result.success) {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        toggleFishingBtn.disabled = true;
        updateStatus('Stopping...');
        addToLog('Bot stopping...');
      } else {
        addToLog('Failed to stop bot: ' + result.message);
      }
    } catch (error) {
      addToLog(`ERROR stopping bot: ${error.message}`);
    }
  });
  
  // Toggle fishing
  toggleFishingBtn.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.toggleFishing();
      
      if (!result.success) {
        addToLog('Failed to toggle fishing: ' + result.message);
      }
    } catch (error) {
      addToLog(`ERROR toggling fishing: ${error.message}`);
    }
  });
  
  // Register event listeners
  window.electronAPI.onLogMessage(addToLog);
  window.electronAPI.onStatusUpdate(updateStatus);
  window.electronAPI.onEmbedReceived(renderEmbed);

  // Function to render Discord embeds in the log
  function renderEmbed(embedData) {
    // Get the embeds container
    const embedsContainer = document.getElementById('embedsDisplay');
    if (!embedsContainer) {
      console.error('Embeds container not found');
      return;
    }
    
    // Clear previous embeds
    embedsContainer.innerHTML = '';
    
    // Create the embed container
    const embedContainer = document.createElement('div');
    embedContainer.className = 'discord-embed';
    
    // Embed color bar
    if (embedData.color) {
      const colorBar = document.createElement('div');
      colorBar.className = 'embed-color-bar';
      colorBar.style.backgroundColor = `#${embedData.color.toString(16).padStart(6, '0')}`;
      embedContainer.appendChild(colorBar);
    }
    
    const embedContent = document.createElement('div');
    embedContent.className = 'embed-content';
    
    // Author
    if (embedData.author) {
      const authorElement = document.createElement('div');
      authorElement.className = 'embed-author';
      
      if (embedData.author.iconURL) {
        const authorIcon = document.createElement('img');
        authorIcon.src = embedData.author.iconURL;
        authorIcon.className = 'embed-author-icon';
        authorElement.appendChild(authorIcon);
      }
      
      const authorName = document.createElement('span');
      authorName.textContent = embedData.author.name;
      authorElement.appendChild(authorName);
      
      embedContent.appendChild(authorElement);
    }
    
    // Title
    if (embedData.title) {
      const titleElement = document.createElement('div');
      titleElement.className = 'embed-title';
      titleElement.textContent = embedData.title;
      embedContent.appendChild(titleElement);
    }
    
    // Description
    if (embedData.description) {
      const descriptionElement = document.createElement('div');
      descriptionElement.className = 'embed-description';
      descriptionElement.innerHTML = formatDiscordText(embedData.description);
      embedContent.appendChild(descriptionElement);
    }
    
    // Fields
    if (embedData.fields && embedData.fields.length > 0) {
      const fieldsContainer = document.createElement('div');
      fieldsContainer.className = 'embed-fields';
      
      embedData.fields.forEach(field => {
        const fieldElement = document.createElement('div');
        fieldElement.className = `embed-field ${field.inline ? 'embed-field-inline' : ''}`;
        
        const fieldName = document.createElement('div');
        fieldName.className = 'embed-field-name';
        fieldName.textContent = field.name;
        
        const fieldValue = document.createElement('div');
        fieldValue.className = 'embed-field-value';
        fieldValue.innerHTML = formatDiscordText(field.value);
        
        fieldElement.appendChild(fieldName);
        fieldElement.appendChild(fieldValue);
        fieldsContainer.appendChild(fieldElement);
      });
      
      embedContent.appendChild(fieldsContainer);
    }
    
    // Image
    if (embedData.image) {
      const imageElement = document.createElement('img');
      imageElement.className = 'embed-image';
      imageElement.src = embedData.image;
      embedContent.appendChild(imageElement);
    }
    
    // Thumbnail
    if (embedData.thumbnail) {
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.className = 'embed-thumbnail-container';
      
      const thumbnailElement = document.createElement('img');
      thumbnailElement.className = 'embed-thumbnail';
      thumbnailElement.src = embedData.thumbnail;
      
      thumbnailContainer.appendChild(thumbnailElement);
      embedContainer.appendChild(thumbnailContainer);
    }
    
    // Footer
    if (embedData.footer) {
      const footerElement = document.createElement('div');
      footerElement.className = 'embed-footer';
      
      if (embedData.footer.iconURL) {
        const footerIcon = document.createElement('img');
        footerIcon.src = embedData.footer.iconURL;
        footerIcon.className = 'embed-footer-icon';
        footerElement.appendChild(footerIcon);
      }
      
      const footerText = document.createElement('span');
      footerText.textContent = embedData.footer.text;
      footerElement.appendChild(footerText);
      
      if (embedData.timestamp) {
        const timestamp = document.createElement('span');
        timestamp.className = 'embed-footer-timestamp';
        const date = new Date(embedData.timestamp);
        timestamp.textContent = ` • ${date.toLocaleTimeString()}`;
        footerElement.appendChild(timestamp);
      }
      
      embedContent.appendChild(footerElement);
    }
    
    embedContainer.appendChild(embedContent);
    embedsContainer.appendChild(embedContainer);
    
    // Also add a simple log entry about receiving an embed
    addToLog(`Received a message from fishing bot${embedData.title ? `: "${embedData.title}"` : ''}`);
  }
  
  // Helper function to format Discord text (emojis, markdown, etc.)
  function formatDiscordText(text) {
    if (!text) return '';
    
    // Process the text in a temporary div element
    const tempDiv = document.createElement('div');
    
    // First, escape HTML to prevent XSS
    tempDiv.textContent = text;
    text = tempDiv.innerHTML;
    
    // Process custom emoji tags <:name:id>
    text = text.replace(/<:([a-zA-Z0-9_]+):(\d+)>/g, 
      '▶️EMOJI_PLACEHOLDER_$1_$2◀️');
    
    // Process animated emoji tags <a:name:id>
    text = text.replace(/<a:([a-zA-Z0-9_]+):(\d+)>/g, 
      '▶️ANIMATED_EMOJI_PLACEHOLDER_$1_$2◀️');
    
    // Convert markdown (bold, italic, etc.)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
    text = text.replace(/__(.*?)__/g, '<u>$1</u>');
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Convert URLs to clickable links
    text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert Discord mentions
    text = text.replace(/<@!?(\d+)>/g, '<span class="discord-mention">@user</span>');
    text = text.replace(/<@&(\d+)>/g, '<span class="discord-mention">@role</span>');
    text = text.replace(/<#(\d+)>/g, '<span class="discord-mention">#channel</span>');
    
    // Replace newlines with <br>
    text = text.replace(/\n/g, '<br>');
    
    // Set the processed HTML to the temp div
    tempDiv.innerHTML = text;
    
    // Now replace emoji placeholders with actual img elements
    // This two-step process prevents HTML parsing issues
    const textNodes = [];
    const walk = document.createTreeWalker(
      tempDiv, 
      NodeFilter.SHOW_TEXT, 
      null, 
      false
    );
    
    // Collect all text nodes first
    let node;
    while (node = walk.nextNode()) {
      textNodes.push(node);
    }
    
    // Process each text node
    textNodes.forEach(textNode => {
      // Process regular emojis
      if (textNode.nodeValue.includes('▶️EMOJI_PLACEHOLDER_')) {
        const parts = textNode.nodeValue.split(/(▶️EMOJI_PLACEHOLDER_[a-zA-Z0-9_]+_\d+◀️)/g);
        
        if (parts.length > 1) {
          const fragment = document.createDocumentFragment();
          
          parts.forEach(part => {
            const match = part.match(/▶️EMOJI_PLACEHOLDER_([a-zA-Z0-9_]+)_(\d+)◀️/);
            
            if (match) {
              const [_, name, id] = match;
              const span = document.createElement('span');
              span.className = 'emoji-container';
              span.textContent = `:${name}:`;
              
              const img = document.createElement('img');
              img.className = 'discord-emoji';
              img.alt = `:${name}:`;
              img.src = `https://cdn.discordapp.com/emojis/${id}.webp`;
              img.onerror = function() {
                this.style.display = 'none';
              };
              
              span.innerHTML = '';
              span.appendChild(img);
              fragment.appendChild(span);
            } else if (part) {
              fragment.appendChild(document.createTextNode(part));
            }
          });
          
          textNode.parentNode.replaceChild(fragment, textNode);
        }
      }
      
      // Process animated emojis
      else if (textNode.nodeValue.includes('▶️ANIMATED_EMOJI_PLACEHOLDER_')) {
        const parts = textNode.nodeValue.split(/(▶️ANIMATED_EMOJI_PLACEHOLDER_[a-zA-Z0-9_]+_\d+◀️)/g);
        
        if (parts.length > 1) {
          const fragment = document.createDocumentFragment();
          
          parts.forEach(part => {
            const match = part.match(/▶️ANIMATED_EMOJI_PLACEHOLDER_([a-zA-Z0-9_]+)_(\d+)◀️/);
            
            if (match) {
              const [_, name, id] = match;
              const span = document.createElement('span');
              span.className = 'emoji-container';
              span.textContent = `:${name}:`;
              
              const img = document.createElement('img');
              img.className = 'discord-emoji';
              img.alt = `:${name}:`;
              img.src = `https://cdn.discordapp.com/emojis/${id}.gif`;
              img.onerror = function() {
                this.style.display = 'none';
              };
              
              span.innerHTML = '';
              span.appendChild(img);
              fragment.appendChild(span);
            } else if (part) {
              fragment.appendChild(document.createTextNode(part));
            }
          });
          
          textNode.parentNode.replaceChild(fragment, textNode);
        }
      }
    });
    
    return tempDiv.innerHTML;
  }
});