// Host half of dsh-x-magpie.
//
// Pulls `GET {gatewayUrl}/v1/models` from a running magpie gateway, maps every
// row onto a `llm-pi-ai` provider-route entry (id/name, contextWindow,
// maxTokens, input modalities, reasoningEfforts), and writes that route into
// the profile's llm-pi-ai config through the configEditor — the same Loader
// path dsh's own Models page uses. Nothing is written without a plan/apply
// round trip: `plan` never writes, `apply` re-derives the candidate inside the
// edit callback so a concurrent edit between plan and apply cannot be clobbered.
//
// Fields the gateway does not report stay unwritten: llm-pi-ai then applies
// its own defaults (defaultContextWindow 262144 / defaultMaxTokens 32768) or
// an installed catalog entry, exactly like a hand-declared route would. A
// per-model `modelOverrides` config map can add or correct values; an
// explicit `null` in an override drops the field instead of writing it.
//
// No Config schema is declared on purpose: the row's config passes through
// raw (resolveConfig returns it unchanged when no schema exists), which keeps
// this bundle free of dsh-internal schema dependencies and version pins.

import {
	DEFAULTS,
	PLUGIN_ID,
	REASONING_LEVELS,
	ROUTE_MODALITIES,
	ROUTE_PREFIX,
	type MagpieApi,
	type PluginConfig,
	type RouteCandidate,
	type RouteDiff,
	type RouteModel,
} from './shared.js';

export { name } from './identity.js';

export const inject = ['webServer', 'configEditor', 'credentials'] as const;

/** Raw row of the magpie gateway's `GET /v1/models` answer. */
interface GatewayRow {
	id?: unknown;
	display_name?: unknown;
	name?: unknown;
	context_window?: unknown;
	context_length?: unknown;
	max_output_tokens?: unknown;
	reasoning?: unknown;
	supported_reasoning_levels?: unknown;
	modalities?: { input?: unknown };
	owned_by?: unknown;
	[key: string]: unknown;
}

/** Loader entry handle, as handed to configEditor.edit. */
interface LoaderEntry {
	options?: { id?: string };
	id?: string;
}

/** Minimal surface of the dsh services this plugin touches. */
interface HostContext {
	effect(register: () => () => void, label: string): () => void;
	webServer: {
		register(route: {
			kind: 'prefix';
			path: string;
			handler: (req: IncomingLike, res: ResponseLike) => Promise<void> | void;
		}): () => void;
	};
	configEditor: {
		entries(): LoaderEntry[];
		configuration(): Array<{
			entry: LoaderEntry;
			inherited: Record<string, unknown>;
			override: Record<string, unknown>;
		}>;
		edit(
			entry: LoaderEntry,
			change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
		): Promise<void>;
	};
	credentials: {
		resolve(ref: string): Promise<{ value?: string } | undefined>;
		set(ref: string, value: string): Promise<void>;
	};
}

interface IncomingLike {
	method?: string;
	url?: string;
	headers: Record<string, unknown>;
	on(event: string, listener: (chunk?: unknown) => void): unknown;
}

interface ResponseLike {
	writeHead(status: number, headers: Record<string, string>): unknown;
	end(body: string): unknown;
}

const LLM_PI_AI_ID = 'llm-pi-ai';

const APIS = new Set<string>(['openai-completions', 'openai-responses', 'anthropic-messages']);

/** Volatile config fields may arrive as lazily-resolved wrappers in built plugins. */
function plain(value: unknown): unknown {
	return value !== null && typeof value === 'object' && typeof (value as { get?: unknown }).get === 'function'
		? (value as { get(): unknown }).get()
		: value;
}

