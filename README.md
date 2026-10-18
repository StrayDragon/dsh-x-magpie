<div align="center">

<a href="https://github.com/StrayDragon/dsh-x-magpie"><img src="assets/icon.svg" width="112" alt="dsh-x-magpie 图标:深色圆角底上的 magpie 鹊鸟,右下角为青色同步徽标"></a>

# dsh-x-magpie

**把 magpie 网关的模型目录同步为 dsh 的一个模型供应商。**

拉取 magpie 网关的模型列表,写入 dsh 的 llm-pi-ai 供应商路由。
写盘之前先展示逐字段差异,确认后才应用。

[![版本](https://img.shields.io/badge/版本-0.7.1-1f2430)](#更新日志)
[![协议](https://img.shields.io/badge/协议-MIT-1f2430)](#许可证)
[![dsh](https://img.shields.io/badge/DeepSeek_Harness-插件-1f2430)](https://github.com/deepseek-ai)
[![magpie](https://img.shields.io/badge/magpie-网关同步-1f2430)](https://usemagpie.ai)

[安装](#安装) · [配置](#配置) · [使用](#使用) · [字段映射](#字段映射) · [常见问题](#常见问题) · [English](#english)

</div>

---

## 这是什么

[dsh](https://github.com/deepseek-ai)(DeepSeek Harness)插件:把运行中的 [magpie](https://usemagpie.ai) 网关的模型目录,同步为 dsh 模型页里的一个供应商路由。同步后,dsh 的模型选择器列出 magpie 服务的全部模型,模型上下文与输出上限取 magpie 已知数值,不再逐个手填 `contextWindow` / `maxTokens`。

每次同步分三步:

1. **拉取**:`GET {网关}/v1/models`,映射为 llm-pi-ai 模型条目。
2. **展示差异**:新增、移除、变更的模型与路由字段,逐项列出;没有任何写入。
3. **应用**:经 dsh 的 config editor(与模型页相同的 Loader 路径)写入,只改本插件拥有的那一个路由键,其他供应商路由一律不动。

以下动作都在设置页完成,不需要手动改 YAML:

- 网关地址、显示名、协议、凭据引用名:改动后自动应用。
- 网关密钥:存入 dsh 凭据存储,配置文件只保存引用名,不保存密钥本体。
- 模型勾选:默认全选;取消勾选的模型不写入路由。
- 同步失败时保留上一次的路由,错误原因显示在页面上。

<img width="1092" height="1028" alt="image" src="https://github.com/user-attachments/assets/5b125df7-25fa-468b-9379-1afcf78960e1" />


## 安装

### 方式一:Release tarball(推荐,免构建)

每次发版,GitHub Release 附带构建好的 `.tgz`,安装时不需要任何构建授权:

1. 从 [Releases](https://github.com/StrayDragon/dsh-x-magpie/releases) 下载最新 `dsh-x-magpie-<版本>.tgz`。
2. 安装(或直接用 GitHub 上发布的 tgz 链接):

```sh
dsh plugin --profile <profile> add ./dsh-x-magpie-<版本>.tgz
```

3. 硬刷新浏览器页面(Ctrl+Shift+R),打开 设置 → Magpie 模型同步。

### 方式二:从 GitHub 克隆

1. 克隆本仓库并在本机构建:

```sh
git clone https://github.com/StrayDragon/dsh-x-magpie.git
cd dsh-x-magpie && just build   # 产物输出到 dist/
```

2. 在 dsh 的会话里对 agent 说,把 `<克隆路径>` 替换为第 1 步得到的目录:

```text
请把 <克隆路径> 作为 dsh bundle 安装到当前 profile
```

也可以不用 agent:打开 dsh 网页的 设置 → 插件,选择从目录安装,指向该目录。

3. 硬刷新浏览器页面(Ctrl+Shift+R),打开 设置 → Magpie 模型同步。

> 说明:本插件不发布到 npm。dsh 插件市场支持自定义 index 源(`npm` 源可指向任意 registry,`git` 源锁 commit);将来若要上架市场,补一份 index JSON 即可,插件包本身无需改动。

### 方式二:本地 link 安装(本机开发)

仓库已在本机、或修改过代码时,直接把目录交给 dsh。安装的是软链接:对源码目录的改动,在重新安装后生效。

```text
请把 /绝对路径/dsh-x-magpie 作为 dsh bundle 安装到当前 profile
```

注意:更新版本时,先拉取最新代码,再卸载并重新安装一次,然后硬刷新页面。client 模块只在页面加载时注入,不刷新看不到新界面。

前提:profile 已挂载 `llm-pi-ai`(dsh 自带)与 Web 组合(webServer / configEditor / credentials)。

## 配置

设置页直接修改以下各项,改动自动持久化到 profile 的 patch 文件:

| 配置 | 默认值 | 含义 |
|---|---|---|
| 网关 | `http://127.0.0.1:3425` | magpie 网关地址 |
| 显示名 | `Magpie (from dsh-x-magpie)` | dsh 模型页显示的供应商名称 |
| 协议 | `openai-responses` | `openai-responses` / `openai-completions` / `anthropic-messages` 三选一 |
| 网关密钥 | 无 | 在设置页输入,存入 dsh 凭据存储 |
| 模型勾选 | 全选 | 取消勾选的模型不写入路由 |

高级设置(设置页底部"高级"区):

| 配置 | 默认值 | 含义 |
|---|---|---|
| DSH 供应商名 | `magpie` | llm-pi-ai 路由键,限 `^[a-z][a-z0-9-]*$` |
| 凭据引用名 | `MAGPIE_GATEWAY_KEY` | 密钥在凭据存储里的名字 |
| `modelOverrides` | 空 | 按模型纠正字段,仅支持在 patch 文件中修改;值为 `null` 表示删除该字段 |

说明:magpie 的默认网关密钥为 `magpie`。若 magpie 自带的 dsh 集成已经写入过 `MAGPIE_GATEWAY_KEY`,不需要再输入。

## 使用

1. 打开 设置 → Magpie 模型同步。
2. 填网关地址与网关密钥,两者自动保存。
3. 页面自动拉取模型目录;在列表中勾选需要的模型。
4. 配置与勾选自动应用;出错时上一次的路由保持不变,错误原因显示在页面上。

页面只有一个按钮:左上角 ⟳,拉取最新目录并立即同步。日常同步不需要按它——配置与勾选变动约 1 秒后自动生效。

也可以让 agent 代为执行:agent 工具 `magpie_sync` 提供 `plan`(只读差异)与 `apply`(写入)两个动作。

## 字段映射

| magpie `/v1/models` 字段 | llm-pi-ai 模型条目 |
|---|---|
| `id` | `id`,兼作显示名(`name`) |
| `context_window` | `contextWindow`;缺失则不写,由 llm-pi-ai 默认值兜底 |
| `max_output_tokens` | `maxTokens`;缺失则不写 |
| `modalities.input` | `input`,只保留 `text` 与 `image` |
| `supported_reasoning_levels[].effort` | `reasoningEfforts`;`none` 映射为 `off`,未知档位丢弃 |
| `reasoning: false` | `reasoningEfforts: false`(声明非推理模型) |

说明:网关没有上报的字段一律留空,与手写路由的行为一致。`modelOverrides` 可以按模型补值或覆盖。

## 常见问题

**设置边栏里看不到本插件?**
client 模块在页面加载时注入。安装、更新或重新启用插件后,硬刷新页面(Ctrl+Shift+R);仍不出现时重启 `dsh web`。

**模型页没有出现 Magpie 供应商?**
先在设置页确认网关地址正确、密钥已存入,然后按一次 ⟳。llm-pi-ai 拒绝写入时,错误原因显示在设置页上。

**想换模型页里显示的供应商名?**
改"显示名",自动同步。路由键(`DSH 供应商名`)只作内部标识,格式固定,见上表。

**与 magpie 自带的 dsh 集成是什么关系?**
功能重叠,二选一。magpie 内置集成每约 30 秒重写它自己的路由(如 `magpie-otter`);本插件只写自己的路由键,两者可以并存。建议在 magpie 里断开其内置 dsh 集成,以本插件为唯一同步来源。

**被同步路由里的手工修改会保留吗?**
不会。下一次同步按网关目录与勾选重写该路由。私有模型请另建路由,或用 `modelOverrides` 固定取值。

**协议怎么选?**
magpie 网关同时支持三种协议。`openai-responses` 与 `openai-completions` 走`{网关}/v1`,`anthropic-messages` 走网关根路径;插件按协议自动拼接,不需要手动改地址。

## 开发

仓库以 TypeScript 维护,`src/` 是唯一事实来源;`dist/` 是构建产物,不要手改,也不入库(CI 现场构建)。所有日常命令走 [just](https://github.com/casey/just):

```sh
just    # 列出全部命令(每条上方注释即说明)

just install      # bun install --frozen-lockfile
just check        # typecheck + build + smoke,与 CI 完全一致
just dev          # 日常循环:装依赖 + 构建 + 冒烟
just pack         # 构建 + 打出可安装的 .tgz(dsh plugin add ./x.tgz 即装)
just release 0.8.0  # 改版本号 + commit + 打 tag + push(触发 Release CD)
```

CI(GitHub Actions)在每次 push 与 PR 上运行 `just check` 同款步骤,并断言 `dist/` 关键产物存在。发版:打 `v*` tag 后,Release 工作流构建、打包 tarball 并附到 GitHub Release,无任何密钥要求。

## 项目结构

```text
dsh-x-magpie/
├── justfile             # 任务入口;裸 just 列出全部命令与注释
├── src/                 # TypeScript 源(唯一事实来源)
│   ├── index.ts         # host 半:拉取 / 映射 / 差异 / 写入,同源 HTTP 路由
│   ├── client-core.ts   # client 半:设置页 UI,注册于 settings.section
│   ├── shared.ts        # 两半共享的类型与常量
│   └── dsh-client-env.d.ts
├── scripts/             # build.ts 构建入口;smoke.mjs 行为冒烟;release.ts 发版
├── dist/                # 构建产物(git 不入库):index.js / client.js / types/
├── assets/              # 静态资源:icon.svg + locale/*.json(插件名与描述)
├── package.json         # bundle 清单:dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml     # 插入 dsh-x-magpie 行,携带默认 config
└── .github/workflows/   # ci.yml 质量门;release.yml 打 tag → tarball → GitHub Release
```

host 半注入 3 个 dsh 服务:`webServer`(同源 HTTP)、`configEditor`(经 Loader 路径持久化)、`credentials`(密钥存储)。运行时零 npm 依赖;TypeScript 工具链仅 devDependencies,不进入安装包。

## 更新日志

- 0.7.1 工程化:产物收敛 `dist/`、静态资源迁移 `assets/`、justfile 任务入口、Release CD(tag → tarball → GitHub Release);运行时行为与配置面不变。
- 0.7.0 TypeScript 重写(`src/` 为源,strict tsc)与 CI 质量门;运行时行为与配置面不变。
- 0.6.0 项目更名 `dsh-x-magpie`;同步徽标箭头沿弧线切线方向。
- 0.5.x 显示名可配置;模型勾选列表按供应商分组,支持模糊搜索;单一 ⟳ 按钮,其余改动自动应用,失败保留上一次路由。
- 0.3–0.4 模型勾选与自动同步;协议默认 `openai-responses`;设置页直接改配置。
- 0.1–0.2 首个可用版本:plan / apply 两步同步,字段级差异展示。

## English

A [DeepSeek Harness](https://github.com/deepseek-ai) plugin that syncs the model catalog of a running [magpie](https://usemagpie.ai) gateway into one dsh `llm-pi-ai` provider route, with a field-level diff before any write.

1. Grab the prebuilt `.tgz` from [Releases](https://github.com/StrayDragon/dsh-x-magpie/releases) and run `dsh plugin --profile <name> add ./dsh-x-magpie-<version>.tgz` — no build-step approval needed. Alternatively clone and `just build`, then install the directory.
2. Hard-refresh the browser page, then open Settings → Magpie model sync.

The settings page handles the rest: gateway URL and key, per-model selection (all selected by default), protocol, and display name. Edits apply automatically; a failed sync keeps the previous route. Development: `just` lists every task, `just check` mirrors CI, and pushing a `v*` tag publishes a release tarball. Field mapping and details: see the Chinese sections above. The settings UI is bilingual (English / 简体中文).

## 许可证

MIT,见 [LICENSE](LICENSE)。

插件图标组合了 [magpie](https://github.com/yetone/magpie) 的鹊鸟标志(`assets/icon.svg`,MIT,© yetone)与同步徽标,署名保留于此。
