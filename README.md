# dsh-magpie-sync

[English](#english) · [简体中文](#简体中文)

<a id="english"></a>

## English

A [DeepSeek Harness](https://github.com/deepseek-ai) (dsh) plugin that pulls the model catalog of a running [magpie](https://usemagpie.ai) gateway into **one** `llm-pi-ai` provider route — so dsh's model picker lists every model magpie serves, with the context window and output cap magpie knows, and you never hand-edit `contextWindow` / `maxTokens` per model again.

### How it works

- The Host half answers same-origin HTTP calls under `/dsh-magpie-sync`: `state` (status), `plan` (diff, no write), `apply` (write), `key` (store the gateway key), `config` (settings-page edits), `remove` (drop the route).
- `plan` fetches `GET {gatewayUrl}/v1/models`, maps each row onto an `llm-pi-ai` model entry, and returns a **field-level diff** against the current route. Nothing is written.
- `apply` re-derives the candidate and writes it through dsh's config editor (the same Loader path the Models page uses), touching only the one route key it owns. Other provider routes are never modified.
- Fields the gateway does not report (`context_window`, `max_output_tokens`, modalities, reasoning levels) stay **unwritten** — llm-pi-ai then applies its own defaults, exactly like a hand-declared route. A per-model `modelOverrides` map can add or correct values; an explicit `null` drops a field.

### Field mapping

| magpie `/v1/models` | llm-pi-ai model entry |
| --- | --- |
| `id` | `id` |
| `display_name` | `name` |
| `context_window` | `contextWindow` (omitted when absent) |
| `max_output_tokens` | `maxTokens` (omitted when absent) |
| `modalities.input` | `input` (filtered to text/image/audio/video/pdf) |
| `supported_reasoning_levels[].effort` | `reasoningEfforts` (`none` → `off`; unknown levels dropped) |
| `reasoning: false` | `reasoningEfforts: false` |

### Install

Clone this repository and install the checkout directory as a dsh bundle (Plugin Manager → install from directory, or `plugin_manager` with the absolute package path in a Harness session):

```
git clone <this repo> && cd dsh-magpie-sync
# then install the directory as a bundle in your dsh profile
```

The bundle inserts one row (`magpie-sync`). It requires the profile to already mount `llm-pi-ai` (shipped) and the web composition (webServer / configEditor / credentials).

### Configure

Two items in the row's `config` (defaults in `cordis.patch.yml`):

| field | default | meaning |
| --- | --- | --- |
| `gatewayUrl` | `http://127.0.0.1:3425` | magpie gateway base URL |
| `api` | `openai-responses` | wire protocol (`openai-responses` / `openai-completions` / `anthropic-messages`) |
| `credentialRef` | `MAGPIE_GATEWAY_KEY` | credential reference for the gateway key |

Optional: `routeName` (default `magpie`), `modelOverrides` (per-model corrections, patch file only).

Everything except `modelOverrides` is editable on the plugin's Settings page and persisted into the profile patch through the config editor — no YAML hand-editing required.

The gateway key itself is entered on the plugin's Settings page and stored in dsh's credential store under `credentialRef` — never in a config file. If magpie's own dsh integration already stored `MAGPIE_GATEWAY_KEY`, no key entry is needed.

### Usage

Settings → **Magpie model sync**:

1. **Check for changes** — fetches the gateway, shows added/removed/changed models and route-field changes.
2. **Apply** — writes the route (button enabled only when the diff is non-empty).

### Coexistence notes

- magpie's built-in dsh integration writes its **own** route key (e.g. `magpie-otter`) every ~30 s. This plugin writes a different key and only that key, so both can coexist, but the two features overlap — pick one. Using this plugin means you can disconnect magpie's built-in dsh wiring.
- Manual edits inside the synced route are overwritten by the next apply. Keep private routes as separate llm-pi-ai routes, or pin values via `modelOverrides`.
- dsh's home-layer patch (`~/.dsh/cordis.patch.yml`) wins over the profile layer; if it carries an `llm-pi-ai` config, a sync can be silently shadowed — the status card reports whether the row resolves.

<a id="简体中文"></a>

## 简体中文

一个 DeepSeek Harness(dsh)插件:把运行中的 [magpie](https://usemagpie.ai) 网关的模型目录拉取为 **一个** `llm-pi-ai` provider 路由 —— dsh 的模型选择器从此列出 magpie 服务的全部模型(带 magpie 已知的 context window 与输出上限),不再需要逐个手填 `contextWindow` / `maxTokens`。

### 工作方式

- Host 半在 `/dsh-magpie-sync` 下应答同源 HTTP:`state`(状态)、`plan`(差异,不写盘)、`apply`(写盘)、`key`(存密钥)、`config`(设置页修改)、`remove`(移除路由)。
- `plan` 拉取 `GET {gatewayUrl}/v1/models`,映射为 `llm-pi-ai` 模型条目,返回**字段级 diff**;不写盘。
- `apply` 重新推导候选配置,经 dsh 的 config editor(与 Models 页相同的 Loader 路径)写入,且只碰自己拥有的那一个路由键,其他 provider 路由一律不动。
- 网关没有上报的字段(context、输出上限、模态、思考档位)**保持留空** —— 由 llm-pi-ai 的默认值兜底,与手写路由的行为一致。`modelOverrides` 可按模型补值/纠偏,显式 `null` 表示删除该字段。

### 字段映射

| magpie `/v1/models` | llm-pi-ai 模型条目 |
| --- | --- |
| `id` | `id` |
| `display_name` | `name` |
| `context_window` | `contextWindow`(缺失则不写) |
| `max_output_tokens` | `maxTokens`(缺失则不写) |
| `modalities.input` | `input`(过滤为 text/image/audio/video/pdf) |
| `supported_reasoning_levels[].effort` | `reasoningEfforts`(`none`→`off`,未知档位丢弃) |
| `reasoning: false` | `reasoningEfforts: false` |

### 安装

克隆本仓库,把 checkout 目录作为 dsh bundle 安装(Plugin Manager → 从目录安装,或在 Harness 会话中用 `plugin_manager` 传入包的绝对路径)。

bundle 插入一行(`magpie-sync`);要求 profile 已挂载 `llm-pi-ai`(官方自带)与 Web 组合(webServer / configEditor / credentials)。

### 配置

行配置里的两项(`cordis.patch.yml` 内置默认值):

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `gatewayUrl` | `http://127.0.0.1:3425` | magpie 网关地址 |
| `credentialRef` | `MAGPIE_GATEWAY_KEY` | 网关密钥的凭据引用名 |

可选:`routeName`(默认 `magpie`)、`api`(`openai-completions`)、`modelOverrides`(按模型纠偏)。

密钥本体在插件的设置页输入,存入 dsh 凭据存储(引用名 `credentialRef`),**不进任何配置文件**。若 magpie 自带的 dsh 集成已写入 `MAGPIE_GATEWAY_KEY`,无需再填。

### 使用

设置 → **Magpie 模型同步**:

1. **检查变更** —— 拉取网关,展示新增/移除/变更模型与路由字段变化。
2. **应用** —— 写入路由(仅当 diff 非空时可用)。

### 依赖面

宿主侧仅注入三个 dsh 服务:`webServer`(同源 HTTP 通道)、`configEditor`(经 Loader 路径持久化)、`credentials`(密钥存储)。无其他 dsh 插件库依赖,无构建步骤,无 npm 依赖。

### 共存说明

- magpie 内置的 dsh 集成每约 30 秒重写**它自己的**路由键(如 `magpie-otter`);本插件写不同的键且只写自己的键,二者可共存,但功能重叠 —— 二选一即可。使用本插件时可以在 magpie 里断开其内置 dsh 集成。
- 被同步路由内部的手工修改会被下一次 apply 覆盖。私有模型请另建路由,或用 `modelOverrides` 固定取值。
- dsh 的 home 层 patch(`~/.dsh/cordis.patch.yml`)优先于 profile 层;若其中带有 `llm-pi-ai` 配置,同步可能被静默遮蔽 —— 状态卡会显示该行是否正常解析。

## License

MIT
