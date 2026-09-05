# 05 · M2–M4 设计（类型契约 / 边界收敛 / AI 子系统）

> 日期：2026-09-05。基点：`main = 46c8a1b`（M0/M1/M5 + P1-4/P1-6/P1-8 修复已全部合入，本地与 origin 一致）。
> 本文是路线图 `03` 中 M2、M3、M4 三个 milestone 的共同设计文档，向下派生三份实施计划（每个 M 一份）。
> 上游文档：`00` 基线审计、`01` 问题登记册、`02` 目标架构、`03` 路线图。本文只写"怎么做、做到什么程度、怎么验证"，不重复问题描述。

---

## 0. 决策记录（已与 Owner 逐项确认）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 三个 M 的组织方式 | 一份 spec（本文），三份 plan **串行**：每个 M 一条分支、小 commit，合入 main 前过四道门禁，合入后再开下一个 M |
| D2 | 死模块（i18n / collab / remote / learning / extensions 等 0 引用摆设） | **全部删除**，README / README_CN 同步去掉对应宣称与目录树条目 |
| D3 | 跨厂商降级（P2-3） | **默认关闭**，设置项 `ai.crossVendorFallback` 可打开；同厂商内降级保留 |
| D4 | IPC 入参校验实现 | **手写 guard 组合子**，不引入 zod 等运行时依赖 |
| D5 | `python_examples/`、`.kiro/`（M0 遗留、02 删除清单内、非代码依赖） | 随 M3 删除；Owner 在 M3 开始前仍可否决 |
| D6 | codesuc provider（config 已标弃用、选择器已隐藏、代码仍在启动时构造并探测） | **整体移除**，产品口径改为 5 家厂商 |
| D7 | GLM 传输层 | 改为 `claude.ts` 现有裸 http 传输的子类；**需 Owner 用真实 GLM key 冒烟**，不过则保留 SDK 版并留独立 revert 点 |
| D8 | 未知模型 id 的路由行为 | **返回明确错误**，不再静默落到 claude |
| D9 | 模型目录 | 抽到 `src/shared/ai/models.ts` 作为单一源，选择器 / 路由 / 降级链 / 任务分级全部派生 |
| D10 | 六 store 拆分、useChatEngine 全量拆分 | **不在 M2–M4 范围**。M4 只按 P2-4 / P2-20 需要抽出工具循环一块 |

---

## 1. 基线与关键事实（2026-09-05 实测）

### 1.1 门禁基线

| 门禁 | 结果 |
|---|---|
| `npm run lint` | 退出 0；0 error，801 warning |
| `npm run test` | 27 个文件 / 331 个用例通过 |
| `npm run build` | 通过 |
| `npm run test:e2e` | 20 个 Electron 用例通过（本地）；CI 在 Linux xvfb 下跑同一套 |

801 条 warning 按规则：`explicit-function-return-type` 401、`no-explicit-any` 213、`no-console` 83、`only-export-components` 39、`no-unused-vars` 34、`exhaustive-deps` 31。

### 1.2 IPC 现状

- 渲染→主进程：**66 个 `ipcMain.handle` + 8 个 `ipcMain.on`**（`ai-chat-stream`、`ai-chat-stream-with-tools`、`ai-stream-cancel`、`theme:change`、`window:close/maximize/minimize/showMenu`），分布在 `src/main/ipc/` 13 个文件与 `src/main/index.ts`（5 个）。
- 主→渲染推送：**34 个通道**（ai 流 8、菜单 18、索引 3、终端 2、fs/lsp/theme 各 1）。
- `validateSender` 只出现在 32 处：fs 17/18、ai 4/7、terminal 3/7、debug 2/20、git 2/12、marketplace 全覆盖；**index / lsp / plugin / settings / dashboard / window 为 0**。
- 信任门：debug 已用 `isWithinWorkspace`（M1）；terminal 2 处检查 `getWorkspacePath()`；lsp 无；git 只做 `sanitizeSecretEnv`。
- `src/shared/types/ipc.ts`（663 行）已有 `IPCInvokeChannelMap` / `IPCEventChannelMap`，但**与实际注册已漂移**（缺 `ai-chat-stream`、`ai-stream-cancel`、`debug:detect`、`dashboard:stats`、`marketplace:search`、`plugins:*` 等），且**只被 `test/unit/ipc/type-safety.test.ts` 引用**；preload 123 处 `ipcRenderer.invoke/on` 全是裸字符串。
- 返回值形状：66 个 invoke 通道中约 55 个返回 `IPCResult` 形状；约 11 个返回裸值（`get-app-version` string、`fs:openFolder` string|null、`settings:get` SettingValue、`lsp:status`、`lsp:detect`、三个对话框 `{canceled,...}`、`void` 等）。
- 两个 tsconfig 都 `exclude: src/test`，测试代码从不经过 tsc。

