// Host half of dsh-magpie-sync.
//
// Pulls `GET {gatewayUrl}/v1/models` from a running magpie gateway, maps every
// row onto a `llm-pi-ai` provider-route entry (id, name, contextWindow,
// maxTokens, input modalities, reasoningEfforts), and writes that route into
// the profile's llm-pi-ai config through the configEditor — the same Loader
// path dsh's own Models page uses. Nothing is written without a plan/apply
// round trip: `plan` never writes, `apply` re-derives the candidate inside the
// edit callback so a concurrent edit between plan and apply cannot be clobbered
// blindly.
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
// Defaults live in `readConfig` and in the shipped patch.

export const name = 'magpie-sync';

export const inject = ['webServer', 'configEditor', 'credentials', 'tools'];

const DEFAULTS = {
	gatewayUrl: 'http://127.0.0.1:3425',
	routeName: 'magpie',
	credentialRef: 'MAGPIE_GATEWAY_KEY',
	api: 'openai-completions',
	modelOverrides: {},
};

const ROUTE_PREFIX = '/dsh-magpie-sync';
const LLM_PI_AI_ID = 'llm-pi-ai';

/** pi-ai reasoning level vocabulary; anything else the gateway reports is dropped. */
const LEVELS = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const MODALITIES = new Set(['text', 'image', 'audio', 'video', 'pdf']);

/** Volatile config fields arrive as lazily-resolved wrappers in built plugins. */
function plain(value) {
	return value && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value;
}

function readConfig(config) {
	const raw = { ...DEFAULTS };
	for (const key of Object.keys(DEFAULTS)) {
		const value = plain(config?.[key]);
		if (value !== undefined && value !== null && value !== '') raw[key] = value;
	}
	return {
		...raw,
		gatewayUrl: String(raw.gatewayUrl).replace(/\/+$/, ''),
		modelOverrides: raw.modelOverrides && typeof raw.modelOverrides === 'object' ? raw.modelOverrides : {},
	};
}

function num(value) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Reasoning levels of one gateway row: `false` for a declared non-reasoner,
 * undefined when the gateway says nothing, else a `{level: wireEffort}` map. */
function effortsOf(row) {
	if (row.reasoning === false) return false;
	const levels = row.supported_reasoning_levels;
	if (!Array.isArray(levels) || levels.length === 0) return undefined;
	const map = {};
	for (const entry of levels) {
		const effort = entry && typeof entry === 'object' ? entry.effort : entry;
		if (typeof effort !== 'string' || effort === '') continue;
		const level = effort === 'none' ? 'off' : effort;
		if (LEVELS.has(level)) map[level] = effort;
	}
	return Object.keys(map).length > 0 ? map : undefined;
}

function inputOf(row) {
	const modalities = row?.modalities?.input;
	if (!Array.isArray(modalities)) return undefined;
	const filtered = [...new Set(modalities)].filter((m) => MODALITIES.has(m));
	return filtered.length > 0 ? filtered : undefined;
}

/** One gateway row onto one llm-pi-ai model entry. `null` overrides drop fields. */
function mapModel(row, overrides) {
	if (!row || typeof row.id !== 'string' || row.id === '') return undefined;
	const ov = overrides[row.id] && typeof overrides[row.id] === 'object' ? overrides[row.id] : {};
	const model = { id: row.id };

	const name = ov.name !== undefined ? ov.name : (row.display_name ?? row.name);
	if (typeof name === 'string' && name !== '') model.name = name;

	const contextWindow = ov.contextWindow !== undefined ? ov.contextWindow : num(row.context_window ?? row.context_length);
	if (contextWindow !== null && num(contextWindow) > 0) model.contextWindow = num(contextWindow);

	const maxTokens = ov.maxTokens !== undefined ? ov.maxTokens : num(row.max_output_tokens);
	if (maxTokens !== null && num(maxTokens) > 0) model.maxTokens = num(maxTokens);

	if (ov.input !== undefined) {
		if (ov.input !== null) model.input = ov.input;
	} else {
		const input = inputOf(row);
		if (input) model.input = input;
	}

	if (ov.reasoningEfforts !== undefined) {
		if (ov.reasoningEfforts !== null) model.reasoningEfforts = ov.reasoningEfforts;
	} else {
		const efforts = effortsOf(row);
		if (efforts !== undefined) model.reasoningEfforts = efforts;
	}
	return model;
}

async function gatewayKey(ctx, credentialRef) {
	try {
		const resolved = await ctx.credentials.resolve(credentialRef);
		return typeof resolved?.value === 'string' && resolved.value !== '' ? resolved.value : '';
	} catch {
		return '';
	}
}