export function readConfig(config: Record<string, unknown> | undefined): PluginConfig {
	const raw: Record<string, unknown> = { ...DEFAULTS };
	for (const key of Object.keys(DEFAULTS)) {
		const value = plain(config?.[key]);
		if (value !== undefined && value !== null && value !== '') raw[key] = value;
	}
	const overrides = raw.modelOverrides;
	return {
		gatewayUrl: String(raw.gatewayUrl).replace(/\/+$/, ''),
		routeName: String(raw.routeName),
		displayName: String(raw.displayName),
		credentialRef: String(credentialRefOf(raw)),
		api: raw.api as PluginConfig['api'],
		modelOverrides: overrides !== null && typeof overrides === 'object' ? (overrides as PluginConfig['modelOverrides']) : {},
		exclude: Array.isArray(raw.exclude)
			? [...new Set((raw.exclude as unknown[]).filter((id): id is string => typeof id === 'string'))]
			: [],
	};
}

function credentialRefOf(raw: Record<string, unknown>): unknown {
	return raw.credentialRef;
}

function num(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Reasoning levels of one gateway row: `false` for a declared non-reasoner,
 * undefined when the gateway says nothing, else a `{level: wireEffort}` map. */
function effortsOf(row: GatewayRow): Record<string, string> | false | undefined {
	if (row.reasoning === false) return false;
	const levels = row.supported_reasoning_levels;
	if (!Array.isArray(levels) || levels.length === 0) return undefined;
	const map: Record<string, string> = {};
	for (const entry of levels) {
		const effort = entry && typeof entry === 'object' ? (entry as { effort?: unknown }).effort : entry;
		if (typeof effort !== 'string' || effort === '') continue;
		const level = effort === 'none' ? 'off' : effort;
		if ((REASONING_LEVELS as readonly string[]).includes(level)) map[level] = effort;
	}
	return Object.keys(map).length > 0 ? map : undefined;
}

function inputOf(row: GatewayRow): string[] | undefined {
	const modalities = row.modalities?.input;
	if (!Array.isArray(modalities)) return undefined;
	const filtered = [...new Set(modalities)].filter((m): m is string => typeof m === 'string' && (ROUTE_MODALITIES as readonly string[]).includes(m));
	return filtered.length > 0 ? filtered : undefined;
}

/** One gateway row onto one llm-pi-ai model entry. `null` overrides drop fields. */
export function mapModel(row: GatewayRow, overrides: PluginConfig['modelOverrides']): RouteModel | undefined {
	if (!row || typeof row.id !== 'string' || row.id === '') return undefined;
	const ov = overrides[row.id];
	const ovRecord = ov !== null && typeof ov === 'object' ? (ov as Record<string, unknown>) : {};
	const model: RouteModel = { id: row.id };

	// The id doubles as the display name, so a dsh selector shows the same
	// string it sends; modelOverrides may still rename explicitly.
	const name = ovRecord.name !== undefined ? ovRecord.name : row.id;
	if (typeof name === 'string' && name !== '') model.name = name;

	const contextWindow = ovRecord.contextWindow !== undefined ? num(ovRecord.contextWindow) : num(row.context_window ?? row.context_length);
	if (contextWindow > 0) model.contextWindow = contextWindow;

	const maxTokens = ovRecord.maxTokens !== undefined ? num(ovRecord.maxTokens) : num(row.max_output_tokens);
	if (maxTokens > 0) model.maxTokens = maxTokens;

	if (ovRecord.input !== undefined) {
		if (ovRecord.input !== null) model.input = ovRecord.input as string[];
	} else {
		const input = inputOf(row);
		if (input) model.input = input;
	}

	if (ovRecord.reasoningEfforts !== undefined) {
		if (ovRecord.reasoningEfforts !== null) model.reasoningEfforts = ovRecord.reasoningEfforts as RouteModel['reasoningEfforts'];
	} else {
		const efforts = effortsOf(row);
		if (efforts !== undefined) model.reasoningEfforts = efforts;
	}
	return model;
}

async function gatewayKey(ctx: HostContext, credentialRef: string): Promise<string> {
	try {
		const resolved = await ctx.credentials.resolve(credentialRef);
		return typeof resolved?.value === 'string' && resolved.value !== '' ? resolved.value : '';
	} catch {
		return '';
	}
}

/** Fetch and normalize the gateway's model rows. */
async function fetchModels(ctx: HostContext, cfg: PluginConfig): Promise<{ rows: GatewayRow[] } | { error: string }> {
	let url: URL;
	try {
		url = new URL(`${cfg.gatewayUrl}/v1/models`);
	} catch {
		return { error: `invalid gatewayUrl: ${cfg.gatewayUrl}` };
	}
	const key = await gatewayKey(ctx, cfg.credentialRef);
	const headers: Record<string, string> = {};
	if (key) headers.authorization = `Bearer ${key}`;
	let response: Response;
	try {
		response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
	} catch (error) {
		return { error: `gateway unreachable at ${url} (${error instanceof Error ? error.message : String(error)}); is magpie running?` };
	}
	if (response.status === 401 || response.status === 403) {
		return { error: `gateway refused the request (${response.status}); store the gateway key on this page first` };
	}
	if (!response.ok) return { error: `gateway answered ${response.status} for ${url}` };
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return { error: 'gateway returned a non-JSON model list' };
	}
	const data = (body as { data?: unknown })?.data;
	const models = (body as { models?: unknown })?.models;
	const rows = Array.isArray(data) ? data : Array.isArray(models) ? models : [];
	return { rows: rows as GatewayRow[] };
}

