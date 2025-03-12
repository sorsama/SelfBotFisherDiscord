const { Client } = require("discord.js-selfbot-v13");
const client = new Client();

// Store active fishing sessions
let fishingActive = false;
let fishingInterval = null;
let fishingChannel = null;
const FISHING_BOT_ID = process.env.DISCORD_BOT_ID || "574652751745777665";
const FISHING_INTERVAL_MS = parseInt(process.env.FISHING_INTERVAL) || 3000;
const TARGET_CHANNEL_ID = process.env.DISCORD_BOT_CHANNEL;
const TARGET_USER_ID = process.env.DISCORD_USER_ID;
const CHANNEL_TYPE = process.env.CHANNEL_TYPE || 'server';

// Handle IPC messages from parent process
if (process.send) {
  process.on('message', (message) => {
    console.log(`Received IPC message: ${JSON.stringify(message)}`);
    
    if (message.command === 'toggle-fishing') {
      // Check current fishing state and toggle it
      if (fishingActive) {
        stopFishing();
        process.send({ 
          type: 'log', 
          content: '⚠️ Fishing stopped via UI button' 
        });
        process.send({ 
          type: 'status', 
          status: 'Running (Not Fishing)' 
        });
      } else {
        if (fishingChannel) {
          startFishing();
          process.send({ 
            type: 'log', 
            content: `✅ Fishing started via UI button in ${fishingChannel.name}` 
          });
          process.send({ 
            type: 'status', 
            status: 'Fishing' 
          });
        } else {
          process.send({ 
            type: 'log', 
            content: '❌ Cannot start fishing: No channel available' 
          });
        }
      }
    } else if (message.command === 'shutdown') {
      console.log('Received shutdown command');
      stopFishing();
      client.destroy();
      setTimeout(() => process.exit(0), 500);
    } else if (message.command === 'start-fishing') {
      // Direct command to start fishing
      if (fishingChannel && !fishingActive) {
        startFishing();
        process.send({ 
          type: 'log', 
          content: `✅ Fishing started automatically in ${fishingChannel.name}`
        });
        process.send({ 
          type: 'status', 
          status: 'Fishing' 
        });
      }
    } else if (message.command === 'stop-fishing') {
      // Direct command to stop fishing
      if (fishingActive) {
        stopFishing();
        process.send({ 
          type: 'log', 
          content: '⚠️ Fishing stopped automatically' 
        });
        process.send({ 
          type: 'status', 
          status: 'Running (Not Fishing)' 
        });
      }
    }
  });
}

client.on("ready", async () => {
  console.log(`${client.user.username} is ready to fish!`);
  
  // Notify parent process we're ready
  if (process.send) {
    process.send({ type: 'ready' });
    process.send({ type: 'status', status: 'Running' });
    process.send({ type: 'log', content: `Logged in as ${client.user.tag}` });
  }
  
  // Initialize fishing channel based on channel type
  if (CHANNEL_TYPE === 'server' && TARGET_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
      
      if (channel) {
        console.log(`Found target server channel: ${channel.name}`);
        process.send?.({ type: 'log', content: `Found target server channel: ${channel.name}` });
        fishingChannel = channel;
        
        // Start fishing if auto-start is enabled
        if (process.env.AUTO_START_FISHING === "true") {
          startFishing();
        }
      } else {
        console.error(`Could not find channel with ID: ${TARGET_CHANNEL_ID}`);
        process.send?.({ type: 'log', content: `❌ Could not find channel with ID: ${TARGET_CHANNEL_ID}` });
      }
    } catch (error) {
      console.error(`Error setting up channel: ${error.message}`);
      process.send?.({ type: 'log', content: `❌ Error setting up channel: ${error.message}` });
    }
  } else if (CHANNEL_TYPE === 'dm' && TARGET_USER_ID) {
    try {
      // Get or create DM channel
      const user = await client.users.fetch(TARGET_USER_ID);
      
      if (user) {
        const dmChannel = await user.createDM();
        console.log(`Created DM channel with user: ${user.tag}`);
        process.send?.({ type: 'log', content: `Created DM channel with user: ${user.tag}` });
        fishingChannel = dmChannel;
        
        // Start fishing if auto-start is enabled
        if (process.env.AUTO_START_FISHING === "true") {
          startFishing();
        }
      } else {
        console.error(`Could not find user with ID: ${TARGET_USER_ID}`);
        process.send?.({ type: 'log', content: `❌ Could not find user with ID: ${TARGET_USER_ID}` });
      }
    } catch (error) {
      console.error(`Error setting up DM channel: ${error.message}`);
      process.send?.({ type: 'log', content: `❌ Error setting up DM channel: ${error.message}` });
    }
  }
});

