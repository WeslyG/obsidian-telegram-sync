import { t } from "src/settings/i18n";
import { Modal, Setting } from "obsidian";
import type TelegramSyncPlugin from "src/main";
import * as User from "src/telegram/user/user";

export class UserLogInModal extends Modal {
	private controller = new AbortController();

	constructor(private plugin: TelegramSyncPlugin) {
		super(plugin.app);
	}

	onOpen() {
		this.titleEl.setText(t("Connect a Telegram user"));
		const info = this.contentEl.createDiv({
			text: t("This feature connects directly to Telegram. Create an API ID and hash at "),
		});
		info.createEl("a", { href: "https://my.telegram.org/apps", text: "my.telegram.org" });
		let apiId = "";
		let apiHash = "";
		let password = "";
		let passwordInput: HTMLInputElement | undefined;

		new Setting(this.contentEl).setName("API ID").addText((text) =>
			text.onChange((value) => {
				apiId = value.trim();
			}),
		);
		new Setting(this.contentEl).setName(t("API hash")).addText((text) => {
			text.inputEl.type = "password";
			text.onChange((value) => {
				apiHash = value.trim();
			});
		});
		new Setting(this.contentEl)
			.setName(t("Telegram two-step password"))
			.setDesc(t("Enter it only if enabled on your Telegram account."))
			.addText((text) => {
				text.inputEl.type = "password";
				passwordInput = text.inputEl;
				text.onChange((value) => {
					password = value;
				});
			});

		this.contentEl.createEl("p", { text: t("In Telegram, open Settings → Devices → Link Desktop Device.") });
		const container = this.contentEl.createDiv({ cls: "qr-code-container" });
		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText(t("Generate QR code"))
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					container.setText(t("Connecting to Telegram…"));
					const error = await User.connect(this.plugin, {
						apiId: Number(apiId),
						apiHash,
						password,
						container,
						signal: this.controller.signal,
					});
					password = "";
					if (passwordInput) passwordInput.value = "";
					if (this.controller.signal.aborted) return;
					if (!error) {
						this.close();
						return;
					}
					container.setText(error);
					button.setDisabled(false);
				}),
		);
	}

	onClose() {
		this.controller.abort();
		this.contentEl.empty();
	}
}
