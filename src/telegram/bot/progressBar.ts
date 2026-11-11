import type TelegramBot from "src/telegram/bot/api";
import type { Message } from "src/telegram/bot/apiTypes";
import { BotApiError } from "./api";

export enum ProgressBarType {
	DOWNLOADING = "downloading",
	DELETING = "deleting",
	TRANSCRIBING = "transcribing",
}

export const _3MB = 3 * 1024 * 1024;
const retryAt = new WeakMap<TelegramBot, number>();

export async function createProgressBar(
	bot: TelegramBot,
	msg: Message,
	action: ProgressBarType,
): Promise<Message | undefined> {
	return await bot.sendMessage(msg.chat.id, action, {
		reply_to_message_id: msg.message_id,
		reply_markup: { inline_keyboard: createProgressBarKeyboard(0).inline_keyboard },
		disable_notification: true,
	});
}

// redraw the progress bar to current process state
export async function updateProgressBar(
	bot: TelegramBot,
	msg: Message,
	progressBarMessage: Message | undefined,
	total: number,
	current: number,
	previousStage: number,
): Promise<number> {
	if (!progressBarMessage) return 0;
	const stage = total > 0 ? Math.max(0, Math.min(10, Math.ceil((current / total) * 10))) : 0;
	if (previousStage === stage || (retryAt.get(bot) ?? 0) > Date.now()) return previousStage;
	try {
		await bot.editMessageReplyMarkup(
			{
				inline_keyboard: createProgressBarKeyboard(stage).inline_keyboard,
			},
			{ chat_id: msg.chat.id, message_id: progressBarMessage.message_id },
		);
	} catch (e) {
		if (e instanceof BotApiError && e.status === 429) retryAt.set(bot, Date.now() + (e.retryAfter ?? 5) * 1000);
		return previousStage;
	}
	return stage;
}

export async function deleteProgressBar(bot: TelegramBot, msg: Message, progressBarMessage: Message | undefined) {
	if (!progressBarMessage) return;
	await bot.deleteMessage(msg.chat.id, progressBarMessage.message_id);
}
// Create a progress bar keyboard
function createProgressBarKeyboard(progress: number) {
	const progressBar = "▓".repeat(progress) + "░".repeat(10 - progress);
	return {
		inline_keyboard: [
			[
				{
					text: progressBar,
					callback_data: JSON.stringify({ action: "update_progress", progress: progress }),
				},
			],
		],
	};
}