function candidateRoute(cfg: PluginConfig, models: RouteModel[]): RouteCandidate {
	return {
		displayName: cfg.displayName,
		api: cfg.api,
		// magpie speaks Messages at the gateway root and OpenAI dialects under /v1.
		baseURL: cfg.api === 'anthropic-messages' ? cfg.gatewayUrl : `${cfg.gatewayUrl}/v1`,
		apiKeyEnv: cfg.credentialRef,
		models,
	};
}

/** Current llm-pi-ai entry plus its effective providers map, or an error marker. */
function llmPiAi(ctx: HostContext): { error: string } | { entry: LoaderEntry; providers: Record<string, unknown> } {
	/** Loader entries expose their patch id at `options.id`. */
	const entryId = (entry: LoaderEntry) => entry?.options?.id ?? entry?.id;
	const entry = ctx.configEditor.entries().find((candidate) => entryId(candidate) === LLM_PI_AI_ID);
	if (!entry) return { error: `no "${LLM_PI_AI_ID}" row in this profile; mount it before syncing` };
	const item = ctx.configEditor.configuration().find((candidate) => entryId(candidate.entry) === LLM_PI_AI_ID);
	const inherited = item?.inherited ?? {};
	const override = item?.override ?? {};
	const inheritedProviders = inherited.providers;
	const overrideProviders = override.providers;
	const providers: Record<string, unknown> = {
		...(inheritedProviders !== null && typeof inheritedProviders === 'object' ? inheritedProviders : {}),
		...(overrideProviders !== null && typeof overrideProviders === 'object' ? overrideProviders : {}),
	};
	return { entry, providers };
}

function sameValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Field-level diff of the route this plugin manages. Other routes never appear. */
export function diffRoute(current: unknown, candidate: RouteCandidate): RouteDiff {
	const cur = (current ?? {}) as Record<string, unknown>;
	const out: RouteDiff = { route: [], added: [], removed: [], changed: [], unchanged: 0 };
	for (const field of ['displayName', 'api', 'baseURL', 'apiKeyEnv'] as const) {
		if (!sameValue(cur[field], candidate[field])) {
			out.route.push({ field, from: cur[field] ?? null, to: candidate[field] });
		}
	}
	const currentModels = new Map(
		(Array.isArray(cur.models) ? (cur.models as Array<Record<string, unknown>>) : []).map((m) => [String(m.id), m]),
	);
	const candidateModels = new Map(candidate.models.map((m) => [m.id, m]));
	for (const [id, model] of candidateModels) {
		const before = currentModels.get(id);
		if (!before) {
			out.added.push(id);
			continue;
		}
		const fields: RouteDiff['changed'][number]['fields'] = [];
		for (const field of ['name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts'] as const) {
			if (!sameValue(before[field], model[field])) {
				fields.push({ field, from: before[field] ?? null, to: model[field] ?? null });
			}
		}
		if (fields.length > 0) out.changed.push({ id, fields });
		else out.unchanged += 1;
	}
	for (const id of currentModels.keys()) {
		if (!candidateModels.has(id)) out.removed.push(id);
	}
	return out;
}

