/**
 * Build the two runtime halves from src/ into the package root.
 *
 *  index.js  — esbuild ESM bundle of src/index.ts (loader contract exports).
 *  client.js — esbuild IIFE of src/client-core.ts plus ONE
 *              window.__ModuleLoader__.load registration whose factory returns
 *              the core's plugin object; React reaches the bundle through the
 *              `__dshRequire`/`__dshReact` globals the wrapper seeds from the
 *              loader's require.
 *  lib/types — tsc declarations for the host surface.
 */
import { $ } from 'bun';

await $`bunx tsup src/index.ts --format esm --out-dir . --target es2022 --silent`.throws(true);

await $`bunx esbuild src/client-core.ts --bundle --format=iife --global-name=__dshXMagpieCore --outfile=.client.body.js --target=es2022`.throws(true);
const bundled = (await Bun.file('.client.body.js').text()).trim();
const client = `window.__dshXMagpieLoader = { require: (spec) => require(spec) };
var __dshRequire = window.__dshXMagpieLoader.require;
${bundled}
window.__ModuleLoader__.load({
	id: '@straydragon/dsh-x-magpie',
	factory: () => __dshXMagpieCore?.default ?? __dshXMagpieCore,
});
`;
await Bun.write('client.js', client);
await $`rm .client.body.js`.throws(true);

await $`bunx tsc --emitDeclarationOnly --declaration --declarationMap --outDir lib/types --ignoreConfig --strict --target es2022 --moduleResolution bundler --module esnext --skipLibCheck --types bun src/index.ts`.throws(true);

console.log('build: index.js + client.js + lib/types ✔');
