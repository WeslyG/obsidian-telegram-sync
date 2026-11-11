import { Agent, AgentConnectOpts } from "agent-base";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ClientRequest } from "http";
import { isIP } from "net";
import type { App } from "obsidian";
import { SocksClient } from "socks";
import { connect as connectTls } from "tls";

export interface ProxyCredentials {
	username: string;
	password: string;
}

interface ProxySecretStorage {
	getSecret(id: string): string | null;
	setSecret(id: string, secret: string): void;
}

const proxySecretId = "telegram-sync-bot-proxy-credentials";

function secretStorage(app: App) {
	// SecretStorage was added in Obsidian 1.11.4, after this project's pinned API typings.
	return (app as App & { secretStorage?: ProxySecretStorage }).secretStorage;
}

export function readProxyCredentials(app: App): ProxyCredentials | undefined {
	const stored = secretStorage(app)?.getSecret(proxySecretId);
	if (!stored) return;
	try {
		const credentials = JSON.parse(stored);
		if (typeof credentials?.username === "string" && typeof credentials?.password === "string") return credentials;
	} catch {
		// Let the user replace an invalid stored value in the Authentication tab.
	}
}

export function saveProxyCredentials(app: App, credentials?: ProxyCredentials) {
	const storage = secretStorage(app);
	if (!storage) throw new Error("Proxy authentication requires Obsidian 1.11.4 or later.");
	storage.setSecret(proxySecretId, credentials ? JSON.stringify(credentials) : "");
}

export function parseProxyUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("Enter a valid proxy hostname or IP address and port.");
	}
	if (value.includes("@")) throw new Error("Enter the username and password in the Authentication tab.");
	if (
		!["http:", "https:", "socks5:", "socks5h:"].includes(url.protocol) ||
		!url.hostname ||
		(url.pathname && url.pathname !== "/") ||
		url.search ||
		url.hash ||
		url.port === "0"
	) {
		throw new Error("Enter a valid HTTP, HTTPS, or SOCKS5 proxy address without a path.");
	}
	return url;
}

export function validateProxyCredentials(url: URL, credentials: ProxyCredentials) {
	const { username, password } = credentials;
	if (!username || !password) throw new Error("Enter both the proxy username and password.");
	if (url.protocol.startsWith("socks5")) {
		if (Buffer.byteLength(username) > 255 || Buffer.byteLength(password) > 255) {
			throw new Error("SOCKS5 usernames and passwords must be at most 255 bytes each.");
		}
	} else if (username.includes(":")) {
		throw new Error("An HTTP proxy username cannot contain a colon.");
	}
}

class Socks5Agent extends Agent {
	#credentials?: ProxyCredentials;

	constructor(
		private url: URL,
		credentials?: ProxyCredentials,
	) {
		super();
		this.#credentials = credentials;
	}

	async connect(request: ClientRequest, options: AgentConnectOpts) {
		const host = options.host;
		if (!host) throw new Error("Missing SOCKS5 destination host.");
		let socket;
		try {
			({ socket } = await SocksClient.createConnection({
				command: "connect",
				// Pass the destination hostname to the proxy for DNS resolution.
				destination: { host, port: Number(options.port) },
				proxy: {
					host: this.url.hostname.replace(/^\[|\]$/g, ""),
					port: Number(this.url.port || 1080),
					type: 5,
					userId: this.#credentials?.username,
					password: this.#credentials?.password,
				},
				timeout: 15000,
			}));
		} catch (error) {
			// SocksClient errors contain the full options object, including credentials.
			throw new Error(
				error instanceof Error ? `SOCKS5 proxy: ${error.message}` : "SOCKS5 proxy connection failed.",
			);
		}
		if (request.destroyed) {
			socket.destroy();
			throw new Error("SOCKS5 request was cancelled.");
		}
		if (!options.secureEndpoint) return socket;
		return connectTls({ ...options, socket, servername: options.servername ?? (isIP(host) ? undefined : host) });
	}
}

export function createBotProxyRequest(value: string, credentials?: ProxyCredentials) {
	if (!value.trim()) return;
	const url = parseProxyUrl(value.trim());
	if (credentials) validateProxyCredentials(url, credentials);
	const agent = url.protocol.startsWith("socks5")
		? new Socks5Agent(url, credentials)
		: new HttpsProxyAgent(url, {
				headers: () => {
					if (!credentials) return {};
					const token = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
					return { "Proxy-Authorization": `Basic ${token}` };
				},
		  });
	// The request library must not add another proxy from HTTP(S)_PROXY.
	return { agent, proxy: null };
}
