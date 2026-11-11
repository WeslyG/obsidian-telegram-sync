import type { Message, User } from "src/telegram/bot/apiTypes";
import { Api } from "telegram/tl";
import { TelegramClient } from "telegram/client/TelegramClient";
import { getFileObject } from "../bot/message/getters";
import { extractMediaId } from "./botFileToMessageMedia";
import { TotalList } from "telegram/Helpers";
import { _1sec } from "src/utils/logUtils";
import { unixTime2Date } from "src/utils/dateUtils";

const cantFindTheMessage = "Can't find the message for connected user.";

interface MessageCouple {
	chatId: number;
	date: number;
	botMsgId: number;
	userMsg: Api.Message;
}

interface MessagesRequests {
	botChatId: number;
	msgDate: number;
	limit: number;
	messages: TotalList<Api.Message>;
}

interface UserCouple {
	userId: number;
	botUserId: number;
	botChatId: number;
	userChat: Api.TypeInputPeer;
}

const cachedMessageCouples: MessageCouple[] = [];
const cachedMessagesRequests: MessagesRequests[] = [];
const cachedUserCouples: UserCouple[] = [];

export function clearCachedMessages() {
	cachedMessagesRequests.length = 0;
	cachedMessageCouples.length = 0;
	cachedUserCouples.length = 0;
}

// oxlint-disable-next-line typescript/no-explicit-any
function getMediaId(media: any): bigint | undefined {
	if (!media) return undefined;
	if (media.document && media.document.id) return media.document.id;
	if (media.photo && media.photo.id) return media.photo.id;
	return undefined;
}

export async function getInputPeer(
	client: TelegramClient,
	user: Api.User,
	botUser: User,
	botMsg: Message,
	limit = 10,
): Promise<Api.TypeInputPeer> {
	let userCouple = cachedUserCouples.find(
		(usrCouple) =>
			usrCouple.botChatId == botMsg.chat.id &&
			usrCouple.botUserId == botUser.id &&
			usrCouple.userId == user.id.toJSNumber(),
	);
	if (userCouple) return userCouple.userChat;

	const chatId = botMsg.chat.id == user.id.toJSNumber() ? botUser.id : botMsg.chat.id;
	const dialogs = await client.getDialogs({ limit });
	const dialog = dialogs.find((d) => d.id?.toJSNumber() == chatId);
	if (!dialog && limit <= 20) return await getInputPeer(client, user, botUser, botMsg, limit + 10);
	else if (!dialog || !dialog.inputEntity) {
		throw new Error("The connected Telegram user cannot access the chat.");
	}
	userCouple = {
		botChatId: botMsg.chat.id,
		botUserId: botUser.id,
		userId: user.id.toJSNumber(),
		userChat: dialog.inputEntity,
	};
	cachedUserCouples.push(userCouple);
	if (cachedUserCouples.length > 128) cachedUserCouples.shift();
	return dialog.inputEntity;
}

