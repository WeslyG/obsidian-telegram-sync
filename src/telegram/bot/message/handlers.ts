import type { Message } from "src/telegram/bot/apiTypes";
import TelegramSyncPlugin from "../../../main";
import {
	appendContentToNote,
	createFolderIfNotExist,
	defaultDelimiter,
	getUniqueFilePath,
	toArrayBuffer,
} from "src/utils/fsUtils";
import path from "path";
import * as Client from "../../user/client";
import { extension } from "mime-types";
import {
	applyFilesPathTemplate,
	applyNoteContentTemplate,
	applyNotePathTemplate,
	finalizeMessageProcessing,
} from "./processors";
import { ProgressBarType, _3MB, createProgressBar, deleteProgressBar, updateProgressBar } from "../progressBar";
import { getFileObject, normalizeForwardOrigin } from "./getters";
import { TFile } from "obsidian";
import { enqueue } from "src/utils/queues";
import { _15sec, _1sec, displayAndLogError } from "src/utils/logUtils";
import { botFileLimit } from "../api";
import { isAllowedMessage } from "../access";
import { maxUserDownloadBytes } from "../../user/client";
import { getMessageDistributionRule } from "./filterEvaluations";
import type { MessageDistributionRule } from "src/settings/messageDistribution";
import { getOffsetDate, unixTime2Date } from "src/utils/dateUtils";
import { addOriginalUserMsg, canUpdateProcessingDate } from "src/telegram/user/sync";

interface MediaGroup {
	id: string;
	chatId: number;
	rule: MessageDistributionRule;
	notePath: string;
	initialMsg: Message;
	mediaMessages: Message[];
	error?: Error;
	filesPaths: string[];
}

const mediaGroups: MediaGroup[] = [];

let handleMediaGroupIntervalId: ReturnType<typeof setInterval> | undefined;

export function clearHandleMediaGroupInterval() {
	clearInterval(handleMediaGroupIntervalId);
	handleMediaGroupIntervalId = undefined;
	mediaGroups.length = 0;
}

// handle all messages from Telegram
export async function handleMessage(plugin: TelegramSyncPlugin, msg: Message) {
	if (!isAllowedMessage(plugin.settings.allowedChats, msg)) return;
	if (msg.text === "/start") return;
	const topicName = msg.text?.match(/^\/topicName(?:@\w+)?\s+(.+)$/s)?.[1].trim();
	if (topicName) {
		await plugin.settingsTab?.storeTopicName(msg, topicName);
		return;
	}

	const { fileObject } = getFileObject(msg);
	const topicUpdate = msg.forum_topic_created ?? msg.forum_topic_edited;
	if (!msg.text && !fileObject && !topicUpdate) return;
	normalizeForwardOrigin(msg);
	addOriginalUserMsg(msg);
	// oxlint-disable-next-line typescript/no-explicit-any
	if ((msg as any).userMsg) return;

	const distributionRule = await getMessageDistributionRule(plugin, msg);
	if (!distributionRule) return;
	if (topicUpdate?.name) {
		await plugin.settingsTab?.storeTopicName(msg, topicUpdate.name);
		return;
	}

	++plugin.messagesLeftCnt;
	try {
		if (!msg.text && distributionRule.filePathTemplate) await handleFiles(plugin, msg, distributionRule);
		else await handleMessageText(plugin, msg, distributionRule);
	} catch (error) {
		displayAndLogError(plugin, error, "", "", msg, _15sec);
	} finally {
		--plugin.messagesLeftCnt;
		if (plugin.messagesLeftCnt === 0 && canUpdateProcessingDate) {
			plugin.settings.processOldMessagesSettings.lastProcessingDate = getOffsetDate();
			await plugin.saveSettings();
		}
	}
}

export async function handleMessageText(
	plugin: TelegramSyncPlugin,
	msg: Message,
	distributionRule: MessageDistributionRule,
) {
	const formattedContent = await applyNoteContentTemplate(plugin, distributionRule.templateFilePath, msg);
	const notePath = await applyNotePathTemplate(plugin, distributionRule.notePathTemplate, msg);

	const folder = path.posix.dirname(notePath);
	if (folder !== ".") await createFolderIfNotExist(plugin.app.vault, folder);

	await enqueue(
		appendContentToNote,
		plugin.app.vault,
		notePath,
		formattedContent,
		distributionRule.heading,
		plugin.settings.defaultMessageDelimiter ? defaultDelimiter : "",
		distributionRule.reversedOrder,
	);
	await finalizeMessageProcessing(plugin, msg);
}

async function createNoteContent(
	plugin: TelegramSyncPlugin,
	notePath: string,
	msg: Message,
	distributionRule: MessageDistributionRule,
	filesPaths: string[] = [],
	error?: Error,
) {
	const filesLinks: string[] = [];

	if (!error) {
		filesPaths.forEach((fp) => {
			const filePath = plugin.app.vault.getAbstractFileByPath(fp) as TFile;
			filesLinks.push(plugin.app.fileManager.generateMarkdownLink(filePath, notePath));
		});
	} else {
		filesLinks.push("Attachment could not be saved.");
	}

	return await applyNoteContentTemplate(plugin, distributionRule.templateFilePath, msg, filesLinks);
}

