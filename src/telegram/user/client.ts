import { t } from "src/settings/i18n";
import type TelegramBot from "src/telegram/bot/api";
import type { Message, User } from "src/telegram/bot/apiTypes";
import { Api, Logger, TelegramClient, WebSocketTransport, sessions } from "teleproto";
import { releaseVersion } from "release-notes.mjs";
import { Byte, Encoder } from "@nuintun/qrcode";
import { ProgressBarType, _3MB, createProgressBar, deleteProgressBar, updateProgressBar } from "../bot/progressBar";
import { clearCachedMessages, getInputPeer, getMessage } from "../convertors/botMessageToClientMessage";
import { _5sec } from "src/utils/logUtils";

export type SessionType = "bot" | "user";

export interface TelegramAppCredentials {
	apiId: number;
	apiHash: string;
}

export const maxUserDownloadBytes = 128 * 1024 * 1024;

let client: TelegramClient | undefined;
export let clientUser: Api.User | undefined;
let voiceTranscripts = new Map<string, string>();

export async function stop() {
	const active = client;
	client = undefined;
	clientUser = undefined;
	voiceTranscripts = new Map();
	clearCachedMessages();
	if (active) await active.destroy().catch(() => undefined);
}

export async function init(credentials: TelegramAppCredentials, session: string, signal?: AbortSignal) {
	await stop();
	signal?.throwIfAborted();
	const sessionStore = new sessions.StringSession(session);
	const logger = new Logger();
	logger.handler = () => {};
	const active = new TelegramClient(sessionStore, credentials.apiId, credentials.apiHash, {
		connectionRetries: 2,
		deviceModel: "Obsidian Desktop",
		systemVersion: "Desktop",
		appVersion: releaseVersion,
		transport: new WebSocketTransport(),
		baseLogger: logger,
	});
	client = active;
	try {
		await active.connect();
		signal?.throwIfAborted();
		return sessionStore;
	} catch (error) {
		if (client === active) await stop();
		throw error;
	}
}

export async function signInAsUserWithQrCode(
	credentials: TelegramAppCredentials,
	container: HTMLDivElement,
	password: string,
	signal: AbortSignal,
) {
	const active = client;
	if (!active) throw new Error("Telegram user is disconnected.");
	await active.signInUserWithQrCode(credentials, {
		qrCode: async ({ token }) => {
			signal.throwIfAborted();
			const code = new Encoder().encode(new Byte("tg://login?token=" + token.toString("base64url")));
			const image = container.ownerDocument.createElement("img");
			image.src = code.toDataURL();
			image.alt = t("Telegram login QR code");
			image.width = 150;
			image.height = 150;
			container.replaceChildren(image);
		},
		password: async () => {
			signal.throwIfAborted();
			return password;
		},
		onError: async () => true,
	});
}

export async function authorizeUser() {
	const active = client;
	if (!active || !(await active.checkAuthorization()) || (await active.isBot())) {
		throw new Error("Telegram user authorization failed.");
	}
	const user = await active.getMe();
	if (!(user instanceof Api.User) || client !== active) throw new Error("Telegram user is disconnected.");
	clientUser = user;
}

export async function revokeSession() {
	const active = client;
	if (!active) throw new Error("Connect the Telegram user before logging out.");
	if (await active.checkAuthorization()) await active.invoke(new Api.auth.LogOut());
	await stop();
}

export async function checkUserService(): Promise<{ checkedClient: TelegramClient; checkedUser: Api.User }> {
	const active = client;
	const user = clientUser;
	if (!active || !user) throw new Error("Connect your Telegram user to use this feature.");
	if (!active.connected) await active.connect();
	if (client !== active) throw new Error("Telegram user is disconnected.");
	return { checkedClient: active, checkedUser: user };
}

