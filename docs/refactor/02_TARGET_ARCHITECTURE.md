# 02 · 目标架构（MindCode-IDE）

> 本文定义重构的**目标状态**，不是一次性推翻现状。现有 Electron 边界（sandbox/contextIsolation/nodeIntegration/CSP/preload contextBridge）已合规，作为地基保留；目标架构是在其上**收敛边界规则、统一契约、拆分职责、补齐安全**。
> 设计原则：最小惊讶、单一职责、单一事实源、安全默认（secure by default）、可测试。
> 约束：不为"看起来高级"引入复杂度；能用现有 Zustand + IPC 解决的不引入新框架。

---

## 1. 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (沙箱, 无 Node 能力)                                 │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  UI 组件层  │→ │ 状态层 Zustand │→ │ 服务层 (window.mindcode│   │
│  │ components  │  │ (6 个 store)  │  │  的类型化封装)       │   │
│  └────────────┘  └──────────────┘  └─────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                    contextBridge │ (仅暴露白名单 API)
┌───────────────────────────────┴─────────────────────────────┐
│  Preload Bridge (最小面, 类型化 IPC 契约)                       │
│  window.mindcode.{fs,ai,git,terminal,lsp,debug,index,plugin,  │
│                    settings,secrets} —— 每个方法 = 1 IPC 契约   │
└───────────────────────────────┬─────────────────────────────┘
              typed ipcMain.handle │ (每 channel: 入参校验 + validateSender + 信任门)