// Handle files received in messages
export async function handleFiles(plugin: TelegramSyncPlugin, msg: Message, distributionRule: MessageDistributionRule) {
	const bot = plugin.bot;
	const { fileType, fileObject } = getFileObject(msg);
	const attachment = Array.isArray(fileObject) ? fileObject.at(-1) : fileObject;
	if (!bot || !attachment) return;

	let filePath = "";
	let error: Error | undefined;
	try {
		const size = attachment.file_size ?? 0;
		if (size > maxUserDownloadBytes) throw new Error("The attachment exceeds the download limit.");
		let filename = attachment.file_name;
		let bytes: Buffer;
		if (size > botFileLimit) {
			if (!plugin.userConnected)
				throw new Error("This attachment requires an explicitly connected Telegram user.");
			bytes = await Client.downloadMedia(bot, msg, size, plugin.botUser);
		} else {
			const file = await bot.openFile(attachment.file_id);
			filename ??= file.filename;
			const chunks: Buffer[] = [];
			let length = 0;
			const progress =
				size > _3MB
					? await createProgressBar(bot, msg, ProgressBarType.DOWNLOADING).catch(() => undefined)
					: undefined;
			let stage = 0;
			try {
				for await (const chunk of file.stream) {
					length += chunk.length;
					if (length > botFileLimit) throw new Error("The attachment exceeds the Bot API download limit.");
					chunks.push(chunk);
					if (progress) stage = await updateProgressBar(bot, msg, progress, size, length, stage);
				}
			} finally {
				file.stream.destroy();
				await deleteProgressBar(bot, msg, progress).catch(() => undefined);
			}
			bytes = Buffer.concat(chunks, length);
		}

		filename ||= fileType + "_" + msg.message_id;
		const suffix = path.extname(filename);
		const fileExtension = suffix.slice(1) || (attachment.mime_type && extension(attachment.mime_type)) || "file";
		const fileName = path.basename(filename, suffix);
		const target = await applyFilesPathTemplate(
			plugin,
			distributionRule.filePathTemplate,
			msg,
			fileType,
			fileExtension,
			fileName,
		);
		filePath = await enqueue(saveAttachment, plugin, target, bytes, msg, fileExtension);
	} catch (cause) {
		error = cause instanceof Error ? cause : new Error("Attachment processing failed.");
	}

	if (msg.caption || distributionRule.templateFilePath || msg.media_group_id)
		await appendFileToNote(plugin, msg, distributionRule, filePath, error);
	if (msg.media_group_id && !handleMediaGroupIntervalId)
		handleMediaGroupIntervalId = setInterval(() => void enqueue(handleMediaGroup, plugin), _1sec);
	else if (!msg.media_group_id) await finalizeMessageProcessing(plugin, msg, error);
}

async function saveAttachment(
	plugin: TelegramSyncPlugin,
	target: string,
	bytes: Buffer,
	msg: Message,
	extension: string,
) {
	const vault = plugin.app.vault;
	const filePath = await getUniqueFilePath(vault, target, unixTime2Date(msg.date, msg.message_id), extension);
	await vault.createBinary(filePath, toArrayBuffer(bytes));
	return filePath;
}

async function handleMediaGroup(plugin: TelegramSyncPlugin) {
	if (mediaGroups.length > 0 && plugin.messagesLeftCnt == 0) {
		for (const mg of mediaGroups.splice(0)) {
			const distributionRule = mg.rule;
			try {
				// oxlint-disable-next-line typescript/no-explicit-any
				(mg.initialMsg as any).mediaMessages = mg.mediaMessages;
				const noteContent = await createNoteContent(
					plugin,
					mg.notePath,
					mg.initialMsg,
					distributionRule,
					mg.filesPaths,
					mg.error,
				);
				await enqueue(
					appendContentToNote,
					plugin.app.vault,
					mg.notePath,
					noteContent,
					distributionRule.heading,
					plugin.settings.defaultMessageDelimiter ? defaultDelimiter : "",
					distributionRule.reversedOrder,
				);
				await finalizeMessageProcessing(plugin, mg.initialMsg, mg.error);
			} catch (e) {
				displayAndLogError(plugin, e, "", "", mg.initialMsg, 0);
			}
		}
	}
}

async function appendFileToNote(
	plugin: TelegramSyncPlugin,
	msg: Message,
	distributionRule: MessageDistributionRule,
	filePath: string,
	error?: Error,
) {
	let mediaGroup = mediaGroups.find((mg) => mg.id === msg.media_group_id && mg.chatId === msg.chat.id);
	if (mediaGroup) {
		if (filePath) mediaGroup.filesPaths.push(filePath);
		if (msg.caption || !mediaGroup.initialMsg) mediaGroup.initialMsg = msg;
		mediaGroup.mediaMessages.push(msg);
		if (error) mediaGroup.error = error;
		return;
	}

	const notePath = await applyNotePathTemplate(plugin, distributionRule.notePathTemplate, msg);

	const folder = path.posix.dirname(notePath);
	if (folder !== ".") await createFolderIfNotExist(plugin.app.vault, folder);

	if (msg.media_group_id) {
		mediaGroup = {
			id: msg.media_group_id,
			chatId: msg.chat.id,
			rule: distributionRule,
			notePath,
			initialMsg: msg,
			mediaMessages: [],
			error: error,
			filesPaths: filePath ? [filePath] : [],
		};
		mediaGroups.push(mediaGroup);
		return;
	}

	const noteContent = await createNoteContent(plugin, notePath, msg, distributionRule, [filePath], error);

	await enqueue(
		appendContentToNote,
		plugin.app.vault,
		notePath,
		noteContent,
		distributionRule.heading,
		plugin.settings.defaultMessageDelimiter ? defaultDelimiter : "",
		distributionRule.reversedOrder,
	);
}
