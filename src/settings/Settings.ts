import type { Message } from "src/telegram/bot/apiTypes";
import TelegramSyncPlugin from "src/main";
import { App, ButtonComponent, PluginSettingTab, Setting, TextComponent } from "obsidian";
import * as Client from "src/telegram/user/client";
import { BotSettingsModal } from "./modals/BotSettings";
import { BotProxySettingsModal } from "./modals/BotProxySettings";
import { UserLogInModal } from "./modals/UserLogin";
import { privacyPolicyLink, proxyGuideLink, releaseVersion, repositoryUrl } from "release-notes.mjs";
import { _15sec, _1sec, displayAndLog } from "src/utils/logUtils";
import { getTopicId } from "src/telegram/bot/message/getters";
import * as User from "../telegram/user/user";
import { KeysOfConnectionStatusIndicatorType } from "src/ConnectionStatusIndicator";
import { enqueue } from "src/utils/queues";
import {
	MessageDistributionRule,
	createDefaultMessageDistributionRule,
	getMessageDistributionRuleInfo,
} from "./messageDistribution";
import { MessageDistributionRulesModal } from "./modals/MessageDistributionRules";
import { arrayMove } from "src/utils/arrayUtils";
import {
	ProcessOldMessagesSettings,
	clearCachedUnprocessedMessages,
	getDefaultProcessOldMessagesSettings,
} from "src/telegram/user/sync";
import { AdvancedSettingsModal } from "./modals/AdvancedSettings";
import { ProcessOldMessagesSettingsModal } from "./modals/ProcessOldMessagesSettings";
import { getOffsetDate } from "src/utils/dateUtils";

export interface Topic {
	name: string;
	chatId: number;
	topicId: number;
}

export interface RefreshValues {
	botConnected?: boolean;
	userConnected?: boolean;
	checkingBotConnection?: boolean;
	checkingUserConnection?: boolean;
	userSessionSaved?: boolean;
}

export interface TelegramSyncSettings {
	deleteMessagesFromTelegram: boolean;
	allowedChats: string[];
	mainDeviceId: string;
	connectionStatusIndicatorType: KeysOfConnectionStatusIndicatorType;
	messageDistributionRules: MessageDistributionRule[];
	defaultMessageDelimiter: boolean;
	parallelMessageProcessing: boolean;
	processOldMessages: boolean;
	processOldMessagesSettings: ProcessOldMessagesSettings;
	retryFailedMessagesProcessing: boolean;
	proxyUrl: string;
	proxyAuthentication: boolean;
	// add new settings above this line
	topicNames: Topic[];
}

export const DEFAULT_SETTINGS: TelegramSyncSettings = {
	deleteMessagesFromTelegram: false,
	allowedChats: [],
	mainDeviceId: "",
	connectionStatusIndicatorType: "CONSTANT",
	messageDistributionRules: [createDefaultMessageDistributionRule()],
	defaultMessageDelimiter: true,
	parallelMessageProcessing: false,
	processOldMessages: false,
	processOldMessagesSettings: getDefaultProcessOldMessagesSettings(),
	retryFailedMessagesProcessing: false,
	proxyUrl: "",
	proxyAuthentication: false,
	// add new settings above this line
	topicNames: [],
};

export class TelegramSyncSettingTab extends PluginSettingTab {
	plugin: TelegramSyncPlugin;
	refreshValues?: RefreshValues;
	refreshIntervalId?: ReturnType<typeof setInterval>;