export async function getMessage(
	client: TelegramClient,
	inputPeer: Api.TypeInputPeer,
	botMsg: Message,
	mediaId?: string,
	limit = 50,
): Promise<Api.Message> {
	if (botMsg.chat.type === "channel" || botMsg.chat.type === "supergroup") {
		const [exact] = await client.getMessages(inputPeer, { ids: [botMsg.message_id] });
		if (exact && exact.id === botMsg.message_id) return exact;
		throw new Error(cantFindTheMessage);
	}
	let messageCouple = cachedMessageCouples.find(
		(item) => item.chatId === botMsg.chat.id && item.botMsgId === botMsg.message_id,
	);
	if (messageCouple?.userMsg) return messageCouple.userMsg;

	const messagesRequests = cachedMessagesRequests.filter(
		(rq) =>
			rq.botChatId == botMsg.chat.id &&
			rq.msgDate <= botMsg.date &&
			(rq.messages.at(-1)?.date || botMsg.date - 1) >= botMsg.date,
	);
	if (!messagesRequests.find((rq) => rq.limit == limit)) {
		// wait 1 sec for history updates in Telegram
		if (new Date().getTime() - unixTime2Date(botMsg.date, botMsg.message_id).getTime() < _1sec)
			await new Promise((resolve) => setTimeout(resolve, _1sec));
		let messages = await client.getMessages(inputPeer, { limit, reverse: true, offsetDate: botMsg.date - 2 });
		// remove bot messages (fromId != undefined)
		messages = messages.filter((m) => m.fromId || m.peerId instanceof Api.PeerChannel) || [];
		const request = { botChatId: botMsg.chat.id, msgDate: botMsg.date, messages, limit };
		messagesRequests.push(request);
		cachedMessagesRequests.push(request);
		if (cachedMessagesRequests.length > 50) cachedMessagesRequests.shift();
	}

	if (!botMsg.text && !mediaId) {
		const { fileObject } = getFileObject(botMsg);
		const attachment = Array.isArray(fileObject) ? fileObject.at(-1) : fileObject;
		if (attachment) mediaId = extractMediaId(attachment.file_id);
	}
	const skipMsgIds = cachedMessageCouples
		.filter(
			(item) =>
				item.chatId === botMsg.chat.id &&
				Math.abs(botMsg.date - item.date) <= 1 &&
				item.botMsgId !== botMsg.message_id,
		)
		.map((msgCouple) => msgCouple.userMsg && msgCouple.userMsg.id);

	const messages = messagesRequests.map((rq) => rq.messages).reduce((accumulator, msgs) => accumulator.concat(msgs));
	const unprocessedMessages = [...new Map(messages.map((msg) => [msg.id, msg])).values()].filter(
		(msg) => !skipMsgIds.includes(msg.id),
	);
	// add dateOffset, because different date rounding between bot api and user api for unknown reason
	const userMsg = findUserMsg(unprocessedMessages, botMsg, mediaId);

	if (!userMsg && limit < 200 && messages.length > 0 && botMsg.date + 1 >= (messages.at(-1)?.date || botMsg.date + 1))
		return await getMessage(client, inputPeer, botMsg, mediaId, limit + 150);

	if (!userMsg) {
		throw new Error(cantFindTheMessage);
	}
	if (cachedMessageCouples.some((item) => item.chatId === botMsg.chat.id && item.userMsg.id === userMsg.id)) {
		throw new Error(
			"Because there may be several identical messages, it is not possible to pinpoint which message is needed.",
		);
	}
	messageCouple = {
		chatId: botMsg.chat.id,
		date: botMsg.date,
		botMsgId: botMsg.message_id,
		userMsg: userMsg,
	};
	cachedMessageCouples.push(messageCouple);
	if (cachedMessageCouples.length > 512) cachedMessageCouples.shift();
	return userMsg;
}

function findUserMsgByOffset(
	messages: Api.Message[],
	botMsg: Message,
	// add dateOffset, because different date rounding between bot api and user api for unknown reason
	dateOffset = 0,
	mediaId?: string,
): Api.Message | undefined {
	const matches = messages.filter((m) => {
		const equalDates = m.date + dateOffset == botMsg.date;
		if (!equalDates) return false;
		const equalTexts = (m.message || "") == (botMsg.text || botMsg.caption || "");
		if (!equalTexts) return false;
		const equalGroup = (m.groupedId?.toString() ?? "") === (botMsg.media_group_id ?? "");
		if (!equalGroup) return false;
		const equalMedia = !mediaId || mediaId === getMediaId(m.media)?.toString();
		return equalMedia;
	});
	if (matches.length > 1) throw new Error("Could not identify a unique Telegram message.");
	return matches[0];
}

export function findUserMsg(messages: Api.Message[], botMsg: Message, mediaId?: string) {
	return (
		findUserMsgByOffset(messages, botMsg, 0, mediaId) ||
		findUserMsgByOffset(messages, botMsg, 1, mediaId) ||
		findUserMsgByOffset(messages, botMsg, -1, mediaId)
	);
}
