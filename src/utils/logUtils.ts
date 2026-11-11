import type { Message } from "src/telegram/bot/apiTypes";
import { Notice } from "obsidian";
import { BotApiError } from "src/telegram/bot/api";
import TelegramSyncPlugin from "src/main";
import { stopUpdatingProcessingDate } from "src/telegram/user/sync";

export const _1sec = 1000;
export const _2sec = 2 * _1sec;
export const _5sec = 5 * _1sec;
export const _15sec = 15 * _1sec;
export const _1min = 60 * _1sec;
export const _2min = 2 * _1min;
export const _5min = 5 * _1min;
export const _30min = 30 * _1min;
export const _1h = 60 * _1min;
export const _2h = 2 * _1h;
export const _day = 24 * _1h;

// TODO LOW: connect with ConnectionStatus
export enum StatusMessages {
	BOT_CONNECTED = "Telegram bot is connected!",
	BOT_DISCONNECTED = "Telegram bot is disconnected!",
	USER_DISCONNECTED = "Telegram user is disconnected!",
}

export let errorCache = false;

interface PersistentNotice {
	notice: Notice;
	message: string;
}
let persistentNotices: PersistentNotice[] = [];

// Show notification and log message into console.
export function displayAndLog(plugin: TelegramSyncPlugin, message: string, timeout?: number) {
	console.log(`${plugin.manifest.name} => ${message}`);

	if (timeout == 0) return;
	const notice = new Notice(message, timeout || _day);

	const hideBotDisconnectedMessages = message.includes(StatusMessages.BOT_CONNECTED);
	persistentNotices = persistentNotices.filter((persistentNotice) => {
		const shouldHide =
			(hideBotDisconnectedMessages && persistentNotice.message.includes(StatusMessages.BOT_DISCONNECTED)) ||
			persistentNotice.message == message;
		if (shouldHide) {
			persistentNotice.notice.hide();
		}
		return !shouldHide;
	});

	if (!timeout) persistentNotices.push({ notice, message });
}

export function displayAndLogError(
	plugin: TelegramSyncPlugin,
	error: unknown,
	status?: string,
	action?: string,
	msg?: Message,
	timeout?: number,
	addToCache?: boolean,
) {
	const detail = error instanceof BotApiError ? error.message : "Telegram Sync operation failed.";
	displayAndLog(plugin, [detail, status, action].filter(Boolean).join("\n"), timeout);
	if (addToCache) errorCache = true;
	if (msg && plugin.settings.retryFailedMessagesProcessing) stopUpdatingProcessingDate();
}

export function cleanErrorCache() {
	errorCache = false;
}
