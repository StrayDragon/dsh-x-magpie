// Debug helper: trace the default-unwrap loop on the built client.js.
const vm = require('node:vm');
const fs = require('node:fs');
const src = fs.readFileSync('dist/client.js', 'utf8').replace(
	'let __dshPlugin = client_core_exports;',
	'let __dshPlugin = client_core_exports; console.log("PRE", JSON.stringify([Object.keys(client_core_exports), !!client_core_exports.default, client_core_exports.default && Object.keys(client_core_exports.default)]));'
);
const regs = [];
const sb = { window: { __ModuleLoader__: { load: (r) => regs.push(r) } }, console, setTimeout, clearTimeout };
vm.createContext(sb);
vm.runInContext(src, sb);
regs[0].factory(() => ({ default: {} }));
