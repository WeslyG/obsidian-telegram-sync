export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface User {
	id: number;
	is_bot: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
}

export interface Chat {
	id: number;
	type: ChatType;
	first_name?: string;
	last_name?: string;
	title?: string;
	username?: string;
	is_forum?: boolean;
}

export interface Attachment {
	file_id: string;
	file_unique_id: string;
	file_size?: number;
	file_name?: string;
	mime_type?: string;
}

export interface MessageEntity {
	type: string;
	offset: number;
	length: number;
	url?: string;
	language?: string;
	user?: User;
}

export interface InlineKeyboardMarkup {
	inline_keyboard: { text: string; url?: string; callback_data?: string }[][];
}

export interface Message {
	message_id: number;
	date: number;
	chat: Chat;
	from?: User;
	text?: string;
	caption?: string;
	entities?: MessageEntity[];
	caption_entities?: MessageEntity[];
	reply_markup?: InlineKeyboardMarkup;
	reply_to_message?: Message;
	edit_date?: number;
	forward_origin?: { date: number } & (
		| { type: "user"; sender_user: User }
		| { type: "hidden_user"; sender_user_name: string }
		| { type: "chat"; sender_chat: Chat; author_signature?: string }
		| { type: "channel"; chat: Chat; message_id: number; author_signature?: string }
	);
	forward_date?: number;
	forward_from?: User;
	forward_from_chat?: Chat;
	forward_from_message_id?: number;
	forward_sender_name?: string;
	forward_signature?: string;
	message_thread_id?: number;
	media_group_id?: string;
	forum_topic_created?: { name: string };
	forum_topic_edited?: { name?: string };
	photo?: Attachment[];
	video?: Attachment;
	voice?: Attachment;
	document?: Attachment;
	audio?: Attachment;
	video_note?: Attachment;
}

export interface Update {
	update_id: number;
	message?: Message;
	edited_message?: Message;
	channel_post?: Message;
}
