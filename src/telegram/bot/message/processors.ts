import type { Message } from "src/telegram/bot/apiTypes";
import TelegramSyncPlugin from "../../../main";
import {
	getChatId,
	getChatLink,
	getChatName,
	getForwardFromLink,
	getForwardFromName,
	getHashtag,
	getReplyMessageId,
	getTopic,
	getTopicId,
	getTopicLink,
	getUrl,
	getUserLink,
} from "./getters";
import { TFile, normalizePath } from "obsidian";
import { formatDateTime, unixTime2Date } from "../../../utils/dateUtils";
import { _1h, _5sec, displayAndLogError } from "src/utils/logUtils";
import { convertMessageTextToMarkdown } from "./convertToMarkdown";
import { sanitizeImportedMarkdown } from "./markdownSafety";
import * as Client from "../../user/client";
import { enqueue } from "src/utils/queues";
import { sanitizeFileName, sanitizeFilePath } from "src/utils/fsUtils";
import path from "path";
import { defaultFileNameTemplate, defaultNoteNameTemplate } from "src/settings/messageDistribution";
import { Api } from "telegram/tl";
import { setReaction } from "../bot";
import { emoticonProcessed, emoticonProcessedEdited } from "src/telegram/user/config";

// Delete a message or send a confirmation reply based on settings and message age
export async function finalizeMessageProcessing(plugin: TelegramSyncPlugin, msg: Message, error?: Error) {
	if (error) await displayAndLogError(plugin, error, "", "", msg, _5sec);
	if (error || !plugin.bot) {
		return;
	}
	// oxlint-disable-next-line typescript/no-explicit-any
	const originalMsg: Api.Message | undefined = (msg as any).originalUserMsg;
	// oxlint-disable-next-line typescript/no-explicit-any
	const mediaMessages: Message[] = (msg as any).mediaMessages || [];

	if (originalMsg) {
		await plugin.bot.deleteMessage(msg.chat.id, msg.message_id);
	}

	const messageTime = unixTime2Date(msg.date);
	const timeDifference = new Date().getTime() - messageTime.getTime();
	const hoursDifference = timeDifference / _1h;

	if (plugin.settings.deleteMessagesFromTelegram && originalMsg) {
		await originalMsg.delete();
	} else if (plugin.settings.deleteMessagesFromTelegram && hoursDifference <= 24) {
		for (const mediaMsg of mediaMessages) {
			await plugin.bot.deleteMessage(mediaMsg.chat.id, mediaMsg.message_id);
		}
		await plugin.bot.deleteMessage(msg.chat.id, msg.message_id);
	} else {
		let needReply = true;

		const emoticon = msg.edit_date ? emoticonProcessedEdited : emoticonProcessed;
		// reacting by bot
		try {
			await enqueue(setReaction, plugin, msg, emoticon);
			needReply = false;
		} catch {
			// Fall back to the optional user connection or a fixed acknowledgement.
		}
		// reacting by user
		try {
			if (needReply && plugin.userConnected && plugin.botUser) {
				await enqueue(Client.sendReaction, plugin.botUser, msg, emoticon);
				needReply = false;
			}
		} catch {
			// Fall back to a fixed acknowledgement.
		}
		const ok_msg = msg.edit_date ? "...🆗..." : "...✅...";
		if (needReply && originalMsg) {
			await originalMsg.reply({
				message: ok_msg,
				silent: true,
			});
		} else if (needReply) {
			await plugin.bot?.sendMessage(msg.chat.id, ok_msg, {
				reply_to_message_id: msg.message_id,
				disable_notification: true,
			});
		}
	}
}

export async function applyNoteContentTemplate(
	plugin: TelegramSyncPlugin,
	templateFilePath: string,
	msg: Message,
	filesLinks: string[] = [],
): Promise<string> {
	let template = "";
	if (templateFilePath) {
		const file = plugin.app.vault.getAbstractFileByPath(normalizePath(templateFilePath));
		if (!(file instanceof TFile)) throw new Error("Template file could not be found.");
		template = await plugin.app.vault.read(file);
	}
	const text = await convertMessageTextToMarkdown(msg);
	const forward = getForwardFromLink(msg);
	const files = filesLinks.join("\n");
	const content = [forward ? "**Forwarded from " + forward + "**" : "", files, text].filter(Boolean).join("\n\n");
	return template ? renderTemplate(plugin, msg, template, { text, content, files }) : content;
}