### 1.3 AI 子系统现状

| 文件 | 行数 | 备注 |
|---|---|---|
| `providers/codesuc.ts` | 473 | 已弃用仍在构造并 `probeCapabilities()` |
| `providers/claude.ts` | 374 | 裸 http/https 传输：AbortSignal、30s 空闲超时、10MB 上限 |
| `providers/deepseek.ts` / `gemini.ts` / `openai.ts` | 232 / 216 / 181 | 全走 OpenAI SDK；openai↔gemini 差 75 行、openai↔deepseek 差 111 行（deepseek 多 `reasoning_content`） |
| `providers/glm.ts` | 194 | 走 `@anthropic-ai/sdk`，与 claude.ts 差 568 行（传输不同，非复制） |
| `llm-client.ts` | 422 | `getProviderForModel` 私有；`TIMEOUT_READ_MS=60000` 声明未用；`FALLBACK_MODELS` 里多数 id（如 `claude-opus-4-6-thinking`、`gemini-3-pro-high`）在选择器中不存在 |
| `main/ipc/ai-handlers.ts` | 507 | 第二份 `getProviderForModel`，`startsWith("gemini-")` 无法匹配带 `[次]` 前缀的 gemini id → 误路由到 claude；唯一超时是 `FAST_MODEL_TIMEOUT_MS=2000` |
| `core/ai/model-router.ts` | — | 任务分级路由（primary/fast/cache），useChatEngine 在用，**保留**；含 codesuc 家族 |
| `AIPanel/hooks/useChatEngine.ts` | 1310 | 第 ~950 行硬编码 `requiresConfirm = ["workspace_writeFile","terminal_execute"]`；第 1036 行 `maxIterations = 50`，每轮重发全量历史；codesuc 映射 3 处 |
| `renderer/services/agentToolService.ts` | 635 | `execute()` 只做 `isToolCallBlocked`；checkpoint 为内存 Map |
| `core/ai/tools/schemas.ts` | — | `toolPermissions`（requireConfirmation / allowInChat / allowInAgent / risk）**只被死代码 executor.ts 消费** |
| `core/ai/tools/{executor,rollback,audit-log,impact-analyzer,file-chunker}.ts` | — | 0 消费者（barrel 只被待删的 `core/composer/index.ts` 引用） |
| `core/agent/composer.ts` + `checkpointManager.ts` | 258 + — | 在渲染进程运行（`window.mindcode.ai.chat` / `fs`）；analyze 不读原文；checkpoint 内存态 |
| `renderer/components/ComposerPanel.tsx` | — | App 实际挂载的 Composer UI；预览只显示 `newContent` |
| `renderer/components/DiffEditor.tsx` / `AIPanel/DiffPreview.tsx` | — | 已有 original/modified 对比组件，可复用 |

`AIProvider.chat(messages)` 无 `signal` 参数；`StreamCallbacks.signal` 已有（P1-4 修复）。

### 1.4 死模块证据（`from` 引用扫描，排除自身与测试）

| 模块 | 源码引用 | 备注 |
|---|---|---|
| `renderer/contexts`、`renderer/stores/createStore.ts` | 0 | P2-15 |
| `renderer/i18n` | 0 | P2-14 |
| `core/extensions`、`core/workspace`、`core/collab`、`core/remote`、`core/learning` | 0 | README 宣称的能力 |
| `core/ai/router.ts` | 仅 `core/ai/index.ts` 转出，无消费者 | P2-18 |
| `core/composer/` + `renderer/components/Composer/` | 两者互引；App 挂载的是 `components/ComposerPanel.tsx` | — |
| `renderer/components/StatusBarEnhanced.tsx` | 仅 `test/components/StatusBar.test.tsx` | P2-26 |
| `src/completion-server/`（Python） | 0 | 含 M0 未删的 `=0.24.0` 垃圾文件 |
| `python_examples/`、`.kiro/` | 非代码 | D5 |

---

## 2. 总体方案与推进纪律

### 2.1 契约先行