export async function downloadMedia(
	bot: TelegramBot,
	botMsg: Message,
	fileSize: number,
	botUser?: User,
): Promise<Buffer> {
	if (!botUser || !fileSize || fileSize > maxUserDownloadBytes) throw new Error("Attachment cannot be downloaded.");
	const { checkedClient, checkedUser } = await checkUserService();
	const inputPeer = await getInputPeer(checkedClient, checkedUser, botUser, botMsg);
	const message = await getMessage(checkedClient, inputPeer, botMsg);
	const progress =
		fileSize > _3MB
			? await createProgressBar(bot, botMsg, ProgressBarType.DOWNLOADING).catch(() => undefined)
			: undefined;
	let stage = 0;
	try {
		const bytes = await checkedClient.downloadMedia(message, {
			progressCallback: async (received, total) => {
				const length = received.toJSNumber();
				if (length > maxUserDownloadBytes || total.toJSNumber() > maxUserDownloadBytes) {
					throw new Error("The attachment exceeds the download limit.");
				}
				stage = await updateProgressBar(bot, botMsg, progress, total.toJSNumber() || fileSize, length, stage);
			},
		});
		if (!Buffer.isBuffer(bytes) || bytes.length > maxUserDownloadBytes)
			throw new Error("Attachment could not be saved.");
		return bytes;
	} finally {
		await deleteProgressBar(bot, botMsg, progress).catch(() => undefined);
	}
}

export async function sendReaction(botUser: User, botMsg: Message, emoticon: string) {
	const { checkedClient, checkedUser } = await checkUserService();
	const inputPeer = await getInputPeer(checkedClient, checkedUser, botUser, botMsg);
	const message = await getMessage(checkedClient, inputPeer, botMsg);
	await checkedClient.invoke(
		new Api.messages.SendReaction({
			peer: inputPeer,
			msgId: message.id,
			reaction: [new Api.ReactionEmoji({ emoticon })],
		}),
	);
}

export async function transcribeAudio(
	bot: TelegramBot,
	botMsg: Message,
	botUser?: User,
	mediaId?: string,
	limit = 15, // minutes for waiting transcribing (not for the audio)
): Promise<string> {
	if (botMsg.text || !(botMsg.voice || botMsg.video_note)) {
		return "";
	}
	if (voiceTranscripts.size > 100) voiceTranscripts.clear();
	if (voiceTranscripts.has(`${botMsg.chat.id}_${botMsg.message_id}`))
		return voiceTranscripts.get(`${botMsg.chat.id}_${botMsg.message_id}`) || "";

	const { checkedClient, checkedUser } = await checkUserService();
	if (!checkedUser.premium) {
		throw new Error(
			"Transcribing voices available only for Telegram Premium subscribers! Remove {{voiceTranscript}} from current template or login with a premium user.",
		);
	}
	if (!botUser) return "";
	const inputPeer = await getInputPeer(checkedClient, checkedUser, botUser, botMsg);
	const message = await getMessage(checkedClient, inputPeer, botMsg, mediaId);
	let transcribedAudio: Api.messages.TranscribedAudio | undefined;

	let stage = 0;
	const progressBarMessage = await createProgressBar(bot, botMsg, ProgressBarType.TRANSCRIBING);
	try {
		// to avoid endless loop, limited waiting
		for (let i = 1; i <= limit * 14; i++) {
			transcribedAudio = await checkedClient.invoke(
				new Api.messages.TranscribeAudio({
					peer: inputPeer,
					msgId: message.id,
				}),
			);
			stage = await updateProgressBar(bot, botMsg, progressBarMessage, limit * 14, i, stage);
			if (transcribedAudio.pending)
				await new Promise((resolve) => setTimeout(resolve, _5sec)); // 5 sec delay between updates
			else if (i == limit * 14)
				throw new Error("Very long audio. Transcribing can't be longer then 15 min lasting.");
			else break;
		}
	} finally {
		await deleteProgressBar(bot, botMsg, progressBarMessage).catch(() => undefined);
	}
	if (!transcribedAudio || transcribedAudio.pending) throw new Error("Could not complete the transcription.");
	if (!voiceTranscripts.has(`${botMsg.chat.id}_${botMsg.message_id}`))
		voiceTranscripts.set(`${botMsg.chat.id}_${botMsg.message_id}`, transcribedAudio.text);
	return transcribedAudio.text;
}
