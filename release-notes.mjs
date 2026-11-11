// TODO translating messages
// TODO add messagesLeftCnt displaying in status bar
// TODO NEXT: sending notes from Obsidian to Telegram
// TODO MED: "delete messages from Telegram" settings for each distribution rules
// TODO NEXT: save files if no template file
// TODO NEXT: check reconnecting
import manifest from "./manifest.json" with { type: "json" };

export const releaseVersion = manifest.version;
export const repositoryUrl = manifest.authorUrl;
export const proxyGuideLink = `${repositoryUrl}/blob/main/docs/Bot%20Proxy.md`;
export const privacyPolicyLink = `${repositoryUrl}/blob/main/PRIVACY-POLICY.md`;
