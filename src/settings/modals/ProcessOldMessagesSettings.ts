import { t } from "src/settings/i18n";
import { ButtonComponent, Modal, Setting } from "obsidian";
import TelegramSyncPlugin from "src/main";
import { getChatsForSearch } from "src/telegram/user/sync";

export class ProcessOldMessagesSettingsModal extends Modal {
	saved = false;
	constructor(public plugin: TelegramSyncPlugin) {
		super(plugin.app);
	}

	private display() {
		this.contentEl.empty();
		const container = this.contentEl.createDiv();
		this.titleEl.setText(t("Processing old messages settings"));

		new Setting(container).setName(t("Chats for message search")).setHeading();
		this.plugin.settings.processOldMessagesSettings.chatsForSearch.forEach((chat) => {
			const setting = new Setting(container);
			setting.setName(`"${chat.name}"`);
			setting.addExtraButton((btn) => {
				btn.setIcon("trash-2")
					.setTooltip(t("Delete"))
					.onClick(async () => {
						this.plugin.settings.processOldMessagesSettings.chatsForSearch.remove(chat);
						await this.plugin.saveSettings();
						this.display();
					});
			});
		});
		new Setting(container)
			.setDesc(
				t(
					"Choose chats with your connected bot in which to search for old messages. Only chats with activity in the last 30 days will be available. If no chat is chosen, old message processing will not occur",
				),
			)
			.addButton(async (btn: ButtonComponent) => {
				btn.setButtonText(t("Add chats"));
				btn.setClass("mod-cta");
				btn.onClick(async () => {
					this.plugin.settings.processOldMessagesSettings.chatsForSearch = await getChatsForSearch(
						this.plugin,
						30,
					);
					await this.plugin.saveSettings();
					this.display();
				});
			});
	}

	onOpen() {
		this.display();
	}
}