三个 M 在同一条链上：**M2** 让已存在但零使用的通道契约 map 成为真实单一源，两端调用被类型约束；**M3** 把 M2 的类型胶水升级为策略中间件（来源校验 + 入参 guard + 信任门），一处套全部通道；**M4** 在契约已稳定的前提下重构 ai-handlers 内部并新增 checkpoint 通道（契约测试会强制它进 map）。

否决的替代方案：中间件先行（无类型版写一遍再改一遍）；一次性重写 IPC 层（巨型 diff，违背 03 的小步回滚原则）。

### 2.2 纪律

- 分支：`refactor/m2-type-contracts` → `refactor/m3-boundaries` → `refactor/m4-ai-subsystem`，各自从最新 main 切出。
- 四道门禁：`npm run lint && npm run test && npm run build && npm run test:e2e`，任一红即停，不硬推。
- 每个 M 收尾：更新 `01` 登记册状态、`03` 路线图勾选、README 同步、本文 §6 勾选。
- 密钥不进聊天、不进代码、不进测试。需要真 key 的验证由 Owner 本地执行并回报结果。

---

## 3. M2 · 类型系统治理 + shared 契约

### 3.1 目标 / 非目标

目标：契约 map 与实际通道一致且被两端引用；测试代码进 tsc；`no-explicit-any` 升 error 且 0 违规。
非目标：不改任何运行时行为；不加校验策略（M3）；不删死模块（M3）；不为消 any 引入错误的宽类型。

### 3.2 契约单一源

- `src/shared/types/ipc.ts` 重整为三张 map：
  - `IPCInvokeChannelMap`：66 个 `ipcMain.handle` 通道，`{ params: [...]; result: T }`；
  - `IPCSendChannelMap`：8 个 `ipcMain.on` 通道，`{ params: [...] }`；
  - `IPCEventChannelMap`：34 个主→渲染推送通道，`payload`。
- key 集合 **以实际注册为准**：删除未注册的幽灵条目，补齐缺失条目（含 `index.ts` 直接注册的 5 个 window/app 通道与 18 个 `menu:*` 推送）。
- 参数/返回类型从现有 handler 签名与 preload 用法反推，不臆造字段。

### 3.3 两端类型胶水

- shared 只放类型辅助：`InvokeParams<K>`、`InvokeResult<K>`、`SendParams<K>`、`EventPayload<K>`。
- main：新增 `src/main/ipc/_typed.ts`，导出 `typedHandle(channel, fn)` 与 `typedOn(channel, fn)`，是对 `ipcMain.handle/on` 的**零行为**薄包装，同时把通道名登记进一个可枚举的注册表（供 3.4 测试）。**这是临时脚手架，M3 用 `_middleware.ts` 取代并删除。**
- preload：本地 `typedInvoke / typedSend / typedOn`，123 处裸字符串调用全部改走；main 侧 34 个推送通道的全部 `webContents.send` 调用点改走 `sendToRenderer(win, channel, payload)`（名字与 preload 的 `typedSend` 区分：前者主→渲染，后者渲染→主）。
- 两端任何拼错的通道名、不匹配的参数形状都在 `tsc` 阶段失败。

### 3.4 契约一致性测试

- 运行时：`test/unit/ipc/contract-registry.test.ts` 用现有 `git-handlers.test.ts` 的 fake `ipcMain` 模式加载全部 `register*Handlers` 与 index.ts 的注册函数，断言"注册过的通道集合 == `IPCInvokeChannelMap ∪ IPCSendChannelMap` 的 key 集合"，多一个少一个都失败。
- 编译期：preload 的 API 对象用 `satisfies` 绑定到 map 派生类型，多余/缺失方法在 tsc 阶段失败。
- 现有 `type-safety.test.ts` 保留并更新到新 map。

### 3.5 测试纳入类型检查（P2-24）

- 新增 `tsconfig.test.json`：extends `tsconfig.json`，`include: ["src/**/*"]`（不再排除 `src/test`），`types` 加 vitest globals 与 `@testing-library/jest-dom`。
- `package.json` 的 `lint` 脚本追加 `tsc -p tsconfig.test.json --noEmit`；CI 的 lint job 已调用 `npm run lint`，自动生效。
- 首次开启暴露的测试类型错误在本 M 内修完；不允许用 `// @ts-expect-error` 兜底掩盖。

### 3.6 any 治理

