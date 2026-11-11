import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const root = mkdtempSync(join(tmpdir(), "telegram-sync-security-"));
after(() => rmSync(root, { recursive: true, force: true }));
const host = join(root, "node_modules", "obsidian");
mkdirSync(host, { recursive: true });
writeFileSync(
	join(host, "index.js"),
	`module.exports = {
	Plugin: class {}, Modal: class {}, PluginSettingTab: class {}, AbstractInputSuggest: class {},
	TFile: class {}, TFolder: class {}, normalizePath: x => x, moment: require(${JSON.stringify(require.resolve("moment"))})
};`,
);
const entry = join(root, "audit.cjs");
await build({
	stdin: {
		contents: [
			'export { handleMessage } from "./src/telegram/bot/message/handlers";',
			'export { applyNoteContentTemplate } from "./src/telegram/bot/message/processors";',
			'export { extractConditionsFromFilterQuery } from "./src/settings/messageDistribution";',
			'export { doesMessageMatchRule } from "./src/telegram/bot/message/filterEvaluations";',
			'export { isAllowedMessage } from "./src/telegram/bot/access";',
			'export { sanitizeFilePath } from "./src/utils/fsUtils";',
			'export { displayAndLogError } from "./src/utils/logUtils";',
			'export { connect } from "./src/telegram/user/user";',
		].join("\n"),
		resolveDir: process.cwd(),
		loader: "ts",
	},
	outfile: entry,
	bundle: true,
	platform: "node",
	external: ["obsidian"],
	alias: { websocket: "websocket/lib/browser.js" },
});
const api = require(entry);
const { TFile } = require(join(host, "index.js"));
const message = {
	message_id: 17,
	date: 1700000000,
	chat: { id: 123, type: "private" },
	from: { id: 123, first_name: "Test", username: "test_user" },
	text: "message",
};

test("empty and legacy blank allowlists block messages without a username before any side effect", async () => {
	const anonymous = { ...message, from: { id: 123, first_name: "Test" }, text: "/topicName example" };
	const settings = { allowedChats: [""] };
	assert.equal(api.isAllowedMessage(settings.allowedChats, anonymous), false);
	assert.equal(api.isAllowedMessage(["@TEST_USER"], message), true);
	assert.equal(api.isAllowedMessage(["123"], anonymous), true);
	await api.handleMessage(
		{
			settings,
			get bot() {
				throw new Error("Unexpected bot use");
			},
			get app() {
				throw new Error("Unexpected vault access");
			},
			get settingsTab() {
				throw new Error("Unexpected topic setting");
			},
		},
		anonymous,
	);
});

test("negative and contains filters honor their operators and reject malformed rules", async () => {
	for (const [query, expected] of [
		["{{user!=test_user}}", false],
		["{{user!=other}}", true],
		["{{content~ess}}", true],
		["{{content!~ess}}", false],
		["{{content=ess}}", false],
	]) {
		const rule = { messageFilterConditions: api.extractConditionsFromFilterQuery(query) };
		assert.equal(await api.doesMessageMatchRule({}, message, rule), expected, query);
	}
	assert.throws(() => api.extractConditionsFromFilterQuery("invalid filter"));
	assert.equal(await api.doesMessageMatchRule({}, message, { messageFilterConditions: [] }), false);
});

test("template directives from Telegram are literal and external embeds are disabled", async () => {
	const plugin = {
		app: {
			vault: {
				getAbstractFileByPath: () => new TFile(),
				read: async () => "{{content}}\n{{url1:preview}}",
			},
		},
	};
	const text =
		"https://example.invalid {{replace:message=>changed}} {{url1:preview}} <img src=x> ![remote](https://example.invalid)";
	const note = await api.applyNoteContentTemplate(plugin, "template.md", { ...message, text });
	assert(note.includes("{{replace:message=>changed}} {{url1:preview}}"));
	assert(note.includes("&lt;img src=x>"));
	assert(note.includes("&#33;[remote]"));
	assert(!note.includes("<iframe"));
	assert(note.endsWith("https://example.invalid/"));
});

test("Telegram paths cannot target configuration folders or escape the vault", () => {
	for (const file of [
		"../secret.md",
		"/outside/file",
		"Telegram/../private.md",
		".obsidian/plugins/main.js",
		"C:\\outside\\file",
	]) {
		assert.throws(() => api.sanitizeFilePath(file), /inside the vault/);
	}
	assert.equal(api.sanitizeFilePath("Telegram/notes.md"), "Telegram/notes.md");
});

test("errors containing token and vault path never go to the bot", () => {
	const plugin = {
		manifest: { name: "Fixture" },
		settings: {},
		get bot() {
			throw new Error("Unexpected network access");
		},
	};
	api.displayAndLogError(plugin, new Error("fake-token and /private/vault"), "", "", message, 0);
});

test("MTProto does not initialize without an explicitly saved session or login", async () => {
	await api.connect({
		app: { secretStorage: { getSecret: () => null } },
		get settings() {
			throw new Error("Unexpected connection setup");
		},
	});
});

test("test installer copies only the plugin assets and preserves vault settings", () => {
	const source = join(root, "installer-source");
	const vault = join(root, "test-vault");
	const plugins = join(vault, ".obsidian", "plugins");
	const installed = join(plugins, "telegram-sync");
	mkdirSync(source);
	mkdirSync(installed, { recursive: true });
	const files = ["main.js", "manifest.json", "styles.css"];
	for (const name of files) writeFileSync(join(source, name), name);
	writeFileSync(join(installed, "data.json"), "fixture-settings");

	const installer = fileURLToPath(new URL("../install-plugin.mjs", import.meta.url));
	execFileSync(process.execPath, [installer, vault], { cwd: source, timeout: 5000 });
	assert.deepEqual(readdirSync(plugins), ["telegram-sync"]);
	assert.deepEqual(readdirSync(installed).sort(), [...files, "data.json"].sort());
	assert.equal(readFileSync(join(installed, "data.json"), "utf8"), "fixture-settings");
});
