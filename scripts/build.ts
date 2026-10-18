/**
 * Build the two runtime halves from src/ into the package root, preserving the
 * exact runtime shapes the dsh loader expects:
 *  - index.js: ESM, re-exporting `name`, `inject`, `apply` (host half)
 *  - client.js: IIFE text performing window.__ModuleLoader__.load (client half)
 * Type declarations land in lib/types/.
 */
import { $ } from 'bun';

// Host half: plain ESM re-exporting the loader contract.
await $`bunx tsup src/index.ts --format esm --out-dir . --target es2022 --silent`.throws(true);

// Client half: bundle the factory body, then wrap it in the loader call. The
// banner/footer strings are plain text, so esbuild accepts them verbatim.
await $`bunx esbuild src/client.ts --bundle --format=iife --global-name=__dshXMagpieClient --outfile=.client.body.js --target=es2022`.throws(true);
const body = await Bun.file('.client.body.js').text();
const inner = body.replace(/^var __dshXMagpieClient[^\n]*\n/, '').replace(/^var __dshXMagpieClient[^\n]*\n/, '').trim();
const client = [
	"window.__ModuleLoader__.load({",
	"\tid: '@straydragon/dsh-x-magpie',",
	"\tfactory: (require) => {",
	inner.replace(/\n/g, '\n\t\t'), // indent the IIFE body two levels
	'\t\treturn moduleExports;',
	'\t},',
	'});',
	'',
].join('\n');
await Bun.write('client.js', client);
await $`rm .client.body.js`.throws(true);

// Declarations for the host surface.
await $`bunx tsc --emitDeclarationOnly --declaration --declarationMap --outDir lib/types --ignoreConfig --strict --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.ts src/shared.ts`.throws(true);

console.log('build: index.js + client.js + lib/types ✔');