/** Fetch and normalize the gateway's model rows. */
async function fetchModels(ctx, cfg) {
	let url;
	try {
		url = new URL(`${cfg.gatewayUrl}/v1/models`);
	} catch {
		return { error: `invalid gatewayUrl: ${cfg.gatewayUrl}` };
	}
	const key = await gatewayKey(ctx, cfg.credentialRef);
	const headers = {};
	if (key) headers.authorization = `Bearer ${key}`;
	let response;
	try {
		response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
	} catch (error) {
		return { error: `gateway unreachable at ${url} (${error?.message ?? error}); is magpie running?` };
	}
	if (response.status === 401 || response.status === 403) {
		return { error: `gateway refused the request (${response.status}); store the gateway key on this page first` };
	}
	if (!response.ok) return { error: `gateway answered ${response.status} for ${url}` };
	let body;
	try {
		body = await response.json();
	} catch {
		return { error: 'gateway returned a non-JSON model list' };
	}
	const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
	return { rows };
}

function candidateRoute(cfg, models) {
	return {
		displayName: 'Magpie',
		api: cfg.api,
		baseURL: `${cfg.gatewayUrl}/v1`,
		apiKeyEnv: cfg.credentialRef,
		models,
	};
}

/** Current llm-pi-ai entry plus its effective providers map, or an error marker. */
function llmPiAi(ctx) {
	const entry = ctx.configEditor.entries().find((candidate) => candidate.id === LLM_PI_AI_ID);
	if (!entry) return { error: `no "${LLM_PI_AI_ID}" row in this profile; mount it before syncing` };
	const item = ctx.configEditor.configuration().find((candidate) => candidate.entry.id === LLM_PI_AI_ID);
	const inherited = item?.inherited ?? {};
	const override = item?.override ?? {};
	const providers = { ...(inherited.providers ?? {}), ...(override.providers ?? {}) };
	return { entry, inherited, override, providers };
}