- 213 处按批次清理，顺序 **main → core → shared/types → renderer → test**（安全边界优先）。热点：`main/lsp-manager.ts` 17、`renderer/services/agentToolService.ts` 14、`AIPanel/ContextPicker.tsx` 12、`types/index.ts` 8、`indexing/storage/sqliteStore.ts` 7。
- 替换规则：优先精确类型；确实未知用 `unknown` + 类型守卫收窄；禁止 `Record<string, any>` 式换皮；禁止为通过编译放宽函数签名。
- 允许保留的唯一形态：第三方库边界处 `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <原因>`，必须带原因。
- 收尾：`eslint.config.js` 把 `no-explicit-any` 升为 `error`；`lint` 脚本加 `--max-warnings <N>`，N 取 M2 结束时的实际 warning 数（其余 5 类规则不上涨，后续 M 只降不升）。
- 若消 any 过程中发现真实类型缺陷需要改运行时行为，**单独 commit 并登记到 `01`**，不混在类型 commit 里。

### 3.7 涉及文件

`src/shared/types/ipc.ts`、`src/main/ipc/_typed.ts`（新）、`src/main/ipc/*.ts`（13 个）、`src/main/index.ts`、`src/main/preload.ts`、`tsconfig.test.json`（新）、`package.json`、`eslint.config.js`、`src/test/unit/ipc/contract-registry.test.ts`（新）、`src/test/unit/ipc/type-safety.test.ts`、any 热点文件若干。

### 3.8 验收与验证

- 验收：`npm run lint`（含 test typecheck）退出 0；`no-explicit-any` 为 error 且 0 违规；契约一致性测试通过；四道门禁绿；`git diff` 中无运行时逻辑改动（人工审阅 + 单测集不变）。
- 验证命令：`npm run lint && npm run test && npm run build && npm run test:e2e`。

### 3.9 回滚

全部为类型层改动；按"契约重整 / 胶水接入 / tsconfig / any 批次"分 commit，任一 `git revert` 无运行时风险。

---

## 4. M3 · main/preload/renderer/core 边界收敛

### 4.1 目标 / 非目标

目标：全部 74 个渲染→主进程通道经统一中间件（来源 + 入参 + 信任门）；`index.ts` 菜单拆出；死模块清零并与 README 一致；P1-6 回归确认。
非目标：不搬大目录；不做 store 拆分；不补插件沙箱（M7）；不改 AI 调用链（M4）；路径围栏本身（`security/guards.ts`）不重写。

### 4.2 中间件 `src/main/ipc/_middleware.ts`

```ts
registerInvoke(ctx, channel, spec, impl)   // 替代 M2 的 typedHandle
registerEvent(ctx, channel, spec, impl)    // 替代 M2 的 typedOn
spec = {
  sender?: boolean;              // 默认 true：event.sender === 主窗口 webContents
  guard?: Guard<Params>;         // 入参形状，缺省视为"无参数"并拒绝任何多余参数
  trust?: "none" | "workspace";  // 默认 "none"；"workspace" 要求 ctx.getWorkspacePath() 非空
}
```

- 执行顺序：sender → guard → trust → impl。任一失败**不调用 impl**。
- 拒绝语义：返回 `IPCResult` 形状的通道返回 `{ success:false, errorCode }`，沿用现有 `ERR_UNAUTHORIZED / ERR_INVALID_PARAM / ERR_NO_WORKSPACE`；返回裸值的约 11 个通道**直接 reject**（抛 `IPCError(code)`），让调用方 bug 或恶意来源暴露而不是被吞掉。不新增第四种错误形态。
- 拒绝日志：`warn` 级记录通道名与错误码，**绝不记录入参**（可能含文件内容、命令）。
- `_guards.ts` 组合子：`str / num / bool / literal / oneOf / optional / arrayOf / obj({...}) / tuple(...)`，每个返回 `value is T`，与契约类型双向对齐；每个通道的 guard 写在其 handler 文件内、紧挨实现。
- 迁移完成后删除 `_typed.ts`；handler 内散落的 `if (!validateSender(...)) return ...` 全部移除（由 spec 承担）。

### 4.3 通道信任分级

| `trust: "workspace"` | `trust: "none"` |
|---|---|
| `fs:*`（除 `fs:openFolder`、`fs:setWorkspace`、对话框）、`git:*`、`terminal:*`、`debug:*`（除静态查询 `debug:supportedLanguages`）、`lsp:start`、`index:indexWorkspace`、`plugins:*` | `ai*`、`settings:*`、`theme:*`、`window:*`、`get-app-version`、`dashboard:stats`、`marketplace:search`、`lsp:status/detect/stop`、`index:*` 查询类、`debug:supportedLanguages` |

