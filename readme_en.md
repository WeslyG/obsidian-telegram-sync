# Telegram Sync for Obsidian

[Русский](./README.md) · [Download the release](https://github.com/WeslyG/obsidian-telegram-sync/releases/latest) · [Changelog](./CHANGELOG.md)

Telegram Sync imports messages and files from Telegram into your Obsidian vault. It can save messages as separate notes or append them to existing notes. Rules let you filter messages and choose templates, filenames, and folders.

## Installation

Requires Obsidian 1.11.4 or later for Windows, macOS, or Linux.

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest GitHub release](https://github.com/WeslyG/obsidian-telegram-sync/releases/latest).
2. Copy the files into `.obsidian/plugins/telegram-sync/` inside your vault. When upgrading, replace the three release files and keep `data.json`.
3. Restart Obsidian and enable **Telegram Sync** under **Settings → Community plugins**.

The plugin uses Russian when Obsidian is set to Russian and English for other app languages.

## Connect a bot

1. Create a bot through [@BotFather](https://t.me/botfather) or use an existing bot token.
2. Open **Settings → Telegram Sync** in Obsidian. Select **Connect**, enter the **Bot token**, and add usernames or chat IDs to **Allowed chats**. An empty list blocks all imports.
3. Save the settings and send a message to the bot. Imports run while Obsidian is open.

The token is stored in Obsidian's local secret storage. When upgrading from 4.x, re-enter the token if it was stored in the old encrypted format. [Upgrade instructions](./docs/Bot%20Token%20Encryption.md)

## Bot proxy

Open **Settings → Telegram Sync → Bot proxy → Configure**. Choose **HTTP**, **HTTPS**, or **SOCKS5** and enter the host and port, for example `127.0.0.1:9091`. If your proxy requires credentials, turn on **Use proxy authentication** below **Proxy address** and fill in the username and password. [Proxy setup guide](./docs/Bot%20Proxy.md)

## More features

- [Templates and filters](./docs/Template%20Variables%20List.md) for routing messages.
- [Optional Telegram account features](./docs/Authorized%20User%20Features.md) for older messages and larger files. Audio transcription requires Telegram Premium. The account connects directly to Telegram.
- [Privacy policy](./PRIVACY-POLICY.md) and [contributing guide](./CONTRIBUTING.md).
