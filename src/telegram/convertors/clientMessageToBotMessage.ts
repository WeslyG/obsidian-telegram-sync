import type { Chat, ChatType, User } from "src/telegram/bot/apiTypes";
import { Api } from "telegram/tl";
import { Entity } from "telegram/define";

function getChatType(entity: Entity | undefined): ChatType {
	return entity instanceof Api.User
		? "private"
		: entity instanceof Api.Chat
			? "supergroup"
			: entity instanceof Api.Channel
				? "channel"
				: "group";
}

export function getUser(entity: Entity): User | undefined {
	// Api.User | Api.Chat | Api.Channel
	if (entity instanceof Api.User)
		return {
			id: entity.id.toJSNumber(),
			username: entity.username,
			first_name: entity.firstName || entity.id.toString(),
			last_name: entity.lastName,
			is_bot: entity.bot || false,
			language_code: entity.langCode,
		};
	else if (entity instanceof Api.Chat)
		return {
			id: entity.id.toJSNumber(),
			username: undefined,
			first_name: entity.title,
			is_bot: false,
		};
	else if (entity instanceof Api.Channel)
		return {
			id: entity.id.toJSNumber(),
			username: entity.username,
			first_name: entity.title,
			is_bot: false,
		};
	else return undefined;
}

export function getChat(entity: Entity): Chat | undefined {
	// Api.User | Api.Chat | Api.Channel
	if (entity instanceof Api.User)
		return {
			id: entity.id.toJSNumber(),
			username: entity.username,
			title: entity.firstName + " " + entity.lastName,
			first_name: entity.firstName,
			last_name: entity.lastName,
			type: getChatType(entity),
		};
	else if (entity instanceof Api.Chat)
		return {
			id: entity.id.toJSNumber(),
			username: undefined,
			title: entity.title,
			type: getChatType(entity),
		};
	else if (entity instanceof Api.Channel)
		return {
			id: entity.id.toJSNumber(),
			username: entity.username,
			title: entity.title,
			type: getChatType(entity),
		};
	else return undefined;
}

// Mapping function
