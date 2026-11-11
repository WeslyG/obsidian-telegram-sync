# Telegram Sync for Obsidian

<a href="https://github.com/WeslyG/obsidian-telegram-sync/releases/latest">
<img src="https://img.shields.io/github/v/release/WeslyG/obsidian-telegram-sync?label=plugin&display_name=tag&logo=obsidian&color=purple&logoColor=violet">
</a>&nbsp;<a href="https://github.com/WeslyG/obsidian-telegram-sync">
<img src="https://img.shields.io/github/downloads/WeslyG/obsidian-telegram-sync/total?logo=github">
</a><br><br>

Transfer messages and files from [Telegram](https://telegram.org/) to your [Obsidian](https://obsidian.md/) vault. You can save text, voice transcripts, images, and other files from your Telegram chats to Obsidian for further processing and organization. The plugin is available for desktop Obsidian. This fork is maintained by [WeslyG](https://github.com/WeslyG/obsidian-telegram-sync).

---

## 📚 Table of Contents

-   [Features](#-features)
-   [Installation](#-installation)
-   [Usage](#-usage)
-   [Bot proxy](#bot-proxy)
-   [Contributing](#-contributing)

## 🚀 Features

-   Synchronize text messages and files
-   Save messages as individual notes or append to an existing note
-   Transcript voices and video notes (for Telegram Premium subscribers only)
-   Use customizable templates for new notes
-   Set folders for new notes and files
-   Automatically format text messages with markdown
-   Delete processed messages from Telegram
-   Connect the Telegram bot through HTTP, HTTPS, or SOCKS5 with optional authentication

## 📦 Installation

Requires desktop Obsidian 1.11.4 or later. See [bot token storage](./docs/Bot%20Token%20Encryption.md) before upgrading an existing installation.

1. Download `main.js`, `styles.css`, and `manifest.json` from [GitHub Releases](https://github.com/WeslyG/obsidian-telegram-sync/releases).
2. Copy the downloaded files to <path-to-your-vault>/.obsidian/plugins/telegram-sync/
3. Restart Obsidian and enable **Telegram Sync** in the Community plugins tab

## 📮 Usage

1. Create a new bot on Telegram by talking to the [@botFather](https://t.me/botfather)
2. Copy the bot token provided by the @botFather
3. Open the Obsidian settings and navigate to the **Telegram Sync** settings tab
4. Paste your bot token to **Bot > Connect > Bot Token** field
5. Add your Telegram username or a chat ID to **Allowed chats**. An empty list blocks all imports.
6. Start sending messages and files to your Telegram bot
7. When the Obsidian app is running on your laptop or PC, it syncs all your messages
8. You can optionally add your bot to any chats that you want to sync (the bot needs admin rights)

### Bot proxy

Open **Settings → Telegram Sync → Bot proxy → Configure**. Choose a protocol in **Connection** and enter the host and port. Use **Authentication** to turn username and password on or off. See the [bot proxy setup guide](./docs/Bot%20Proxy.md) for examples and troubleshooting.

## 💻 Contributing

If you're thinking about contributing, please check out the [Contributing Guide](./CONTRIBUTING.md) first. And a heartfelt thank you to everyone who has already contributed - your help is greatly appreciated!
<br>

<div align="center">
<a href="https://github.com/WeslyG/obsidian-telegram-sync/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=WeslyG/obsidian-telegram-sync" />
</a>
</div>