export async function applyNotePathTemplate(
	plugin: TelegramSyncPlugin,
	template: string,
	msg: Message,
): Promise<string> {
	if (!template) return "";
	if (template.endsWith("/")) template += defaultNoteNameTemplate;
	let output = await renderTemplate(plugin, msg, template, { text: msg.text ?? msg.caption ?? "", isPath: true });
	if (output.endsWith("/.md")) output = output.slice(0, -3) + "_.md";
	if (!path.posix.extname(output)) output += ".md";
	if (output.endsWith(".")) output += "md";
	return sanitizeFilePath(output);
}

export async function applyFilesPathTemplate(
	plugin: TelegramSyncPlugin,
	template: string,
	msg: Message,
	fileType: string,
	fileExtension: string,
	fileName: string,
): Promise<string> {
	if (!template) return "";
	if (template.endsWith("/")) template += defaultFileNameTemplate;
	let output = await renderTemplate(plugin, msg, template, {
		text: msg.caption ?? "",
		isPath: true,
		file: { type: fileType, name: fileName, extension: fileExtension },
	});
	if (!path.posix.extname(output)) output += "." + fileExtension;
	if (output.endsWith(".")) output += fileExtension;
	return sanitizeFilePath(output);
}

interface TemplateContext {
	text: string;
	content?: string;
	files?: string;
	isPath?: boolean;
	file?: { type: string; name: string; extension: string };
}

