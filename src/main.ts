import type TelegramBot from "src/telegram/bot/api";
import type { User as BotUser } from "src/telegram/bot/apiTypes";
import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, TelegramSyncSettings, TelegramSyncSettingTab } from "./settings/Settings";
import { randomUUID } from "node:crypto";
import { isBotToken } from "src/telegram/bot/api";
import { normalizeAllowedChats } from "src/telegram/bot/access";
import { _15sec, _2min, displayAndLog, StatusMessages, displayAndLogError, _1sec, _day } from "./utils/logUtils";
import * as Client from "./telegram/user/client";
import * as Bot from "./telegram/bot/bot";
import * as User from "./telegram/user/user";
import { enqueue } from "./utils/queues";
import { clearHandleMediaGroupInterval } from "./telegram/bot/message/handlers";
import ConnectionStatusIndicator, { checkConnectionMessage } from "./ConnectionStatusIndicator";
import { mainDeviceIdSettingName } from "./settings/modals/BotSettings";
import {
	createDefaultMessageDistributionRule,
	extractConditionsFromFilterQuery,
	defaultFileNameTemplate,
	defaultMessageFilterQuery,
	defaultNoteNameTemplate,
	defaultTelegramFolder,
} from "./settings/messageDistribution";
import { clearCachedUnprocessedMessages, forwardUnprocessedMessages } from "./telegram/user/sync";

// TODO LOW: add "connecting"
export type ConnectionStatus = "connected" | "disconnected";
export type PluginStatus = "unloading" | "unloaded" | "loading" | "loaded";

// Main class for the Telegram Sync plugin
export default class TelegramSyncPlugin extends Plugin {
	settings: TelegramSyncSettings;
	settingsTab?: TelegramSyncSettingTab;
	private botStatus: ConnectionStatus = "disconnected";
	// TODO LOW: change to userStatus and display in status bar
	userConnected = false;
	checkingBotConnection = false;
	checkingUserConnection = false;
	// TODO LOW: TelegramSyncBot extends TelegramBot
	bot?: TelegramBot;
	botUser?: BotUser;
	currentDeviceId = "";
	restartingIntervalId?: ReturnType<typeof setInterval>;
	restartingIntervalTime = _15sec;
	messagesLeftCnt = 0;
	connectionStatusIndicator? = new ConnectionStatusIndicator(this);
	status: PluginStatus = "loading";
	time4processOldMessages = false;
	processOldMessagesIntervalId?: ReturnType<typeof setInterval>;

	async initTelegram(initType?: Client.SessionType) {
		if (this.status === "unloading" || this.status === "unloaded") return;
		if (this.settings.mainDeviceId && this.settings.mainDeviceId !== this.currentDeviceId) {
			this.stopTelegram();
			displayAndLog(
				this,
				`Paused on this device. If you want the plugin to work here, change the value of "${mainDeviceIdSettingName}" to the current device id in the bot settings.`,
				0,
			);
			return;
		}
		// Uncomment timeout to debug if test during plugin loading
		// await new Promise((resolve) => setTimeout(resolve, 3000));

		if (!initType || initType == "bot") await Bot.connect(this);
		if (!initType || initType == "user") await User.connect(this);
		if (this.status !== "loaded") return;

		// restart telegram bot or user if needed
		if (!this.restartingIntervalId) this.setRestartTelegramInterval(this.restartingIntervalTime);

		// start processing old messages
		if (!this.processOldMessagesIntervalId) {
			this.setProcessOldMessagesInterval();
			this.time4processOldMessages = true;
			await this.processOldMessages();
		}
	}

	setRestartTelegramInterval(newRestartingIntervalTime: number, sessionType?: Client.SessionType) {
		this.restartingIntervalTime = newRestartingIntervalTime;
		clearInterval(this.restartingIntervalId);
		this.restartingIntervalId = setInterval(
			async () => await enqueue(this, this.restartTelegram, sessionType),
			this.restartingIntervalTime,
		);
	}

	setProcessOldMessagesInterval() {
		this.clearProcessOldMessagesInterval();
		this.processOldMessagesIntervalId = setInterval(async () => {
			this.time4processOldMessages = true;
			await enqueue(this, this.processOldMessages);
		}, _day);
	}

	clearProcessOldMessagesInterval() {
		clearInterval(this.processOldMessagesIntervalId);
		this.processOldMessagesIntervalId = undefined;
		this.time4processOldMessages = false;
	}

	async restartTelegram(sessionType?: Client.SessionType) {
		let needRestartInterval = false;
		try {
			if (
				(!sessionType || sessionType == "user") &&
				!this.userConnected &&
				!this.checkingUserConnection &&
				User.hasSession(this)
			) {
				await this.initTelegram("user");
				needRestartInterval = true;
			}

			if (
				(!sessionType || sessionType == "bot") &&
				!this.bot &&
				!this.checkingBotConnection &&
				this.getBotToken()
			) {
				await this.initTelegram("bot");
				needRestartInterval = true;
			}

			if (needRestartInterval) this.setRestartTelegramInterval(_15sec);
		} catch {
			this.setRestartTelegramInterval(
				this.restartingIntervalTime < _2min ? this.restartingIntervalTime * 2 : this.restartingIntervalTime,
			);
		}
	}

	async processOldMessages() {
		if (!this.time4processOldMessages) return;
		if (!this.settings.processOldMessages) clearCachedUnprocessedMessages();
		if (!this.userConnected || !this.settings.processOldMessages || !this.botUser) return;
		try {
			await forwardUnprocessedMessages(this);
		} finally {
			this.time4processOldMessages = false;
		}
	}

