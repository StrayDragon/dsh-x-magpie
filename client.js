// Client half of dsh-magpie-sync: a Settings page under `settings.section`.
//
// Interaction model: exactly one button — a small refresh control that pulls
// the gateway catalog and syncs the route. Everything else syncs itself: any
// config edit, the stored key, and the per-model selection are debounced,
// persisted through the Host, and applied automatically. A failed apply keeps
// the previous route (llm-pi-ai validates the candidate before anything is
// written), and the error is shown instead.
//
// Model display name = model id; unchecking a model leaves it out of the
// route (persisted as `exclude`, default: everything selected). UI text is a
// small inline bilingual table (en / zh) keyed off the browser language.

window.__ModuleLoader__.load({
	id: '@straydragon/dsh-magpie-sync',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const { useState, useEffect, useCallback, useRef } = React;

		const STRINGS = {
			en: {
				title: 'Magpie model sync',
				description:
					'Pull the model catalog of a running magpie gateway into one llm-pi-ai provider route. ' +
					'Edits and selection changes apply themselves; the last good route survives failures.',
				gateway: 'Gateway',
				route: 'DSH provider name',
				routeHint: 'Lowercase letters, digits and hyphens.',
				credential: 'Credential ref',
				credentialHint: 'Reference name of the stored key \u2014 keep the default; the key itself goes below.',
				apiLabel: 'Protocol',
				keyRow: 'Gateway key',
				keyPlaceholder: 'magpie gateway key',
				keySaved: 'Key stored.',
				keyHint: 'The key goes into dsh\u2019s credential store as a reference; config files never hold it.',
				advanced: 'Advanced',
				refresh: 'Pull catalog and sync now',
				syncing: 'Syncing\u2026',
				pulling: 'Pulling\u2026',
				syncedChanges: 'Synced: +{added} / -{removed} / ~{changed}',
				selectTitle: 'Models',
				selectHint: 'Unchecked models are left out of the route; everything is selected by default.',
				searchPlaceholder: 'Search models\u2026',
				noMatches: 'No model matches the filter.',
				autoHint: 'Edits and selection apply automatically; on failure the previous route is kept.',
				errGateway: 'Gateway URL must be an absolute http(s) address',
				errRoute: 'Route name must be lowercase letters, digits and hyphens',
				errCredential: 'Credential ref must be UPPER_CASE letters, digits and underscores \u2014 keep the default',
				stateError: 'Status unavailable',
				retry: 'Retry',
			},
			zh: {
				title: 'Magpie 模型同步',
				description:
					'把运行中 magpie 网关的模型目录拉取为一个 llm-pi-ai provider 路由。' +
					'修改与勾选自动应用;出错时保留上一次的路由。',
				gateway: '网关',
				route: 'DSH 供应商名',
				routeHint: '小写字母、数字和中划线。',
				credential: '凭据引用名',
				credentialHint: '已存密钥的引用名 \u2014 保持默认即可,密钥本体填在下方。',
				apiLabel: '协议',
				keyRow: '网关密钥',
				keyPlaceholder: 'magpie 网关密钥',
				keySaved: '密钥已存入。',
				keyHint: '密钥以引用形式存入 dsh 凭据存储,配置文件中不保存本体。',
				advanced: '高级',
				refresh: '拉取目录并立即同步',
				syncing: '同步中…',
				pulling: '拉取中…',
				syncedChanges: '已同步:新增 {added} / 移除 {removed} / 变更 {changed}',
				selectTitle: '模型选择',
				selectHint: '取消勾选的模型不会写入路由;默认全选。',
				searchPlaceholder: '搜索模型…',
				noMatches: '没有匹配的模型。',
				autoHint: '配置与勾选自动应用;出错时保留上一次配置。',
				errGateway: '网关地址必须是完整的 http(s) 地址',
				errRoute: '路由名只能包含小写字母、数字和中划线',
				errCredential: '凭据引用名只能是大写字母、数字和下划线 \u2014 保持默认即可',
				stateError: '状态不可用',
				retry: '重试',
			},
		};

		function translator() {
			const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en';
			const table = STRINGS[lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'];
			return (key, vars) => {
				let text = table[key] ?? STRINGS.en[key] ?? key;
				if (vars) {
					for (const [name, value] of Object.entries(vars)) {
						text = text.split(`{${name}}`).join(String(value));
					}
				}
				return text;
			};
		}

		async function call(path, body) {
			const options =
				body === undefined
					? { method: 'GET' }
					: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
			const response = await fetch(`/dsh-magpie-sync${path}`, options);
			const data = await response.json().catch(() => ({}));
			if (!response.ok || (data && data.error)) {
				throw new Error(data?.error || `${response.status} ${response.statusText}`);
			}
			return data;
		}

		function shortTokens(value) {
			if (typeof value !== 'number' || value <= 0) return null;
			return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
		}

		const STYLE = `
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
.dms-search { margin: 2px 0; }
.dms-group { font-size: 11px; font-weight: 600; color: var(--dsw-alias-label-secondary);
  text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 4px 2px;
  border-top: 1px solid var(--dsw-alias-border-l1); margin-top: 4px;
  display: flex; justify-content: space-between; gap: 8px; }
.dms-group:first-child { border-top: none; margin-top: 0; }
.dms-empty { color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 8px 4px; }
`;

		function Dot({ on }) {
			return h('span', { className: `dms-dot ${on ? 'ok' : 'miss'}`, 'aria-hidden': true });
		}

		/** Case-insensitive subsequence match: "glmflash" finds zhipu/glm-5.3-flash. */
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
			const groups = new Map();
			for (const model of filtered) {
				const group = model.provider || model.id.split('/')[0] || 'other';
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
			const [catalog, setCatalog] = useState(null); // {modelCount, models} of the last pull
			const [busy, setBusy] = useState(null); // null | 'sync' | 'pull' | 'key'
			const [error, setError] = useState(null);
			const [notice, setNotice] = useState(null);
			const [keyValue, setKeyValue] = useState('');
			const [query, setQuery] = useState('');
			const [form, setForm] = useState(null);
			const [form0, setForm0] = useState(null); // values as last loaded/persisted

			const formRef = useRef(null);
			formRef.current = form;
			const form0Ref = useRef(null);
			form0Ref.current = form0;
			const syncTimer = useRef(null);
			const keyTimer = useRef(null);
			const syncRunning = useRef(false);
			const rerunAfter = useRef(false);
			const fullSyncRef = useRef(() => {});
			const pullRef = useRef(() => {});

			const refreshState = useCallback(async (resyncForm) => {
				try {
					setStateError(null);
					const next = await call('/state');
					setState(next);
					const snapshot = {
						gatewayUrl: next.gatewayUrl,
						routeName: next.routeName,
						credentialRef: next.credentialRef,
						api: next.api,
						exclude: next.exclude ?? [],
					};
					setForm((prev) => (resyncForm || prev === null ? snapshot : prev));
					setForm0((prev) => (resyncForm || prev === null ? snapshot : prev));
					return next;
				} catch (err) {
					setStateError(err?.message ?? String(err));
					return null;
				}
			}, []);

			const persistChanged = useCallback(async () => {
				const current = formRef.current;
				const base = form0Ref.current;
				if (!current) return { error: t('stateError') };
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
				};
				const errText = {
					gatewayUrl: t('errGateway'),
					routeName: t('errRoute'),
					credentialRef: t('errCredential'),
				};
				const patch = {};
				for (const key of ['gatewayUrl', 'routeName', 'credentialRef', 'api', 'exclude']) {
					if (JSON.stringify(current[key] ?? null) === JSON.stringify(base?.[key] ?? null)) continue;
					if (VALID[key] && !VALID[key](current[key])) return { error: errText[key] };
					patch[key] = key === 'gatewayUrl' ? current[key].replace(/\/+$/, '') : current[key];
				}
				if (Object.keys(patch).length === 0) return { ok: true, persisted: false };
				await call('/config', patch);
				return { ok: true, persisted: true };
			}, [t]);

			const waitState = useCallback(async (pick, expected) => {
				for (let i = 0; i < 10; i++) {
					try {
						const snapshot = await call('/state');
						if (pick(snapshot) === expected) return snapshot;
					} catch {}
					await new Promise((resolve) => setTimeout(resolve, 300));
				}
				return null;
			}, []);

			/** One sync round: persist pending edits, then write the route.
			 * Failures surface here and leave the previous route untouched. */
			const fullSync = useCallback(async () => {
				if (syncRunning.current) {
					rerunAfter.current = true;
					return;
				}
				syncRunning.current = true;
				setBusy('sync');
				setError(null);
				try {
					const saved = await persistChanged();
					if (saved.error) {
						setError(saved.error);
						return;
					}
					if (saved.persisted) {
						const expected = formRef.current.gatewayUrl.replace(/\/+$/, '');
						const fresh = await waitState((s) => s.gatewayUrl, expected);
						if (!fresh) {
							setError(t('stateError'));
							return;
						}
					}
					const result = await call('/apply', {});
					if (result?.error) {
						// llm-pi-ai refused the candidate: the previous route stands.
						setError(result.error);
						return;
					}
					const diff = result?.diff;
					const changes = diff ? diff.added.length + diff.removed.length + diff.changed.length : 0;
					setNotice(
						diff && changes > 0
							? t('syncedChanges', { added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length })
							: null,
					);
				} catch (err) {
					setError(err?.message ?? String(err));
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

			/** Pull the catalog for the selection list (no write). */
			const pull = useCallback(async (cfgOverride) => {
				const current = cfgOverride ?? formRef.current;
				if (!current) return;
				setBusy('pull');
				setError(null);
				try {
					setCatalog(
						await call('/plan', {
							gatewayUrl: current.gatewayUrl.replace(/\/+$/, ''),
							routeName: current.routeName,
							credentialRef: current.credentialRef,
							api: current.api,
							exclude: current.exclude ?? [],
						}),
					);
				} catch (err) {
					setError(err?.message ?? String(err));
				} finally {
					setBusy(null);
				}
			}, []);
			pullRef.current = pull;

			const scheduleSync = useCallback(() => {
				clearTimeout(syncTimer.current);
				syncTimer.current = setTimeout(() => fullSyncRef.current(), 900);
			}, []);

			const editField = useCallback(
				(key, value) => {
					setForm((prev) => ({ ...prev, [key]: value }));
					scheduleSync();
				},
				[scheduleSync],
			);

			const toggleModel = useCallback(
				(id) => {
					setForm((prev) => {
						const set = new Set(prev.exclude ?? []);
						if (set.has(id)) set.delete(id);
						else set.add(id);
						return { ...prev, exclude: [...set] };
					});
					scheduleSync();
				},
				[scheduleSync],
			);

			const onKeyInput = useCallback(
				(value) => {
					setKeyValue(value);
					clearTimeout(keyTimer.current);
					if (value.trim() === '') return;
					keyTimer.current = setTimeout(async () => {
						setBusy('key');
						setError(null);
						try {
							await call('/key', { value });
							setKeyValue('');
							setNotice(t('keySaved'));
							refreshState(true);
						} catch (err) {
							setError(err?.message ?? String(err));
						} finally {
							setBusy(null);
						}
					}, 800);
				},
				[refreshState, t],
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
							credentialRef: snapshot.credentialRef,
							api: snapshot.api,
							exclude: snapshot.exclude ?? [],
						});
					}
				})();
				return () => {
					clearTimeout(syncTimer.current);
					clearTimeout(keyTimer.current);
				};
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, []);

			const catalogModels = catalog?.models ?? [];
			const excluded = new Set(form?.exclude ?? []);

			return h(
				'div',
				{ className: 'dms' },
				h('style', null, STYLE),
				h('h2', null, t('title')),
				h('p', { className: 'dms-desc' }, t('description')),
				stateError
					? h(
							'div',
							{ className: 'dms-card' },
							h('span', { className: 'dms-error' }, `${t('stateError')}: ${stateError}`),
							h(
								'button',
								{ className: 'dms-iconbtn', 'aria-label': t('retry'), onClick: () => refreshState(true) },
								'⟳',
							),
						)
					: null,
				state && form
					? h(
							'div',
							{ className: 'dms-card' },
							h(
								'div',
								{ className: 'dms-row' },
								h(
									'button',
									{
										className: `dms-iconbtn${busy !== null ? ' spin' : ''}`,
										title: t('refresh'),
										'aria-label': t('refresh'),
										disabled: busy !== null || !state.gatewayMounted,
										onClick: refreshNow,
									},
									busy === 'sync' || busy === 'pull' ? '⟳' : '⟳',
								),
								h('span', { className: 'dms-k' }, t('gateway')),
								h('input', {
									className: 'dms-input grow',
									value: form.gatewayUrl,
									'aria-label': t('gateway'),
									onChange: (event) => editField('gatewayUrl', event.target.value),
								}),
								h(Dot, { on: state.gatewayMounted === true }),
							),
							h(
								'div',
								{ className: 'dms-row' },
								h('span', { className: 'dms-k' }, t('apiLabel')),
								h(
									'select',
									{
										className: 'dms-input',
										value: form.api,
										'aria-label': t('apiLabel'),
										onChange: (event) => editField('api', event.target.value),
									},
									['openai-responses', 'openai-completions', 'anthropic-messages'].map((value) =>
										h('option', { key: value, value }, value),
									),
								),
								h(Dot, { on: state.routePresent === true }),
								state.routePresent ? h('span', { className: 'dms-note' }, `${state.routeModelCount}`) : null,
								busy === 'sync'
									? h('span', { className: 'dms-note' }, t('syncing'))
									: busy === 'pull'
										? h('span', { className: 'dms-note' }, t('pulling'))
										: null,
							),
							h(
								'div',
								{ className: 'dms-row' },
								h('span', { className: 'dms-k' }, t('keyRow')),
								h('input', {
									type: 'password',
									className: 'dms-input grow',
									value: keyValue,
									placeholder: t('keyPlaceholder'),
									'aria-label': t('keyRow'),
									onChange: (event) => onKeyInput(event.target.value),
								}),
								h(Dot, { on: state.hasCredential === true }),
							),
							h('span', { className: 'dms-hint' }, t('autoHint')),
							h('span', { className: 'dms-hint' }, t('keyHint')),
							h(
								'details',
								{ className: 'dms-advanced' },
								h('summary', null, t('advanced')),
								h(
									'div',
									{ className: 'dms-row' },
									h('span', { className: 'dms-k' }, t('route')),
									h('input', {
										className: 'dms-input',
										value: form.routeName,
										'aria-label': t('route'),
										onChange: (event) => editField('routeName', event.target.value),
									}),
									h('span', { className: 'dms-hint' }, t('routeHint')),
								),
								h(
									'div',
									{ className: 'dms-row' },
									h('span', { className: 'dms-k' }, t('credential')),
									h('input', {
										className: 'dms-input',
										value: form.credentialRef,
										'aria-label': t('credential'),
										onChange: (event) => editField('credentialRef', event.target.value),
									}),
								),
								h('span', { className: 'dms-hint' }, t('credentialHint')),
							),
						)
					: null,
				error ? h('div', { className: 'dms-error', role: 'alert' }, error) : null,
				notice ? h('span', { className: 'dms-ok' }, notice) : null,
			catalog && catalog.error
				? h('div', { className: 'dms-error', role: 'alert' }, catalog.error)
				: catalog && Array.isArray(catalog.models)
					? (() => {
							const { filtered, names, groups } = groupModels(catalogModels, query);
							return h(
								'div',
								{ className: 'dms-card' },
								h(
									'div',
									{ className: 'dms-row' },
									h('span', { className: 'dms-k' }, t('selectTitle')),
									h('span', { className: 'dms-note' }, `${catalogModels.length}`),
								),
								h('span', { className: 'dms-hint' }, t('selectHint')),
								catalog.warning ? h('span', { className: 'dms-hint dms-warn' }, catalog.warning) : null,
								h('input', {
									type: 'search',
									className: 'dms-input dms-search grow',
									value: query,
									placeholder: t('searchPlaceholder'),
									'aria-label': t('searchPlaceholder'),
									onChange: (event) => setQuery(event.target.value),
								}),
								h(
									'div',
									{ className: 'dms-models' },
									filtered.length === 0
										? h('div', { className: 'dms-empty' }, t('noMatches'))
										: names.flatMap((group) => [
												h(
													'div',
													{ className: 'dms-group', key: `g:${group}` },
													h('span', null, group),
												h('span', null, `${groups.get(group).length}`),
												),
												...groups.get(group).map((model) =>
													h(
														'div',
														{ className: 'dms-model', key: model.id },
														h(
															'label',
															null,
															h('input', {
																type: 'checkbox',
																checked: !excluded.has(model.id),
																onChange: () => toggleModel(model.id),
															}),
															h('span', { className: 'id' }, model.id),
														),
														h(
															'span',
															{ className: 'cap' },
															[shortTokens(model.contextWindow), shortTokens(model.maxTokens)]
																.filter(Boolean)
																.join(' / '),
														),
													),
											  ),
										  ]),
								),
							);
						})()
					: null,
			);
		}

		return {
			inject: ['slots'],
			apply(ctx) {
				ctx.slots.inject('settings.section', () =>
					ctx.slots.register(
						{
							name: 'settings.section',
							id: 'magpie-sync',
							order: 60,
							label: () => translator()('title'),
						},
						MagpieSyncSection,
					),
				);
			},
		};
	},
});
