# Bot token storage

Telegram Sync stores bot tokens in Obsidian's per-vault secret storage. This requires Obsidian 1.11.4 or later. The token stays out of the plugin's `data.json`. Enter it on each device that runs the plugin.

The token is used only for HTTPS requests to the Telegram Bot API, including attachment downloads. A configured bot proxy carries those requests. The optional Telegram account login uses its own API ID and hash.

## Upgrading an older installation

A valid legacy plaintext token moves to secret storage. Legacy encrypted values are removed from current settings and require token re-entry. The old encryption key shipped in the plugin. If a legacy settings copy was shared or synced to a location you do not trust, rotate the bot token in BotFather and enter the new token in Telegram Sync.

The main device ID is now generated locally for each vault. If you previously selected a main device, open **Bot settings → Main device id** on the intended device and select **Use this device**. Old account sessions need a fresh login. Revoke the previous session in Telegram's **Settings → Devices**.
