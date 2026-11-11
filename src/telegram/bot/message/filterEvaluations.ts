import type { Message } from "src/telegram/bot/apiTypes";
import {
	ConditionOperation,
	ConditionType,
	MessageDistributionRule,
	MessageFilterCondition,
} from "src/settings/messageDistribution";
import { getForwardFromName, getTopic } from "./getters";
import type TelegramSyncPlugin from "src/main";
import * as Client from "src/telegram/user/client";

async function valuesFor(plugin: TelegramSyncPlugin, msg: Message, type: ConditionType): Promise<string[]> {
	switch (type) {
		case ConditionType.USER: {
			const user = msg.from;
			return user
				? [user.username ?? "", String(user.id), [user.first_name, user.last_name].filter(Boolean).join(" ")]
				: [];
		}
		case ConditionType.CHAT: {
			const { chat } = msg;
			const id = String(chat.id);
			const channelId = id.startsWith("-100") ? id.slice(4) : id;
			return [id, channelId, chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ")];
		}
		case ConditionType.FORWARD_FROM:
			return [getForwardFromName(msg)];
		case ConditionType.TOPIC: {
			const topic = await getTopic(plugin, msg, false);
			return topic ? [topic.name] : [];
		}
		case ConditionType.CONTENT:
			return [msg.text ?? msg.caption ?? ""];
		case ConditionType.VOICE_TRANSCRIPT:
			return plugin.bot && plugin.userConnected
				? [await Client.transcribeAudio(plugin.bot, msg, await plugin.getBotUser())]
				: [];
		default:
			return [];
	}
}

async function matches(plugin: TelegramSyncPlugin, msg: Message, condition: MessageFilterCondition): Promise<boolean> {
	if (condition.conditionType === ConditionType.ALL) return condition.operation === ConditionOperation.NO_OPERATION;
	if (!condition.value) return false;
	const values = await valuesFor(plugin, msg, condition.conditionType);
	if (!values.length) return false;
	const equal = () => values.some((value) => value === condition.value);
	const contains = () => values.some((value) => value.includes(condition.value));
	switch (condition.operation) {
		case ConditionOperation.EQUAL:
			return equal();
		case ConditionOperation.NOT_EQUAL:
			return !equal();
		case ConditionOperation.CONTAIN:
			return contains();
		case ConditionOperation.NOT_CONTAIN:
			return !contains();
		default:
			return false;
	}
}

export async function doesMessageMatchRule(plugin: TelegramSyncPlugin, msg: Message, rule: MessageDistributionRule) {
	if (!rule.messageFilterConditions.length) return false;
	for (const condition of rule.messageFilterConditions) {
		if (!(await matches(plugin, msg, condition))) return false;
	}
	return true;
}

export async function getMessageDistributionRule(plugin: TelegramSyncPlugin, msg: Message) {
	for (const rule of plugin.settings.messageDistributionRules) {
		if (await doesMessageMatchRule(plugin, msg, rule)) return rule;
	}
}
