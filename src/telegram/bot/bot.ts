import TelegramBot, { BotApiError } from "./api";
import { setTimeout as delay } from "node:timers/promises";
import type { Message } from "./apiTypes";
import type TelegramSyncPlugin from "src/main";
import { _1sec, displayAndLog } from "src/utils/logUtils";
import { handleMessage } from "./message/handlers";
import { createBotProxyAgent, readProxyCredentials } from "./proxy";

export async function connect(plugin: TelegramSyncPlugin) {
	plugin.checkingBotConnection = true;
	try {
		disconnect(plugin);
		const token = plugin.getBotToken();
		if (!token || plugin.status === "unloading" || plugin.status === "unloaded") return;

		const { proxyUrl, proxyAuthentication } = plugin.settings;
		const credentials = proxyUrl && proxyAuthentication ? readProxyCredentials(plugin.app) : undefined;
		if (proxyUrl && proxyAuthentication && !credentials) {
			throw new Error("Set the proxy username and password in Telegram Sync → Bot proxy → Authentication.");
		}

		const bot = new TelegramBot(token, undefined, createBotProxyAgent(proxyUrl, credentials));
		plugin.bot = bot;
		const user = await bot.getMe();
		if (plugin.bot !== bot) return;

		plugin.botUser = user;
		void plugin.setBotStatus("connected");
		plugin.time4processOldMessages = true;
		void poll(plugin, bot);
	} catch (error) {
		disconnect(plugin);
		await plugin.setBotStatus("disconnected", error);
	} finally {
		plugin.checkingBotConnection = false;
	}
}

export function disconnect(plugin: TelegramSyncPlugin) {
	const bot = plugin.bot;
	plugin.bot = undefined;
	plugin.botUser = undefined;
	bot?.close();
	void plugin.setBotStatus("disconnected");
}

async function poll(plugin: TelegramSyncPlugin, bot: TelegramBot) {
	let offset = 0;
	while (plugin.bot === bot) {
		try {
			const updates = await bot.getUpdates(offset);
			if (plugin.bot !== bot) return;
			if (!plugin.isBotConnected()) {
				void plugin.setBotStatus("connected");
				plugin.time4processOldMessages = true;
			}
			const batchSize = plugin.settings.parallelMessageProcessing ? 4 : 1;
			for (let i = 0; i < updates.length && plugin.bot === bot; i += batchSize) {
				await Promise.all(
					updates.slice(i, i + batchSize).map(async (update) => {
						const msg = update.message ?? update.edited_message ?? update.channel_post;
						if (msg) {
							try {
								await handleMessage(plugin, msg);
							} catch {
								displayAndLog(plugin, "A Telegram update could not be processed.", 0);
							}
						}
						offset = Math.max(offset, update.update_id + 1);
					}),
				);
			}
		} catch (error) {
			if (plugin.bot !== bot) return;
			await plugin.setBotStatus("disconnected", error);
			const retry = error instanceof BotApiError ? error.retryAfter : undefined;
			const seconds = Math.max(3, Math.min(retry ?? 15, 300));
			await delay(seconds * _1sec, undefined, { signal: bot.signal }).catch(() => undefined);
		}
	}
}

export async function setReaction(plugin: TelegramSyncPlugin, msg: Message, emoji: string) {
	await plugin.bot?.setMessageReaction(msg.chat.id, msg.message_id, { reaction: [{ emoji, type: "emoji" }] });
}
