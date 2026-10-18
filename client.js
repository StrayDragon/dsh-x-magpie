window.__ModuleLoader__.load({
	id: '@straydragon/dsh-x-magpie',
	factory: (require) => {
	var __dshRequire = require;

  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client-core.ts
  var client_core_exports = {};
  __export(client_core_exports, {
    default: () => client_core_default
  });
  var React = typeof __dshRequire === "function" ? __dshRequire("react") : globalThis.__dshReact;
  var h = React.createElement;
  var { useState, useEffect, useCallback, useRef } = React;
  var STRINGS = {
    en: {
      title: "Magpie model sync",
      description: "Pull the model catalog of a running magpie gateway into one llm-pi-ai provider route. Edits and selection changes apply themselves; the last good route survives failures.",
      gateway: "Gateway",
      route: "DSH provider name",
      routeHint: "Lowercase letters, digits and hyphens.",
      displayName: "Display name",
      displayNameHint: "Provider name shown on dsh\u2019s Models page.",
      errDisplayName: "Display name must be 1\u201364 characters",
      credential: "Credential ref",
      credentialHint: "Reference name of the stored key \u2014 keep the default; the key itself goes below.",
      apiLabel: "Protocol",
      keyRow: "Gateway key",
      keyPlaceholder: "magpie gateway key",
      keySaved: "Key stored.",
      keyHint: "The key goes into dsh\u2019s credential store as a reference; config files never hold it.",
      advanced: "Advanced",
      refresh: "Pull catalog and sync now",
      syncing: "Syncing\u2026",
      pulling: "Pulling\u2026",
      syncedChanges: "Synced: +{added} / -{removed} / ~{changed}",
      selectTitle: "Models",
      selectHint: "Unchecked models are left out of the route; everything is selected by default.",
      searchPlaceholder: "Search models\u2026",
      noMatches: "No model matches the filter.",
      autoHint: "Edits and selection apply automatically; on failure the previous route is kept.",
      errGateway: "Gateway URL must be an absolute http(s) address",
      errRoute: "Route name must be lowercase letters, digits and hyphens",
      errCredential: "Credential ref must be UPPER_CASE letters, digits and underscores \u2014 keep the default",
      stateError: "Status unavailable",
      retry: "Retry"
    },
    zh: {
      title: "Magpie \u6A21\u578B\u540C\u6B65",
      description: "\u628A\u8FD0\u884C\u4E2D magpie \u7F51\u5173\u7684\u6A21\u578B\u76EE\u5F55\u62C9\u53D6\u4E3A\u4E00\u4E2A llm-pi-ai provider \u8DEF\u7531\u3002\u4FEE\u6539\u4E0E\u52FE\u9009\u81EA\u52A8\u5E94\u7528;\u51FA\u9519\u65F6\u4FDD\u7559\u4E0A\u4E00\u6B21\u7684\u8DEF\u7531\u3002",
      gateway: "\u7F51\u5173",
      route: "DSH \u4F9B\u5E94\u5546\u540D",
      routeHint: "\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E2D\u5212\u7EBF\u3002",
      displayName: "\u663E\u793A\u540D",
      displayNameHint: "\u663E\u793A\u5728 dsh \u6A21\u578B\u9875\u7684\u4F9B\u5E94\u5546\u540D\u79F0\u3002",
      errDisplayName: "\u663E\u793A\u540D\u9700\u8981 1\u201364 \u4E2A\u5B57\u7B26",
      credential: "\u51ED\u636E\u5F15\u7528\u540D",
      credentialHint: "\u5DF2\u5B58\u5BC6\u94A5\u7684\u5F15\u7528\u540D \u2014 \u4FDD\u6301\u9ED8\u8BA4\u5373\u53EF,\u5BC6\u94A5\u672C\u4F53\u586B\u5728\u4E0B\u65B9\u3002",
      apiLabel: "\u534F\u8BAE",
      keyRow: "\u7F51\u5173\u5BC6\u94A5",
      keyPlaceholder: "magpie \u7F51\u5173\u5BC6\u94A5",
      keySaved: "\u5BC6\u94A5\u5DF2\u5B58\u5165\u3002",
      keyHint: "\u5BC6\u94A5\u4EE5\u5F15\u7528\u5F62\u5F0F\u5B58\u5165 dsh \u51ED\u636E\u5B58\u50A8,\u914D\u7F6E\u6587\u4EF6\u4E2D\u4E0D\u4FDD\u5B58\u672C\u4F53\u3002",
      advanced: "\u9AD8\u7EA7",
      refresh: "\u62C9\u53D6\u76EE\u5F55\u5E76\u7ACB\u5373\u540C\u6B65",
      syncing: "\u540C\u6B65\u4E2D\u2026",
      pulling: "\u62C9\u53D6\u4E2D\u2026",
      syncedChanges: "\u5DF2\u540C\u6B65:\u65B0\u589E {added} / \u79FB\u9664 {removed} / \u53D8\u66F4 {changed}",
      selectTitle: "\u6A21\u578B\u9009\u62E9",
      selectHint: "\u53D6\u6D88\u52FE\u9009\u7684\u6A21\u578B\u4E0D\u4F1A\u5199\u5165\u8DEF\u7531;\u9ED8\u8BA4\u5168\u9009\u3002",
      searchPlaceholder: "\u641C\u7D22\u6A21\u578B\u2026",
      noMatches: "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B\u3002",
      autoHint: "\u914D\u7F6E\u4E0E\u52FE\u9009\u81EA\u52A8\u5E94\u7528;\u51FA\u9519\u65F6\u4FDD\u7559\u4E0A\u4E00\u6B21\u914D\u7F6E\u3002",
      errGateway: "\u7F51\u5173\u5730\u5740\u5FC5\u987B\u662F\u5B8C\u6574\u7684 http(s) \u5730\u5740",
      errRoute: "\u8DEF\u7531\u540D\u53EA\u80FD\u5305\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E2D\u5212\u7EBF",
      errCredential: "\u51ED\u636E\u5F15\u7528\u540D\u53EA\u80FD\u662F\u5927\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF \u2014 \u4FDD\u6301\u9ED8\u8BA4\u5373\u53EF",
      stateError: "\u72B6\u6001\u4E0D\u53EF\u7528",
      retry: "\u91CD\u8BD5"
    }
  };
  function translator() {
    const lang = typeof navigator !== "undefined" && navigator.language || "en";
    const table = STRINGS[lang.toLowerCase().startsWith("zh") ? "zh" : "en"];
    return (key, vars) => {
      const en = STRINGS.en;
      const active = table;
      let text = active[key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    };
  }
  async function call(path, body) {
    const options = body === void 0 ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    const response = await fetch(`/dsh-x-magpie${path}`, options);
    const data = await response.json().catch(() => ({}));
    const message = typeof data.error === "string" ? data.error : `${response.status} ${response.statusText}`;
    if (!response.ok || data.error !== void 0) {
      throw new Error(message);
    }
    return data;
  }
  function shortTokens(value) {
    if (typeof value !== "number" || value <= 0) return null;
    return value >= 1e3 ? `${Math.round(value / 1e3)}k` : String(value);
  }
  var STYLE = `
.dms { display: flex; flex-direction: column; gap: 16px; max-width: 760px; padding: 20px 24px 48px;
  color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.5; }
.dms h2 { margin: 0; font-size: 16px; font-weight: 600; }
.dms-desc { margin: 0; color: var(--dsw-alias-label-secondary); }
.dms-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.dms-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dms-k { color: var(--dsw-alias-label-secondary); min-width: 110px; flex-shrink: 0; }
.dms-note { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dms-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.dms-dot.ok { background: var(--dsw-alias-state-success-primary); }
.dms-dot.miss { background: var(--dsw-alias-state-warn-primary); }
.dms-iconbtn { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center;
  justify-content: center; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); cursor: pointer; font-size: 15px; line-height: 1; flex-shrink: 0; }
.dms-iconbtn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.dms-iconbtn:disabled { opacity: 0.5; cursor: default; }
.dms-iconbtn.spin { animation: dms-spin 0.9s linear infinite; }
@keyframes dms-spin { to { transform: rotate(360deg); } }
.dms-input { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; padding: 5px 9px; color: var(--dsw-alias-label-primary);
  font-size: 12.5px; font-family: ui-monospace, monospace; }
.dms-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dms-input.grow { flex: 1 1 240px; min-width: 200px; }
select.dms-input { font-family: inherit; }
.dms-advanced { border: 1px dashed var(--dsw-alias-border-l1); border-radius: 8px;
  padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.dms-advanced summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dms-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dms-warn { color: var(--dsw-alias-state-warn-primary); }
.dms-ok { color: var(--dsw-alias-state-success-primary); font-size: 12px; }
.dms-error { border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 8px;
  padding: 8px 12px; color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; font-size: 12px; }
.dms-models { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 8px;
  background: var(--dsw-alias-bg-layer-2); }
.dms-model { display: flex; align-items: center; gap: 8px; padding: 2px 4px; border-radius: 6px; }
.dms-model:hover { background: var(--dsw-alias-bg-layer-1); }
.dms-model label { display: flex; align-items: center; gap: 8px; cursor: pointer; min-width: 0; flex: 1; }
.dms-model .id { font-family: ui-monospace, monospace; font-size: 12px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.dms-model .cap { color: var(--dsw-alias-label-secondary); font-size: 11px;
  font-family: ui-monospace, monospace; flex-shrink: 0; }
.dms-search { width: 100%; margin: 2px 0 4px; }
.dms-models input[type='checkbox'] { width: 14px; height: 14px; margin: 0;
  accent-color: var(--dsw-alias-brand-primary); flex-shrink: 0; }
.dms-group { font-size: 11px; font-weight: 600; color: var(--dsw-alias-label-secondary);
  text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 4px 2px;
  border-top: 1px solid var(--dsw-alias-border-l1); margin-top: 4px;
  display: flex; justify-content: space-between; gap: 8px; }
.dms-group:first-child { border-top: none; margin-top: 0; }
.dms-empty { color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 8px 4px; }
`;
  function Dot({ on }) {
    return h("span", { className: `dms-dot ${on ? "ok" : "miss"}`, "aria-hidden": true });
  }
  function fuzzyMatch(query, text) {
    if (!query) return true;
    const haystack = text.toLowerCase();
    let at = 0;
    for (const ch of query.toLowerCase()) {
      at = haystack.indexOf(ch, at);
      if (at === -1) return false;
      at += 1;
    }
    return true;
  }
  function groupModels(models, query) {
    const filtered = models.filter((model) => fuzzyMatch(query, model.id));
    const groups = /* @__PURE__ */ new Map();
    for (const model of filtered) {
      const group = model.provider || model.id.split("/")[0] || "other";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(model);
    }
    const names = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    return { filtered, names, groups };
  }
  function MagpieSyncSection() {
    const t = translator();
    const [state, setState] = useState(null);
    const [stateError, setStateError] = useState(null);
    const [catalog, setCatalog] = useState(null);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [keyValue, setKeyValue] = useState("");
    const [query, setQuery] = useState("");
    const [form, setForm] = useState(null);
    const [form0, setForm0] = useState(null);
    const formRef = useRef(null);
    formRef.current = form;
    const form0Ref = useRef(null);
    form0Ref.current = form0;
    const syncTimer = useRef(null);
    const keyTimer = useRef(null);
    const syncRunning = useRef(false);
    const rerunAfter = useRef(false);
    const fullSyncRef = useRef(() => {
    });
    const pullRef = useRef(() => {
    });
    const refreshState = useCallback(async (resyncForm) => {
      try {
        setStateError(null);
        const next = await call("/state");
        setState(next);
        const snapshot = {
          gatewayUrl: String(next.gatewayUrl),
          routeName: String(next.routeName),
          displayName: String(next.displayName),
          credentialRef: String(next.credentialRef),
          api: String(next.api),
          exclude: Array.isArray(next.exclude) ? next.exclude : []
        };
        setForm((prev) => resyncForm || prev === null ? snapshot : prev);
        setForm0((prev) => resyncForm || prev === null ? snapshot : prev);
        return snapshot;
      } catch (err) {
        setStateError(err instanceof Error ? err.message : String(err));
        return null;
      }
    }, []);
    const persistChanged = useCallback(async () => {
      const current = formRef.current;
      const base = form0Ref.current;
      if (!current) return { error: t("stateError") };
      const currentRecord = current;
      const baseRecord = base ?? {};
      const VALID = {
        gatewayUrl: (v) => {
          try {
            return Boolean(new URL(v)) && /^https?:/.test(new URL(v).protocol);
          } catch {
            return false;
          }
        },
        routeName: (v) => /^[a-z][a-z0-9-]*$/.test(v),
        credentialRef: (v) => /^[A-Z][A-Z0-9_]*$/.test(v),
        displayName: (v) => v.trim().length > 0 && v.length <= 64
      };
      const errText = {
        gatewayUrl: t("errGateway"),
        routeName: t("errRoute"),
        credentialRef: t("errCredential"),
        displayName: t("errDisplayName")
      };
      const patch = {};
      for (const key of ["gatewayUrl", "displayName", "routeName", "credentialRef", "api", "exclude"]) {
        if (JSON.stringify(currentRecord[key] ?? null) === JSON.stringify(baseRecord[key] ?? null)) continue;
        const raw = currentRecord[key];
        const asStr = typeof raw === "string" ? raw : "";
        if (VALID[key] && !VALID[key](asStr)) return { error: errText[key] };
        patch[key] = key === "gatewayUrl" ? asStr.replace(/\/+$/, "") : raw;
      }
      if (Object.keys(patch).length === 0) return { ok: true, persisted: false };
      await call("/config", patch);
      return { ok: true, persisted: true };
    }, [t]);
    const waitState = useCallback(async (pick, expected) => {
      for (let i = 0; i < 10; i++) {
        try {
          const snapshot = await call("/state");
          if (pick(snapshot) === expected) return snapshot;
        } catch {
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return null;
    }, []);
    const fullSync = useCallback(async () => {
      if (syncRunning.current) {
        rerunAfter.current = true;
        return;
      }
      syncRunning.current = true;
      setBusy("sync");
      setError(null);
      try {
        const saved = await persistChanged();
        if (saved.error) {
          setError(saved.error);
          return;
        }
        if (saved.persisted) {
          const expected = (formRef.current?.gatewayUrl ?? "").replace(/\/+$/, "");
          const fresh = await waitState((s) => s.gatewayUrl, expected);
          if (!fresh) {
            setError(t("stateError"));
            return;
          }
        }
        const result = await call("/apply", {});
        if (result?.error) {
          setError(result.error);
          return;
        }
        const diff = result?.diff;
        const changes = diff ? diff.added.length + diff.removed.length + diff.changed.length : 0;
        setNotice(
          diff && changes > 0 ? t("syncedChanges", { added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length }) : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        syncRunning.current = false;
        setBusy(null);
        refreshState(true);
        if (rerunAfter.current) {
          rerunAfter.current = false;
          fullSyncRef.current();
        }
      }
    }, [persistChanged, refreshState, t, waitState]);
    fullSyncRef.current = fullSync;
    const pull = useCallback(async (cfgOverride) => {
      const current = cfgOverride ?? formRef.current;
      if (!current) return;
      setBusy("pull");
      setError(null);
      try {
        setCatalog(
          await call("/plan", {
            gatewayUrl: current.gatewayUrl.replace(/\/+$/, ""),
            routeName: current.routeName,
            credentialRef: current.credentialRef,
            api: current.api,
            exclude: current.exclude ?? []
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    }, []);
    pullRef.current = pull;
    const scheduleSync = useCallback(() => {
      if (syncTimer.current !== null) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void fullSyncRef.current(), 900);
    }, []);
    const editField = useCallback(
      (key, value) => {
        setForm((prev) => prev === null ? prev : { ...prev, [key]: value });
        scheduleSync();
      },
      [scheduleSync]
    );
    const toggleModel = useCallback(
      (id) => {
        setForm((prev) => {
          if (prev === null) return prev;
          const set = new Set(prev.exclude ?? []);
          if (set.has(id)) set.delete(id);
          else set.add(id);
          return { ...prev, exclude: [...set] };
        });
        scheduleSync();
      },
      [scheduleSync]
    );
    const onKeyInput = useCallback(
      (value) => {
        setKeyValue(value);
        if (keyTimer.current !== null) clearTimeout(keyTimer.current);
        if (value.trim() === "") return;
        keyTimer.current = setTimeout(async () => {
          setBusy("key");
          setError(null);
          try {
            await call("/key", { value });
            setKeyValue("");
            setNotice(t("keySaved"));
            refreshState(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(null);
          }
        }, 800);
      },
      [refreshState, t]
    );
    const refreshNow = useCallback(async () => {
      await pullRef.current();
      await fullSyncRef.current();
    }, []);
    useEffect(() => {
      (async () => {
        const snapshot = await refreshState();
        if (snapshot) {
          await pullRef.current({
            gatewayUrl: snapshot.gatewayUrl,
            routeName: snapshot.routeName,
            displayName: snapshot.displayName,
            credentialRef: snapshot.credentialRef,
            api: snapshot.api,
            exclude: snapshot.exclude ?? []
          });
        }
      })();
      return () => {
        if (syncTimer.current !== null) clearTimeout(syncTimer.current);
        if (keyTimer.current !== null) clearTimeout(keyTimer.current);
      };
    }, []);
    const catalogModels = catalog?.models ?? [];
    const excluded = new Set(form?.exclude ?? []);
    return h(
      "div",
      { className: "dms" },
      h("style", null, STYLE),
      h("h2", null, t("title")),
      h("p", { className: "dms-desc" }, t("description")),
      stateError ? h(
        "div",
        { className: "dms-card" },
        h("span", { className: "dms-error" }, `${t("stateError")}: ${stateError}`),
        h(
          "button",
          { className: "dms-iconbtn", "aria-label": t("retry"), onClick: () => refreshState(true) },
          "\u27F3"
        )
      ) : null,
      state && form ? h(
        "div",
        { className: "dms-card" },
        h(
          "div",
          { className: "dms-row" },
          h(
            "button",
            {
              className: `dms-iconbtn${busy !== null ? " spin" : ""}`,
              title: t("refresh"),
              "aria-label": t("refresh"),
              disabled: busy !== null || !state.gatewayMounted,
              onClick: refreshNow
            },
            busy === "sync" || busy === "pull" ? "\u27F3" : "\u27F3"
          ),
          h("span", { className: "dms-k" }, t("gateway")),
          h("input", {
            className: "dms-input grow",
            value: form.gatewayUrl,
            "aria-label": t("gateway"),
            onChange: (event) => editField("gatewayUrl", event.target.value)
          }),
          h(Dot, { on: state.gatewayMounted === true })
        ),
        h(
          "div",
          { className: "dms-row" },
          h("span", { className: "dms-k" }, t("displayName")),
          h("input", {
            className: "dms-input grow",
            value: form.displayName ?? "",
            "aria-label": t("displayName"),
            onChange: (event) => editField("displayName", event.target.value)
          })
        ),
        h(
          "div",
          { className: "dms-row" },
          h("span", { className: "dms-k" }, t("apiLabel")),
          h(
            "select",
            {
              className: "dms-input",
              value: form.api,
              "aria-label": t("apiLabel"),
              onChange: (event) => editField("api", event.target.value)
            },
            ["openai-responses", "openai-completions", "anthropic-messages"].map(
              (value) => h("option", { key: value, value }, value)
            )
          ),
          h(Dot, { on: state.routePresent === true }),
          state.routePresent ? h("span", { className: "dms-note" }, `${state.routeModelCount}`) : null,
          busy === "sync" ? h("span", { className: "dms-note" }, t("syncing")) : busy === "pull" ? h("span", { className: "dms-note" }, t("pulling")) : null
        ),
        h(
          "div",
          { className: "dms-row" },
          h("span", { className: "dms-k" }, t("keyRow")),
          h("input", {
            type: "password",
            className: "dms-input grow",
            value: keyValue,
            placeholder: t("keyPlaceholder"),
            "aria-label": t("keyRow"),
            onChange: (event) => onKeyInput(event.target.value)
          }),
          h(Dot, { on: state.hasCredential === true })
        ),
        h("span", { className: "dms-hint" }, t("autoHint")),
        h("span", { className: "dms-hint" }, t("keyHint")),
        h(
          "details",
          { className: "dms-advanced" },
          h("summary", null, t("advanced")),
          h(
            "div",
            { className: "dms-row" },
            h("span", { className: "dms-k" }, t("route")),
            h("input", {
              className: "dms-input",
              value: form.routeName,
              "aria-label": t("route"),
              onChange: (event) => editField("routeName", event.target.value)
            }),
            h("span", { className: "dms-hint" }, t("routeHint"))
          ),
          h(
            "div",
            { className: "dms-row" },
            h("span", { className: "dms-k" }, t("credential")),
            h("input", {
              className: "dms-input",
              value: form.credentialRef,
              "aria-label": t("credential"),
              onChange: (event) => editField("credentialRef", event.target.value)
            })
          ),
          h("span", { className: "dms-hint" }, t("credentialHint"))
        )
      ) : null,
      error ? h("div", { className: "dms-error", role: "alert" }, error) : null,
      notice ? h("span", { className: "dms-ok" }, notice) : null,
      catalog && catalog.error ? h("div", { className: "dms-error", role: "alert" }, catalog.error) : catalog && Array.isArray(catalog.models) ? (() => {
        const { filtered, names, groups } = groupModels(catalogModels, query);
        return h(
          "div",
          { className: "dms-card" },
          h(
            "div",
            { className: "dms-row" },
            h("span", { className: "dms-k" }, t("selectTitle")),
            h("span", { className: "dms-note" }, `${catalogModels.length}`)
          ),
          h("span", { className: "dms-hint" }, t("selectHint")),
          catalog.warning ? h("span", { className: "dms-hint dms-warn" }, catalog.warning) : null,
          h("input", {
            type: "search",
            className: "dms-input dms-search",
            value: query,
            placeholder: t("searchPlaceholder"),
            "aria-label": t("searchPlaceholder"),
            onChange: (event) => setQuery(event.target.value)
          }),
          h(
            "div",
            { className: "dms-models" },
            filtered.length === 0 ? h("div", { className: "dms-empty" }, t("noMatches")) : names.flatMap((group) => [
              h(
                "div",
                { className: "dms-group", key: `g:${group}` },
                h("span", null, group),
                h("span", null, `${groups.get(group)?.length ?? 0}`)
              ),
              ...(groups.get(group) ?? []).map(
                (model) => h(
                  "div",
                  { className: "dms-model", key: model.id },
                  h(
                    "label",
                    null,
                    h("input", {
                      type: "checkbox",
                      checked: !excluded.has(model.id),
                      onChange: () => toggleModel(model.id)
                    }),
                    h("span", { className: "id" }, model.id)
                  ),
                  h(
                    "span",
                    { className: "cap" },
                    [shortTokens(model.contextWindow), shortTokens(model.maxTokens)].filter(Boolean).join(" / ")
                  )
                )
              )
            ])
          )
        );
      })() : null
    );
  }
  var plugin = {
    inject: ["slots"],
    apply(ctx) {
      ctx.slots.inject(
        "settings.section",
        () => ctx.slots.register(
          {
            name: "settings.section",
            id: "dsh-x-magpie",
            order: 60,
            label: () => translator()("title")
          },
          MagpieSyncSection
        )
      );
    }
  };
  var client_core_default = plugin;

	// esbuild's __toESM interop nests our default export once more when the
	// module has the __esModule marker; unwrap until the plugin surfaces.
	let __dshPlugin = client_core_exports;
	while (__dshPlugin && typeof __dshPlugin === 'object' && 'default' in __dshPlugin && __dshPlugin.inject === undefined) {
		__dshPlugin = __dshPlugin.default;
	}
	return __dshPlugin;
	},
});
