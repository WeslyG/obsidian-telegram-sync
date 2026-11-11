import { TFile, TFolder, Vault, normalizePath } from "obsidian";
import { date2DateString, date2TimeString } from "./dateUtils";
import path from "path";

export const defaultDelimiter = "\n\n***\n\n";

// Create a folder path if it does not exist
export async function createFolderIfNotExist(vault: Vault, folderPath: string) {
	if (!vault || !folderPath) {
		return;
	}
	const folder = vault.getAbstractFileByPath(normalizePath(folderPath));

	if (folder && folder instanceof TFolder) {
		return;
	}

	if (folder && folder instanceof TFile) {
		throw new URIError(
			`Folder "${folderPath}" can't be created because there is a file with the same name. Change the path or rename the file.`,
		);
	}

	await vault.createFolder(folderPath).catch((error) => {
		if (error.message !== "Folder already exists.") {
			throw error;
		}
	});
}

export function sanitizeFileName(fileName: string): string {
	const invalidCharacters = /[\\/:*?"<>|\n\r]/g;
	return fileName.replace(invalidCharacters, "_");
}

export function sanitizeFilePath(filePath: string): string {
	const segments = filePath.split(/[\\/]/);
	if (
		path.posix.isAbsolute(filePath) ||
		path.win32.isAbsolute(filePath) ||
		segments.some((part) => part.trimStart().startsWith("."))
	) {
		throw new Error("Telegram output paths must stay in visible folders inside the vault.");
	}
	const invalidCharacters = /[\\:*?"<>|\n\r]/g;
	return normalizePath(truncatePathComponents(filePath.replace(invalidCharacters, "_")));
}

export async function getUniqueFilePath(
	vault: Vault,
	initialFilePath: string,
	date: Date,
	fileExtension: string,
): Promise<string> {
	let fileFolderPath = path.posix.dirname(initialFilePath);
	if (fileFolderPath != ".") await createFolderIfNotExist(vault, fileFolderPath);
	else fileFolderPath = "";

	let filePath = initialFilePath;
	if (!vault.getAbstractFileByPath(filePath)) return filePath;

	const initialFileName = path.posix.basename(filePath, "." + fileExtension);
	const dateString = date2DateString(date);
	let fileId = Number(date2TimeString(date));
	const collectFileName = () => `${initialFileName} - ${dateString}${fileId}.${fileExtension}`;
	let fileName = collectFileName();

	while (vault.getAbstractFileByPath(filePath)) {
		fileId += 1;
		fileName = collectFileName();
		filePath = fileFolderPath ? `${fileFolderPath}/${fileName}` : fileName;
	}
	return filePath;
}

export async function appendContentToNote(
	vault: Vault,
	notePath: string,
	newContent: string,
	startLine = "",
	delimiter = defaultDelimiter,
	reversedOrder = false,
) {
	if (!notePath || !newContent.trim()) return;
	if (startLine == undefined) startLine = "";

	const noteFile: TFile = vault.getAbstractFileByPath(notePath) as TFile;

	let currentContent = "";
	if (noteFile) currentContent = await vault.read(noteFile);
	let index = reversedOrder ? 0 : currentContent.length;
	if (currentContent.length == 0 && !startLine) delimiter = "";
	newContent = reversedOrder ? newContent + delimiter : delimiter + newContent;

	if (startLine) {
		const startLineIndex = currentContent.indexOf(startLine);
		if (startLineIndex > -1) index = reversedOrder ? startLineIndex : startLineIndex + startLine.length;
		else newContent = reversedOrder ? newContent + startLine : startLine + newContent;
	}

	const content = currentContent.slice(0, index) + newContent + currentContent.slice(index);
	if (!noteFile) await vault.create(notePath, content);
	else if (currentContent != content) await vault.modify(noteFile, content);
}

function truncatePathComponents(filePath: string, maxLength = 200): string {
	const parsedPath = path.posix.parse(filePath);

	// Split the path into its components (folders, subfolders, etc.)
	const pathComponents = parsedPath.dir.split("/");

	// Truncate each path component if it exceeds maxLength characters
	const truncatedComponents = pathComponents.map((component) =>
		component.length > maxLength ? component.substring(0, maxLength) : component,
	);

	// Truncate the file name if it exceeds maxLength characters
	const truncatedFileName =
		parsedPath.name.length > maxLength ? parsedPath.name.substring(0, maxLength) : parsedPath.name;

	// Reassemble the full path
	const truncatedPath = path.posix.join(...truncatedComponents, truncatedFileName + parsedPath.ext);

	return truncatedPath;
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const { buffer, byteOffset, byteLength } = bytes;
	if (!(buffer instanceof ArrayBuffer)) return Uint8Array.from(bytes).buffer;
	return byteOffset === 0 && byteLength === buffer.byteLength
		? buffer
		: buffer.slice(byteOffset, byteOffset + byteLength);
}