function collect(ctx: HostContext, cfg: PluginConfig): Promise<{ all: RouteModel[] } | { error: string }> {
	return fetchModels(ctx, cfg).then((fetched) => {
		if ('error' in fetched) return fetched;
		const seen = new Set<string>();
		const all: RouteModel[] = [];
		for (const raw of fetched.rows) {
			const model = mapModel(raw, cfg.modelOverrides);
			if (!model || seen.has(model.id)) continue;
			seen.add(model.id);
			all.push(model);
		}
		if (all.length === 0) return { error: 'the gateway listed no usable models' };
		return { all };
	});
}

interface PlanShape {
	gatewayUrl: string;
	routeName: string;
	routePresent: boolean;
	modelCount: number;
	models: Array<{ id: string; provider?: string; contextWindow?: number; maxTokens?: number }>;
	diff: RouteDiff;
	warning?: string;
}

export async function planSync(ctx: HostContext, cfg: PluginConfig): Promise<PlanShape | { error: string }> {
	const row = llmPiAi(ctx);
	if ('error' in row) return { error: row.error };
	const built = await collect(ctx, cfg);
	if ('error' in built) return { error: built.error };
	const selected = built.all.filter((model) => !cfg.exclude.includes(model.id));
	const candidate = candidateRoute(cfg, selected);
	const current = row.providers[cfg.routeName];
	return {
		gatewayUrl: cfg.gatewayUrl,
		routeName: cfg.routeName,
		routePresent: current !== undefined,
		modelCount: selected.length,
		models: built.all.map((m) => ({ id: m.id, contextWindow: m.contextWindow, maxTokens: m.maxTokens })),
		diff: diffRoute(current, candidate),
		...(selected.length === 0 ? { warning: 'no models selected; applying would empty the route' } : {}),
	};
}

export async function applySync(ctx: HostContext, cfg: PluginConfig): Promise<{ ok: true; routeName: string; written: number; diff: RouteDiff } | { error: string }> {
	const row = llmPiAi(ctx);
	if ('error' in row) return { error: row.error };
	const built = await collect(ctx, cfg);
	if ('error' in built) return { error: built.error };
	const selected = built.all.filter((model) => !cfg.exclude.includes(model.id));
	if (selected.length === 0) {
		return { error: 'no models selected; refusing to write an empty route' };
	}
	const candidate = candidateRoute(cfg, selected);
	const before = row.providers[cfg.routeName];
	const diff = diffRoute(before, candidate);
	await ctx.configEditor.edit(row.entry, (current, inherited) => {
		const providers: Record<string, unknown> = { ...(inherited.providers ?? {}), ...(current.providers ?? {}) };
		providers[cfg.routeName] = candidate;
		return { ...inherited, ...current, providers };
	});
	return { ok: true, routeName: cfg.routeName, written: selected.length, diff };
}

/** Remove the route this plugin owns. Other routes are never touched. */
export async function removeSync(ctx: HostContext, cfg: PluginConfig): Promise<{ ok: true; removed: boolean } | { error: string }> {
	const row = llmPiAi(ctx);
	if ('error' in row) return { error: row.error };
	const present = row.providers[cfg.routeName] !== undefined;
	if (!present) return { ok: true, removed: false };
	await ctx.configEditor.edit(row.entry, (current, inherited) => {
		const providers: Record<string, unknown> = { ...(inherited.providers ?? {}), ...(current.providers ?? {}) };
		delete providers[cfg.routeName];
		return { ...inherited, ...current, providers };
	});
	return { ok: true, removed: true };
}