┌───────────────────────────────┴─────────────────────────────┐
│  Main Process (完整 Node 能力, 唯一特权层)                      │
│  ┌──────────────┐  ┌────────────────────────────────────┐    │
│  │ IPC Handler 层 │→ │ Core Domain Services (跨进程复用逻辑) │    │
│  │ (薄, 只做校验+  │  │ ai / indexing / lsp / encoding /    │    │
│  │  转发+序列化)   │  │ workspace / recovery / plugins ...  │    │
│  └──────────────┘  └────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Infrastructure: 子进程(pty/git/lsp/dap) · 持久化 ·      │   │
│  │  Secrets(safeStorage) · Logger(脱敏) · Workspace Trust  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         Worker/UtilityProcess: 索引/解析等 CPU 密集任务离开主线程
```

各层职责：

| 层 | 职责 | 禁止 |
|---|---|---|
| **Renderer UI** | 渲染、交互、组件状态 | 直接 fs/path/child_process；直接 fetch 第三方；持有明文密钥 |
| **State (Zustand)** | 应用状态单一事实源 | 业务副作用逻辑（放服务层）；跨 store 直接 setState |
| **Renderer Service** | 封装 `window.mindcode.*` 调用、类型转换、错误处理 | 越过 preload 直连 ipcRenderer |
| **Preload** | 用 contextBridge 暴露**白名单** API，桥接 IPC | 暴露原始 ipcRenderer / Node 模块；无类型的 passthrough |
| **IPC Handler** | 入参校验 + validateSender + 信任门 + 调用 Core + 序列化 | 承载业务逻辑（应在 Core）；无校验的路径/命令透传 |
| **Core Domain** | 纯领域逻辑（AI/索引/LSP/编码…），可单测 | 直接依赖 Electron API（通过接口注入）；跨进程 window 访问 |
| **Infrastructure** | 子进程、持久化、Secrets、Logger、Workspace Trust | 泄漏密钥到日志；无脱敏落盘 |

---

## 2. 模块边界规则（硬约束）

### 2.1 代码归属

- **只能在 main**：`child_process`/`spawn`/`pty`、原始 `fs` 写、`keytar`/`safeStorage`、DAP/LSP 子进程管理、AI provider 出站请求（含 API Key）、`electron` 主进程 API。
- **只能在 renderer**：React 组件、DOM、Monaco 实例、Zustand store。
- **可跨进程（core，须无 Electron 直依赖）**：AI 领域逻辑（prompt/context/router，但**实际网络请求在 main**）、索引算法、编码转换、类型定义。core 通过**依赖注入**拿到 fs/net 能力，不 `import electron`。
- **shared**：纯类型 + 纯函数工具，main 与 renderer 都能安全导入。

### 2.2 preload 暴露规则

- 只暴露**显式白名单**方法，每个方法对应一个已知 IPC channel；**禁止** `exposeInMainWorld('ipc', ipcRenderer)` 式的原始透传。
- 事件订阅返回 `cleanup` 函数（现状已做）；**requestId 必须可被调用方用于 cancel**（修复 P1-4）。
- 新增 `window.mindcode.secrets`：`{ get(provider), set(provider, key), list() }` → main 用 `safeStorage` 加密存储；**renderer 永不接触明文 key**（现状 renderer 确实不碰 key，保持）。

### 2.3 IPC channel 命名与类型约束

- 命名：`域:动作`（`fs:readFile`、`ai:chatStream`、`debug:start`），已有约定保留。
- **每个 channel 必须有 shared 类型契约**：`src/shared/types/ipc.ts` 定义 `{ 请求参数, 响应 }`，preload 与 handler 双向引用同一类型（现状部分已做，补全）。
- **每个 `ipcMain.handle`/`on` 三件套**：① `validateSender(event)` 校验来源 frame；② 入参 schema 校验（用轻量 runtime 校验，如手写 guard 或 zod 视依赖策略）；③ 需触碰文件/命令的加**工作区信任门** `ctx.getWorkspacePath()`。三者当前覆盖不一致（写类严、读类松），目标是**全覆盖**。

### 2.4 文件系统访问限制

- 单一入口 `isPathAllowed(target, workspaceRoot)`：`realpath` 解析后必须落在**受信工作区**内（防 `..` 穿越与软链逃逸）。
- **未打开工作区 → 一律拒绝**（删除现有依赖系统 denylist 的兜底分支，改白名单）。
- 读、写、搜索、枚举、stat 一视同仁走同一校验（修复 P1-1 的读写不对称）。

### 2.5 命令执行限制

- **PTY/terminal**：明确定义为"等价任意命令执行"，边界是**工作区信任 + 用户可见性**，不再用误导性黑白名单假装安全；write/resize/close/cd/pwd 全补 `validateSender`。
- **git/lsp/dap 子进程**：`shell:false`（已做）；`cwd` 限受信工作区；`env` 走 `getSafeEnv` 白名单（**删除所有 `MINDCODE_*_API_KEY`**，防 hook 窃取）；npx 类命令绝对路径解析防 `.bin` 劫持。
- **debug:start**：program/cwd 限工作区内 + 信任门 + validateSender（修复 P1-2）。

### 2.6 插件权限限制

- 插件加载环境：**独立 Worker / utilityProcess 沙箱**，非主进程直 eval/require（现状 loadModule 是死 stub，重建时按此实现）。
- manifest 声明 `permissions`（fs.read/fs.write/terminal/git/network/ai/editor/workspace）→ **加载前 enforcement**（现状 integrity/permission 是死代码，接线时必须在 loadPlugin 前置执行）。
- 插件 API 面按 permission 动态裁剪；未声明的能力 = undefined。

### 2.7 AI 工具调用隔离

- **单一裁决点**：`agentToolService.execute` 是唯一权限裁决处，读 `toolPermissions.requireConfirmation` 统一走确认回调（收敛 P2-4 的三处硬编码）。
- 写文件工具：main 侧工作区围栏兜底（已有）+ 写前持久化 checkpoint（修复 P1-5）。
- 命令工具：走 terminal 信任门。
- 循环预算：maxIterations + 累计 token/成本上限，超限暂停询问（修复 P2-20）。

### 2.8 API Key 存储与禁止位置

- **存储**：main 进程 `safeStorage`（OS 级加密）或 keytar（若保留），落盘于 userData。
- **禁止**：源码硬编码（历史已犯，P0-1）、明文写 settings.json、写日志（P2-2）、经 IPC 明文往返到 renderer、提交进 git。
- **出站**：默认官方端点（修复 P0-2）；第三方中转仅显式配置且 UI 明示。

---

## 3. 目标目录结构

现状目录已接近合理，**不做大搬迁**（避免制造巨型 diff），只做以下收敛：

```
src/
├── main/                  主进程（保留）
│   ├── index.ts           入口（瘦身：菜单模板抽出到 menu.ts）
│   ├── menu.ts            应用菜单（从 index.ts 拆出，现 index.ts 有 ~340 行菜单）
│   ├── security/          【新增】window-guards.ts(will-navigate/openHandler)、path-guard.ts、safe-env.ts
│   ├── preload.ts         保留，补 secrets 桥
│   ├── ipc/               保留 10 个 handler，统一加校验中间件
│   │   └── _middleware.ts  【新增】validateSender + schema 校验 + 信任门的复用封装
│   └── workers/           【新增】indexing.worker.ts 等 CPU 密集任务
├── preload/               （可选）若 preload 变复杂再独立目录，暂留 main/preload.ts
├── renderer/              渲染进程（保留）
│   ├── stores/            收敛为 6 个明确 store（见 §4），删 createStore/contexts 死代码
│   ├── hooks/             useEditorFiles 收敛到 store（修复双真源 P1-6）
│   ├── services/          window.mindcode 类型化封装
│   └── components/        删重复/死组件，useChatEngine 拆分
├── core/                  领域服务（保留，删死模块）
│   ├── ai/                统一 1 套路由 + provider 基类抽取，删 router.ts/composer 死代码
│   ├── indexing/          解析移入 worker
│   ├── secrets/           【新增】safeStorage 封装
│   └── (删除 collab/remote/learning/extensions/workspace 死代码，或明确标注 stub)
├── shared/                跨进程类型 + 纯工具（强化 IPC 契约类型）
└── test/                  补核心链路测试，重命名 integration
```

**删除清单（M2/M3 执行，需逐一确认无引用）**：`renderer/contexts`、`renderer/stores/createStore.ts`、`renderer/i18n`（或接线）、`core/extensions`、`core/workspace`、`core/collab`、`core/remote`、`core/learning`、`core/ai/router.ts`、`core/composer`、`completion-server`（或文档化）、`python_examples`、`.kiro`、`=0.24.0`、`eslint.config.mjs`、`StatusBarEnhanced.tsx`。

---

## 4. 状态管理方案

现状：仅 3 个真 store（useAIStore 638 行偏大、useFileStore、useUIStore），另有大量死的 contexts/createStore。目标是**保留 Zustand、按域拆分、删死代码**，不引入新状态库。

| Store | 职责 | 来源 |
|---|---|---|
| **workspaceStore** | 工作区根、文件树、信任状态 | 从 useFileStore 拆出工作区部分 + useWorkspace hook |
| **editorStore** | openFiles、activeFileId、脏标记、每文件 model 状态 | **收敛 useEditorFiles + useFileStore.openFiles 双真源为此单一源**（修复 P1-6） |
| **aiChatStore** | 会话、消息、流式、工具循环、pendingChanges、模型路由 | 现 useAIStore 拆分（把 Agent/Debug/队列逻辑移到 hooks，store 只存状态） |
| **settingsStore** | 主题、快捷键、AI 配置（不含明文 key）、面板偏好 | 现 useUIStore 部分 + settings 服务 |
| **terminalStore** | 终端会话列表、活动终端、输出缓冲元数据 | 新建（现状终端状态散在组件） |
| **gitStore** | 分支、状态、diff、暂存区 | 新建（现状散在 GitPanel） |

规则：store 只存状态 + 简单 action；**副作用/IPC 调用放 hooks 或 service 层**；store 之间不互相 setState（用派生 selector 或在 hook 层编排）。useAIStore 638 行、useChatEngine 1300 行必须按此拆分。

---

## 5. AI 子系统方案

现状核心（llm-client 熔断/重试/降级 + 6 provider + tools）真实可用，但有假取消、复制粘贴、三套路由、盲写文件、默认中转等问题。目标：

| 组件 | 目标设计 |
|---|---|
| **Provider Adapter** | 抽 `OpenAICompatibleProvider`（openai/gemini/deepseek 继承，只覆写 baseURL/reasoning/模型列表）+ `AnthropicCompatibleProvider`（claude/glm）。消除逐行复制（P2-17），清 console.log |
| **Model Router** | **收敛为唯一** `getProviderForModel`（放 llm-client 导出），ai-handlers 与补全复用；修 gemini 前缀匹配；删 core/ai/router.ts（P2-18） |
| **Streaming** | 保留 SSE/SDK stream 经 IPC token 事件；requestId 可被 cancel |
| **Abort/Cancel** | **贯穿全链**：provider 接 `AbortSignal` → ai-handlers 存 `AbortController` 于 activeStreams → cancel 时 `abort()`+`res.destroy()` → preload 回传 requestId（修复 P1-4） |
| **Retry/Timeout** | 保留指数退避重试；**启用**声明未用的 TIMEOUT 常量给非流式加整体超时（P2-19）；熔断器保留 |
| **跨厂商降级** | 默认关闭或首次弹窗确认（P2-3），同厂商内降级保留 |
| **Prompt/Context Builder** | 保留 @codebase 注入、tiktoken token 预算、messageCompressor 历史压缩；加累计 token 预算门（P2-20） |
| **Tool Calling** | agentToolService 单一权限裁决点（P2-4）；写文件走 checkpoint |
| **Code Edit / Diff / Apply** | Composer analyze **先读原文**传入上下文；真实 old-vs-new diff；写盘前**持久化** checkpoint（修复 P1-5）；applyCode 落点走统一 editorStore（修复 P1-6） |
| **Token Budget** | tiktoken 计数 + 每会话/每循环预算上限 |
| **脱敏日志** | 所有 AI 日志经 redact（sk-/Bearer/x-api-key），删 codesuc key 日志（P2-2） |

---

## 6. 安全方案（优先级最高）

| 项 | 现状 | 目标 |
|---|---|---|
| contextIsolation | ✅ true | 保持 |
| nodeIntegration | ✅ false | 保持 |
| sandbox | ✅ true | 保持 |
| webviewTag | ✅ 未开 | 保持 |
| CSP | ✅ 已注入（prod 严格） | 保持；扩展市场改主进程代理 fetch 而非放开 connect-src |
| preload 最小 API | ✅ contextBridge 白名单 | 保持；补 secrets 桥、requestId 可 cancel |
| **IPC 输入校验** | ⚠️ 覆盖不一致 | **全 channel** validateSender + schema + 信任门（`_middleware.ts` 统一封装） |
| **path traversal** | ⚠️ 读类无防护 | 读写搜索统一 `isPathAllowed(realpath, workspace)`；未开工作区拒绝 |
| **shell/terminal** | ⚠️ 白名单是摆设 | 明确 PTY=任意执行，边界=信任门+可见性；write 补 validateSender |
| **debug/lsp 执行** | ⚠️ 无信任门 | 加信任门 + program/cwd 限工作区 + env 白名单 |
| **plugin sandbox** | ⚠️ 加载链死、权限死代码 | Worker 沙箱 + 加载前 permission enforcement |
| **secret storage** | ⚠️ 仅 env，历史泄漏 | safeStorage 加密 + 设置 UI；轮换历史泄漏 key（Owner）|
| **secret scanning** | ❌ 无 | pre-commit gitleaks |
| **日志脱敏** | ❌ 无 | Transport 写入前统一 redact |
| **依赖漏洞** | ⚠️ 39 个 | 非破坏性 audit fix（M0）+ major 升级评估（M9） |
| **AI 工具权限** | ⚠️ 三处硬编码 | 单一裁决点 + 确认回调 |
| **默认出站** | ⚠️ 第三方中转 | 官方端点默认；中转显式配置 |
| **外链导航** | ❌ 无守卫 | setWindowOpenHandler deny + shell.openExternal；will-navigate 拦截 |

---

## 7. 测试方案

现状：256 用例集中外围，核心链路 0 覆盖，e2e 不进 CI。目标金字塔：

| 层 | 目标 | 重点覆盖 |
|---|---|---|
| **unit** | 核心领域逻辑 | ai/tools/executor + rollback（写入/回滚）、llm-client（降级/重试/熔断/超时）、encoding、indexing 解析、model router |
| **integration** | 真跨模块（重命名现有伪集成） | IPC handler + core service 联动；DAP/LSP 消息编解码 |
| **IPC contract tests** | preload↔handler 契约一致 | 每个 channel 的请求/响应类型 + 校验拒绝非法入参 |
| **AI provider mock tests** | 不需真实 key | SSE 解析、工具增量、abort 生效、错误分类脱敏 |
| **file system safety tests** | 路径安全回归 | `../` 穿越、软链逃逸、未开工作区拒绝、denylist 移除后白名单生效 |
| **plugin sandbox tests** | 权限 enforcement | 未声明 permission 的能力不可用、危险模式检测拦截 |
| **Electron e2e** | 真启 Electron，进 CI | 启动、打开文件、编辑保存、切 tab 不污染（P0-4 回归）、面板可见 |
| **regression tests** | 每修一个 P0/P1 配一个回归用例 | P0-4 切 tab、P1-1 fs 越权、P1-4 cancel、P1-6 双真源 |

CI：`lint`（0 error）+ `typecheck`（含 test）+ `unit/integration` + `e2e`（build+xvfb）+ `audit`（高危阻断）+ `gitleaks`。

---

## 8. 关键取舍（详见 ADR）

- **ADR-0001**：默认 AI 端点从第三方中转改为官方端点——若 Owner 确认中转是既定基础设施，则改为"默认官方 + 文档/UI 明示可切中转"，而非静默默认中转。
- **ADR-0002**：secrets 存储选型 safeStorage vs keytar——倾向 safeStorage（无原生编译负担，Electron 内建），keytar 作为已装依赖可评估移除。
- **ADR-0003**：伪实现功能（collab/remote/GitHub/插件市场）——补齐 vs 从 UI 摘除的逐个决策。

以上 ADR 在进入对应 milestone 时创建于 `docs/refactor/ADR-xxxx.md`。
