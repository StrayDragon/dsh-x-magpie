/**
 * Build the two runtime halves from src/ into dist/.
 *
 * The client artifact matches the shape of dsh's own compiled plugins: exactly
 * one window.__ModuleLoader__.load({id, factory}) whose factory receives the
 * loader's require and returns the plugin. esbuild keeps `react` external
 * (emitting __require("react")), and the wrapper reopens the IIFE as a function
 * of require, so those calls hit the loader's module table — the same way the
 * official build pipeline inlines its bundle into the factory scope.
 *
 *  dist/index.js  — esbuild ESM bundle of src/index.ts (loader contract exports).
 *  dist/client.js — reopened-IIFE wrapper of src/client-core.ts.
 *  dist/types     — tsc declarations for the host surface.
 */
import { $ } from 'bun';

await $`mkdir -p dist`.quiet();

await $`bunx tsup src/index.ts --format esm --out-dir dist --target es2022 --silent`.throws(true);

await $`bunx esbuild src/client-core.ts --bundle --external:react --format=iife --global-name=__dshXMagpieCore --outfile=dist/.client.body.js --target=es2022 --legal-comments=none`.throws(true);
const raw = (await Bun.file('dist/.client.body.js').text()).trim();
// Shape: "use strict";\nvar NAME = (() => {\n ...return exports; })();
const assignment = raw.match(/var\s+__dshXMagpieCore\s*=\s*\(\(\) => \{([\s\S]*)\}\)\(\);$/);
if (!assignment) throw new Error('unexpected esbuild IIFE envelope');
const body = assignment[1].replace(/\n\s*return __toCommonJS\(client_core_exports\);/, '');
// reopen: factory gets the loader require; the core resolves react from it.
const client = `window.__ModuleLoader__.load({
	id: '@straydragon/dsh-x-magpie',
	factory: (require) => {
	var __dshRequire = require;
${body}
	// esbuild's __toESM interop nests our default export once more when the
	// module has the __esModule marker; unwrap until the plugin surfaces.
	let __dshPlugin = client_core_exports;
	while (__dshPlugin && typeof __dshPlugin === 'object' && 'default' in __dshPlugin && __dshPlugin.inject === undefined) {
		__dshPlugin = __dshPlugin.default;
	}
	return __dshPlugin;
	},
});
`;
await Bun.write('dist/client.js', client);
await $`rm dist/.client.body.js`.throws(true);

await $`bunx tsc --emitDeclarationOnly --declaration --declarationMap --outDir dist/types --ignoreConfig --strict --target es2022 --moduleResolution bundler --module esnext --skipLibCheck --types bun src/index.ts`.throws(true);

console.log('build: dist/index.js + dist/client.js + dist/types ✔');