export interface PluginState {
	gatewayUrl: string;
	routeName: string;
	displayName: string;
	credentialRef: string;
	api: MagpieApi;
	exclude: string[];
	hasCredential: boolean;
	gatewayMounted: boolean;
	gatewayMessage: string | null;
	routePresent: boolean;
	routeModelCount: number;
}

export async function readState(ctx: HostContext, cfg: PluginConfig): Promise<PluginState> {
	const row = llmPiAi(ctx);
	const providers = 'providers' in row ? row.providers : {};
	const route = providers[cfg.routeName] as { models?: unknown } | undefined;
	let hasCredential = false;
	try {
		hasCredential = (await gatewayKey(ctx, cfg.credentialRef)) !== '';
	} catch {
		hasCredential = false;
	}
	return {
		gatewayUrl: cfg.gatewayUrl,
		routeName: cfg.routeName,
		displayName: cfg.displayName,
		credentialRef: cfg.credentialRef,
		api: cfg.api,
		exclude: cfg.exclude,
		hasCredential,
		gatewayMounted: !('error' in row),
		gatewayMessage: 'error' in row ? row.error : null,
		routePresent: route !== undefined,
		routeModelCount: Array.isArray(route?.models) ? (route.models as unknown[]).length : 0,
	};
}

export async function storeKey(ctx: HostContext, cfg: PluginConfig, value: unknown): Promise<{ ok: true; credentialRef: string } | { error: string }> {
	if (typeof value !== 'string' || value.trim() === '' || value.length > 512) {
		return { error: 'a gateway key is a non-empty string of at most 512 characters' };
	}
	await ctx.credentials.set(cfg.credentialRef, value.trim());
	return { ok: true, credentialRef: cfg.credentialRef };
}

/** Validate settings-page config edits onto this plugin's own row. */
export function normalizeConfigPatch(body: Record<string, unknown>): { updates: Partial<Record<string, unknown>> } | { error: string } {
	const updates: Record<string, unknown> = {};
	if (body.gatewayUrl !== undefined) {
		if (typeof body.gatewayUrl !== 'string') return { error: 'gatewayUrl must be a string' };
		let parsed: URL;
		try {
			parsed = new URL(body.gatewayUrl);
		} catch {
			return { error: 'gatewayUrl must be an absolute http(s) URL' };
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'gatewayUrl must be http(s)' };
		updates.gatewayUrl = body.gatewayUrl.replace(/\/+$/, '');
	}
	if (body.routeName !== undefined) {
		if (typeof body.routeName !== 'string' || !/^[a-z][a-z0-9-]*$/.test(body.routeName)) {
			return { error: 'routeName must be a lowercase hyphenated identifier' };
		}
		updates.routeName = body.routeName;
	}
	if (body.credentialRef !== undefined) {
		if (typeof body.credentialRef !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(body.credentialRef)) {
			return { error: 'credentialRef must be an UPPER_CASE name' };
		}
		updates.credentialRef = body.credentialRef;
	}
	if (body.displayName !== undefined) {
		if (typeof body.displayName !== 'string' || body.displayName.trim() === '' || body.displayName.length > 64) {
			return { error: 'displayName must be a non-empty string of at most 64 characters' };
		}
		updates.displayName = body.displayName.trim();
	}
	if (body.api !== undefined) {
		if (typeof body.api !== 'string' || !APIS.has(body.api)) {
			return { error: 'api must be one of openai-completions, openai-responses, anthropic-messages' };
		}
		updates.api = body.api;
	}
	if (body.exclude !== undefined) {
		if (
			!Array.isArray(body.exclude) ||
			body.exclude.some((id) => typeof id !== 'string' || id === '' || id.length > 256) ||
			body.exclude.length > 512
		) {
			return { error: 'exclude must be a list of model ids (at most 512)' };
		}
		updates.exclude = [...new Set(body.exclude as string[])];
	}
	return { updates };
}

