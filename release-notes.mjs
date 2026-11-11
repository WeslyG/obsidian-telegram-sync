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
export const showNewFeatures = true;
export let showBreakingChanges = releaseVersion === "4.0.0";

const newFeatures = `See the <a href='${repositoryUrl}/releases/tag/${releaseVersion}'>release notes</a> for changes in this version.`;
export const breakingChanges = `⚠️ <b><i>Breaking changes!\n\nBot token may need to be re-entered.</i></b> ⚠️`;
export const notes = `<u><b>Telegram Sync ${releaseVersion}</b></u>\n\n${newFeatures}`;

export function showBreakingChangesInReleaseNotes() {
	showBreakingChanges = true;
}