	stopTelegram() {
		this.checkingBotConnection = false;
		this.checkingUserConnection = false;
		this.clearProcessOldMessagesInterval();
		clearInterval(this.restartingIntervalId);
		this.restartingIntervalId = undefined;
		Bot.disconnect(this);
		User.disconnect(this);
	}

	// Load the plugin, settings, and initialize the bot
	async onload() {
		this.status = "loading";

		const localId = this.app.loadLocalStorage("telegram-sync-device-id");
		this.currentDeviceId = typeof localId === "string" && localId ? localId : randomUUID();
		if (this.currentDeviceId !== localId)
			this.app.saveLocalStorage("telegram-sync-device-id", this.currentDeviceId);
		await this.loadSettings();
		await this.upgradeSettings();

		// Add a settings tab for this plugin
		this.settingsTab = new TelegramSyncSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		// Initialize the Telegram bot when Obsidian layout is fully loaded
		this.app.workspace.onLayoutReady(async () => {
			enqueue(this, this.initTelegram);
		});

		this.status = "loaded";
		displayAndLog(this, this.status, 0);
	}

	async onunload(): Promise<void> {
		this.status = "unloading";
		try {
			clearHandleMediaGroupInterval();
			this.connectionStatusIndicator?.destroy();
			this.connectionStatusIndicator = undefined;
			this.settingsTab?.hide();
			this.settingsTab = undefined;
			this.stopTelegram();
		} catch (e) {
			displayAndLogError(this, e, "", "", undefined, 0);
		} finally {
			this.status = "unloaded";
			displayAndLog(this, this.status, 0);
		}
	}

	// Load settings from the plugin's data
	async loadSettings() {
		const {
			botToken,
			botTokenEncrypted,
			encryptionByPinCode,
			telegramSessionId,
			telegramSessionType,
			cacheCleanupAtStartup,
			processOtherBotsMessages,
			betaVersion,
			pluginVersion,
			...stored
		} = (await this.loadData()) ?? {};
		this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), stored);
		const entries = Array.isArray(this.settings.allowedChats)
			? this.settings.allowedChats.filter((entry): entry is string => typeof entry === "string")
			: [];
		this.settings.allowedChats = normalizeAllowedChats(entries);
		if (typeof botToken === "string" && !botTokenEncrypted && isBotToken(botToken) && !this.getBotToken()) {
			this.setBotToken(botToken);
		}
		if (typeof telegramSessionId === "number" && /^\d+$/.test(String(telegramSessionId))) {
			const prefixes = [`user_${telegramSessionId}_`, `bot_${telegramSessionId}_`];
			for (const key of Object.keys(localStorage)) {
				if (prefixes.some((prefix) => key.startsWith(prefix)) && key.includes(":"))
					localStorage.removeItem(key);
			}
		}
		if (
			[
				botToken,
				botTokenEncrypted,
				encryptionByPinCode,
				telegramSessionId,
				telegramSessionType,
				cacheCleanupAtStartup,
				processOtherBotsMessages,
				betaVersion,
				pluginVersion,
			].some((value) => value !== undefined)
		) {
			await this.saveSettings();
		}
	}

	// Save settings to the plugin's data
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async upgradeSettings() {
		let needToSaveSettings = false;
		if (this.settings.messageDistributionRules.length == 0) {
			this.settings.messageDistributionRules.push(createDefaultMessageDistributionRule());
			needToSaveSettings = true;
		} else {
			// fixing incorrectly saved rules
			this.settings.messageDistributionRules.forEach((rule) => {
				try {
					const conditions = extractConditionsFromFilterQuery(
						rule.messageFilterQuery ?? defaultMessageFilterQuery,
					);
					if (JSON.stringify(rule.messageFilterConditions) !== JSON.stringify(conditions)) {
						rule.messageFilterConditions = conditions;
						needToSaveSettings = true;
					}
				} catch {
					if (rule.messageFilterConditions?.length !== 0) {
						rule.messageFilterConditions = [];
						needToSaveSettings = true;
					}
				}
				if (!rule.filePathTemplate && !rule.notePathTemplate && !rule.templateFilePath) {
					rule.notePathTemplate = `${defaultTelegramFolder}/${defaultNoteNameTemplate}`;
					rule.filePathTemplate = `${defaultTelegramFolder}/${defaultFileNameTemplate}`;
					needToSaveSettings = true;
				}
			});
		}

		if (needToSaveSettings) await this.saveSettings();
	}

	async getBotUser(): Promise<BotUser> {
		this.botUser = this.botUser || (await this.bot?.getMe());
		if (!this.botUser) throw new Error("Can't get access to bot info. Restart the Telegram Sync plugin");
		return this.botUser;
	}

	isBotConnected(): boolean {
		return this.botStatus === "connected";
	}

	async setBotStatus(status: ConnectionStatus, error?: Error) {
		if (this.botStatus == status && !error) return;

		this.botStatus = status;
		this.connectionStatusIndicator?.update(error ? new Error("Telegram Bot API connection failed.") : undefined);

		if (this.isBotConnected()) displayAndLog(this, StatusMessages.BOT_CONNECTED, 0);
		else if (!error) displayAndLog(this, StatusMessages.BOT_DISCONNECTED, 0);
		else displayAndLogError(this, error, StatusMessages.BOT_DISCONNECTED, checkConnectionMessage, undefined, 0);
	}

	getBotToken(): string {
		const token = this.app.secretStorage?.getSecret("telegram-sync-bot-token") ?? "";
		return isBotToken(token) ? token : "";
	}

	setBotToken(token: string) {
		if (token && !isBotToken(token)) throw new Error("Invalid Telegram bot token format.");
		this.app.secretStorage.setSecret("telegram-sync-bot-token", token);
	}
}
