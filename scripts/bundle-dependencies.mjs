import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const telegramManifest = require.resolve("teleproto/package.json");
const portableCrypto = join(dirname(createRequire(telegramManifest).resolve("cifrante")), "cifrante.cjs");

export const portableTelegram = {
	name: "portable-telegram",
	setup(build) {
		// Bundle the package's self-contained WASM entry so Obsidian needs no platform-specific add-on.
		build.onResolve({ filter: /^cifrante$/ }, () => ({ path: portableCrypto }));

		// We always pass a StringSession backed by Obsidian secret storage.
		build.onResolve({ filter: /^#platform\/storage$/ }, () => ({
			path: "storage",
			namespace: "disabled-telegram-storage",
		}));
		build.onLoad({ filter: /.*/, namespace: "disabled-telegram-storage" }, () => ({
			contents: 'exports.open = () => { throw new Error("Disk sessions are disabled."); };',
		}));
	},
};
