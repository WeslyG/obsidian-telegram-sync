import { readFileSync, writeFileSync } from "node:fs";
import { compareVersions } from "compare-versions";

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// update versions.json with target version and minAppVersion from manifest.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
const previousVersion = Object.keys(versions)
	.sort(compareVersions)
	.findLast((version) => compareVersions(version, targetVersion) <= 0);
if (minAppVersion !== versions[previousVersion]) {
	versions[targetVersion] = minAppVersion;
	writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
}
