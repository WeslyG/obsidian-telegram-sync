import { proxySettingsError, t } from "src/settings/i18n";
import { Modal, Notice, Setting } from "obsidian";
import type TelegramSyncPlugin from "src/main";
import {
	parseProxyUrl,
	readProxyCredentials,
	saveProxyCredentials,
	validateProxyCredentials,
} from "src/telegram/bot/proxy";
import { enqueue } from "src/utils/queues";

export class BotProxySettingsModal extends Modal {
	constructor(private plugin: TelegramSyncPlugin) {
		super(plugin.app);
	}

	onOpen() {
		this.titleEl.setText(t("Bot proxy"));
		const { proxyUrl, proxyAuthentication } = this.plugin.settings;
		let protocol = "direct";
		let address = "";
		let credentials = readProxyCredentials(this.app) ?? { username: "", password: "" };
		let authentication = proxyAuthentication;
		if (proxyUrl) {
			try {
				const url = new URL(proxyUrl);
				protocol = url.protocol === "socks5h:" ? "socks5" : url.protocol.slice(0, -1);
				address = url.host;
				// Prefill the separate fields when editing a URL saved by an older fork.
				if (url.username || url.password) {
					authentication = true;
					credentials = {
						username: decodeURIComponent(url.username),
						password: decodeURIComponent(url.password),
					};
				}
			} catch {
				// A malformed saved address can be replaced here.
			}
		}

		const connectionType = new Setting(this.contentEl).setName(t("Connection type"));
		const addressSetting = new Setting(this.contentEl)
			.setName(t("Proxy address"))
			.setDesc(t("Hostname or IP address and port."))
			.addText((text) =>
				text
					.setPlaceholder("127.0.0.1:1080")
					.setValue(address)
					.onChange((value) => (address = value.trim())),
			);

		const authenticationSetting = new Setting(this.contentEl)
			.setName(t("Use proxy authentication"))
			.setDesc(t("Credentials are stored in Obsidian's secret storage on this device."));
		const fields = this.contentEl.createDiv();
		const refreshFields = () => {
			const direct = protocol === "direct";
			addressSetting.setDisabled(direct);
			authenticationSetting.setDisabled(direct);
			fields.hidden = direct || !authentication;
		};
		authenticationSetting.addToggle((toggle) =>
			toggle.setValue(authentication).onChange((value) => {
				authentication = value;
				refreshFields();
			}),
		);
		new Setting(fields).setName(t("Username")).addText((text) => {
			text.inputEl.setAttribute("aria-label", t("Proxy username"));
			text.setValue(credentials.username).onChange((value) => (credentials.username = value));
		});
		new Setting(fields).setName(t("Password")).addText((text) => {
			text.inputEl.type = "password";
			text.inputEl.setAttribute("aria-label", t("Proxy password"));
			text.setValue(credentials.password).onChange((value) => (credentials.password = value));
		});
		connectionType.addDropdown((dropdown) =>
			dropdown
				.addOptions({ direct: t("No proxy"), http: "HTTP", https: "HTTPS", socks5: "SOCKS5" })
				.setValue(protocol)
				.onChange((value) => {
					protocol = value;
					refreshFields();
				}),
		);
		refreshFields();

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText(t("Save"))
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					let url: URL | undefined;
					try {
						if (protocol !== "direct") {
							url = parseProxyUrl(`${protocol}://${address}`);
							if (authentication) validateProxyCredentials(url, credentials);
						}
					} catch (error) {
						new Notice(proxySettingsError(error));
						button.setDisabled(false);
						return;
					}

					const useAuthentication = !!url && authentication;
					const settings = this.plugin.settings;
					const previousUrl = settings.proxyUrl;
					const previousAuthentication = settings.proxyAuthentication;
					const previousCredentials = readProxyCredentials(this.app);
					let credentialsSaved = false;
					try {
						if (useAuthentication) {
							saveProxyCredentials(this.app, credentials);
							credentialsSaved = true;
						}
						settings.proxyUrl = url?.href ?? "";
						settings.proxyAuthentication = useAuthentication;
						await this.plugin.saveSettings();
					} catch {
						settings.proxyUrl = previousUrl;
						settings.proxyAuthentication = previousAuthentication;
						new Notice(
							t("Could not save proxy settings. Proxy authentication requires Obsidian 1.11.4 or later."),
						);
						button.setDisabled(false);
						if (credentialsSaved) {
							try {
								saveProxyCredentials(this.app, previousCredentials);
							} catch {
								new Notice(
									t("Could not restore the previous proxy credentials in Obsidian secret storage."),
								);
							}
						}
						return;
					}
					this.close();
					if (this.plugin.getBotToken()) {
						await this.plugin.setBotStatus("disconnected");
						await enqueue(this.plugin, this.plugin.initTelegram, "bot");
					}
				}),
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
