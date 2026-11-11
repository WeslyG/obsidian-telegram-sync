import { ButtonComponent, Modal, Notice, Setting } from "obsidian";
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
		this.titleEl.setText("Bot proxy");
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

		const tabs = new Setting(this.contentEl);
		const connectionPanel = this.contentEl.createDiv();
		const authenticationPanel = this.contentEl.createDiv();
		const connectionTab = new ButtonComponent(tabs.controlEl).setButtonText("Connection");
		const authenticationTab = new ButtonComponent(tabs.controlEl).setButtonText("Authentication");
		const selectTab = (showAuthentication: boolean) => {
			connectionPanel.hidden = showAuthentication;
			authenticationPanel.hidden = !showAuthentication;
			connectionTab.buttonEl.toggleClass("mod-cta", !showAuthentication);
			authenticationTab.buttonEl.toggleClass("mod-cta", showAuthentication);
			connectionTab.buttonEl.setAttribute("aria-pressed", String(!showAuthentication));
			authenticationTab.buttonEl.setAttribute("aria-pressed", String(showAuthentication));
		};
		connectionTab.onClick(() => selectTab(false));
		authenticationTab.onClick(() => selectTab(true));
		selectTab(false);

		const connectionType = new Setting(connectionPanel).setName("Connection type");
		const addressSetting = new Setting(connectionPanel);
		connectionType.addDropdown((dropdown) =>
			dropdown
				.addOptions({ direct: "No proxy", http: "HTTP", https: "HTTPS", socks5: "SOCKS5" })
				.setValue(protocol)
				.onChange((value) => {
					protocol = value;
					addressSetting.setDisabled(value === "direct");
				}),
		);
		addressSetting
			.setName("Proxy address")
			.setDesc("Hostname or IP address and port.")
			.addText((text) =>
				text
					.setPlaceholder("127.0.0.1:1080")
					.setValue(address)
					.onChange((value) => (address = value.trim())),
			)
			.setDisabled(protocol === "direct");

		const authenticationToggle = new Setting(authenticationPanel)
			.setName("Use proxy authentication")
			.setDesc("Credentials are stored in Obsidian's secret storage on this device.");
		const fields = authenticationPanel.createDiv();
		authenticationToggle.addToggle((toggle) =>
			toggle.setValue(authentication).onChange((value) => {
				authentication = value;
				fields.hidden = !value;
			}),
		);
		fields.hidden = !authentication;
		new Setting(fields).setName("Username").addText((text) => {
			text.inputEl.setAttribute("aria-label", "Proxy username");
			text.setValue(credentials.username).onChange((value) => (credentials.username = value));
		});
		new Setting(fields).setName("Password").addText((text) => {
			text.inputEl.type = "password";
			text.inputEl.setAttribute("aria-label", "Proxy password");
			text.setValue(credentials.password).onChange((value) => (credentials.password = value));
		});

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText("Save")
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
						new Notice(error instanceof Error ? error.message : "Invalid proxy settings.");
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
							"Could not save proxy settings. Proxy authentication requires Obsidian 1.11.4 or later.",
						);
						button.setDisabled(false);
						if (credentialsSaved) {
							try {
								saveProxyCredentials(this.app, previousCredentials);
							} catch {
								new Notice(
									"Could not restore the previous proxy credentials in Obsidian secret storage.",
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