// Function to start fishing
function startFishing() {
  if (fishingActive || !fishingChannel) return;
  
  fishingActive = true; // Set the flag to true
  console.log(`Started fishing in ${fishingChannel.name}`);
  
  // Function to send fishing command
  const sendFishCommand = async () => {
    try {
      await fishingChannel.sendSlash(FISHING_BOT_ID, "fish");
      console.log(`Sent fishing command in ${fishingChannel.name}`);
    } catch (error) {
      console.error("Error sending fishing command:", error);
      process.send?.({ 
        type: 'log', 
        content: `❌ Error sending fishing command: ${error.message}` 
      });
    }
  };
  
  // Send fishing command immediately
  sendFishCommand();
  
  // Set up interval to send fishing command
  fishingInterval = setInterval(sendFishCommand, FISHING_INTERVAL_MS);
  
  // Update UI if parent process exists
  if (process.send) {
    process.send({ 
      type: 'status', 
      status: 'Fishing' 
    });
  }
}

// Function to stop fishing
function stopFishing() {
  if (!fishingActive) return;
  
  clearInterval(fishingInterval);
  fishingInterval = null; // Clear the interval reference
  fishingActive = false; // Set the flag to false
  console.log("Stopped fishing session");
  
  // Update UI if parent process exists
  if (process.send) {
    process.send({ 
      type: 'status', 
      status: 'Running (Not Fishing)' 
    });
  }
}

