import type { Message } from "./apiTypes";

export function normalizeAllowedChats(entries: string[]): string[] {
	return [...new Set(entries.map((entry) => entry.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))];
}

export function isAllowedMessage(entries: string[], message: Message): boolean {
	return isAllowedChat(entries, message.chat.id, message.from?.username);
}

export function isAllowedChat(entries: string[], chatId: number, username?: string): boolean {
	const allowed = normalizeAllowedChats(entries);
	return allowed.includes(String(chatId)) || (!!username && allowed.includes(username.toLowerCase()));
}