async function renderTemplate(plugin: TelegramSyncPlugin, msg: Message, template: string, context: TemplateContext) {
	const replacements: [string, string][] = [];
	const messageDate = unixTime2Date(msg.date, msg.message_id);
	const creationDate = msg.forward_date ? unixTime2Date(msg.forward_date, msg.message_id) : messageDate;
	const now = new Date();
	const topic = () => (topicResult ??= getTopic(plugin, msg));
	let topicResult: ReturnType<typeof getTopic> | undefined;
	let transcript: Promise<string> | undefined;
	const tokens = /^([> \t]+)\{\{((?:content|voiceTranscript)(?::[^{}\n]+)?)\}\}|\{\{([^{}\n]+)\}\}/gm;
	let cursor = 0;
	const output: string[] = [];

	for (const match of template.matchAll(tokens)) {
		output.push(template.slice(cursor, match.index));
		cursor = match.index + match[0].length;
		const token = match[2] ?? match[3];
		const separator = token.indexOf(":");
		const name = separator === -1 ? token : token.slice(0, separator);
		const argument = separator === -1 ? undefined : token.slice(separator + 1);
		const leading = match[1];
		let value: string | undefined;

		switch (name) {
			case "content":
				value = processText(
					argument === undefined ? (context.content ?? context.text) : context.text,
					leading,
					argument,
				);
				break;
			case "voiceTranscript": {
				if (plugin.bot && plugin.userConnected) {
					const bot = plugin.bot;
					transcript ??= plugin.getBotUser().then((user) => Client.transcribeAudio(bot, msg, user));
				}
				value = processText(sanitizeImportedMarkdown((await transcript) ?? ""), leading, argument);
				break;
			}
			case "files":
				value = argument === "links" ? context.files?.replaceAll("![", "[") : context.files;
				break;
			case "file":
				if (argument === "type" || argument === "name" || argument === "extension")
					value = context.file?.[argument];
				break;
			case "url1":
				// Legacy preview tokens render as a URL, without embedding a remote page.
				value = getUrl(msg);
				break;
			case "replace":
				if (!context.isPath && argument) {
					const arrow = argument.indexOf("=>");
					const from = arrow === -1 ? argument : argument.slice(0, arrow);
					const to = arrow === -1 ? "" : argument.slice(arrow + 2);
					if (from) replacements.push([from.replaceAll("\\n", "\n"), to.replaceAll("\\n", "\n")]);
					value = "";
				}
				break;
			case "messageDate":
			case "messageTime":
				value = formatDateTime(messageDate, argument ?? "");
				break;
			case "creationDate":
			case "creationTime":
				value = formatDateTime(creationDate, argument ?? "");
				break;
			case "date":
			case "time":
				value = formatDateTime(now, argument ?? "");
				break;
			case "user":
				value =
					argument === "name"
						? (msg.from?.username ?? "")
						: argument === "fullName"
							? [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ")
							: getUserLink(msg);
				break;
			case "chat":
				value = argument === "name" ? getChatName(msg, plugin.botUser) : getChatLink(msg, plugin.botUser);
				break;
			case "forwardFrom":
				value = argument === "name" ? getForwardFromName(msg) : getForwardFromLink(msg);
				break;
			case "topic":
				value = argument === "name" ? ((await topic())?.name ?? "") : getTopicLink(msg, await topic());
				break;
			case "hashtag": {
				const number = argument?.match(/^\[(\d+)\]$/)?.[1];
				if (number) value = getHashtag(msg, Number(number));
				break;
			}
			case "userId":
				value = String(msg.from?.id ?? msg.message_id);
				break;
			case "chatId":
				value = getChatId(msg, plugin.botUser);
				break;
			case "topicId":
				value = getTopicId(msg)?.toString() ?? "";
				break;
			case "messageId":
				value = String(msg.message_id);
				break;
			case "replyMessageId":
				value = getReplyMessageId(msg);
				break;
		}

		if (value === undefined) output.push(match[0]);
		else if (context.isPath) {
			const isDateFormat = /^(?:(?:message|creation)(?:Date|Time)|date|time)$/.test(name);
			output.push(isDateFormat ? value : sanitizeFileName(value));
		} else {
			output.push(name === "files" || name === "content" ? value : sanitizeImportedMarkdown(value));
		}
	}

	output.push(template.slice(cursor));
	let rendered = output.join("");
	for (const [from, to] of replacements) rendered = rendered.replaceAll(from, () => to);
	return rendered;
}

function addLeadingForEveryLine(text: string, leadingChars?: string): string {
	if (!leadingChars) return text;
	return text
		.split("\n")
		.map((line) => leadingChars + line)
		.join("\n");
}

function processText(text: string, leadingChars?: string, property?: string): string {
	let finalText = "";
	const lowerCaseProperty = (property && property.toLowerCase()) || "text";

	if (lowerCaseProperty == "text") finalText = text;
	// if property is length
	else if (Number.isInteger(parseFloat(lowerCaseProperty))) finalText = text.substring(0, Number(property));

	if (finalText) return addLeadingForEveryLine(finalText, leadingChars);

	// if property is range
	const rangePattern = /^\[\d+-\d+\]$/;
	const singleLinePattern = /^\[\d+\]$/;
	const lastLinePattern = /^\[-\d+\]$/;
	const fromLineToEndPattern = /^\[\d+-\]$/;

	let lines = text.split("\n");
	let startLine = 0;
	let endLine = lines.length;

	if (rangePattern.test(lowerCaseProperty)) {
		const range = lowerCaseProperty
			.substring(1, lowerCaseProperty.length - 1)
			.split("-")
			.map(Number);
		startLine = Math.max(0, range[0] - 1);
		endLine = Math.min(lines.length, range[1]);
	} else if (singleLinePattern.test(lowerCaseProperty)) {
		startLine = Number(lowerCaseProperty.substring(1, lowerCaseProperty.length - 1)) - 1;
		endLine = startLine + 1;
	} else if (lastLinePattern.test(lowerCaseProperty)) {
		startLine = Math.max(0, lines.length - Number(lowerCaseProperty.substring(2, lowerCaseProperty.length - 1)));
		endLine = startLine + 1;
	} else if (fromLineToEndPattern.test(lowerCaseProperty)) {
		startLine = Number(lowerCaseProperty.substring(1, lowerCaseProperty.length - 2)) - 1;
		endLine = lines.length;
	} else lines = [];

	finalText = lines.slice(startLine, endLine).join("\n");

	return addLeadingForEveryLine(finalText, leadingChars);
}
