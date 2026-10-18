// src/shared.ts
var ROUTE_MODALITIES = ["text", "image"];
var REASONING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var DEFAULTS = {
  gatewayUrl: "http://127.0.0.1:3425",
  routeName: "magpie",
  displayName: "Magpie (from dsh-x-magpie)",
  credentialRef: "MAGPIE_GATEWAY_KEY",
  api: "openai-responses",
  modelOverrides: {},
  exclude: []
};
var PLUGIN_ID = "dsh-x-magpie";
var ROUTE_PREFIX = `/${PLUGIN_ID}`;

// src/identity.ts
var name = "dsh-x-magpie";

// src/index.ts
var inject = ["webServer", "configEditor", "credentials"];
var LLM_PI_AI_ID = "llm-pi-ai";
var APIS = /* @__PURE__ */ new Set(["openai-completions", "openai-responses", "anthropic-messages"]);
function plain(value) {
  return value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value;
}
function readConfig(config) {
  const raw = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const value = plain(config?.[key]);
    if (value !== void 0 && value !== null && value !== "") raw[key] = value;
  }
  const overrides = raw.modelOverrides;
  return {
    gatewayUrl: String(raw.gatewayUrl).replace(/\/+$/, ""),
    routeName: String(raw.routeName),
    displayName: String(raw.displayName),
    credentialRef: String(credentialRefOf(raw)),
    api: raw.api,
    modelOverrides: overrides !== null && typeof overrides === "object" ? overrides : {},
    exclude: Array.isArray(raw.exclude) ? [...new Set(raw.exclude.filter((id) => typeof id === "string"))] : []
  };
}
function credentialRefOf(raw) {
  return raw.credentialRef;
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
function effortsOf(row) {
  if (row.reasoning === false) return false;
  const levels = row.supported_reasoning_levels;
  if (!Array.isArray(levels) || levels.length === 0) return void 0;
  const map = {};
  for (const entry of levels) {
    const effort = entry && typeof entry === "object" ? entry.effort : entry;
    if (typeof effort !== "string" || effort === "") continue;
    const level = effort === "none" ? "off" : effort;
    if (REASONING_LEVELS.includes(level)) map[level] = effort;
  }
  return Object.keys(map).length > 0 ? map : void 0;
}
function inputOf(row) {
  const modalities = row.modalities?.input;
  if (!Array.isArray(modalities)) return void 0;
  const filtered = [...new Set(modalities)].filter((m) => typeof m === "string" && ROUTE_MODALITIES.includes(m));
  return filtered.length > 0 ? filtered : void 0;
}
function mapModel(row, overrides) {
  if (!row || typeof row.id !== "string" || row.id === "") return void 0;
  const ov = overrides[row.id];
  const ovRecord = ov !== null && typeof ov === "object" ? ov : {};
  const model = { id: row.id };
  const name2 = ovRecord.name !== void 0 ? ovRecord.name : row.id;
  if (typeof name2 === "string" && name2 !== "") model.name = name2;
  const contextWindow = ovRecord.contextWindow !== void 0 ? num(ovRecord.contextWindow) : num(row.context_window ?? row.context_length);
  if (contextWindow > 0) model.contextWindow = contextWindow;
  const maxTokens = ovRecord.maxTokens !== void 0 ? num(ovRecord.maxTokens) : num(row.max_output_tokens);
  if (maxTokens > 0) model.maxTokens = maxTokens;
  if (ovRecord.input !== void 0) {
    if (ovRecord.input !== null) model.input = ovRecord.input;
  } else {
    const input = inputOf(row);
    if (input) model.input = input;
  }
  if (ovRecord.reasoningEfforts !== void 0) {
    if (ovRecord.reasoningEfforts !== null) model.reasoningEfforts = ovRecord.reasoningEfforts;
  } else {
    const efforts = effortsOf(row);
    if (efforts !== void 0) model.reasoningEfforts = efforts;
  }
  return model;
}
async function gatewayKey(ctx, credentialRef) {
  try {
    const resolved = await ctx.credentials.resolve(credentialRef);
    return typeof resolved?.value === "string" && resolved.value !== "" ? resolved.value : "";
  } catch {
    return "";
  }
}
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
    response = await fetch(url, { headers, signal: AbortSignal.timeout(1e4) });
  } catch (error) {
    return { error: `gateway unreachable at ${url} (${error instanceof Error ? error.message : String(error)}); is magpie running?` };
  }
  if (response.status === 401 || response.status === 403) {
    return { error: `gateway refused the request (${response.status}); store the gateway key on this page first` };
  }
  if (!response.ok) return { error: `gateway answered ${response.status} for ${url}` };
  let body;
  try {
    body = await response.json();
  } catch {
    return { error: "gateway returned a non-JSON model list" };
  }
  const data = body?.data;
  const models = body?.models;
  const rows = Array.isArray(data) ? data : Array.isArray(models) ? models : [];
  return { rows };
}
function candidateRoute(cfg, models) {
  return {
    displayName: cfg.displayName,
    api: cfg.api,
    // magpie speaks Messages at the gateway root and OpenAI dialects under /v1.
    baseURL: cfg.api === "anthropic-messages" ? cfg.gatewayUrl : `${cfg.gatewayUrl}/v1`,
    apiKeyEnv: cfg.credentialRef,
    models
  };
}
function llmPiAi(ctx) {
  const entryId = (entry2) => entry2?.options?.id ?? entry2?.id;
  const entry = ctx.configEditor.entries().find((candidate) => entryId(candidate) === LLM_PI_AI_ID);
  if (!entry) return { error: `no "${LLM_PI_AI_ID}" row in this profile; mount it before syncing` };
  const item = ctx.configEditor.configuration().find((candidate) => entryId(candidate.entry) === LLM_PI_AI_ID);
  const inherited = item?.inherited ?? {};
  const override = item?.override ?? {};
  const inheritedProviders = inherited.providers;
  const overrideProviders = override.providers;
  const providers = {
    ...inheritedProviders !== null && typeof inheritedProviders === "object" ? inheritedProviders : {},
    ...overrideProviders !== null && typeof overrideProviders === "object" ? overrideProviders : {}
  };
  return { entry, providers };
}
function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function diffRoute(current, candidate) {
  const cur = current ?? {};
  const out = { route: [], added: [], removed: [], changed: [], unchanged: 0 };
  for (const field of ["displayName", "api", "baseURL", "apiKeyEnv"]) {
    if (!sameValue(cur[field], candidate[field])) {
      out.route.push({ field, from: cur[field] ?? null, to: candidate[field] });
    }
  }
  const currentModels = new Map(
    (Array.isArray(cur.models) ? cur.models : []).map((m) => [String(m.id), m])
  );
  const candidateModels = new Map(candidate.models.map((m) => [m.id, m]));
  for (const [id, model] of candidateModels) {
    const before = currentModels.get(id);
    if (!before) {
      out.added.push(id);
      continue;
    }
    const fields = [];
    for (const field of ["name", "contextWindow", "maxTokens", "input", "reasoningEfforts"]) {
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
function collect(ctx, cfg) {
  return fetchModels(ctx, cfg).then((fetched) => {
    if ("error" in fetched) return fetched;
    const seen = /* @__PURE__ */ new Set();
    const all = [];
    for (const raw of fetched.rows) {
      const model = mapModel(raw, cfg.modelOverrides);
      if (!model || seen.has(model.id)) continue;
      seen.add(model.id);
      all.push(model);
    }
    if (all.length === 0) return { error: "the gateway listed no usable models" };
    return { all };
  });
}
async function planSync(ctx, cfg) {
  const row = llmPiAi(ctx);
  if ("error" in row) return { error: row.error };
  const built = await collect(ctx, cfg);
  if ("error" in built) return { error: built.error };
  const selected = built.all.filter((model) => !cfg.exclude.includes(model.id));
  const candidate = candidateRoute(cfg, selected);
  const current = row.providers[cfg.routeName];
  return {
    gatewayUrl: cfg.gatewayUrl,
    routeName: cfg.routeName,
    routePresent: current !== void 0,
    modelCount: selected.length,
    models: built.all.map((m) => ({ id: m.id, contextWindow: m.contextWindow, maxTokens: m.maxTokens })),
    diff: diffRoute(current, candidate),
    ...selected.length === 0 ? { warning: "no models selected; applying would empty the route" } : {}
  };
}
async function applySync(ctx, cfg) {
  const row = llmPiAi(ctx);
  if ("error" in row) return { error: row.error };
  const built = await collect(ctx, cfg);
  if ("error" in built) return { error: built.error };
  const selected = built.all.filter((model) => !cfg.exclude.includes(model.id));
  if (selected.length === 0) {
    return { error: "no models selected; refusing to write an empty route" };
  }
  const candidate = candidateRoute(cfg, selected);
  const before = row.providers[cfg.routeName];
  const diff = diffRoute(before, candidate);
  await ctx.configEditor.edit(row.entry, (current, inherited) => {
    const providers = { ...inherited.providers ?? {}, ...current.providers ?? {} };
    providers[cfg.routeName] = candidate;
    return { ...inherited, ...current, providers };
  });
  return { ok: true, routeName: cfg.routeName, written: selected.length, diff };
}
async function removeSync(ctx, cfg) {
  const row = llmPiAi(ctx);
  if ("error" in row) return { error: row.error };
  const present = row.providers[cfg.routeName] !== void 0;
  if (!present) return { ok: true, removed: false };
  await ctx.configEditor.edit(row.entry, (current, inherited) => {
    const providers = { ...inherited.providers ?? {}, ...current.providers ?? {} };
    delete providers[cfg.routeName];
    return { ...inherited, ...current, providers };
  });
  return { ok: true, removed: true };
}
async function readState(ctx, cfg) {
  const row = llmPiAi(ctx);
  const providers = "providers" in row ? row.providers : {};
  const route = providers[cfg.routeName];
  let hasCredential = false;
  try {
    hasCredential = await gatewayKey(ctx, cfg.credentialRef) !== "";
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
    gatewayMounted: !("error" in row),
    gatewayMessage: "error" in row ? row.error : null,
    routePresent: route !== void 0,
    routeModelCount: Array.isArray(route?.models) ? route.models.length : 0
  };
}
async function storeKey(ctx, cfg, value) {
  if (typeof value !== "string" || value.trim() === "" || value.length > 512) {
    return { error: "a gateway key is a non-empty string of at most 512 characters" };
  }
  await ctx.credentials.set(cfg.credentialRef, value.trim());
  return { ok: true, credentialRef: cfg.credentialRef };
}
function normalizeConfigPatch(body) {
  const updates = {};
  if (body.gatewayUrl !== void 0) {
    if (typeof body.gatewayUrl !== "string") return { error: "gatewayUrl must be a string" };
    let parsed;
    try {
      parsed = new URL(body.gatewayUrl);
    } catch {
      return { error: "gatewayUrl must be an absolute http(s) URL" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { error: "gatewayUrl must be http(s)" };
    updates.gatewayUrl = body.gatewayUrl.replace(/\/+$/, "");
  }
  if (body.routeName !== void 0) {
    if (typeof body.routeName !== "string" || !/^[a-z][a-z0-9-]*$/.test(body.routeName)) {
      return { error: "routeName must be a lowercase hyphenated identifier" };
    }
    updates.routeName = body.routeName;
  }
  if (body.credentialRef !== void 0) {
    if (typeof body.credentialRef !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(body.credentialRef)) {
      return { error: "credentialRef must be an UPPER_CASE name" };
    }
    updates.credentialRef = body.credentialRef;
  }
  if (body.displayName !== void 0) {
    if (typeof body.displayName !== "string" || body.displayName.trim() === "" || body.displayName.length > 64) {
      return { error: "displayName must be a non-empty string of at most 64 characters" };
    }
    updates.displayName = body.displayName.trim();
  }
  if (body.api !== void 0) {
    if (typeof body.api !== "string" || !APIS.has(body.api)) {
      return { error: "api must be one of openai-completions, openai-responses, anthropic-messages" };
    }
    updates.api = body.api;
  }
  if (body.exclude !== void 0) {
    if (!Array.isArray(body.exclude) || body.exclude.some((id) => typeof id !== "string" || id === "" || id.length > 256) || body.exclude.length > 512) {
      return { error: "exclude must be a list of model ids (at most 512)" };
    }
    updates.exclude = [...new Set(body.exclude)];
  }
  return { updates };
}
async function updateConfig(ctx, body) {
  const check = normalizeConfigPatch(body ?? {});
  if ("error" in check) return { error: check.error };
  if (Object.keys(check.updates).length === 0) return { error: "no config fields to update" };
  const entryId = (entry2) => entry2?.options?.id ?? entry2?.id;
  const entry = ctx.configEditor.entries().find((candidate) => entryId(candidate) === PLUGIN_ID);
  if (!entry) return { error: `the "${PLUGIN_ID}" row is not editable in this profile` };
  await ctx.configEditor.edit(entry, (current, inherited) => ({
    ...inherited,
    ...current,
    ...check.updates
  }));
  return { ok: true, applied: check.updates };
}
function apply(ctx, config) {
  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) => new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += typeof chunk === "string" ? chunk : chunk instanceof Uint8Array ? new TextDecoder().decode(chunk) : "";
      if (data.length > 1 << 16) {
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      if (data === "") return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
  });
  const handler = async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const action = path === ROUTE_PREFIX ? "" : path.slice(ROUTE_PREFIX.length);
    const origin = req.headers.origin;
    if (origin && !String(origin).includes(String(req.headers.host ?? ""))) {
      json(res, 403, { error: "cross-origin requests are refused" });
      return;
    }
    try {
      if (req.method === "GET" && (action === "" || action === "/state")) {
        json(res, 200, await readState(ctx, readConfig(config)));
        return;
      }
      if (req.method === "POST" && action === "/plan") {
        const body = await readBody(req);
        const base = readConfig(config);
        const check = normalizeConfigPatch(body);
        if (!("error" in check)) Object.assign(base, check.updates);
        json(res, 200, await planSync(ctx, base));
        return;
      }
      if (req.method === "POST" && action === "/apply") {
        json(res, 200, await applySync(ctx, readConfig(config)));
        return;
      }
      if (req.method === "POST" && action === "/key") {
        const body = await readBody(req);
        json(res, 200, await storeKey(ctx, readConfig(config), body.value));
        return;
      }
      if (req.method === "POST" && action === "/config") {
        const body = await readBody(req);
        json(res, 200, await updateConfig(ctx, body));
        return;
      }
      if (req.method === "POST" && action === "/remove") {
        json(res, 200, await removeSync(ctx, readConfig(config)));
        return;
      }
      json(res, 404, { error: `no such action: ${req.method} ${action || "/"}` });
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  };
  ctx.effect(
    () => ctx.webServer.register({ kind: "prefix", path: ROUTE_PREFIX, handler }),
    "dsh-x-magpie/routes"
  );
}
export {
  apply,
  applySync,
  diffRoute,
  inject,
  mapModel,
  name,
  normalizeConfigPatch,
  planSync,
  readConfig,
  readState,
  removeSync,
  storeKey,
  updateConfig
};
