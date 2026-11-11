import fs from "node:fs";
import path from "node:path";
import manifest from "./manifest.json" with { type: "json" };

const destination = process.argv[2];
if (!destination) throw new Error("Provide the path to an initialized Obsidian test vault.");

const vault = fs.realpathSync(destination);
const config = path.join(vault, ".obsidian");
if (!fs.lstatSync(config).isDirectory()) throw new Error("Use an initialized Obsidian test vault.");
const plugins = path.join(config, "plugins");
const plugin = path.join(plugins, manifest.id);

for (const directory of [plugins, plugin]) {
	if (!fs.existsSync(directory)) fs.mkdirSync(directory);
	if (!fs.lstatSync(directory).isDirectory()) throw new Error("Plugin directories must be inside the test vault.");
}

const files = ["main.js", "styles.css", "manifest.json"];
for (const file of files) {
	if (!fs.lstatSync(file).isFile()) throw new Error(`Missing build file ${file}.`);
	const existing = fs.lstatSync(path.join(plugin, file), { throwIfNoEntry: false });
	if (existing && !existing.isFile()) throw new Error(`Refusing to overwrite ${file}.`);
}
for (const file of files) fs.copyFileSync(file, path.join(plugin, file));
console.log("Installed Telegram Sync in the test vault.");
