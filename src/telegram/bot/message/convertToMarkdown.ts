import type { Message, MessageEntity } from "src/telegram/bot/apiTypes";
import { getInlineUrls } from "./getters";
import { markdownWebLink, sanitizeImportedMarkdown } from "./markdownSafety";

export async function convertMessageTextToMarkdown(msg: Message): Promise<string> {
	let text = msg.text || msg.caption || "";
	const entities = msg.entities || msg.caption_entities || [];
	const copiedEntities: MessageEntity[] = structuredClone(entities);
	copiedEntities.forEach((entity, index, updatedEntities) => {
		const entityStart = entity.offset;
		let entityEnd = entityStart + entity.length;
		let entityText = text.slice(entityStart, entityEnd);
		// skip trailing new lines
		if (entity.type != "pre") entityEnd = entityEnd - entityText.length + entityText.trimEnd().length;

		const beforeEntity = text.slice(0, entityStart);
		entityText = text.slice(entityStart, entityEnd);
		const afterEntity = text.slice(entityEnd);

		switch (entity.type) {
			case "bold":
				entityText = `**${entityText}**`;
				updateEntitiesOffset(updatedEntities, entity, index, 2, 2);
				break;
			case "italic":
				entityText = `*${entityText}*`;
				updateEntitiesOffset(updatedEntities, entity, index, 1, 1);
				break;
			case "underline":
				break;
			case "strikethrough":
				entityText = `~~${entityText}~~`;
				updateEntitiesOffset(updatedEntities, entity, index, 2, 2);
				break;
			case "code":
				entityText = "`" + entityText + "`";
				updateEntitiesOffset(updatedEntities, entity, index, 1, 1);
				break;
			case "pre":
				entityText = "```\n" + entityText + "\n```";
				updateEntitiesOffset(updatedEntities, entity, index, 4, 4);
				break;
			case "text_link":
				if (entity.url) {
					const originalLength = entityText.length;
					entityText = markdownWebLink(entityText, entity.url);
					updateEntitiesOffset(updatedEntities, entity, index, 0, entityText.length - originalLength);
				}
				break;
			default:
				break;
		}
		text = beforeEntity + entityText + afterEntity;
	});
	const inlineUrls = getInlineUrls(msg);
	return sanitizeImportedMarkdown(text) + (inlineUrls ? `\n\n${inlineUrls}` : "");
}

function updateEntitiesOffset(
	currentEntities: MessageEntity[],
	currentEntity: MessageEntity,
	currentIndex: number,
	beforeOffset: number,
	afterOffset: number,
) {
	currentEntities.forEach((entity, index) => {
		if (index <= currentIndex) return;
		if (entity.offset >= currentEntity.offset) entity.offset += beforeOffset;
		if (entity.offset > currentEntity.offset + currentEntity.length) entity.offset += afterOffset;
	});
}
