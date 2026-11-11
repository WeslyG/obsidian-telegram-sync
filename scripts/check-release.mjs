import assert from "node:assert/strict";
import { compareVersions } from "compare-versions";
import manifest from "../manifest.json" with { type: "json" };
import lock from "../package-lock.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };
import versions from "../versions.json" with { type: "json" };

const { version } = pkg;
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const tag = process.argv[2];

assert.match(version, stableVersion, "Use a stable Obsidian release version in package.json.");
assert.equal(manifest.version, version, "manifest.json must match package.json.");
assert.equal(lock.version, version, "package-lock.json must match package.json.");
assert.equal(lock.packages[""].version, version, "The root package in package-lock.json must match package.json.");

const compatibilityVersion = Object.keys(versions)
	.sort(compareVersions)
	.findLast((entry) => compareVersions(entry, version) <= 0);
assert.equal(
	versions[compatibilityVersion],
	manifest.minAppVersion,
	"Update the compatibility entry in versions.json.",
);

if (tag !== undefined)
	assert.equal(tag, version, "The release tag must match the manifest version without a v prefix.");
