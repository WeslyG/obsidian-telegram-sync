### Privacy Policy for Telegram Sync

#### Last updated: 2026-11-11

Thank you for choosing to use Telegram Sync, an open-source plugin developed for the Obsidian platform. This Privacy Policy outlines our commitment to protecting your privacy and personal information when using our plugin.

---

#### Introduction

Telegram Sync transfers messages and files from Telegram to your Obsidian vault. The bot connects to the Telegram Bot API over HTTPS. The optional Telegram user session connects via Telegram's MTProto client protocol.

---

#### Information We Collect

The maintainers do not receive Telegram messages, files, or credentials from the plugin. Obsidian processes Telegram data on the device where the plugin runs.

---

#### Data Transfer and Storage

When you configure a [bot proxy](./docs/Bot%20Proxy.md), Bot API traffic travels through that proxy. The proxy can see connection metadata and receives proxy credentials when authentication is enabled. Bot tokens, proxy credentials, and optional user session credentials are kept in Obsidian's local secret storage. The optional Telegram user session uses a separate direct connection. Old-message recovery, if enabled, forwards messages within the selected Telegram chats.

---

#### User Authentication and Session Management

If you choose to connect as a user, you'll go through Telegram's standard two-factor authentication process, and the plugin will register a new session within your Telegram account's list of devices. This ensures that your Telegram login credentials are verified, secure, and directly linked to your device or current location (IP address). All data, including session information, is stored locally on your machine, bolstering your data's safety. However, as the plugin connects to Telegram servers, it is advisable to secure your Telegram account with a strong, unique password and two-factor authentication.

---

#### Data Deletion

Telegram Sync offers the option to delete processed messages from Telegram once they have been transferred to your Obsidian vault. The deletion of these messages is entirely within your control and is not mandatory to use this plugin.

---

#### Links to third-party websites and services

The Plugin may contain links to other websites and online services. If you choose to click through to one of these other websites or online services, please note that any information you may provide will be subject to the privacy policy and other terms and conditions of that websites or service, and not to this Privacy Policy. We do not control third-party websites or services, and the fact that a link to such a website or service appears in the plugin does not mean that we endorse them or have approved their policies or practices relating to user information. Before providing any information to any third-party website or service, we encourage you to review the privacy policy and other terms and conditions of that website or service. You agree that we will have no liability for any matters relating to a third-party website or service that you provide information to, including their collection and handling of that information.

#### Changes to this Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by updating the "Last updated" date of this Privacy Policy. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.

---

#### Contact Us

For questions about this Privacy Policy, use the [project repository](https://github.com/WeslyG/obsidian-telegram-sync).

---

By using Telegram Sync, you agree to the terms laid out in this Privacy Policy. Thank you for your trust and for using Telegram Sync.

---

This Privacy Policy is compliant with relevant laws and regulations. Use of Telegram Sync signifies your agreement to this Privacy Policy and any subsequent updates.
