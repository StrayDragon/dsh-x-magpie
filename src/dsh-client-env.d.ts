/** Ambient declarations for the dsh client module runtime. The browser half
 * runs inside dsh's module loader, which seeds `window.__ModuleLoader__` and
 * a require shim exposing `react`; none of these are bundled. */

export {};

declare global {
	interface ModuleLoaderRegistration {
		id: string;
		factory: (require: (spec: string) => unknown) => {
			inject?: string[];
			apply: (ctx: never) => void;
		};
	}

	interface Window {
		/** Seeded by @deepseek-ai/dsh-client-modules before any plugin code runs. */
		__ModuleLoader__: {
			load(registration: ModuleLoaderRegistration): void;
		};
	}
}
