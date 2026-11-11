import { t } from "src/settings/i18n";
import { Modal, Setting } from "obsidian";
import TelegramSyncPlugin from "src/main";
import { _5sec } from "src/utils/logUtils";
import type { KeysOfConnectionStatusIndicatorType } from "src/ConnectionStatusIndicator";

export class AdvancedSettingsModal extends Modal {
	saved = false;
	constructor(public plugin: TelegramSyncPlugin) {
		super(plugin.app);
	}

	onOpen() {
		this.contentEl.empty();
		const container = this.contentEl.createDiv();
		this.titleEl.setText(t("Advanced settings"));

		this.addConnectionStatusIndicator(container);
		this.addDeleteMessagesFromTelegram(container);
		this.addMessageDelimiterSetting(container);
		this.addParallelMessageProcessing(container);
	}

	private addMessageDelimiterSetting(container: HTMLDivElement) {
		new Setting(container)
			.setName(t('Default delimiter "***" between messages'))
			.setDesc(t("Turn off for using a custom delimiter, which you can set in the template file"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.defaultMessageDelimiter);
				toggle.onChange(async (value) => {
					this.plugin.settings.defaultMessageDelimiter = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private addParallelMessageProcessing(container: HTMLDivElement) {
		new Setting(container)
			.setName(t("Parallel message processing"))
			.setDesc(t("Turn on for faster message and file processing. Caution: may disrupt message order"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.parallelMessageProcessing);
				toggle.onChange(async (value) => {
					this.plugin.settings.parallelMessageProcessing = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private addConnectionStatusIndicator(container: HTMLDivElement) {
		new Setting(container)
			.setName(t("Connection status indicator"))
			.setDesc(t("Choose when you want to see the connection status indicator"))
			.addDropdown((dropDown) => {
				dropDown.addOptions({
					HIDDEN: t("never show, log the errors"),
					CONSTANT: t("show constantly all states"),
					ONLY_WHEN_ERRORS: t("show only when connection errors"),
				});
				dropDown.setValue(this.plugin.settings.connectionStatusIndicatorType);
				dropDown.onChange(async (value) => {
					this.plugin.settings.connectionStatusIndicatorType = value as KeysOfConnectionStatusIndicatorType;
					this.plugin.connectionStatusIndicator?.update();
					await this.plugin.saveSettings();
				});
			});
	}

	private addDeleteMessagesFromTelegram(container: HTMLDivElement) {
		new Setting(container)
			.setName(t("Delete messages from Telegram"))
			.setDesc(
				t(
					"The Telegram messages will be deleted after processing them. If disabled, the Telegram messages will be marked as processed",
				),
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.deleteMessagesFromTelegram);
				toggle.onChange(async (value) => {
					this.plugin.settings.deleteMessagesFromTelegram = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