function sameValue(a, b) {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Field-level diff of the route this plugin manages. Other routes never appear. */
function diffRoute(current, candidate) {
	const out = { route: [], added: [], removed: [], changed: [], unchanged: 0 };
	for (const field of ['displayName', 'api', 'baseURL', 'apiKeyEnv']) {
		if (!sameValue(current?.[field], candidate[field])) {
			out.route.push({ field, from: current?.[field] ?? null, to: candidate[field] });
		}
	}
	const currentModels = new Map((Array.isArray(current?.models) ? current.models : []).map((m) => [m.id, m]));
	const candidateModels = new Map(candidate.models.map((m) => [m.id, m]));
	for (const [id, model] of candidateModels) {
		const before = currentModels.get(id);
		if (!before) {
			out.added.push(id);
			continue;
		}
		const fields = [];
		for (const field of ['name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts']) {
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

async function planSync(ctx, cfg) {
	const row = llmPiAi(ctx);
	if (row.error) return { error: row.error };
	const fetched = await fetchModels(ctx, cfg);
	if (fetched.error) return fetched;
	const seen = new Set();
	const models = [];
	for (const raw of fetched.rows) {
		const model = mapModel(raw, cfg.modelOverrides);
		if (!model || seen.has(model.id)) continue;
		seen.add(model.id);
		models.push(model);
	}
	if (models.length === 0) {
		return { error: 'the gateway listed no usable models; refusing to plan an empty route' };
	}
	const candidate = candidateRoute(cfg, models);
	const current = row.providers[cfg.routeName];
	return {
		gatewayUrl: cfg.gatewayUrl,
		routeName: cfg.routeName,
		routePresent: current !== undefined,
		modelCount: models.length,
		diff: diffRoute(current, candidate),
	};
}

async function applySync(ctx, cfg) {
	const row = llmPiAi(ctx);
	if (row.error) return { error: row.error };
	const fetched = await fetchModels(ctx, cfg);
	if (fetched.error) return fetched;
	const seen = new Set();
	const models = [];
	for (const raw of fetched.rows) {
		const model = mapModel(raw, cfg.modelOverrides);
		if (!model || seen.has(model.id)) continue;
		seen.add(model.id);
		models.push(model);
	}
	if (models.length === 0) {
		return { error: 'the gateway listed no usable models; refusing to write an empty route' };
	}
	const candidate = candidateRoute(cfg, models);
	const before = row.providers[cfg.routeName];
	const diff = diffRoute(before, candidate);
	await ctx.configEditor.edit(row.entry, (current, inherited) => {
		const providers = { ...(inherited?.providers ?? {}), ...(current?.providers ?? {}) };
		providers[cfg.routeName] = candidate;
		return { ...(inherited ?? {}), ...(current ?? {}), providers };
	});
	return { ok: true, routeName: cfg.routeName, written: models.length, diff };
}

/** Remove the route this plugin owns. Other routes are never touched. */
async function removeSync(ctx, cfg) {
	const row = llmPiAi(ctx);
	if (row.error) return { error: row.error };
	const present = row.providers[cfg.routeName] !== undefined;
	if (!present) return { ok: true, removed: false };
	await ctx.configEditor.edit(row.entry, (current, inherited) => {
		const providers = { ...(inherited?.providers ?? {}), ...(current?.providers ?? {}) };
		delete providers[cfg.routeName];
		return { ...(inherited ?? {}), ...(current ?? {}), providers };
	});
	return { ok: true, removed: true };
}

async function readState(ctx, cfg) {
	const row = llmPiAi(ctx);
	const route = row.providers ? row.providers[cfg.routeName] : undefined;
	let hasCredential = false;
	try {
		hasCredential = (await gatewayKey(ctx, cfg.credentialRef)) !== '';
	} catch {}
	return {
		gatewayUrl: cfg.gatewayUrl,
		routeName: cfg.routeName,
		credentialRef: cfg.credentialRef,
		api: cfg.api,
		hasCredential,
		gatewayMounted: row.error ? false : true,
		gatewayMessage: row.error ?? null,
		routePresent: route !== undefined,
		routeModelCount: Array.isArray(route?.models) ? route.models.length : 0,
	};
}

async function storeKey(ctx, cfg, value) {
	if (typeof value !== 'string' || value.trim() === '' || value.length > 512) {
		return { error: 'a gateway key is a non-empty string of at most 512 characters' };
	}
	await ctx.credentials.set(cfg.credentialRef, value.trim());
	return { ok: true, credentialRef: cfg.credentialRef };
}

/** @returns {import('@deepseek-ai/cordis').Cleanup} */
export function apply(ctx, config) {
	const json = (res, status, body) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	};
	const readBody = (req) =>
		new Promise((resolve, reject) => {
			let data = '';
			req.on('data', (chunk) => {
				data += chunk;
				if (data.length > 1 << 16) reject(new Error('payload too large'));
			});
			req.on('end', () => {
				if (data === '') return resolve({});
				try {
					resolve(JSON.parse(data));
				} catch {
					reject(new Error('invalid JSON body'));
				}
			});
			req.on('error', reject);
		});

	const handler = async (req, res) => {
		const path = new URL(req.url ?? '/', 'http://localhost').pathname;
		const action = path === ROUTE_PREFIX ? '' : path.slice(ROUTE_PREFIX.length);
		// Browser-origin guard: a cross-origin page must not drive writes.
		const origin = req.headers.origin;
		if (origin && !String(origin).includes(String(req.headers.host ?? ''))) {
			return json(res, 403, { error: 'cross-origin requests are refused' });
		}
		try {
			if (req.method === 'GET' && (action === '' || action === '/state')) {
				return json(res, 200, await readState(ctx, readConfig(config)));
			}
			if (req.method === 'POST' && action === '/plan') {
				return json(res, 200, await planSync(ctx, readConfig(config)));
			}
			if (req.method === 'POST' && action === '/apply') {
				return json(res, 200, await applySync(ctx, readConfig(config)));
			}
			if (req.method === 'POST' && action === '/key') {
				const body = await readBody(req);
				return json(res, 200, await storeKey(ctx, readConfig(config), body.value));
			}
			if (req.method === 'POST' && action === '/remove') {
				return json(res, 200, await removeSync(ctx, readConfig(config)));
			}
			return json(res, 404, { error: `no such action: ${req.method} ${action || '/'}` });
		} catch (error) {
			return json(res, 500, { error: error?.message ?? String(error) });
		}
	};

	ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler }), 'magpie-sync/routes');

	ctx.effect(
		() =>
			ctx.tools.register({
				name: 'magpie_sync',
				description:
					'Sync the model catalog of the configured magpie gateway into the llm-pi-ai provider route. ' +
					'action "plan" fetches the gateway and returns the field-level diff without writing; ' +
					'action "apply" re-derives it and writes the route through the config editor. ' +
					'Read-only plan first; apply only on an explicit user request.',
				parameters: {
					action: {
						type: 'string',
						required: true,
						enum: ['plan', 'apply'],
						description: '"plan" previews the diff; "apply" writes it into llm-pi-ai.',
					},
				},
				execute: async (args) => {
					const cfg = readConfig(config);
					if (args?.action === 'apply') return applySync(ctx, cfg);
					if (args?.action === 'plan') return planSync(ctx, cfg);
					return { error: 'action must be "plan" or "apply"' };
				},
			}),
		'magpie-sync/tool',
	);
}
