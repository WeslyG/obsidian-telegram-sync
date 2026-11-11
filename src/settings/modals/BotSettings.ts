import { t } from "src/settings/i18n";
import { Modal, Notice, Setting } from "obsidian";
import type TelegramSyncPlugin from "src/main";
import { proxyGuideLink } from "release-notes.mjs";
import { isBotToken } from "src/telegram/bot/api";
import { normalizeAllowedChats } from "src/telegram/bot/access";

export class BotSettingsModal extends Modal {
	private token?: string;
	private allowedChats: string;
	private mainDeviceId: string;

	constructor(
		private plugin: TelegramSyncPlugin,
		private onSaved: () => Promise<void>,
	) {
		super(plugin.app);
		this.allowedChats = plugin.settings.allowedChats.join(", ");
		this.mainDeviceId = plugin.settings.mainDeviceId;
	}

	onOpen() {
		this.titleEl.setText(t("Bot settings"));
		const tokenSetting = new Setting(this.contentEl)
			.setName(t("Bot token"))
			.setDesc(t("Stored in Obsidian's local secret storage."));
		tokenSetting.addText((text) => {
			text.inputEl.type = "password";
			text.setPlaceholder(this.plugin.getBotToken() ? t("Token is stored") : t("Telegram bot token")).onChange(
				(value) => {
					this.token = value.trim() || undefined;
				},
			);
			if (this.plugin.getBotToken()) {
				tokenSetting.addButton((button) =>
					button.setButtonText(t("Remove token")).onClick(() => {
						text.setValue("").setPlaceholder(t("Token will be removed when saved"));
						this.token = "";
					}),
				);
			}
		});

		new Setting(this.contentEl)
			.setName(t("Allowed chats"))
			.setDesc(t("Comma-separated usernames or Telegram chat IDs. Leave empty to block all imports."))
			.addTextArea((text) =>
				text
					.setPlaceholder("example_user, -1001234567890")
					.setValue(this.allowedChats)
					.onChange((value) => {
						this.allowedChats = value;
					}),
			);

		const device = new Setting(this.contentEl)
			.setName(t("Main device id"))
			.setDesc(t("Select one device when the same vault runs on multiple desktops."));
		device.addText((text) => {
			text.setValue(this.mainDeviceId).onChange((value) => {
				this.mainDeviceId = value.trim();
			});
			device.addButton((button) =>
				button.setButtonText(t("Use this device")).onClick(() => {
					this.mainDeviceId = this.plugin.currentDeviceId;
					text.setValue(this.mainDeviceId);
				}),
			);
		});

		this.contentEl.createEl("a", { text: t("Bot proxy setup guide"), href: proxyGuideLink });
		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText(t("Save"))
				.setCta()
				.onClick(async () => {
					const token = this.token;
					if (token && !isBotToken(token)) {
						new Notice(t("Enter a valid Telegram bot token."));
						return;
					}
					button.setDisabled(true);
					const previousToken = this.plugin.getBotToken();
					const settings = this.plugin.settings;
					const previousChats = settings.allowedChats;
					const previousDevice = settings.mainDeviceId;
					let tokenSaved = false;
					try {
						if (token !== undefined) {
							this.plugin.setBotToken(token);
							tokenSaved = true;
						}
						settings.allowedChats = normalizeAllowedChats(this.allowedChats.split(","));
						settings.mainDeviceId = this.mainDeviceId;
						await this.plugin.saveSettings();
					} catch {
						settings.allowedChats = previousChats;
						settings.mainDeviceId = previousDevice;
						new Notice(t("Could not save Telegram Sync settings."));
						button.setDisabled(false);
						if (tokenSaved) {
							try {
								this.plugin.setBotToken(previousToken);
							} catch {
								new Notice(t("Could not restore the previous bot token in Obsidian secret storage."));
							}
						}
						return;
					}
					this.close();
					await this.onSaved().catch(
						() => new Notice(t("Settings saved. Telegram Sync could not reconnect.")),
					);
				}),
		);
	}

	onClose() {
		this.token = undefined;
		this.contentEl.empty();
	}
}