// Listen to all messages for verification codes and other fishing responses
client.on("messageCreate", async (message) => {
  // Check if message is from the fishing bot and we have an active fishing session
  if (message.author.id === FISHING_BOT_ID && fishingActive && fishingChannel) {
    console.log("Received message from fishing bot");

    // Check for verification codes in embeds
    if (message.embeds && message.embeds.length > 0) {
      const embed = message.embeds[0];
      let code = null;

      // Log the entire embed for debugging
      console.log("Received embed from fishing bot");
      // Format and send embed data to UI
      if (process.send) {
        // Extract the key information from the embed
        const embedData = {
          title: embed.title || null,
          description: embed.description || null,
          color: embed.color || null,
          fields: embed.fields ? embed.fields.map(field => ({
            name: field.name,
            value: field.value,
            inline: field.inline
          })) : [],
          author: embed.author ? {
            name: embed.author.name,
            iconURL: embed.author.iconURL
          } : null,
          footer: embed.footer ? {
            text: embed.footer.text,
            iconURL: embed.footer.iconURL
          } : null,
          thumbnail: embed.thumbnail ? embed.thumbnail.url : null,
          image: embed.image ? embed.image.url : null,
          timestamp: embed.timestamp || null
        };
        
        process.send({ 
          type: 'embed', 
          content: embedData,
          source: 'fishing-bot',
          messageId: message.id
        });
      }

      // Check description for code
      if (embed.description) {
        // More comprehensive regex that can find codes in various formats
        const descriptionMatch = embed.description.match(
          /[cC]ode:?\s*[`"']?([A-Za-z0-9]+)[`"']?/
        );
        if (descriptionMatch && descriptionMatch[1]) {
          code = descriptionMatch[1];
          console.log(`Found verification code in description: ${code}`);
        }

        // Also check for "verify with code" patterns
        if (!code) {
          const verifyMatch = embed.description.match(
            /verify with[^`"']*[`"']([A-Za-z0-9]+)[`"']/i
          );
          if (verifyMatch && verifyMatch[1]) {
            code = verifyMatch[1];
            console.log(
              `Found verification code in "verify with" pattern: ${code}`
            );
          }
        }
      }

      // Check title for verification mentions
      if (
        !code &&
        embed.title &&
        embed.title.toLowerCase().includes("verify") &&
        embed.description
      ) {
        // If title mentions verification, try to extract any code-like pattern from description
        const possibleCode = embed.description.match(
          /[`"']([A-Za-z0-9]{4,10})[`"']/
        );
        if (possibleCode && possibleCode[1]) {
          code = possibleCode[1];
          console.log(`Found verification code from title hint: ${code}`);
        }
      }

      // Check fields
      if (!code && embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          if (field.value) {
            const fieldMatch = field.value.match(
              /[cC]ode:?\s*[`"']?([A-Za-z0-9]+)[`"']?/
            );
            if (fieldMatch && fieldMatch[1]) {
              code = fieldMatch[1];
              console.log(`Found verification code in field: ${code}`);
              break;
            }
          }
        }
      }

      // If we found a code, send the verification
      if (code) {
        console.log(`Using verification code: ${code}`);
        try {
          // Small delay to seem more human-like
          setTimeout(async () => {
            await fishingChannel.sendSlash(FISHING_BOT_ID, "verify", code);
            console.log(`Sent verification code ${code}`);
          }, 1500 + Math.random() * 1000);
        } catch (error) {
          console.error("Error sending verification code:", error);
        }
      }
    }

    // Also check regular message content for codes
    if (message.content) {
      const contentMatch = message.content.match(
        /[cC]ode:?\s*[`"']?([A-Za-z0-9]+)[`"']?/
      );
      if (contentMatch && contentMatch[1]) {
        const code = contentMatch[1];
        console.log(`Found verification code in message content: ${code}`);
        try {
          setTimeout(async () => {
            await fishingChannel.sendSlash(FISHING_BOT_ID, "verify", code);
            console.log(`Sent verification code ${code}`);
          }, 1500 + Math.random() * 1000);
        } catch (error) {
          console.error("Error sending verification code:", error);
        }
      }
    }
  }

  // Only process commands from the bot owner
  if (message.author.id !== client.user.id) return;

  // Handle !fish command
  if (message.content.startsWith("!fish")) {
    const args = message.content.split(" ");

    // Stop fishing if already active
    if (fishingActive) {
      stopFishing();
      return message.channel
        .send("⚠️ Stopped fishing session.")
        .catch(console.error);
    }

    // Check if channel is specified
    if (args.length < 2) {
      return message.channel
        .send("❌ Please specify a channel: !fish <channel>")
        .catch(console.error);
    }

    // Extract channel ID from mention (<#channelID>)
    const channelMention = args[1];
    const channelId = channelMention.replace(/<#|>/g, "");

    try {
      // Get the channel
      const channel = await client.channels.fetch(channelId);

      if (!channel) {
        return message.channel
          .send("❌ Cannot find the specified channel.")
          .catch(console.error);
      }

      // Start fishing
      fishingChannel = channel;
      startFishing();
      message.channel
        .send(`✅ Started fishing in <#${channelId}>`)
        .catch(console.error);
    } catch (error) {
      console.error("Error setting up fishing session:", error);
      message.channel
        .send("❌ An error occurred while setting up the fishing session.")
        .catch(console.error);
    }
  }
  
  // Add new command to start/stop fishing without channel specification
  if (message.content === "!togglefish" && fishingChannel) {
    if (fishingActive) {
      stopFishing();
      message.channel.send("⚠️ Stopped fishing session.").catch(console.error);
    } else {
      startFishing();
      message.channel
        .send(`✅ Started fishing in ${fishingChannel.name}`)
        .catch(console.error);
    }
  }
});

// Handle process signals for clean shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT signal, shutting down...');
  stopFishing();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal, shutting down...');
  stopFishing();
  client.destroy();
  process.exit(0);
});

// Custom commands from parent process
process.on('message', async (message) => {
  if (message.command === 'start-fishing' && fishingChannel) {
    startFishing();
  } else if (message.command === 'stop-fishing') {
    stopFishing();
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
