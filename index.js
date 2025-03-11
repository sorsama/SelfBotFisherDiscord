require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

// Store active fishing sessions
let fishingActive = false;
let fishingInterval = null;
let fishingChannel = null;
const FISHING_BOT_ID = '574652751745777665'; // Replace with the actual fishing bot ID

client.on('ready', async () => {
  console.log(`${client.user.username} พร้อมตกปลา!`);
});

client.on('messageCreate', async (message) => {
  // Only respond to messages from the bot owner
  if (message.author.id !== client.user.id) return;
  
  // Handle !fish command
  if (message.content.startsWith('!fish')) {
    const args = message.content.split(' ');
    
    // Stop fishing if already active
    if (fishingActive) {
      clearInterval(fishingInterval);
      fishingActive = false;
      fishingChannel = null;
      return message.channel.send('⚠️ Stopped fishing session.').catch(console.error);
    }
    
    // Check if channel is specified
    if (args.length < 2) {
      return message.channel.send('❌ Please specify a channel: !fish <channel>').catch(console.error);
    }
    
    // Extract channel ID from mention (<#channelID>)
    const channelMention = args[1];
    const channelId = channelMention.replace(/<#|>/g, '');
    
    try {
      // Get the channel
      fishingChannel = await client.channels.fetch(channelId);
      
      if (!fishingChannel) {
        return message.channel.send('❌ Cannot find the specified channel.').catch(console.error);
      }
      
      // Start fishing
      fishingActive = true;
      message.channel.send(`✅ Started fishing in <#${channelId}>`).catch(console.error);
      
      // Function to send fishing command
      const sendFishCommand = async () => {
        try {
          await fishingChannel.sendSlash(FISHING_BOT_ID, 'fish');
          console.log(`Sent fishing command in ${fishingChannel.name}`);
        } catch (error) {
          console.error('Error sending fishing command:', error);
        }
      };
      
      // Send fishing command immediately
      await sendFishCommand();
      
      // Set up interval to send fishing command (every 4 seconds)
      fishingInterval = setInterval(sendFishCommand, 4000);
      
    } catch (error) {
      console.error('Error setting up fishing session:', error);
      message.channel.send('❌ An error occurred while setting up the fishing session.').catch(console.error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);