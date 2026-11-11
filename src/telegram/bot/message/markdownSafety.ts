export function sanitizeImportedMarkdown(text: string): string {
	return text.replaceAll("<", "&lt;").replaceAll("![", "&#33;[");
}

export function safeWebUrl(value: string): string {
	try {
		const url = new URL(value);
		if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
	} catch {
		// Invalid external links are left as text.
	}
	return "";
}

export function markdownWebLink(label: string, address: string): string {
	const text = sanitizeImportedMarkdown(label)
		.replace(/[\r\n]+/g, " ")
		.replace(/[\\[\]]/g, "\\$&");
	const url = safeWebUrl(address);
	return url ? `[${text}](${url.replaceAll("(", "%28").replaceAll(")", "%29")})` : text;
}
