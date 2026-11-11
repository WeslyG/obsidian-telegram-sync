const WEB_LOCATION_FLAG = 1 << 24; // substitute with actual value
const FILE_REFERENCE_FLAG = 1 << 25; // substitute with actual value

enum FileType {
	THUMBNAIL = 0,
	CHAT_PHOTO = 1, // ProfilePhoto
	PHOTO = 2,
	VOICE = 3, // VoiceNote
	VIDEO = 4,
	DOCUMENT = 5,
	ENCRYPTED = 6,
	TEMP = 7,
	STICKER = 8,
	AUDIO = 9,
	ANIMATION = 10,
	ENCRYPTED_THUMBNAIL = 11,
	WALLPAPER = 12,
	VIDEO_NOTE = 13,
	SECURE_RAW = 14,
	SECURE = 15,
	BACKGROUND = 16,
	DOCUMENT_AS_FILE = 17,
}

export function extractMediaId(fileId: string): string {
	if (fileId.length > 4096) throw new Error("Invalid Telegram file identifier.");
	const decoded = rle_decode(b64_decode(fileId));
	const major = decoded[decoded.length - 1];
	const buffer = major < 4 ? decoded.slice(0, -1) : decoded.slice(0, -2);

	let bufferPosition = 0;
	let fileType = buffer.readInt32LE(bufferPosition);
	bufferPosition += 4;
	buffer.readInt32LE(bufferPosition);
	bufferPosition += 4;

	const hasFileReference = Boolean(fileType & FILE_REFERENCE_FLAG);

	fileType &= ~WEB_LOCATION_FLAG;
	fileType &= ~FILE_REFERENCE_FLAG;

	if (!(fileType in FileType)) {
		throw new Error("Unsupported Telegram file type.");
	}

	if (hasFileReference) {
		const { newPosition } = readBytes(buffer, bufferPosition);
		bufferPosition = newPosition;
	}

	const mediaId = buffer.readBigInt64LE(bufferPosition);
	return mediaId.toString();
}

function b64_decode(s: string): Buffer {
	const base64Padded = s + "=".repeat(mod(-s.length, 4));
	return Buffer.from(base64Padded, "base64");
}

function rle_decode(s: Buffer): Buffer {
	const r: number[] = [];
	let z = false;

	for (let i = 0; i < s.length; i++) {
		const b = s[i];

		if (!b) {
			z = true;
			continue;
		}

		if (z) {
			r.push(...Array(b).fill(0));
			z = false;
		} else {
			r.push(b);
		}
	}

	return Buffer.from(r);
}

function readBytes(buffer: Buffer, position: number): { result: Buffer; newPosition: number } {
	let length = buffer.readUInt8(position);
	position += 1;
	let padding = 0;

	if (length > 253) {
		length = buffer.readUIntLE(position, 3);
		position += 3;
		padding = mod(-length, 4);
	} else {
		padding = mod(-(length + 1), 4);
	}

	const result = buffer.slice(position, position + length);
	position += length + padding;
	return { result, newPosition: position };
}

function mod(n: number, m: number): number {
	return ((n % m) + m) % m;
}