判定规则：凡触碰文件系统、子进程或以工作区路径为入参的通道 → `workspace`；纯查询、纯配置 → `none`。上表是初始分级，plan 阶段逐通道按入参核对，与现有行为不一致处（例如某静态查询在未开工作区时被 UI 调用）以不破坏现有 UI 为准并在 spec 注明。

P2-7 顺带修前三项：`lsp:start` 加 sender + 信任门，`cwd` 用现有 `isWithinWorkspace` 限在工作区内；npx 绝对路径解析留 M6。

### 4.4 菜单拆分

`src/main/index.ts` 第 139–482 行（`createMenu` 与模板）移到 `src/main/menu.ts`，导出 `buildApplicationMenu({ isDev, send })`，其中 `send` 只接受 `IPCEventChannelMap` 里的 `menu:*` 通道。纯搬移，零行为变化；index.ts 只留窗口生命周期、安全守卫与注册调用。

### 4.5 死模块删除

每个删除项**单独 commit**；删前重新 grep 0 引用、删后 `npm run build && npm run test`。

| 删除项 | 附带动作 |
|---|---|
| `renderer/contexts/`、`renderer/stores/createStore.ts` | `01` P2-15 → CLOSED |
| `renderer/i18n/` | README/README_CN 去掉"国际化 (中/英)"；`01` P2-14 → CLOSED |
| `core/extensions/`、`core/workspace/`、`core/collab/`、`core/remote/`、`core/learning/` | README/README_CN 去掉"智能学习"、"远程开发 (SSH)"、"实时协作"及目录树对应行；`core/index.ts` 若有转出同步删 |
| `core/ai/router.ts` | 删 `core/ai/index.ts` 中 `AIRouter/ProviderRegistry` 转出 |
| `core/composer/`、`renderer/components/Composer/` | 检查 `renderer/components/index.ts` 转出 |
| `renderer/components/StatusBarEnhanced.tsx` | `test/components/StatusBar.test.tsx` 改测生产 `StatusBar`；`01` P2-26 → CLOSED |
| `src/completion-server/` | 含 `=0.24.0`；若 README/QUICK_START 提及则删 |
| `python_examples/`、`.kiro/` | D5，Owner 可在 M3 开始前否决 |

### 4.6 P1-6 回归确认

已由 `refactor/single-editor-source` 关闭。M3 只确认 `useEditorFiles.test.ts` 与 M5 e2e 仍绿，并在 `01` 补一句"M3 回归确认"。不再改动。

### 4.7 测试

- `test/unit/ipc/middleware.test.ts`：sender 拒绝、guard 拒绝（缺参 / 多参 / 类型错）、信任门拒绝、放行并透传返回值、裸值通道 reject 语义、拒绝不调用 impl、日志不含入参。
- `test/unit/ipc/all-channels-sender.test.ts`：复用 fake `ipcMain` 模式加载全部注册函数，用非主窗口 sender 遍历契约 map 全部 74 个通道，断言全部拒绝且底层副作用（spawn / fs 写）零次。
- 每个 handler 文件挑 1–2 个代表通道测 guard 边界。
- 删除类：每步 build + test；最终四道门禁。

### 4.8 涉及文件

`src/main/ipc/_middleware.ts`、`_guards.ts`（新）、`src/main/ipc/*.ts`、`src/main/index.ts`、`src/main/menu.ts`（新）、`src/main/lsp-manager.ts`（cwd 围栏）、删除清单所列目录、`README.md`、`README_CN.md`、`docs/refactor/01_BUG_AND_RISK_REGISTER.md`、测试若干。

### 4.9 验收与回滚

- 验收：全部 74 个通道走中间件（`grep -c 'ipcMain\.(handle|on)\(' src/main` 在 `_middleware.ts` 之外为 0）；遍历测试通过；删除后 build/test 绿；README 与代码一致；四道门禁绿。
- 回滚：中间件按 handler 文件逐个 commit；删除按模块逐个 commit；菜单拆分单独 commit。任一 `git revert` 可独立恢复。

---

## 5. M4 · AI 子系统重构

### 5.1 目标 / 非目标

目标：provider 去重、路由单一、Composer 不再盲写、工具权限单一裁决、超时与预算真正生效、跨厂商降级默认关。
非目标：useChatEngine 全量拆分与六 store 拆分（D10）；插件沙箱（M7）；索引离主线程（M6）；密钥存储 safeStorage（另排）。

### 5.2 ① 真取消（P1-4）