export async function updateConfig(ctx: HostContext, body: Record<string, unknown>): Promise<{ ok: true; applied: Record<string, unknown> } | { error: string }> {
	const check = normalizeConfigPatch(body ?? {});
	if ('error' in check) return { error: check.error };
	if (Object.keys(check.updates).length === 0) return { error: 'no config fields to update' };
	const entryId = (entry: LoaderEntry) => entry?.options?.id ?? entry?.id;
	const entry = ctx.configEditor.entries().find((candidate) => entryId(candidate) === PLUGIN_ID);
	if (!entry) return { error: `the "${PLUGIN_ID}" row is not editable in this profile` };
	await ctx.configEditor.edit(entry, (current, inherited) => ({
		...inherited,
		...current,
		...check.updates,
	}));
	return { ok: true, applied: check.updates };
}

interface RegisteredRoute {
	kind: 'prefix';
	path: string;
	handler: (req: IncomingLike, res: ResponseLike) => Promise<void> | void;
}

/** The apply() export: one effect for the same-origin HTTP surface. */
export function apply(ctx: HostContext, config: Record<string, unknown> | undefined): void {
	const json = (res: ResponseLike, status: number, body: unknown): void => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	};
	const readBody = (req: IncomingLike): Promise<Record<string, unknown>> =>
		new Promise((resolve, reject) => {
			let data = '';
			req.on('data', (chunk?: unknown) => {
				data += typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? new TextDecoder().decode(chunk) : '';
				if (data.length > 1 << 16) {
					reject(new Error('payload too large'));
				}
			});
			req.on('end', () => {
				if (data === '') return resolve({});
				try {
					resolve(JSON.parse(data) as Record<string, unknown>);
				} catch {
					reject(new Error('invalid JSON body'));
				}
			});
		});

	const handler = async (req: IncomingLike, res: ResponseLike): Promise<void> => {
		const path = new URL(req.url ?? '/', 'http://localhost').pathname;
		const action = path === ROUTE_PREFIX ? '' : path.slice(ROUTE_PREFIX.length);
		// Browser-origin guard: a cross-origin page must not drive writes.
		const origin = req.headers.origin;
		if (origin && !String(origin).includes(String(req.headers.host ?? ''))) {
			json(res, 403, { error: 'cross-origin requests are refused' });
			return;
		}
		try {
			if (req.method === 'GET' && (action === '' || action === '/state')) {
				json(res, 200, await readState(ctx, readConfig(config)));
				return;
			}
			if (req.method === 'POST' && action === '/plan') {
				const body = await readBody(req);
				const base = readConfig(config);
				const check = normalizeConfigPatch(body);
				if (!('error' in check)) Object.assign(base, check.updates);
				json(res, 200, await planSync(ctx, base));
				return;
			}
			if (req.method === 'POST' && action === '/apply') {
				json(res, 200, await applySync(ctx, readConfig(config)));
				return;
			}
			if (req.method === 'POST' && action === '/key') {
				const body = await readBody(req);
				json(res, 200, await storeKey(ctx, readConfig(config), body.value));
				return;
			}
			if (req.method === 'POST' && action === '/config') {
				const body = await readBody(req);
				json(res, 200, await updateConfig(ctx, body));
				return;
			}
			if (req.method === 'POST' && action === '/remove') {
				json(res, 200, await removeSync(ctx, readConfig(config)));
				return;
			}
			json(res, 404, { error: `no such action: ${req.method} ${action || '/'}` });
		} catch (error) {
			json(res, 500, { error: error instanceof Error ? error.message : String(error) });
		}
	};

	ctx.effect(
		() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler } satisfies RegisteredRoute),
		'dsh-x-magpie/routes',
	);
}
