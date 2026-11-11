import assert from "node:assert/strict";
import lock from "../package-lock.json" with { type: "json" };

assert.equal(lock.lockfileVersion, 3);
for (const [name, entry] of Object.entries(lock.packages)) {
	if (!name) continue;
	assert.equal(entry.link, undefined, `${name} must resolve to a registry tarball`);
	const url = new URL(entry.resolved);
	assert.equal(url.origin, "https://registry.npmjs.org", `${name} uses an unexpected registry`);
	assert(
		!url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith(".tgz"),
		`${name} has an unexpected tarball URL`,
	);
	assert.match(entry.integrity ?? "", /^sha512-[A-Za-z0-9+/]{86}==$/, `${name} is missing a SHA-512 integrity hash`);
}
