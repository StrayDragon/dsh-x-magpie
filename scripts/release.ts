/**
 * Cut a release: validate the semver argument against package.json, rewrite the
 * version, commit, tag `v<version>`, and push the branch plus the tag. Pushing
 * the tag is what triggers release.yml to build and attach the tarball.
 *
 * Refuses to run on a dirty tree (outside the version change it makes itself)
 * or when the tag already exists.
 */
import { $ } from 'bun';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
	console.error(`usage: just release <0.7.1|0.8.0-rc.1|...>  (got: ${version ?? ''})`);
	process.exit(1);
}

const manifest = JSON.parse(await Bun.file('package.json').text());
if (manifest.version === version) {
	console.error(`package.json is already ${version}; bump to a new version`);
	process.exit(1);
}

const dirty = await $`git status --porcelain`.quiet().text();
if (dirty.trim() !== '') {
	console.error('working tree not clean; commit or stash first:\n' + dirty);
	process.exit(1);
}

const tag = `v${version}`;
const existing = await $`git tag -l {{tag}}`.text().catch(() => '');
if (existing.trim() !== '') {
	console.error(`tag ${tag} already exists`);
	process.exit(1);
}

manifest.version = version;
await Bun.write('package.json', `${JSON.stringify(manifest, null, '\t')}\n`);
await $`git add package.json`.quiet();
await $`git commit -m release: v${version}`.quiet();
await $`git tag ${tag}`;
await $`git push && git push origin ${tag}`;
console.log(`released ${tag} — release.yml now builds the tarball and attaches it to the GitHub Release`);
