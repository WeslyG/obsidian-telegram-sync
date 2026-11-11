import { t } from "src/settings/i18n";
import { Modal, normalizePath, Setting } from "obsidian";
import TelegramSyncPlugin from "../../main";
import {
	defaultFileNameTemplate,
	defaultNoteNameTemplate,
	extractConditionsFromFilterQuery,
	createBlankMessageDistributionRule,
	MessageDistributionRule,
} from "../messageDistribution";
import { FileSuggest } from "../suggesters/FileSuggester";
import { _15sec, displayAndLog } from "../../utils/logUtils";

export class MessageDistributionRulesModal extends Modal {
	messageDistributionRule: MessageDistributionRule;
	plugin: TelegramSyncPlugin;
	saved = false;
	editing = false;

	constructor(plugin: TelegramSyncPlugin, messageDistributionRule?: MessageDistributionRule) {
		super(plugin.app);
		this.plugin = plugin;
		if (messageDistributionRule) {
			this.editing = true;
			this.messageDistributionRule = messageDistributionRule;
		} else this.messageDistributionRule = createBlankMessageDistributionRule();
	}

	onOpen() {
		this.modalEl.style.height = "90vh";
		this.modalEl.style.width = "60vw";
		this.contentEl.empty();
		const container = this.contentEl.createDiv();
		this.addHeader(container);
		this.addMessageFilter(container);
		this.addTemplateFilePath(container);
		this.addNotePathTemplate(container);
		this.addFilePathTemplate(container);
		this.addHeading(container);
		this.addMessageSortingMode(container);
		this.addFooterButtons(container);
	}

	private addHeader(container: HTMLDivElement) {
		this.titleEl.setText(
			this.editing ? t("Editing message distribution rule") : t("Adding message distribution rule"),
		);
		new Setting(container).descEl.createEl("a", {
			text: t("🗎 User guide"),
			href: "https://github.com/WeslyG/obsidian-telegram-sync/blob/main/docs/Template%20Variables%20List.md",
		});
	}

	private addMessageFilter(container: HTMLDivElement) {
		const setting = new Setting(container)
			.setName(t("Message filter"))
			.setDesc(
				t(
					"Conditions by which you would like to filter messages. Leave the field blank if you want to apply this rule to all messages",
				),
			)
			.addTextArea((text) => {
				text.setValue(this.messageDistributionRule.messageFilterQuery)
					.onChange(async (filterQuery: string) => {
						this.messageDistributionRule.messageFilterQuery = filterQuery;
						this.messageDistributionRule.messageFilterConditions =
							extractConditionsFromFilterQuery(filterQuery);
					})
					.setPlaceholder(t("example: {{topic=Notes}}{{user=example_user}}"));
			});
		setSettingStyles(setting);
	}

	private addTemplateFilePath(container: HTMLDivElement) {
		const setting = new Setting(container)
			.setName(t("Template file path"))
			.setDesc(t("Specify path to template file you want to apply to new notes"))
			.addSearch((cb) => {
				new FileSuggest(cb.inputEl, this.plugin);
				cb.setPlaceholder(t("example: folder/zettelkasten.md"))
					.setValue(this.messageDistributionRule.templateFilePath)
					.onChange(async (path) => {
						this.messageDistributionRule.templateFilePath = path ? normalizePath(path) : path;
					});
			});
		setSettingStyles(setting);
	}

	private addNotePathTemplate(container: HTMLDivElement) {
		const setting = new Setting(container)
			.setName(t("Note path template"))
			.setDesc(
				t(
					"Specify path template for storage folders and note names. Leave empty if you don't want to create any notes from filtrated messages",
				),
			)
			.addTextArea((text) => {
				text.setPlaceholder(t("Example: {path}", { path: `folder/${defaultNoteNameTemplate}` }))
					.setValue(this.messageDistributionRule.notePathTemplate)
					.onChange(async (value: string) => {
						this.messageDistributionRule.notePathTemplate = value;
					});
			});
		setSettingStyles(setting);
	}

	private addFilePathTemplate(container: HTMLDivElement) {
		const setting = new Setting(container);
		setting
			.setName(t("File path template"))
			.setDesc(
				t(
					"Specify path template for storage folders and file names. Leave empty if you don't want to save any files from filtrated messages",
				),
			)
			.addTextArea((text) => {
				text.setPlaceholder(t("Example: {path}", { path: `folder/${defaultFileNameTemplate}` }))
					.setValue(this.messageDistributionRule.filePathTemplate)
					.onChange(async (value: string) => {
						this.messageDistributionRule.filePathTemplate = value;
					});
			});
		setSettingStyles(setting);
	}

	private addHeading(container: HTMLDivElement) {
		const setting = new Setting(container);
		setting
			.setName(t("Heading"))
			.setDesc(t("Specify the heading under which new messages will be inserted"))
			.addText((text) => {
				text.setPlaceholder(t("example: ### Log"))
					.setValue(this.messageDistributionRule.heading)
					.onChange(async (value: string) => {
						this.messageDistributionRule.heading = value;
					});
			});
		setSettingStyles(setting);
	}

	private addMessageSortingMode(container: HTMLDivElement) {
		const setting = new Setting(container);
		setting
			.setName(t("Reversed order"))
			.setDesc(
				t(
					'Turn on to have new messages appear at the beginning of the note, or, if a heading is specified, above it. Warning: If "Parallel Message Processing" turn on, it may disrupt message order',
				),
			)
			.addToggle((toggle) => {
				toggle.setValue(this.messageDistributionRule.reversedOrder);
				toggle.onChange(async (value) => {
					this.messageDistributionRule.reversedOrder = value;
				});
			});
	}

	private addFooterButtons(container: HTMLDivElement) {
		container.createEl("br");
		const footerButtons = new Setting(this.contentEl.createDiv());
		footerButtons.addButton((b) => {
			b.setTooltip(t("Submit"))
				.setIcon("checkmark")
				.onClick(async () => {
					const template = this.messageDistributionRule.templateFilePath;
					const notePath = this.messageDistributionRule.notePathTemplate;
					const filePath = this.messageDistributionRule.filePathTemplate;
					if (!template && !notePath && !filePath) {
						displayAndLog(this.plugin, t("Please, fill at least one field"), _15sec);
						return;
					}
					if (
						(template && (template == notePath || template == filePath)) ||
						(filePath && filePath == notePath)
					) {
						displayAndLog(
							this.plugin,
							t(
								'"Template file path", "Note path template" and "File path template" must not be equal to one another',
							),
							_15sec,
						);
						return;
					}
					if (!this.editing) this.plugin.settings.messageDistributionRules.push(this.messageDistributionRule);
					await this.plugin.saveSettings();
					this.saved = true;
					this.close();
				});
			return b;
		});
		footerButtons.addExtraButton((b) => {
			b.setIcon("cross")
				.setTooltip(t("Cancel"))
				.onClick(async () => {
					await this.plugin.loadSettings();
					this.saved = false;
					this.close();
				});
			return b;
		});
	}
}
function setSettingStyles(setting: Setting) {
	setting.infoEl.style.width = "55%";
	setting.controlEl.style.width = "45%";
	const el = setting.controlEl.firstElementChild;
	if (!el) return;
	if (el instanceof HTMLTextAreaElement) {
		el.style.height = "4.5em";
		el.style.width = "100%";
	}
	if (el instanceof HTMLInputElement) {
		el.style.width = "100%";
	}

	if (el instanceof HTMLDivElement && el.className == "search-input-container") {
		el.style.width = "100%";
	}
}
