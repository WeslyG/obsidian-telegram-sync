import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import { createRequire } from "node:module";
import { connect, createServer as tcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { build } from "esbuild";

const buildDir = mkdtempSync(join(tmpdir(), "telegram-sync-test-"));
after(() => rmSync(buildDir, { recursive: true, force: true }));

const proxyModule = join(buildDir, "proxy.cjs");
await build({
	entryPoints: ["src/telegram/bot/proxy.ts"],
	outfile: proxyModule,
	bundle: true,
	platform: "node",
});
const { createBotProxyAgent, readProxyCredentials, saveProxyCredentials } = createRequire(import.meta.url)(proxyModule);

const apiModule = join(buildDir, "api.cjs");
await build({ entryPoints: ["src/telegram/bot/api.ts"], outfile: apiModule, bundle: true, platform: "node" });
const { default: TelegramBot } = createRequire(import.meta.url)(apiModule);

const host = "telegram-sync.test";
const credentials = { username: "proxy@user", password: "pass:word%+" };

async function listen(t, server) {
	const sockets = new Set();
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.once("close", () => sockets.delete(socket));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	t.after(() => {
		for (const socket of sockets) socket.destroy();
		return new Promise((resolve) => server.close(resolve));
	});
	return server.address().port;
}

function tunnel(client, origin, reply, head = Buffer.alloc(0)) {
	const upstream = connect(origin, "127.0.0.1", () => {
		client.write(reply);
		if (head.length) upstream.write(head);
		client.pipe(upstream).pipe(client);
	});
	client.on("error", () => upstream.destroy());
	client.once("close", () => upstream.destroy());
	upstream.on("error", () => client.destroy());
}

function httpProxy(origin, authenticate) {
	const proxy = httpServer();
	const authorization = authenticate
		? "Basic " + Buffer.from(credentials.username + ":" + credentials.password).toString("base64")
		: undefined;
	proxy.on("connect", (request, socket, head) => {
		assert.equal(request.url, host + ":" + origin);
		if (request.headers["proxy-authorization"] !== authorization) {
			socket.end("HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n");
			return;
		}
		tunnel(socket, origin, "HTTP/1.1 200 Connection Established\r\n\r\n", head);
	});
	return proxy;
}

function socksProxy(origin, authenticate) {
	return tcpServer(async (socket) => {
		const reader = socket.iterator({ destroyOnReturn: false });
		let pending = Buffer.alloc(0);
		async function read(size) {
			while (pending.length < size) {
				const { done, value } = await reader.next();
				assert(!done, "SOCKS5 client closed during negotiation");
				pending = Buffer.concat([pending, value]);
			}
			const chunk = pending.subarray(0, size);
			pending = pending.subarray(size);
			return chunk;
		}

		const [version, methodCount] = await read(2);
		assert.equal(version, 5);
		const methods = await read(methodCount);
		const method = authenticate ? 2 : 0;
		assert(methods.includes(method));
		socket.write(Buffer.from([5, method]));

		if (authenticate) {
			const [authVersion, usernameLength] = await read(2);
			assert.equal(authVersion, 1);
			const username = (await read(usernameLength)).toString();
			const [passwordLength] = await read(1);
			const password = (await read(passwordLength)).toString();
			if (username !== credentials.username || password !== credentials.password) {
				socket.end(Buffer.from([1, 1]));
				return;
			}
			socket.write(Buffer.from([1, 0]));
		}

		assert.deepEqual(await read(4), Buffer.from([5, 1, 0, 3]));
		const [hostLength] = await read(1);
		assert.equal((await read(hostLength)).toString(), host);
		assert.equal((await read(2)).readUInt16BE(), origin);
		await reader.return();
		tunnel(socket, origin, Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]), pending);
	});
}

for (const [protocol, proxy] of [
	["http", httpProxy],
	["socks5", socksProxy],
]) {
	for (const authenticate of [false, true]) {
		test(
			protocol + (authenticate ? " with authentication" : " without authentication"),
			{ timeout: 10000 },
			async (t) => {
				let requests = 0;
				const origin = await listen(
					t,
					httpServer((request, response) => {
						assert.equal(request.headers["proxy-authorization"], undefined);
						requests++;
						if (request.url.startsWith("/file/")) return response.end("test attachment");
						const result = {
							getMe: { id: 1, username: "local_bot" },
							getUpdates: [],
							getFile: { file_path: "attachment.txt" },
						}[request.url.split("/").at(-1)];
						response.setHeader("Content-Type", "application/json");
						response.end(JSON.stringify({ ok: true, result }));
					}),
				);

				const port = await listen(t, proxy(origin, authenticate));
				const proxyUrl = protocol + "://127.0.0.1:" + port;
				function makeBot(auth) {
					const agent = createBotProxyAgent(proxyUrl, auth);
					const bot = new TelegramBot("123:local-token", new URL("http://" + host + ":" + origin), agent);
					t.after(() => bot.close());
					return bot;
				}

				const bot = makeBot(authenticate ? credentials : undefined);
				assert.equal((await bot.getMe()).username, "local_bot");
				assert.deepEqual(await bot.getUpdates(0, 0), []);
				const attachment = [];
				const file = await bot.openFile("test-file");
				for await (const chunk of file.stream) attachment.push(chunk);
				assert.equal(Buffer.concat(attachment).toString(), "test attachment");
				assert.equal(requests, 4);

				if (authenticate) {
					const rejectedBot = makeBot({ ...credentials, password: "wrong" });
					await assert.rejects(rejectedBot.getMe());
					assert.equal(requests, 4);
				}
			},
		);
	}
}

test("proxy credentials stay separate from the address", () => {
	const secrets = new Map();
	const app = {
		secretStorage: {
			getSecret: (key) => secrets.get(key) ?? null,
			setSecret: (key, value) => secrets.set(key, value),
		},
	};
	saveProxyCredentials(app, credentials);
	assert.deepEqual(readProxyCredentials(app), credentials);
	assert.equal(createBotProxyAgent(""), undefined);
	assert.throws(() => createBotProxyAgent("http://user:password@proxy.test:8080"), /Authentication tab/);
	assert.throws(
		() => createBotProxyAgent("socks5://proxy.test:1080", { username: "user", password: "я".repeat(128) }),
		/255 bytes/,
	);
});

test("Bot API errors do not expose credentials or follow redirects", async (t) => {
	const paths = [];
	const origin = await listen(
		t,
		httpServer((request, response) => {
			paths.push(request.url);
			if (paths.length === 1) {
				response.writeHead(302, { Location: "/unexpected-redirect" }).end();
				return;
			}
			response.writeHead(400, { "Content-Type": "application/json" }).end(
				JSON.stringify({
					ok: false,
					error_code: 400,
					description: "123:local-token and /private/vault",
				}),
			);
		}),
	);
	const bot = new TelegramBot("123:local-token", new URL(`http://127.0.0.1:${origin}`));
	t.after(() => bot.close());
	await assert.rejects(bot.getMe(), /getMe failed \(302\)/);
	await assert.rejects(bot.getMe(), (error) => error.message === "Telegram Bot API getMe failed (400).");
	assert.deepEqual(paths, ["/bot123:local-token/getMe", "/bot123:local-token/getMe"]);
});
