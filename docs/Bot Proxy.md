# Telegram bot proxy

The proxy carries Telegram Bot API requests, including polling and file downloads made by the bot. The optional Telegram user session uses its own connection. Features such as old-message recovery or large downloads through that session may need separate network access to Telegram.

## Connection

1. Open **Obsidian → Settings → Telegram Sync → Bot proxy → Configure**.
2. On **Connection**, select the protocol offered by your proxy and enter its hostname or IP address and port.

    | Connection type | Example address         | Use when                                                                                |
    | --------------- | ----------------------- | --------------------------------------------------------------------------------------- |
    | HTTP            | `127.0.0.1:7890`        | Your proxy accepts HTTP `CONNECT` requests.                                             |
    | HTTPS           | `proxy.example.com:443` | Your proxy accepts `CONNECT` over a TLS connection to the proxy itself.                 |
    | SOCKS5          | `127.0.0.1:1080`        | Your proxy or VPN client exposes a SOCKS5 port. The proxy resolves Telegram's hostname. |

    The address field takes `host:port`. For IPv6, use brackets, for example `[::1]:1080`.

3. Set up authentication if required and click **Save**. Telegram Sync reconnects the configured bot with the new settings. Select **No proxy** and save to clear the plugin's proxy.

## Authentication

On the **Authentication** tab, enable **Use proxy authentication** and fill in **Username** and **Password**. Leave the switch off for an anonymous proxy. HTTP and HTTPS use Basic proxy authentication. SOCKS5 uses username/password authentication. Obsidian 1.11.4 or later is required to save credentials in Obsidian's local secret storage. Set them separately on each device that needs the proxy.

## Troubleshooting

- **Connection refused or timed out.** Verify that the proxy is running, its port is reachable from Obsidian, and you selected the protocol for that port. A VPN client's HTTP and SOCKS5 listeners can use different ports.
- **HTTP 407 or SOCKS5 authentication failure.** Enable authentication and check the proxy username and password. Telegram's bot token belongs in **Bot → Connect**, separately from proxy credentials.
- **TLS certificate error.** Select HTTPS only if your proxy offers a TLS listener. Its certificate must be trusted by the runtime and match the hostname you enter.
- **Bot is still disconnected.** Confirm that the proxy allows connections to `api.telegram.org:443` and that the bot token is valid. See [repository issues](https://github.com/WeslyG/obsidian-telegram-sync/issues) for support.
