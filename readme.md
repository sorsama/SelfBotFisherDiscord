# TestSelfBotFisher

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/sorsama/SelfBotFisherDiscord)](https://github.com/sorsama/SelfBotFisherDiscord/releases)

An automated fishing bot that helps you automate fishing tasks on discord bot.


## Table of Contents
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/sorsama/SelfBotFisherDiscord.git
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your settings (see [Configuration](#configuration))
4. Run the bot:
   ```
   npm start
   ```


## Basic Usage

### Getting Server ID

There are multiple ways to find a server ID:

![image](https://github.com/user-attachments/assets/eb104ad5-1a88-4db4-a435-d43e8a4fb1ad)

- **Enable Developer Mode:**
   - Go to User Settings > Advanced
   - Enable Developer Mode
   - Right-click on the server icon and select "Copy ID"

### Getting Any User ID/Bot ID

![image](https://github.com/user-attachments/assets/3b14bf93-098f-4d65-b7b0-fb278992df72)

- **Enable Developer Mode:**
   - Go to User Settings > Advanced
   - Enable Developer Mode
   - Right-click on any username / bot id anywhere and select "Copy ID"
   _The default is Virtual Fisher bot._

## Troubleshooting

### Common Issues

1. **Bot Not Responding**
   - Verify your token is correct in config.json
   - Check your internet connection
   - Ensure the bot has proper permissions

2. **Fishing Not Working**
   - Make sure you're in the correct channel
   - Check if the fishing cooldown has expired
   - Verify the user bot has permission to send messages

3. **Rate Limiting**
   - Increase your interval setting: `10000`

## FAQ

**Q: Is this against Terms of Service?**
A: Self-bots may violate the Terms of Service of some platforms. Use at your own risk.

**Q: How do I get a token?**
A: We cannot provide instructions for obtaining tokens as it may violate terms of service.

**Q: Can I run multiple instances?**
A: Yes, but use different accounts and be careful of IP-based rate limits.

Created with 💜 by Sour
