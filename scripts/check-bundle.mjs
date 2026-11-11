import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), "telegram-sync-bundle-"));
try {
	// Load the same single-file bundle Obsidian receives, with only its host API available.
	const hostApi = join(dir, "node_modules", "obsidian");
	mkdirSync(hostApi, { recursive: true });
	writeFileSync(
		join(hostApi, "index.js"),
		`module.exports = { Plugin: class {}, Modal: class {}, PluginSettingTab: class {}, AbstractInputSuggest: class {},
		moment: require(${JSON.stringify(require.resolve("moment"))}) };`,
	);
	const bundle = join(dir, "main.cjs");
	copyFileSync(new URL("../main.js", import.meta.url), bundle);
	const plugin = require(bundle);
	assert.equal(typeof (plugin.default ?? plugin), "function", "Expected an Obsidian plugin class in main.js.");
} finally {
	rmSync(dir, { recursive: true, force: true });
}

// The smoke check ends at module initialization, before the host starts the plugin lifecycle.
process.exit(0);
