// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes
import { AbstractInputSuggest, TFile } from "obsidian";
import type TelegramSyncPlugin from "src/main";

export class FileSuggest extends AbstractInputSuggest<TFile> {
	constructor(
		public inputEl: HTMLInputElement,
		private plugin: TelegramSyncPlugin,
	) {
		super(plugin.app, inputEl);
	}

	getSuggestions(input: string): TFile[] {
		const query = input.toLowerCase();
		return this.plugin.app.vault.getMarkdownFiles().filter((file) => file.path.toLowerCase().includes(query));
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.setValue(file.path);
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}
