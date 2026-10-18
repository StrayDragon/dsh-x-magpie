// Client half of dsh-magpie-sync: a Settings page under `settings.section`.
//
// The page shows the gateway/route/credential state, lets the user store the
// magpie gateway key into dsh's credential store (never into config files),
// and drives the plan → review diff → apply flow against the Host half's
// same-origin /dsh-magpie-sync routes. UI text is a small inline bilingual
// table (en / zh) keyed off the browser language.

window.__ModuleLoader__.load({
	id: '@straydragon/dsh-magpie-sync',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const { useState, useEffect, useCallback } = React;

		const STRINGS = {
			en: {
				title: 'Magpie model sync',
				description:
					'Pull the model catalog of a running magpie gateway into one llm-pi-ai provider route. ' +
					'Nothing is written before you review the diff and press apply.',
				gateway: 'Gateway',
				route: 'Provider route',
				keyStored: 'stored',
				keyMissing: 'not stored',
				keyLabel: 'Store gateway key',
				keyPlaceholder: 'magpie gateway key',
				keySave: 'Save key',
				keySaved: 'Key stored.',
				keyHint: 'The key goes into dsh\u2019s credential store as a reference; config files never hold it.',
				apiLabel: 'Protocol',
				saveConfig: 'Save settings',
				configSaved: 'Settings saved.',
				configHint: 'Saved into this profile\u2019s patch; modelOverrides stays a patch-file field.',
				configLoading: 'Saving\u2026',
				advanced: 'Advanced',
				credential: 'Credential ref',
				credentialHint: 'Reference name of the stored key \u2014 keep the default; the key itself goes below.',
				keyRow: 'Gateway key',
				errGateway: 'Gateway URL must be an absolute http(s) address',
				errRoute: 'Route name must be lowercase letters, digits and hyphens',
				errCredential: 'Credential ref must be UPPER_CASE letters, digits and underscores \u2014 keep the default',
				noConfigChanges: 'No setting changed.',
				dirtyHint: 'Unsaved edits \u2014 \u201cPull now\u201d previews them; \u201cApply\u201d saves first.',
				removeRoute: 'Remove route',
				removeLoading: 'Removing\u2026',
				removed: 'Route removed.',
				plan: 'Pull now',
				planLoading: 'Fetching catalog\u2026',
				apply: 'Apply',
				applyLoading: 'Writing\u2026',
				applied: 'Route written.',
				noChanges: 'Already in sync \u2014 nothing to apply.',
				routeNew: 'The route does not exist yet; applying creates it.',
				summary: '{n} model(s): {added} added, {removed} removed, {changed} changed, {unchanged} unchanged.',
				routeChanges: 'Route fields',
				added: 'Added models',
				removed: 'Removed models',
				changed: 'Changed models',
				from: 'current',
				to: 'incoming',
				leaveEmpty: 'empty \u2014 provider default applies',
				stateError: 'Status unavailable',
				retry: 'Retry',
			},
			zh: {
				title: 'Magpie 模型同步',
				description:
					'把运行中 magpie 网关的模型目录拉取为一个 llm-pi-ai provider 路由。' +
					'写盘之前先核对差异,确认后才会应用。',
				gateway: '网关',
				route: 'Provider 路由',
				keyStored: '已存入',
				keyMissing: '未存储',
				keyLabel: '保存网关密钥',
				keyPlaceholder: 'magpie 网关密钥',
				keySave: '保存密钥',
				keySaved: '密钥已存入。',
				keyHint: '密钥以引用形式存入 dsh 凭据存储,配置文件中不保存本体。',
				apiLabel: '协议',
				saveConfig: '保存设置',
				configSaved: '设置已保存。',
				configHint: '保存写入本 profile 的 patch(cordis.patch.yml);modelOverrides 仅支持在 patch 文件中修改。',
				configLoading: '正在保存…',
				advanced: '高级',
				credential: '凭据引用名',
				credentialHint: '已存密钥的引用名 \u2014 保持默认即可,密钥本体填在下方。',
				keyRow: '网关密钥',
				errGateway: '网关地址必须是完整的 http(s) 地址',
				errRoute: '路由名只能包含小写字母、数字和中划线',
				errCredential: '凭据引用名只能是大写字母、数字和下划线 \u2014 保持默认即可',
				noConfigChanges: '设置没有变化。',
				dirtyHint: '有未保存的修改 \u2014\u201c同步拉取\u201d按表单值预览;\u201c应用\u201d会先保存再同步。',
				removeRoute: '移除路由',
				removeLoading: '正在移除…',
				removed: '路由已移除。',
				plan: '同步拉取',
				planLoading: '正在拉取目录…',
				apply: '应用',
				applyLoading: '正在写入…',
				applied: '路由已写入。',
				noChanges: '已同步,没有需要应用的变更。',
				routeNew: '该路由尚不存在,应用后将创建。',
				summary: '共 {n} 个模型:新增 {added},移除 {removed},变更 {changed},无变化 {unchanged}。',
				routeChanges: '路由字段',
				added: '新增模型',
				removed: '移除模型',
				changed: '变更模型',
				from: '当前',
				to: '写入',
				leaveEmpty: '留空 \u2014 使用 provider 默认值',
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

		function shortValue(value) {
			if (value === null || value === undefined || value === '') return '\u2014';
			if (typeof value === 'object') {
				const text = JSON.stringify(value);
				return text.length > 60 ? `${text.slice(0, 57)}\u2026` : text;
			}
			const text = String(value);
			return text.length > 60 ? `${text.slice(0, 57)}\u2026` : text;
		}

		const STYLE = `
.dms { display: flex; flex-direction: column; gap: 16px; max-width: 760px; padding: 20px 24px 48px;
  color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.5; }
.dms h2 { margin: 0; font-size: 16px; font-weight: 600; }
.dms-desc { margin: 0; color: var(--dsw-alias-label-secondary); }
.dms-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.dms-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dms-k { color: var(--dsw-alias-label-secondary); min-width: 110px; }
.dms-code { font-family: ui-monospace, monospace; font-size: 12px; }
.dms-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dms-dot.ok { background: var(--dsw-alias-state-success-primary); }
.dms-dot.miss { background: var(--dsw-alias-state-warn-primary); }
.dms-dot.err { background: var(--dsw-alias-state-error-primary); }
.dms-key { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dms-key input { flex: 1 1 220px; min-width: 180px; background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 10px;
  color: var(--dsw-alias-label-primary); font-size: 13px; }
.dms-key input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dms-input { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; padding: 5px 9px; color: var(--dsw-alias-label-primary);
  font-size: 12.5px; font-family: ui-monospace, monospace; }
.dms-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dms-input.grow { flex: 1 1 240px; min-width: 200px; }
select.dms-input { font-family: inherit; }
.dms-advanced { border: 1px dashed var(--dsw-alias-border-l1); border-radius: 8px;
  padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.dms-advanced summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dms-actions { display: flex; gap: 8px; align-items: center; }
.dms-btn { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 6px 14px;
  font-size: 13px; cursor: pointer; }
.dms-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.dms-btn:disabled { opacity: 0.5; cursor: default; }
.dms-btn.primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base); }
.dms-note { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dms-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dms-error { border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 8px;
  padding: 8px 12px; color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; }
.dms-ok { color: var(--dsw-alias-state-success-primary); }
.dms-warn { color: var(--dsw-alias-state-warn-primary); }
.dms-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dms-chip { font-family: ui-monospace, monospace; font-size: 12px; border-radius: 6px;
  padding: 2px 8px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2); }
.dms-chip.add { border-color: var(--dsw-alias-state-success-primary); }
.dms-chip.del { border-color: var(--dsw-alias-state-error-primary); text-decoration: line-through; }
.dms-table { border-collapse: collapse; width: 100%; }
.dms-table th, .dms-table td { text-align: left; vertical-align: top; padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dms-table th { color: var(--dsw-alias-label-secondary); font-weight: 500; font-size: 12px; }
.dms-model-id { font-family: ui-monospace, monospace; font-size: 12px; white-space: nowrap; }
.dms-field-row { display: flex; gap: 6px; flex-direction: column; }
.dms-field { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; font-size: 12px; }
.dms-field .f { color: var(--dsw-alias-label-secondary); font-family: ui-monospace, monospace; }
.dms-field .from { color: var(--dsw-alias-state-error-primary); font-family: ui-monospace, monospace; }
.dms-field .to { color: var(--dsw-alias-state-success-primary); font-family: ui-monospace, monospace; }
.dms-section h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
`;

		function Dot({ on }) {
			return h('span', { className: `dms-dot ${on ? 'ok' : 'miss'}`, 'aria-hidden': true });
		}

		function DiffView({ plan, t }) {
			const diff = plan.diff;
			const counts = {
				n: plan.modelCount,
				added: diff.added.length,
				removed: diff.removed.length,
				changed: diff.changed.length,
				unchanged: diff.unchanged,
			};
			const children = [h('p', { className: 'dms-note', key: 'sum' }, t('summary', counts))];
			if (!plan.routePresent && diff.added.length > 0) {
				children.push(h('p', { className: 'dms-note', key: 'new' }, t('routeNew')));
			}
			if (diff.route.length > 0) {
				children.push(
					h(
						'div',
						{ className: 'dms-section', key: 'route' },
						h('h3', null, t('routeChanges')),
						h(
							'div',
							{ className: 'dms-field-row' },
							diff.route.map((change) =>
								h(
									'div',
									{ className: 'dms-field', key: change.field },
									h('span', { className: 'f' }, change.field),
									h('span', { className: 'from' }, shortValue(change.from)),
									h('span', null, '\u2192'),
									h('span', { className: 'to' }, shortValue(change.to)),
								),
							),
						),
					),
				);
			}
			if (diff.added.length > 0) {
				children.push(
					h(
						'div',
						{ className: 'dms-section', key: 'added' },
						h('h3', null, `${t('added')} (${diff.added.length})`),
						h(
							'div',
							{ className: 'dms-chips' },
							diff.added.map((id) => h('span', { className: 'dms-chip add', key: id }, id)),
						),
					),
				);
			}
			if (diff.removed.length > 0) {
				children.push(
					h(
						'div',
						{ className: 'dms-section', key: 'removed' },
						h('h3', null, `${t('removed')} (${diff.removed.length})`),
						h(
							'div',
							{ className: 'dms-chips' },
							diff.removed.map((id) => h('span', { className: 'dms-chip del', key: id }, id)),
						),
					),
				);
			}
			if (diff.changed.length > 0) {
				children.push(
					h(
						'div',
						{ className: 'dms-section', key: 'changed' },
						h('h3', null, `${t('changed')} (${diff.changed.length})`),
						h(
							'table',
							{ className: 'dms-table' },
							h(
								'thead',
								null,
								h(
									'tr',
									null,
									h('th', null, 'id'),
									h('th', null, `${t('from')} \u2192 ${t('to')}`),
								),
							),
							h(
								'tbody',
								null,
								diff.changed.map((model) =>
									h(
										'tr',
										{ key: model.id },
										h('td', { className: 'dms-model-id' }, model.id),
										h(
											'td',
											null,
											h(
												'div',
												{ className: 'dms-field-row' },
												model.fields.map((field) =>
													h(
														'div',
														{ className: 'dms-field', key: field.field },
														h('span', { className: 'f' }, field.field),
														h('span', { className: 'from' }, shortValue(field.from)),
														h('span', null, '\u2192'),
														h('span', { className: 'to' }, shortValue(field.to)),
													),
												),
											),
										),
									),
								),
							),
						),
					),
				);
			}
			return h('div', { className: 'dms-card' }, ...children);
		}

		function MagpieSyncSection() {
			const t = translator();
			const [state, setState] = useState(null);
			const [stateError, setStateError] = useState(null);
			const [plan, setPlan] = useState(null);
			const [busy, setBusy] = useState(null); // null | 'plan' | 'apply' | 'key' | 'config' | 'remove'
			const [error, setError] = useState(null);
			const [notice, setNotice] = useState(null);
			const [keyValue, setKeyValue] = useState('');
			const [form, setForm] = useState(null);
			const [form0, setForm0] = useState(null); // values as last loaded, to diff against

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
					};
					setForm((prev) => (resyncForm || prev === null ? snapshot : prev));
					setForm0((prev) => (resyncForm || prev === null ? snapshot : prev));
				} catch (err) {
					setStateError(err?.message ?? String(err));
				}
			}, []);

			useEffect(() => {
				refreshState();
			}, [refreshState]);

			const runPlan = useCallback(async () => {
				setBusy('plan');
				setError(null);
				setNotice(null);
				try {
					// Preview with the form's current values, saved or not.
					setPlan(
						await call('/plan', {
							gatewayUrl: form.gatewayUrl.replace(/\/+$/, ''),
							routeName: form.routeName,
							credentialRef: form.credentialRef,
							api: form.api,
						}),
					);
				} catch (err) {
					setError(err?.message ?? String(err));
					setPlan(null);
				} finally {
					setBusy(null);
				}
			}, [form]);

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

			const persistChanged = useCallback(async () => {
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
				for (const key of ['gatewayUrl', 'routeName', 'credentialRef', 'api']) {
					if (form[key] === form0?.[key]) continue;
					if (VALID[key] && !VALID[key](form[key])) return { error: errText[key] };
					patch[key] = key === 'gatewayUrl' ? form[key].replace(/\/+$/, '') : form[key];
				}
				if (Object.keys(patch).length === 0) return { ok: true, persisted: false };
				await call('/config', patch);
				return { ok: true, persisted: true };
			}, [form, form0, t]);

			const runApply = useCallback(async () => {
				setBusy('apply');
				setError(null);
				setNotice(null);
				try {
					// Apply writes what the saved config says: persist edits first,
					// and wait until the restarted plugin serves the new values.
					const saved = await persistChanged();
					if (saved.error) {
						setError(saved.error);
						setBusy(null);
						return;
					}
					if (saved.persisted) {
						const fresh = await waitState((s) => s.gatewayUrl, form.gatewayUrl.replace(/\/+$/, ''));
						if (!fresh) {
							setError(t('stateError'));
							setBusy(null);
							return;
						}
					}
					const result = await call('/apply', {});
					setPlan(null);
					setNotice(
						result?.diff &&
							result.diff.added.length + result.diff.removed.length + result.diff.changed.length === 0
							? t('noChanges')
							: t('applied'),
					);
					refreshState(true);
				} catch (err) {
					setError(err?.message ?? String(err));
				} finally {
					setBusy(null);
				}
			}, [form, persistChanged, refreshState, t, waitState]);

			const saveConfig = useCallback(async () => {
				setBusy('config');
				setError(null);
				setNotice(null);
				try {
					const saved = await persistChanged();
					if (saved.error) {
						setError(saved.error);
						return;
					}
					setNotice(t('configSaved'));
					setPlan(null);
					await refreshState(true);
				} catch (err) {
					setError(err?.message ?? String(err));
				} finally {
					setBusy(null);
				}
			}, [persistChanged, refreshState, t]);

			const saveKey = useCallback(async () => {
				setBusy('key');
				setError(null);
				setNotice(null);
				try {
					await call('/key', { value: keyValue });
					setKeyValue('');
					setNotice(t('keySaved'));
					refreshState();
				} catch (err) {
					setError(err?.message ?? String(err));
				} finally {
					setBusy(null);
				}
			}, [keyValue, refreshState, t]);

			const removeRoute = useCallback(async () => {
				setBusy('remove');
				setError(null);
				setNotice(null);
				try {
					await call('/remove', {});
					setPlan(null);
					setNotice(t('removed'));
					refreshState();
				} catch (err) {
					setError(err?.message ?? String(err));
				} finally {
					setBusy(null);
				}
			}, [refreshState, t]);

			const hasChanges =
				plan &&
				plan.diff &&
				(plan.diff.added.length + plan.diff.removed.length + plan.diff.changed.length > 0 ||
					plan.diff.route.length > 0);
			const dirty = Boolean(form && form0 && JSON.stringify(form) !== JSON.stringify(form0));

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
							h('button', { className: 'dms-btn', onClick: refreshState }, t('retry')),
						)
					: state && form
						? h(
								'div',
								{ className: 'dms-card' },
								h(
									'div',
									{ className: 'dms-row' },
									h('span', { className: 'dms-k' }, t('gateway')),
									h('input', {
										className: 'dms-input grow',
										value: form.gatewayUrl,
										'aria-label': t('gateway'),
										onChange: (event) => setForm({ ...form, gatewayUrl: event.target.value }),
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
											onChange: (event) => setForm({ ...form, api: event.target.value }),
										},
										['openai-responses', 'openai-completions', 'anthropic-messages'].map((value) =>
											h('option', { key: value, value }, value),
										),
									),
									h(Dot, { on: state.routePresent === true }),
									state.routePresent
										? h('span', { className: 'dms-note' }, `${state.routeModelCount}`)
										: null,
								),
								h(
									'div',
									{ className: 'dms-key' },
									h(
										'button',
										{
											className: dirty ? 'dms-btn primary' : 'dms-btn',
											disabled: busy !== null || !dirty,
											onClick: saveConfig,
										},
										busy === 'config' ? t('configLoading') : t('saveConfig'),
									),
									h('span', { className: 'dms-hint' }, t('configHint')),
								),
								dirty ? h('span', { className: 'dms-hint dms-warn' }, t('dirtyHint')) : null,
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
											onChange: (event) => setForm({ ...form, routeName: event.target.value }),
										}),
										h('span', { className: 'dms-hint' }, t('errRoute')),
									),
									h(
										'div',
										{ className: 'dms-row' },
										h('span', { className: 'dms-k' }, t('credential')),
										h('input', {
											className: 'dms-input',
											value: form.credentialRef,
											'aria-label': t('credential'),
											onChange: (event) => setForm({ ...form, credentialRef: event.target.value }),
										}),
									),
									h('span', { className: 'dms-hint' }, t('credentialHint')),
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
										'aria-label': t('keyLabel'),
										onChange: (event) => setKeyValue(event.target.value),
									}),
									h(Dot, { on: state.hasCredential === true }),
									h(
										'button',
										{
											className: 'dms-btn',
											disabled: busy !== null || keyValue === '',
											onClick: saveKey,
										},
										busy === 'key' ? '\u2026' : t('keySave'),
									),
									h(
										'span',
										{ className: 'dms-note' },
										state.hasCredential ? t('keyStored') : t('keyMissing'),
									),
								),
								h('span', { className: 'dms-hint' }, t('keyHint')),
							)
						: null,
				h(
					'div',
					{ className: 'dms-actions' },
					h(
						'button',
						{ className: 'dms-btn', disabled: busy !== null || !state, onClick: runPlan },
						busy === 'plan' ? t('planLoading') : t('plan'),
					),
					h(
						'button',
						{
							className: 'dms-btn primary',
							disabled: busy !== null || !hasChanges,
							onClick: runApply,
						},
						busy === 'apply' ? t('applyLoading') : t('apply'),
					),
					state?.routePresent
						? h(
								'button',
								{ className: 'dms-btn', disabled: busy !== null, onClick: removeRoute },
								busy === 'remove' ? t('removeLoading') : t('removeRoute'),
							)
						: null,
					notice ? h('span', { className: 'dms-ok' }, notice) : null,
				),
				error ? h('div', { className: 'dms-error', role: 'alert' }, error) : null,
				plan && plan.error
					? h('div', { className: 'dms-error', role: 'alert' }, plan.error)
					: plan && plan.diff
						? plan.diff.added.length +
								plan.diff.removed.length +
								plan.diff.changed.length +
								plan.diff.route.length ===
							0
							? h('div', { className: 'dms-card' }, h('span', { className: 'dms-note' }, t('noChanges')))
							: h(DiffView, { plan, t })
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