	constructor(app: App, plugin: TelegramSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async refresh() {
		const botConnected = this.plugin.isBotConnected();
		const userConnected = this.plugin.userConnected;
		const checkingBotConnection = this.plugin.checkingBotConnection;
		const checkingUserConnection = this.plugin.checkingUserConnection;
		const userSessionSaved = User.hasSession(this.plugin);
		if (
			!this.refreshValues ||
			botConnected != this.refreshValues.botConnected ||
			userConnected != this.refreshValues.userConnected ||
			checkingBotConnection != this.refreshValues.checkingBotConnection ||
			checkingUserConnection != this.refreshValues.checkingUserConnection ||
			userSessionSaved !== this.refreshValues.userSessionSaved
		) {
			try {
				if (this.refreshValues) await this.display();
			} finally {
				this.refreshValues = {
					botConnected,
					userConnected,
					checkingBotConnection,
					checkingUserConnection,
					userSessionSaved,
				};
			}
		}
	}

	async setRefreshInterval() {
		clearInterval(this.refreshIntervalId);
		this.refreshIntervalId = setInterval(async () => {
			await enqueue(this, this.refresh);
		}, _1sec);
	}

	async display(): Promise<void> {
		this.containerEl.empty();
		this.addSettingsHeader();

		await this.addBot();
		const proxySettings = new Setting(this.containerEl)
			.setName("Bot proxy")
			.setDesc("Connect the Telegram bot through an HTTP, HTTPS, or SOCKS5 proxy. ")
			.addButton((button) =>
				button.setButtonText("Configure").onClick(() => new BotProxySettingsModal(this.plugin).open()),
			);
		proxySettings.descEl.createEl("a", { href: proxyGuideLink, text: "Setup guide" });
		await this.addUser();
		this.addAdvancedSettings();

		new Setting(this.containerEl).setName("Message distribution rules").setHeading();
		await this.addMessageDistributionRules();

		new Setting(this.containerEl).setName("Telegram user features").setHeading();
		await this.addProcessOldMessages();
		await this.setRefreshInterval();
	}

	hide() {
		super.hide();
		clearInterval(this.refreshIntervalId);
	}

	addSettingsHeader() {
		const versionContainer = this.containerEl.createDiv();
		versionContainer.style.display = "flex";
		versionContainer.style.justifyContent = "space-between";
		versionContainer.createSpan().createEl("h1", {
			text: `Telegram Sync ${releaseVersion}`,
		});

		const privacyPolicyButton = versionContainer.createSpan().createEl("a", {
			text: "Privacy Policy",
			href: privacyPolicyLink,
		});
		privacyPolicyButton.style.fontSize = "0.75em";
		privacyPolicyButton.style.color = "LightCoral";
		privacyPolicyButton.style.textDecoration = "None";

		this.containerEl.createEl("div", { text: "Fork maintained by " }).createEl("a", {
			text: "WeslyG",
			href: repositoryUrl,
		});

		this.containerEl.createEl("br");
		this.containerEl.createEl("br");
	}

	async addBot() {
		const botSettings = new Setting(this.containerEl)
			.setName("Bot (required)")
			.setDesc("Connect your telegram bot. It's required for all features.")
			.addText(async (botStatus: TextComponent) => {
				botStatus.setDisabled(true);
				if (this.plugin.checkingBotConnection) {
					botStatus.setValue("⏳ connecting...");
				} else if (this.plugin.isBotConnected()) {
					botStatus.setValue(`🤖 ${this.plugin.botUser?.username || "connected"}`);
				} else {
					botStatus.setValue("❌ disconnected");
				}
			})
			.addButton(async (botSettingsButton: ButtonComponent) => {
				if (this.plugin.checkingBotConnection) botSettingsButton.setButtonText("Restart");
				else if (this.plugin.isBotConnected()) botSettingsButton.setButtonText("Settings");
				else botSettingsButton.setButtonText("Connect");
				botSettingsButton.onClick(() => {
					new BotSettingsModal(this.plugin, () =>
						enqueue(this.plugin, this.plugin.initTelegram, "bot"),
					).open();
				});
			});
		// add link to botFather
		const botFatherLink = document.createElement("div");
		botFatherLink.textContent = "To create a new bot click on -> ";
		botFatherLink.createEl("a", {
			href: "https://t.me/botfather",
			text: "@botFather",
		});
		botSettings.descEl.appendChild(botFatherLink);
	}

	async addUser() {
		const hasSession = User.hasSession(this.plugin);
		const description = this.containerEl.createDiv({ text: "Optional Telegram account connection for " });
		description.createEl("a", {
			href: repositoryUrl + "/blob/main/docs/Authorized%20User%20Features.md",
			text: "older messages, larger files, and transcription",
		});
		new Setting(this.containerEl)
			.setName("Telegram user")
			.setDesc("Uses a separate direct connection to Telegram. The bot proxy applies to Bot API only.")
			.addText((status) => {
				status.setDisabled(true);
				status.setValue(
					this.plugin.checkingUserConnection
						? "Connecting…"
						: this.plugin.userConnected
							? (Client.clientUser?.username ?? "Connected")
							: "Disconnected",
				);
			})
			.addButton((button) =>
				button
					.setButtonText(hasSession ? "Log out" : "Log in")
					.setDisabled(this.plugin.checkingUserConnection)
					.onClick(async () => {
						if (!hasSession) {
							new UserLogInModal(this.plugin).open();
							return;
						}
						try {
							await User.logOut(this.plugin);
							displayAndLog(this.plugin, "Telegram user session revoked.", _15sec);
						} catch {
							displayAndLog(
								this.plugin,
								"Could not revoke the Telegram session. Retry when connected.",
								_15sec,
							);
						}
						await this.display();
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("refresh-ccw")
					.setTooltip("Reconnect")
					.setDisabled(!hasSession || this.plugin.userConnected || this.plugin.checkingUserConnection)
					.onClick(async () => {
						const error = await User.connect(this.plugin);
						if (error) displayAndLog(this.plugin, error, _15sec);
						await this.display();
					}),
			);
	}

	addAdvancedSettings() {
		new Setting(this.containerEl).addButton((button) =>
			button.setButtonText("Advanced settings").onClick(() => new AdvancedSettingsModal(this.plugin).open()),
		);
	}

	async addMessageDistributionRules() {
		this.plugin.settings.messageDistributionRules.forEach((rule, index) => {
			const ruleInfo = getMessageDistributionRuleInfo(rule);
			const setting = new Setting(this.containerEl);
			setting.setName(ruleInfo.name);
			setting.setDesc(ruleInfo.description);
			setting.addExtraButton(async (btn) => {
				btn.setIcon("up-chevron-glyph")
					.setTooltip("Move up")
					.onClick(async () => {
						arrayMove(this.plugin.settings.messageDistributionRules, index, index - 1);
						await this.plugin.saveSettings();
						await this.display();
					});
			});
			setting.addExtraButton(async (btn) => {
				btn.setIcon("down-chevron-glyph")
					.setTooltip("Move down")
					.onClick(async () => {
						arrayMove(this.plugin.settings.messageDistributionRules, index, index + 1);
						await this.plugin.saveSettings();
						await this.display();
					});
			});
			setting.addExtraButton(async (btn) => {
				btn.setIcon("pencil")
					.setTooltip("Edit")
					.onClick(async () => {
						const messageDistributionRulesModal = new MessageDistributionRulesModal(
							this.plugin,
							this.plugin.settings.messageDistributionRules[index],
						);
						messageDistributionRulesModal.onClose = async () => {
							if (messageDistributionRulesModal.saved) await this.display();
						};
						messageDistributionRulesModal.open();
					});
			});
			setting.addExtraButton(async (btn) => {
				btn.setIcon("trash-2")
					.setTooltip("Delete")
					.onClick(async () => {
						this.plugin.settings.messageDistributionRules.remove(
							this.plugin.settings.messageDistributionRules[index],
						);
						if (this.plugin.settings.messageDistributionRules.length == 0) {
							displayAndLog(
								this.plugin,
								"The default message distribution rule has been created, as at least one rule must exist!",
								_15sec,
							);
							this.plugin.settings.messageDistributionRules.push(createDefaultMessageDistributionRule());
						}
						await this.plugin.saveSettings();
						await this.display();
					});
			});
		});

		new Setting(this.containerEl).addButton(async (btn: ButtonComponent) => {
			btn.setButtonText("Add rule");
			btn.setClass("mod-cta");
			btn.onClick(async () => {
				const messageDistributionRulesModal = new MessageDistributionRulesModal(this.plugin);
				messageDistributionRulesModal.onClose = async () => {
					if (messageDistributionRulesModal.saved) await this.display();
				};
				messageDistributionRulesModal.open();
			});
		});
	}

	async addProcessOldMessages() {
		const disabled = !this.plugin.userConnected;

		new Setting(this.containerEl)
			.setName("Process old messages")
			.setDesc(
				"During the plugin loading, unprocessed messages that are older than 24 hours and are not accessible to the bot will be forwarded to the same chat using the connected user's account. This action will enable the bot to detect and process these messages",
			)
			.addButton((btn) => {
				btn.setIcon("settings");
				btn.setTooltip("Settings");
				btn.setDisabled(disabled);
				btn.onClick(async () => {
					const processOldMessagesSettingsModal = new ProcessOldMessagesSettingsModal(this.plugin);
					processOldMessagesSettingsModal.open();
				});
			})
			.addToggle((toggle) => {
				toggle.setValue(disabled ? false : this.plugin.settings.processOldMessages);
				toggle.setDisabled(disabled);
				toggle.onChange(async (value) => {
					if (!value) clearCachedUnprocessedMessages();
					else this.plugin.settings.processOldMessagesSettings.lastProcessingDate = getOffsetDate();
					this.plugin.settings.processOldMessages = value;

					await this.plugin.saveSettings();
				});
			});
	}

	async storeTopicName(msg: Message, name: string) {
		const topicId = getTopicId(msg);
		if (!topicId || !name) return;
		const existing = this.plugin.settings.topicNames.find(
			(topic) => topic.chatId === msg.chat.id && topic.topicId === topicId,
		);
		if (existing) existing.name = name;
		else this.plugin.settings.topicNames.push({ name, chatId: msg.chat.id, topicId });
		await this.plugin.saveSettings();
	}
}
