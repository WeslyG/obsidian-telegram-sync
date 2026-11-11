import type TelegramSyncPlugin from "src/main";
import * as Client from "./client";
import { clearCachedUnprocessedMessages } from "./sync";

const secretId = "telegram-sync-user-session";

interface UserSession extends Client.TelegramAppCredentials {
	session: string;
}

interface Login extends Client.TelegramAppCredentials {
	container: HTMLDivElement;
	password: string;
	signal: AbortSignal;
}

function readSession(plugin: TelegramSyncPlugin): UserSession | undefined {
	const raw = plugin.app.secretStorage?.getSecret(secretId);
	if (!raw) return;
	try {
		const value = JSON.parse(raw);
		if (
			Number.isSafeInteger(value.apiId) &&
			typeof value.apiHash === "string" &&
			typeof value.session === "string" &&
			value.session
		) {
			return value;
		}
	} catch {
		// An invalid stored record cannot start a network connection.
	}
}

export function hasSession(plugin: TelegramSyncPlugin): boolean {
	return !!readSession(plugin);
}

export async function connect(plugin: TelegramSyncPlugin, login?: Login): Promise<string | undefined> {
	if (plugin.checkingUserConnection) return "Telegram user connection is already in progress.";
	const stored = readSession(plugin);
	if (!stored && !login) return;
	if (plugin.status === "unloading" || plugin.status === "unloaded") return "Telegram Sync is closing.";
	if (plugin.settings.mainDeviceId && plugin.settings.mainDeviceId !== plugin.currentDeviceId)
		return "Telegram Sync is paused on this device.";

	const credentials = login ?? stored;
	if (!credentials) return;
	if (
		!Number.isSafeInteger(credentials.apiId) ||
		credentials.apiId <= 0 ||
		credentials.apiId > 2147483647 ||
		!/^[0-9a-f]{32}$/i.test(credentials.apiHash)
	)
		return "Enter a valid Telegram API ID and API hash.";

	plugin.checkingUserConnection = true;
	const stopOnAbort = () => {
		void Client.stop();
	};
	login?.signal.addEventListener("abort", stopOnAbort, { once: true });
	try {
		const session = await Client.init(credentials, login ? "" : (stored?.session ?? ""), login?.signal);
		if (login) await Client.signInAsUserWithQrCode(credentials, login.container, login.password, login.signal);
		await Client.authorizeUser();
		login?.signal.throwIfAborted();
		if (plugin.status !== "loaded") throw new Error("Telegram Sync is not active.");
		const serialized = session.save();
		if (!serialized) throw new Error("Could not save the Telegram session.");
		plugin.app.secretStorage.setSecret(
			secretId,
			JSON.stringify({
				apiId: credentials.apiId,
				apiHash: credentials.apiHash,
				session: serialized,
			}),
		);
		plugin.userConnected = true;
	} catch {
		await disconnect(plugin);
		return login?.signal.aborted ? "Telegram login cancelled." : "Could not connect the Telegram user.";
	} finally {
		login?.signal.removeEventListener("abort", stopOnAbort);
		plugin.checkingUserConnection = false;
	}
}

export async function logOut(plugin: TelegramSyncPlugin) {
	if (plugin.checkingUserConnection) throw new Error("Telegram user connection is already in progress.");
	plugin.checkingUserConnection = true;
	try {
		const stored = readSession(plugin);
		if (stored) {
			if (!plugin.userConnected) await Client.init(stored, stored.session);
			await Client.revokeSession();
		}
		plugin.app.secretStorage.setSecret(secretId, "");
		await disconnect(plugin);
	} finally {
		plugin.checkingUserConnection = false;
	}
}

export async function disconnect(plugin: TelegramSyncPlugin) {
	plugin.userConnected = false;
	clearCachedUnprocessedMessages();
	await Client.stop();
}