已由 `ai-stream-sessions.ts` 关闭（`start/cancel/finish/abortAll`），`llm-client-abort.test.ts` 与 `ai-stream-sessions.test.ts` 在。M4 不改，只保证回归绿。

### 5.3 ② Provider 基类抽取（P2-17）+ 删 codesuc（D6）

- `providers/openai-compatible.ts`：`OpenAICompatibleProvider extends BaseAIProvider`，承载 OpenAI SDK 的 chat / chatStream / chatWithTools 与工具增量拼装；子类钩子：`defaultBaseUrl`、`models`、`mapMessages(messages)`（deepseek 注入 `reasoning_content`）、`extractReasoning(chunk)`（思考流）。openai / gemini / deepseek 变为薄子类。ai-handlers 中重复的 `gpt4` 实例删除。
- `providers/anthropic-compatible.ts`：以 `claude.ts` 的裸 http 传输为基类（`request()`、AbortSignal、30s 空闲超时、10MB 上限、SSE 解析、`tool_use` 增量）；`ClaudeProvider` 与 `GLMProvider` 只覆写 baseURL、模型表、认证头差异。**GLM 切换是独立 commit，Owner 用真实 key 冒烟（普通对话、流式、工具调用各一次）；不过则 revert 该 commit，GLM 留在 SDK 版**，`@anthropic-ai/sdk` 依赖随之保留或移除。
- codesuc 移除清单：`providers/codesuc.ts`、`providers/index.ts` 转出、`config.ts` 类型与默认值、`llm-client.ts` FALLBACK 条目、`model-router.ts` 三个家族、`useChatEngine.ts` 三处映射与超时表项、`shared/types/ai.ts` 的 `AIProviderType` 联合、`types/index.ts` 的 `AIModel`、`request-optimizer.ts` 注释、`ai-handlers.ts` 构造与探测；README/README_CN 模型数改为 5 家。
- provider 内所有 `console.log` 改为 `logger.child(...)`（已有脱敏 transport）。

### 5.4 ③ 单一路由（P2-18）+ 模型目录（D9）

- 新建 `src/shared/ai/models.ts`：`MODEL_CATALOG: ModelEntry[]`，字段 `id / provider / displayName / toolCapable / tier("primary"|"fast"|"cache") / family`。`ModelPicker.MODELS`、`TOOL_CAPABLE_MODELS`、`model-router.MODEL_FAMILIES`、降级链全部从它派生；不再有第二份手写表。
- 新建 `src/core/ai/resolve-provider.ts`：纯函数 `resolveProvider(modelId): AIProviderType | null`，先查目录精确 id，再按前缀规则兜底（正确剥离 `[次]` 一类渠道前缀）。`LLMClient` 与 `ai-handlers` 共用；`null` 时 `LLMClient` 返回新增错误类型 `unsupported_model`（不可重试、不降级），不再静默落到 claude（D8）。
- `core/ai/model-router.ts` 保留任务分级逻辑，数据源改为目录。

### 5.5 ④ Composer 真读原文 + 真 diff + 持久化 checkpoint（P1-5）

- **两段式协议**（`core/agent/composer.ts`）：
  1. 计划段：提示词只要求输出 `{ title, edits: [{ path, description, action: "modify"|"create"|"delete" }] }`，**禁止输出文件内容**；
  2. 编辑段：对每个 `modify` 路径先 `fs:readFile` 读原文，逐文件单独请求"给定原文与修改说明，输出完整新内容"，得到 `newContent`；`create` 直接生成；`delete` 不生成内容。`oldContent` 一律填真实原文。
- 预览：`components/ComposerPanel.tsx` 用现有 `DiffEditor`（original / modified / language）替换只显示 `newContent` 的 `<pre>`；新文件以空 original 展示。删除行数超过原文一半的编辑在列表项打"高危"标记（仅提示，不阻断）。
- **checkpoint 移到主进程**，新增契约与 preload 桥 `window.mindcode.checkpoint`：

