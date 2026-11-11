import { setIcon } from "obsidian";
import TelegramSyncPlugin from "./main";
import { t } from "./settings/i18n";

export type KeysOfConnectionStatusIndicatorType = "HIDDEN" | "CONSTANT" | "ONLY_WHEN_ERRORS";
export const checkConnectionMessage = () =>
	t(
		"Check your internet or proxy connection and confirm that the official Telegram app works. Then restart Obsidian.",
	);

export default class ConnectionStatusIndicator {
	plugin: TelegramSyncPlugin;
	icon?: HTMLElement;
	label?: HTMLLabelElement;

	constructor(plugin: TelegramSyncPlugin) {
		this.plugin = plugin;
	}

	private create() {
		if (this.icon) return; // status icon resource has already been allocated
		this.icon = this.plugin.addStatusBarItem();
		this.icon.id = "connection-status-indicator";
		setIcon(this.icon, "send");
		this.label = this.icon.createEl("label");
		this.label.setAttr("for", "connection-status-indicator");
	}

	destroy() {
		this.label?.remove();
		this.icon?.remove();
		this.icon = undefined;
		this.label = undefined;
	}

	update(error?: Error) {
		if (
			this.plugin.settings.connectionStatusIndicatorType == "HIDDEN" ||
			(this.plugin.settings.connectionStatusIndicatorType == "ONLY_WHEN_ERRORS" && !error)
		) {
			this.destroy();
			return;
		}
		this.create();

		if (this.plugin.isBotConnected()) this.setConnected();
		else this.setDisconnected(error?.message);
	}

	private setConnected() {
		if (!this.icon) return;
		this.label?.setText("");
		this.label?.removeAttribute("style");
		this.icon.removeAttribute("data-tooltip-position");
		this.icon.removeAttribute("aria-label");
	}

	private setDisconnected(error?: string): void {
		if (!this.icon) return;
		this.icon.setAttrs({
			"data-tooltip-position": "top",
			"aria-label": `${error || ""}\n${checkConnectionMessage()}`.trimStart(),
		});
		this.label?.setAttr("style", "position: relative; left: -3px; bottom: -3px; font-weight: bold; color:red;");
		this.label?.setText("x");
	}
}
