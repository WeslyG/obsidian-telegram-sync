import { request as httpRequest, Agent as HttpAgent } from "node:http";
import type { Agent, IncomingMessage } from "node:http";
import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import type { InlineKeyboardMarkup, Message, Update, User } from "./apiTypes";

const defaultOrigin = new URL("https://api.telegram.org");
const maxResponseBytes = 8 * 1024 * 1024;
export const botFileLimit = 20 * 1024 * 1024;

export function isBotToken(value: string): boolean {
	return /^\d+:[A-Za-z0-9_-]+$/.test(value);
}

export class BotApiError extends Error {
	constructor(
		public operation: string,
		public status?: number,
		public retryAfter?: number,
	) {
		super(
			status
				? `Telegram Bot API ${operation} failed (${status}).`
				: `Telegram Bot API ${operation} connection failed.`,
		);
	}
}

interface Envelope<T> {
	ok: boolean;
	result?: T;
	error_code?: number;
	parameters?: { retry_after?: number };
}

interface SendOptions {
	reply_to_message_id?: number;
	reply_markup?: InlineKeyboardMarkup;
	disable_notification?: boolean;
	parse_mode?: "HTML";
}

export default class TelegramBot {
	#token: string;
	#agent: Agent;
	#controller = new AbortController();

	constructor(
		token: string,
		private origin = defaultOrigin,
		agent?: Agent,
	) {
		if (!isBotToken(token)) throw new Error("Invalid Telegram bot token format.");
		this.#token = token;
		this.#agent =
			agent ??
			(origin.protocol === "https:" ? new HttpsAgent({ keepAlive: true }) : new HttpAgent({ keepAlive: true }));
	}

	close() {
		this.#controller.abort();
		this.#agent.destroy();
	}

	get signal(): AbortSignal {
		return this.#controller.signal;
	}

	private request(operation: string, path: string, payload?: object): Promise<IncomingMessage> {
		const body = payload === undefined ? undefined : JSON.stringify(payload);
		const send = this.origin.protocol === "https:" ? httpsRequest : httpRequest;
		return new Promise((resolve, reject) => {
			const req = send(
				this.origin,
				{
					path,
					method: body === undefined ? "GET" : "POST",
					agent: this.#agent,
					signal: this.#controller.signal,
					headers:
						body === undefined
							? undefined
							: {
									"Content-Type": "application/json",
									"Content-Length": Buffer.byteLength(body),
								},
				},
				resolve,
			);
			const deadline = setTimeout(() => req.destroy(), operation === "download" ? 120000 : 45000);
			req.once("close", () => clearTimeout(deadline));
			// Network errors can contain URLs, paths, credentials or proxy responses.
			req.once("error", () => reject(new BotApiError(operation)));
			req.end(body);
		});
	}

	private async call<T>(operation: string, payload: object = {}): Promise<T> {
		const response = await this.request(operation, `/bot${this.#token}/${operation}`, payload);
		const status = response.statusCode;
		if (!status || (status >= 300 && status < 400)) {
			response.destroy();
			throw new BotApiError(operation, status);
		}
		let result: Envelope<T>;
		try {
			const chunks: Buffer[] = [];
			let size = 0;
			for await (const chunk of response) {
				size += chunk.length;
				if (size > maxResponseBytes) throw new Error("Response too large");
				chunks.push(chunk);
			}
			result = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
		} catch {
			response.destroy();
			throw new BotApiError(operation, status);
		}
		if (status !== 200 || result?.ok !== true || result.result === undefined) {
			const code = Number.isInteger(result?.error_code) ? result.error_code : status;
			const retry = result?.parameters?.retry_after;
			throw new BotApiError(
				operation,
				code,
				typeof retry === "number" && Number.isInteger(retry) && retry > 0 ? retry : undefined,
			);
		}
		return result.result;
	}

	getMe() {
		return this.call<User>("getMe");
	}

	async getUpdates(offset: number, timeout = 25) {
		const updates = await this.call<Update[]>("getUpdates", {
			offset,
			timeout,
			limit: 20,
			allowed_updates: ["message", "edited_message", "channel_post"],
		});
		if (!Array.isArray(updates) || updates.some((update) => !Number.isSafeInteger(update?.update_id)))
			throw new BotApiError("getUpdates");
		return updates;
	}

	sendMessage(chatId: number, text: string, options: SendOptions = {}) {
		return this.call<Message>("sendMessage", { chat_id: chatId, text, ...options });
	}

	editMessageReplyMarkup(markup: InlineKeyboardMarkup, target: { chat_id: number; message_id: number }) {
		return this.call<Message | boolean>("editMessageReplyMarkup", { ...target, reply_markup: markup });
	}

	deleteMessage(chatId: number, messageId: number) {
		return this.call<boolean>("deleteMessage", { chat_id: chatId, message_id: messageId });
	}

	setMessageReaction(chatId: number, messageId: number, options: { reaction: { emoji: string; type: "emoji" }[] }) {
		return this.call<boolean>("setMessageReaction", { chat_id: chatId, message_id: messageId, ...options });
	}

	async openFile(fileId: string) {
		const file = await this.call<{ file_path?: string }>("getFile", { file_id: fileId });
		const parts = file.file_path?.split("/");
		if (!parts?.every((part) => part && part !== "." && part !== ".." && !part.includes("\\"))) {
			throw new BotApiError("getFile");
		}
		const filePath = parts.map(encodeURIComponent).join("/");
		const stream = await this.request("download", `/file/bot${this.#token}/${filePath}`);
		if (stream.statusCode !== 200) {
			stream.destroy();
			throw new BotApiError("download", stream.statusCode);
		}
		return { stream, filename: parts[parts.length - 1] };
	}
}