| 通道 | 参数 | 返回 |
|---|---|---|
| `checkpoint:create` | `{ label: string; files: string[] }` | `IPCResult<{ id: string }>` |
| `checkpoint:restore` | `{ id: string }` | `IPCResult<{ restored: string[] }>` |
| `checkpoint:list` | 无 | `IPCResult<CheckpointMeta[]>` |
| `checkpoint:delete` | `{ id: string }` | `IPCResult` |

  四个通道同步写入 `IPCInvokeChannelMap` 并经 M3 中间件注册（`trust: "workspace"`，guard 校验 `files` 为非空字符串数组、`id` 为合法 id 字符），preload 桥受 `satisfies` 约束；漏写任何一端都会被 3.4 的契约测试或 tsc 拦下。
  存储于 `userData/checkpoints/<id>/`：`manifest.json`（id、label、时间、工作区根、文件列表与存在性）+ 每文件原文快照。`trust: "workspace"`；每个路径经 `isWithinWorkspace` 校验，restore 也校验（防 manifest 被改）。保留上限 50，超出淘汰最旧。`core/agent/checkpointManager.ts` 与 `agentToolService` 的内存 checkpoint 都改为调用该桥，三份实现合一；重启后仍可回滚。

### 5.6 ⑤ 工具权限单一裁决点（P2-4）

- `agentToolService.execute(name, args, { mode })` 为唯一裁决处，顺序：`isToolCallBlocked`（含 blockedPaths / blockedCommands）→ 模式门（`toolPermissions[name].allowInChat/allowInAgent`）→ `requireConfirmation` 时 `await confirmHandler({ name, args, risk })`（由 useChatEngine 通过 `setConfirmHandler` 注入一次，底层仍是现有 `onPendingConfirm`）→ 写类工具先建 checkpoint（走 5.5 的桥）→ 执行 → 审计。
- useChatEngine 删除硬编码的 `requiresConfirm` 列表与 `confirmTool` 分支，只传 `mode`。
- `ToolConfirmDialog` 的 `riskLevel` 从 `toolPermissions` 读取，不再由调用方拼。
- 测试保证 `schemas.ts` 中每个工具都有 `toolPermissions` 条目（缺失即失败）。
- 删除 `core/ai/tools/{executor,rollback,audit-log,impact-analyzer,file-chunker}.ts` 与 barrel 对应转出（M3 删掉 `core/composer` 后它们 0 消费者）；`schemas.ts` 保留。

### 5.7 ⑥ 超时（P2-19）与预算（P2-20）

- `AIProvider.chat(messages, opts?: { signal?: AbortSignal })`；`LLMClient.chat` 在 `withRetry` 的**每次尝试**内用 `AbortSignal.any([request.signal, AbortSignal.timeout(LLM_CONFIG.TIMEOUT_READ_MS)])` 传入，即每次尝试各有 60s 上限，整体受 `RETRY_MAX` 约束（Electron 30 内置 Node 20.16，`AbortSignal.any` 可用；plan 阶段用 `electron -e` 复核一次）。超时归类为现有 `timeout` 错误类型（可重试）；用户主动取消仍归 `cancelled`（不可重试）。
- `OpenAICompatibleProvider` 的流式路径补 30s 空闲超时，与 Anthropic 传输对齐；常量收敛到 `LLM_CONFIG.STREAM_IDLE_TIMEOUT_MS`。
- 工具循环从 `useChatEngine.ts` 抽到 `AIPanel/hooks/toolLoop.ts` 的 `runToolLoop(deps)`（依赖注入：发流、执行工具、更新消息、预算回调），这是 M4 对 useChatEngine 的唯一结构性改动。
- 预算：`{ maxIterations: 25, tokenBudget: 400_000 }`，设置键 `ai.agent.maxIterations` / `ai.agent.tokenBudget`；每轮用 `messageCompressor.estimateTokens(apiMessages)` 累计（**provider 不回报 usage，是估算值**，UI 文案要写"约"）。超限调用 `onBudgetExceeded({ iterations, estTokens })` 返回 `"continue" | "stop"`；`continue` 再给一个同等窗口。每轮估算超过目标时用现有 `messageCompressor.compress` 压历史。

### 5.8 ⑦ 跨厂商降级默认关（P2-3 / D3）

- 降级链由目录派生：同 `provider`、同 `family` 内更低 `tier`；跨厂商候选只在 `allowCrossVendorFallback()` 为 true 时追加。
- 设置键 `ai.crossVendorFallback`（boolean，默认 false，`SettingsPanel` AI 分类，标签"跨厂商降级"），主进程经 `getSettingsCache()` 读取并以 `() => boolean` 注入 `LLMClient`。
- `ai-stream-fallback` 事件与现有 UI 提示保留。

### 5.9 测试与手工验证

单测 / 集成：

