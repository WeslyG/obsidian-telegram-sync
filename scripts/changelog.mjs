import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const version = process.argv[2] ?? "";
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Expected a stable release version.");

const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const sections = changelog
	.split(/^##[ \t]+/m)
	.slice(1)
	.filter((section) => section.split("\n", 1)[0].trim().split(/\s+/, 1)[0] === version);
assert.equal(sections.length, 1, `Expected exactly one changelog section for ${version}.`);

const notes = sections[0].slice(sections[0].indexOf("\n") + 1).trim();
assert.ok(sections[0].includes("\n") && notes, `The changelog section for ${version} is empty.`);
process.stdout.write(notes + "\n");