- provider mock（OpenAI SDK 与裸 http 各一套 fixture）：token 流、思考流、工具增量拼装、abort 后不再回调、错误分类与脱敏。
- `resolveProvider` 表测试：目录内 id、`[次]gemini-*`、未知 id → `null`；`LLMClient` 对 `null` 返回 `unsupported_model`。
- 降级链：设置开 / 关两态；同厂商链正确、跨厂商项仅在开时出现。
- 超时：假时钟下非流式 60s 触发 `timeout`；流式 30s 无数据触发。
- `agentToolService`：模式门拒绝、确认通过 / 拒绝、封禁路径、每工具有权限条目。
- checkpoint IPC：create / restore / list / delete / 淘汰 / 越界路径拒绝 / manifest 篡改拒绝。
- Composer 两段式：mock `ai.chat`，断言编辑段提示词含原文、`oldContent` 非空、`delete` 无内容。
- `runToolLoop`：预算超限回调 `stop` 终止、`continue` 续跑。

**Owner 手工验证（需真实 key，结果回报后才算关闭）**：真 key 普通对话 + 中途取消；GLM 新传输普通 / 流式 / 工具各一次；对已有文件跑 Composer 看到真实 diff，应用后重启应用再回滚成功；跨厂商开关关闭时人为制造 claude 失败观察不转投。

### 5.10 涉及文件、验收、回滚

- 文件：`core/ai/providers/*`、`core/ai/llm-client.ts`、`core/ai/resolve-provider.ts`（新）、`core/ai/model-router.ts`、`shared/ai/models.ts`（新）、`shared/types/ai.ts`、`shared/types/ipc.ts`、`main/ipc/ai-handlers.ts`、`main/ipc/checkpoint-handlers.ts`（新）、`main/preload.ts`、`core/agent/composer.ts`、`core/agent/checkpointManager.ts`（删）、`renderer/components/ComposerPanel.tsx`、`renderer/components/ToolConfirmDialog.tsx`、`renderer/components/SettingsPanel.tsx`、`renderer/components/AIPanel/ModelPicker.tsx`、`renderer/components/AIPanel/hooks/useChatEngine.ts`、`AIPanel/hooks/toolLoop.ts`（新）、`renderer/services/agentToolService.ts`、`core/ai/tools/*`（删 5 个）、`README.md`、`README_CN.md`、`01` 登记册。
- 验收：provider 目录无复制实现；`grep getProviderForModel` 只剩 `resolveProvider` 一处；Composer 对已有文件的编辑 `oldContent` 非空且预览为真实 diff；checkpoint 落盘可列出；工具确认只在 `agentToolService` 内决定；`TIMEOUT_READ_MS` 有消费者；跨厂商默认关；四道门禁绿；Owner 手工清单全部回报通过。
- 回滚：①–⑦ 各自独立 commit；GLM 传输切换、codesuc 删除、checkpoint 迁移各自单独 commit 作为 revert 点。

---

## 6. 登记册与文档同步（各 M 收尾时勾选）

- [ ] M2：P2-24 → CLOSED；`03` M2 勾选。
- [ ] M3：P2-14 / P2-15 / P2-26 → CLOSED；P2-7 标"部分（npx 留 M6）"；P1-6 补回归确认；README/README_CN 去宣称；`03` M3 勾选。
- [ ] M4：P1-5 / P2-3 / P2-4 / P2-17 / P2-18 / P2-19 / P2-20 → CLOSED；P2-25 标"核心链路测试已补（llm / 权限 / checkpoint）"；README 模型口径 5 家；`03` M4 勾选。

---

## 7. 风险与开放项

| 风险 | 处置 |
|---|---|
| GLM 裸传输与其 Anthropic 兼容端点存在细微差异 | 独立 commit + Owner 真 key 冒烟；不过即 revert，保留 SDK 版 |
| 真 provider 行为无法在无 key 环境验证 | 单测全部走 mock；真 key 场景列入 §5.9 Owner 清单，Claude 不接触 key |
| 消 any 暴露真实类型缺陷 | 行为改动单独 commit 并登记 `01`，不与类型 commit 混合 |
| 删除 `python_examples/`、`.kiro/` 可能有 Owner 本地用途 | D5：M3 开始前可否决，删除为单独 commit |
| Composer 两段式约使 token 消耗翻倍 | 接受：换取不盲写；预算机制（§5.7）兜底 |
| 全通道默认 `sender: true` 可能拦住尚未发现的合法非主窗口调用 | 现状无 webview / 第二窗口；遍历测试 + e2e 兜底；发现即在 spec 显式 `sender:false` 并注明原因 |
