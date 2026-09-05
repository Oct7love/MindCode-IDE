# M2 · 类型系统治理 + shared 契约 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `src/shared/types/ipc.ts` 成为全部 106 个渲染→主进程通道与 35 个主→渲染推送通道的唯一契约源，两端调用被 tsc 约束；测试代码纳入类型检查；`no-explicit-any` 升为 error 且 0 违规。全程不改运行时行为。

**Architecture:** 契约先行。shared 里用 `as const` 通道常量 + 三张 `ChannelMap` 接口定义"通道 → 参数/返回"，并用编译期断言保证常量与 map 的 key 集合一致。主进程新增薄包装 `typedHandle / typedOn / sendToRenderer`（M3 会用中间件取代），preload 新增 `typedInvoke / typedSend / typedOn`，`window.mindcode` 的全局类型改为 `typeof api` 派生，删除 220 行手写副本。一条静态扫描测试保证 `src/main` 与 `preload.ts` 里不再有裸字符串通道调用，并且注册集合 == 契约集合。any 按 main → core → renderer → test 分批清零，M3 删除清单内的文件用带说明的规则覆盖块跳过。

**Tech Stack:** TypeScript 5.9 strict、Electron 30（Node 20.16）、Vite 5、Vitest 3（jsdom）、ESLint 9 flat config（typescript-eslint 8）、Playwright（Electron e2e）。

**Spec:** `docs/refactor/05_M2_M4_DESIGN.md` §3（M2）。事实基线见该文 §1。本计划在 Task 3 顺带修正 §1.2/§4 中过低的通道计数（实测 96 handle + 10 on + 35 push）。

## Global Constraints

- **不改运行时行为**。唯一例外：类型工作暴露的真实缺陷，必须**单独 commit**、commit message 带 `fix(...)`、并在 `docs/refactor/01_BUG_AND_RISK_REGISTER.md` 登记或标 CLOSED（本计划已知一处：P2-13 `_restartCount`）。
- **不引入运行时依赖**（不加 zod 等）；允许新增 devDependency 仅限本计划明示的项（本计划为零）。
- **any 替换规则**：优先精确类型；确实未知用 `unknown` + 类型守卫收窄；禁止 `Record<string, any>` 换成同义宽类型糊弄；禁止为通过编译放宽函数签名或 `as unknown as X` 双重断言。唯一允许保留 any 的形态：`// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <原因>`，且只用于第三方库泛型边界。
- **契约以实现为准**：契约类型写完后若 tsc 报 handler 返回值与契约不符，改 shared 类型去匹配实现，不改实现（除非实现本身就是 bug，走上面第一条）。
- **密钥零接触**：不读 `.env`，不在测试/日志/commit 中出现任何 key。
- **四道门禁**：`npm run lint && npm run test && npm run build && npm run test:e2e`（Task 2 起可用 `npm run gate`）。任务末尾说"通过"必须附带本次运行的真实输出。
- **分支与提交**：分支 `refactor/m2-type-contracts`，在独立 worktree 中工作；每个 Task 至少一个 commit；message 用 `type(scope): 中文描述`（仓库既有风格）。pre-commit 钩子会跑 prettier + gitleaks，不要用 `--no-verify`。
- **命令前缀**：所有 `npm`/`npx` 命令在 worktree 根目录执行；路径含空格，`cd` 时加引号。
- **Node**：本机非交互 shell 默认 node 20.x（`node -v` 应为 v20），CI 亦为 20。若不是，先 `nvm use 20` 或注入 node@20 的 PATH。

---

## 文件结构（本计划创建/修改的全部文件）

| 文件 | 职责 | 动作 |
|---|---|---|
| `tsconfig.test.json` | 让 `src/test/**` 进入 tsc | 新建 |
| `package.json` | `lint` 追加 test typecheck；新增 `gate` 脚本；后续加 `--max-warnings` | 修改 |
| `src/test/utils.tsx` | 0 引用且依赖未安装的 `@testing-library/user-event` | 删除 |
| `src/shared/types/log.ts` | `LogLevel / LogEntry / LogWriteEntry`（从 core/logger 上移，供契约引用） | 新建 |
| `src/shared/types/encoding.ts` | `ENCODING_IDS / EncodingId`（供 `fs:readFile` 契约引用） | 新建 |
| `src/shared/types/ipc.ts` | 通道常量 + 三张 map + 编译期断言 + 新增 dashboard/plugins/marketplace/debug 真实类型 | 重写 map 区 |
| `src/shared/types/index.ts` | 转出新文件 | 修改 |
| `src/core/logger/index.ts` | 改为从 shared 引入并转出 `LogLevel/LogEntry`（消一处 any） | 修改 |
| `src/core/encoding/index.ts` | `SUPPORTED_ENCODINGS` 以 shared 的 `EncodingId` 约束 | 修改 |
| `src/main/marketplace/open-vsx.ts` | `SearchParams / SanitizedExtension` 改为从 shared 引入 | 修改 |
| `src/main/debugger/dap-client.ts`、`session-manager.ts` | `DAPBreakpoint / DAPStackFrame / DAPVariable / DebugSessionInfo` 改为 shared 类型别名；`debug:event` 走 `sendToRenderer` | 修改 |
| `src/main/ipc/_typed.ts` | `typedHandle / typedOn / sendToRenderer / getRegisteredChannels`（M3 将替换） | 新建 |
| `src/main/ipc/*.ts`（11 个 handler）、`src/main/log-setup.ts`、`src/main/index.ts` | 全部注册与推送改走 `_typed.ts` | 修改 |
| `src/main/preload.ts` | `typedInvoke/typedSend/typedOn`；API 对象提取为常量；`declare global` 改 `typeof` | 修改 |
| `src/test/unit/ipc/typed-registry.test.ts` | `_typed.ts` 行为单测 | 新建 |
| `src/test/unit/ipc/contract-registry.test.ts` | 静态扫描：main/preload 无裸通道、注册集合 == 契约集合 | 新建 |
| `src/test/unit/ipc/type-safety.test.ts` | 更新到新 map 与新 key 断言 | 修改 |
| `src/test/integration/lsp.test.ts`、`src/test/e2e/file-operations.spec.ts` | 消 any | 修改 |
| `eslint.config.js` | `no-explicit-any: error` + M3 删除清单覆盖块 | 修改 |
| any 热点文件（见 Task 10–14 表） | 消 any | 修改 |
| `docs/refactor/05_M2_M4_DESIGN.md`、`01_BUG_AND_RISK_REGISTER.md`、`03_REFACTOR_ROADMAP.md` | 计数修正、P2-24/P2-13 CLOSED、M2 勾选 | 修改 |

---

### Task 1: 工作区、分支与基线

**Files:**
- 无源码改动；创建 worktree `../MindCode-IDE-m2`

**Interfaces:**
- Produces: 分支 `refactor/m2-type-contracts`（基于 `main`），后续所有 Task 在 `../MindCode-IDE-m2` 中执行

- [ ] **Step 1: 确认主仓状态干净且 main 与 origin 一致**

```bash
cd "/Users/mac/Desktop/Code/Claude code vibe coding/MindCode-IDE"
git status --short
git fetch origin && git rev-list --left-right --count main...origin/main
```

Expected: `git status --short` 只有 ` M package.json` 与 `?? scripts/`（用户自己的未提交脚本，**不要碰**）；计数为 `0	0`。

- [ ] **Step 2: 创建 worktree 与分支**

```bash
git worktree add "../MindCode-IDE-m2" -b refactor/m2-type-contracts main
cd "/Users/mac/Desktop/Code/Claude code vibe coding/MindCode-IDE-m2"
git log --oneline -1
```

Expected: 输出 `0840647 docs(refactor): M2–M4 设计文档...`（或更新的 main 头）。

- [ ] **Step 3: 安装依赖并确认 Electron 可用**

```bash
node -v
npm ci
npx electron --version
```

Expected: `v20.x`；`npm ci` 退出 0；`v30.5.1`。若 electron 二进制下载超时，重试一次（环境有 HTTP_PROXY）。

- [ ] **Step 4: 跑四道门禁拿基线**

```bash
npm run lint 2>&1 | tail -3 && npm run test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -1 && npm run test:e2e 2>&1 | grep -E "passed|failed"
```

Expected（与 05 §1.1 一致）：`✖ 801 problems (0 errors, 801 warnings)`；`Test Files  27 passed (27)` / `Tests  331 passed (331)`；`✓ built in ...`；`20 passed`。任何一项不符先停下报告，不进入 Task 2。

---

### Task 2: 测试纳入类型检查（P2-24）+ gate 脚本

**Files:**
- Create: `tsconfig.test.json`
- Modify: `package.json`（scripts）
- Delete: `src/test/utils.tsx`

**Interfaces:**
- Produces: `npm run lint` 现在包含 `tsc -p tsconfig.test.json --noEmit`；`npm run gate` = 四道门禁

- [ ] **Step 1: 确认 `src/test/utils.tsx` 无人引用**

```bash
grep -rn "test/utils\|from \"\.\./utils\"\|from \"\./utils\"" src/test --include='*.ts' --include='*.tsx'
```

Expected: 无输出。

- [ ] **Step 2: 新建 `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": ["src/**/*", "vite-env.d.ts"],
  "exclude": ["node_modules", "dist", "release"]
}
```

- [ ] **Step 3: 运行它，确认唯一错误就是 utils.tsx**

```bash
npx tsc -p tsconfig.test.json --noEmit
```

Expected: 恰好 1 行错误 `src/test/utils.tsx(9,23): error TS2307: Cannot find module '@testing-library/user-event'`。

- [ ] **Step 4: 删除死文件并复跑**

```bash
git rm src/test/utils.tsx
npx tsc -p tsconfig.test.json --noEmit && echo TEST_TYPECHECK_OK
```

Expected: `TEST_TYPECHECK_OK`。

- [ ] **Step 5: 修改 `package.json` scripts**

把

```json
"lint": "eslint src/ && tsc --noEmit && tsc -p tsconfig.main.json --noEmit",
```

改为

```json
"lint": "eslint src/ && tsc --noEmit && tsc -p tsconfig.main.json --noEmit && tsc -p tsconfig.test.json --noEmit",
"gate": "npm run lint && npm run test && npm run build && npm run test:e2e",
```

- [ ] **Step 6: 验证**

```bash
npm run lint 2>&1 | tail -2 && echo LINT_EXIT=$?
```

Expected: `✖ 801 problems (0 errors, 801 warnings)` 且 `LINT_EXIT=0`。

- [ ] **Step 7: Commit**

```bash
git add tsconfig.test.json package.json
git commit -m "build(test): 测试代码纳入 tsc（P2-24）+ 新增 gate 脚本

- 新增 tsconfig.test.json，lint 追加 tsc -p tsconfig.test.json
- 删除 0 引用且依赖缺失的 src/test/utils.tsx
- gate = lint && test && build && test:e2e"
```

---

### Task 3: 契约单一源

**Files:**
- Create: `src/shared/types/log.ts`、`src/shared/types/encoding.ts`
- Modify: `src/shared/types/ipc.ts`（第 429–663 行的 map 区整体重写；第 9–17 行 `IPCResult` 加 `errorCode`；Debug 类型区 262–338 行替换）、`src/shared/types/index.ts`、`src/core/logger/index.ts`、`src/core/encoding/index.ts`、`src/main/marketplace/open-vsx.ts`、`src/main/debugger/dap-client.ts`、`src/main/debugger/session-manager.ts`
- Modify: `src/test/unit/ipc/type-safety.test.ts`
- Modify: `docs/refactor/05_M2_M4_DESIGN.md`（计数修正）

**Interfaces:**
- Produces（后续所有 Task 依赖）：
  - `INVOKE_CHANNELS / SEND_CHANNELS / EVENT_CHANNELS`（`readonly string[] as const`）
  - `InvokeChannel / SendChannel / EventChannel`（字面量联合）
  - `IPCInvokeChannelMap[K] = { params: [...]; result: T }`，`IPCSendChannelMap[K] = { params: [...] }`，`IPCEventChannelMap[K] = payload`
  - 辅助：`InvokeParams<K> / InvokeResult<K> / SendParams<K> / EventPayload<K> / EventArgs<K>`
  - 新类型：`DashboardStats`、`InstalledPluginInfo`、`PluginVerifyInfo`、`SearchParams`、`SanitizedExtension`、`DebugStartResult`、`DebugBreakpoint`、`DebugStackFrame`、`DebugVariable`、`DebugSessionInfo`（真实形状）、`DebugEventPayload`、`LogLevel`、`LogEntry`、`LogWriteEntry`、`EncodingId`

- [ ] **Step 1: 新建 `src/shared/types/log.ts`**

```ts
/** 日志级别（renderer/main 共用） */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** logger 缓冲区条目（log:getBuffer 返回） */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  source?: string;
  traceId?: string;
  data?: unknown;
}

/** renderer → main 的 log:write 载荷 */
export interface LogWriteEntry {
  level: LogLevel;
  message: string;
  source?: string;
  data?: unknown;
  traceId?: string;
}
```

- [ ] **Step 2: 新建 `src/shared/types/encoding.ts`**

```ts
/** 支持的编码 id（与 core/encoding 的 SUPPORTED_ENCODINGS 一一对应，由 satisfies 约束） */
export const ENCODING_IDS = [
  "utf8", "utf8bom", "utf16le", "utf16be",
  "gbk", "gb18030", "big5", "shiftjis", "eucjp", "euckr",
  "iso88591", "iso88592", "iso88595", "iso885915",
  "windows1250", "windows1251", "windows1252", "windows1253", "windows1254", "windows1255", "windows1256",
  "koi8r", "koi8u",
] as const;

export type EncodingId = (typeof ENCODING_IDS)[number];
```

- [ ] **Step 3: `src/core/logger/index.ts` 改用 shared 类型**

把第 8–17 行

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  source?: string;
  traceId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}
```

改为

```ts
import type { LogLevel, LogEntry } from "../../shared/types/log";
export type { LogLevel, LogEntry };
```

然后 `npx tsc -p tsconfig.main.json --noEmit`。若 logger 内部有把 `entry.data` 当 `any` 用的地方报错，用 `unknown` 收窄修（例如 `typeof data === "object" && data !== null`），不加 any。

- [ ] **Step 4: `src/core/encoding/index.ts` 以 shared 约束编码表**

在文件顶部 import 区加

```ts
import type { EncodingId } from "../../shared/types/encoding";
export type { EncodingId };
```

把第 17–19 行

```ts
] as const;

export type EncodingId = (typeof SUPPORTED_ENCODINGS)[number]["id"];
```

改为

```ts
] as const satisfies readonly { id: EncodingId; label: string; aliases: string[] }[];
```

运行 `npx tsc -p tsconfig.main.json --noEmit`。若 `satisfies` 报某个 id 不在 `ENCODING_IDS` 中，说明 Step 2 漏抄，以 core 表为准补进 shared。

- [ ] **Step 5: `src/main/marketplace/open-vsx.ts` 类型上移**

把第 23–43 行的 `SanitizedExtension` 与 `SearchParams` 两个 interface 剪切到 `src/shared/types/ipc.ts`（下一步的 map 区上方，`// ─── Marketplace 模块类型` 段），原位改为

```ts
import type { SanitizedExtension, SearchParams } from "../../shared/types/ipc";
export type { SanitizedExtension, SearchParams };
```

- [ ] **Step 6: Debug 类型上移（dap-client / session-manager）**

`src/main/debugger/dap-client.ts`：把 `DAPBreakpoint`（53–61 行）、`DAPStackFrame`（64–72 行）、`DAPVariable`（82–87 行）三个 interface 删除，改为

```ts
import type { DebugBreakpoint, DebugStackFrame, DebugVariable } from "../../shared/types/ipc";
export type DAPBreakpoint = DebugBreakpoint;
export type DAPStackFrame = DebugStackFrame;
export type DAPVariable = DebugVariable;
```

`src/main/debugger/session-manager.ts`：把第 13–19 行的 `DebugSessionInfo` 删除，改为

```ts
import type { DebugSessionInfo } from "../../shared/types/ipc";
export type { DebugSessionInfo };
```

（shared 侧的定义在 Step 8 写入。）

- [ ] **Step 7: `IPCResult` 加 `errorCode`**

`src/shared/types/ipc.ts` 第 11–15 行改为

```ts
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}
```

- [ ] **Step 8: 替换 Debug 类型区（262–338 行）为真实形状**

删除原 `DebugConfig` 之后到 `EvaluateResult` 为止的 `BreakpointOptions / BreakpointInfo / DebugVariable / DebugSessionInfo / EvaluateResult`（保留 `DebugConfig`），写入：

```ts
export interface BreakpointOptions {
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

/** DAP 断点（setBreakpoints 响应） */
export interface DebugBreakpoint {
  id?: number;
  verified: boolean;
  line?: number;
  column?: number;
  message?: string;
  source?: { name?: string; path?: string };
}

/** DAP 栈帧 */
export interface DebugStackFrame {
  id: number;
  name: string;
  source?: { name?: string; path?: string; sourceReference?: number };
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** DAP 变量 */
export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

/** 调试会话信息（与 main/debugger/session-manager 的运行时形状一致） */
export interface DebugSessionInfo {
  id: string;
  language: string;
  state: "initializing" | "running" | "paused" | "stopped";
  config: Record<string, unknown>;
  threadId: number;
}

export interface DebugStartResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  errorCode?: string;
}

/** main → renderer 的 debug:event 载荷 */
export interface DebugEventPayload {
  event: "stopped" | "continued" | "exited" | "output" | string;
  sessionId: string;
  reason?: string;
  threadId?: number;
  text?: string;
  exitCode?: number;
  category?: string;
  output?: string;
}
```

- [ ] **Step 9: 新增 Dashboard / Plugins / Marketplace 类型（放在 `// ─── 菜单事件类型` 段之前）**

```ts
// ─── Dashboard 模块类型 ─────────────────────────────────

export interface DashboardStats {
  system: {
    memoryRss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    osTotalMem: number;
    osFreeMem: number;
    uptime: number;
    cpuUser: number;
    cpuSystem: number;
    platform: string;
    nodeVersion: string;
  };
  ai: {
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    avgLatency: number;
    queueLength: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    latencyHistory: number[];
  };
  startup: { marks: Record<string, number>; measures: Record<string, number>; totalMs: number };
  cache: { size: number; hotPatterns: number };
}

// ─── Plugins 模块类型 ───────────────────────────────────

/** plugins:list 条目：manifest 原样 + 主进程附加字段 */
export interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  main?: string;
  permissions?: string[];
  _checksum: string;
  _dir: string;
  [key: string]: unknown;
}

export interface PluginVerifyInfo {
  manifest: Record<string, unknown>;
  manifestChecksum: string;
  mainChecksum: string;
  warnings: string[];
  verified: boolean;
}

// ─── Marketplace 模块类型（Open VSX，主进程代理） ───────

export interface SanitizedExtension {
  id: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  category: "theme" | "language" | "snippet" | "tool" | "ai" | "other";
  tags: string[];
  downloads: number;
  rating: number;
  repository?: string;
}

export interface SearchParams {
  query: string;
  category?: string;
  size?: number;
}
```

同时把 `CompletionResult` 改为

```ts
export interface CompletionResult extends IPCResult<string> {
  cached?: boolean;
  model?: string;
}
```

并在文件顶部 import 区加

```ts
import type { ChatMessage, ToolCallInfo, ToolSchema } from "./ai";
import type { LogLevel, LogEntry, LogWriteEntry } from "./log";
import type { EncodingId } from "./encoding";
```

- [ ] **Step 10: 重写 map 区（原 429–663 行整段替换）**

```ts
// ─── IPC Channel 契约（单一源） ──────────────────────────
// 规则：
// 1. 三张常量表是运行时可枚举的通道名单，三张 Map 是类型契约；文件底部的编译期断言保证二者 key 集合完全一致。
// 2. 新增/删除通道必须同时改常量表与 Map，否则 tsc 失败；main 侧注册与 preload 调用都从这里推导类型。
// 3. 参数/返回以 main 侧 handler 的真实实现为准。

/** renderer → main，请求/响应（ipcMain.handle） */
export const INVOKE_CHANNELS = [
  // 应用 / 窗口 / 日志
  "get-app-version", "window:isMaximized", "log:getPath", "log:getBuffer", "log:export",
  // AI
  "ai-chat", "ai-stats", "ai:completion", "ai:completion-settings", "ai:completion-settings-set",
  // 文件系统
  "fs:setWorkspace", "fs:openFolder", "fs:readDir", "fs:readFile", "fs:readFileChunk", "fs:getLineCount",
  "fs:writeFile", "fs:stat", "fs:getEncodings", "fs:detectEncoding", "fs:getAllFiles", "fs:searchInFiles",
  "fs:createFolder", "fs:createFile", "fs:delete", "fs:rename", "fs:copy", "fs:exists",
  // 设置 / 对话框
  "settings:get", "settings:set", "dialog:showSaveDialog", "dialog:showOpenDialog", "dialog:showMessageBox",
  // 终端
  "terminal:execute", "terminal:cd", "terminal:pwd", "terminal:create", "terminal:write", "terminal:resize", "terminal:close",
  // Git
  "git:isRepo", "git:status", "git:currentBranch", "git:branches", "git:stage", "git:unstage", "git:commit",
  "git:diff", "git:checkout", "git:createBranch", "git:log", "git:discard",
  // LSP
  "lsp:start", "lsp:stop", "lsp:request", "lsp:notify", "lsp:status", "lsp:detect",
  // Debug
  "debug:start", "debug:stop", "debug:continue", "debug:stepOver", "debug:stepInto", "debug:stepOut", "debug:pause",
  "debug:restart", "debug:setBreakpoints", "debug:addBreakpoint", "debug:removeBreakpoint", "debug:toggleBreakpoint",
  "debug:getBreakpoints", "debug:getVariables", "debug:evaluate", "debug:stackTrace", "debug:getSession",
  "debug:listSessions", "debug:detect", "debug:supportedLanguages",
  // Index
  "index:indexWorkspace", "index:getProgress", "index:getStats", "index:search", "index:searchSymbols",
  "index:getFileSymbols", "index:findDefinition", "index:findReferences", "index:getRelatedCode", "index:cancel", "index:clear",
  // Dashboard / Plugins / Marketplace
  "dashboard:stats",
  "plugins:list", "plugins:verify", "plugins:uninstall", "plugins:getDir",
  "marketplace:search", "marketplace:getExtension",
] as const;

/** renderer → main，单向（ipcMain.on） */
export const SEND_CHANNELS = [
  "ai-chat-stream", "ai-chat-stream-with-tools", "ai-stream-cancel", "ai:completion-stream",
  "log:write", "theme:change",
  "window:minimize", "window:maximize", "window:close", "window:showMenu",
] as const;

/** main → renderer 推送（webContents.send） */
export const EVENT_CHANNELS = [
  "ai-stream-token", "ai-stream-complete", "ai-stream-error", "ai-stream-fallback", "ai-stream-tool-call",
  "ai:completion-stream-token", "ai:completion-stream-done", "ai:completion-stream-error",
  "terminal:data", "terminal:exit",
  "theme:change", "fs:fileChanged",
  "lsp:notification",
  "index:progress", "index:fileIndexed", "index:complete",
  "debug:event",
  "menu:newFile", "menu:openFile", "menu:openFolder", "menu:save", "menu:saveAs", "menu:closeEditor",
  "menu:find", "menu:findInFiles", "menu:replace", "menu:commandPalette", "menu:showExplorer", "menu:showSearch",
  "menu:showGit", "menu:toggleTerminal", "menu:toggleAI", "menu:goToFile", "menu:goToLine", "menu:newTerminal",
] as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export type SendChannel = (typeof SEND_CHANNELS)[number];
export type EventChannel = (typeof EVENT_CHANNELS)[number];

/** invoke 通道契约 */
export interface IPCInvokeChannelMap {
  // 应用 / 窗口 / 日志
  "get-app-version": { params: []; result: string };
  "window:isMaximized": { params: []; result: boolean };
  "log:getPath": { params: []; result: string | null };
  "log:getBuffer": { params: [LogLevel?]; result: LogEntry[] };
  "log:export": { params: []; result: string };

  // AI
  "ai-chat": { params: [{ model: string; messages: ChatMessage[] }]; result: AIChatResult };
  "ai-stats": { params: []; result: AIStatsResult };
  "ai:completion": { params: [CompletionRequest]; result: CompletionResult };
  "ai:completion-settings": { params: []; result: CompletionSettings };
  "ai:completion-settings-set": { params: [Partial<CompletionSettings>]; result: IPCResult };

  // 文件系统
  "fs:setWorkspace": { params: [string]; result: IPCResult };
  "fs:openFolder": { params: []; result: string | null };
  "fs:readDir": { params: [string]; result: IPCResult<FileEntry[]> };
  "fs:readFile": { params: [string, EncodingId?]; result: IPCResult<string> & { encoding?: string } };
  "fs:readFileChunk": { params: [string, number, number]; result: IPCResult<FileChunkData> };
  "fs:getLineCount": { params: [string]; result: IPCResult<number> };
  "fs:writeFile": { params: [string, string, EncodingId?]; result: IPCResult };
  "fs:stat": { params: [string]; result: IPCResult<FileStat> };
  "fs:getEncodings": { params: []; result: EncodingInfo[] };
  "fs:detectEncoding": { params: [string]; result: IPCResult & { encoding?: string } };
  "fs:getAllFiles": { params: [string]; result: IPCResult<FileListEntry[]> };
  "fs:searchInFiles": { params: [SearchInFilesParams]; result: IPCResult<SearchMatch[]> };
  "fs:createFolder": { params: [string]; result: IPCResult };
  "fs:createFile": { params: [string, string?]; result: IPCResult };
  "fs:delete": { params: [string]; result: IPCResult };
  "fs:rename": { params: [string, string]; result: IPCResult };
  "fs:copy": { params: [string, string]; result: IPCResult };
  "fs:exists": { params: [string]; result: IPCResult<boolean> };

  // 设置 / 对话框
  "settings:get": { params: [string]; result: SettingValue };
  "settings:set": { params: [string, SettingValue]; result: void };
  "dialog:showSaveDialog": { params: [SaveDialogOptions]; result: { canceled: boolean; filePath?: string } };
  "dialog:showOpenDialog": { params: [OpenDialogOptions]; result: { canceled: boolean; filePaths: string[] } };
  "dialog:showMessageBox": { params: [MessageBoxOptions]; result: { response: number } };

  // 终端
  "terminal:execute": { params: [string, string?]; result: IPCResult<TerminalExecResult> };
  "terminal:cd": { params: [string, string]; result: IPCResult<string> };
  "terminal:pwd": { params: []; result: IPCResult<string> };
  "terminal:create": { params: [TerminalCreateOptions?]; result: IPCResult & { id?: string } };
  "terminal:write": { params: [string, string]; result: IPCResult };
  "terminal:resize": { params: [string, number, number]; result: IPCResult };
  "terminal:close": { params: [string]; result: IPCResult };

  // Git（第一个参数恒为 workspacePath）
  "git:isRepo": { params: [string]; result: IPCResult<boolean> };
  "git:status": { params: [string]; result: IPCResult<GitFileStatus[]> };
  "git:currentBranch": { params: [string]; result: IPCResult<string> };
  "git:branches": { params: [string]; result: IPCResult<GitBranch[]> };
  "git:stage": { params: [string, string[]]; result: IPCResult };
  "git:unstage": { params: [string, string[]]; result: IPCResult };
  "git:commit": { params: [string, string]; result: IPCResult };
  "git:diff": { params: [string, string, boolean]; result: IPCResult<string> };
  "git:checkout": { params: [string, string]; result: IPCResult };
  "git:createBranch": { params: [string, string]; result: IPCResult };
  "git:log": { params: [string, number?]; result: IPCResult<GitCommitLog[]> };
  "git:discard": { params: [string, string]; result: IPCResult };

  // LSP
  "lsp:start": { params: [string, LSPStartOptions?]; result: { success: boolean; capabilities?: Record<string, unknown>; error?: string } };
  "lsp:stop": { params: [string]; result: IPCResult };
  "lsp:request": { params: [string, string, unknown]; result: IPCResult<unknown> };
  "lsp:notify": { params: [string, string, unknown]; result: IPCResult };
  "lsp:status": { params: [string]; result: LSPStatus | null };
  "lsp:detect": { params: [string]; result: LSPDetectResult };

  // Debug（返回形状以 debug-handlers.ts 为准：frames/session/sessions/variables/result/breakpoint 直挂，不走 data）
  "debug:start": { params: [DebugConfig]; result: DebugStartResult };
  "debug:stop": { params: [string?]; result: IPCResult };
  "debug:continue": { params: [string?]; result: IPCResult };
  "debug:stepOver": { params: [string?]; result: IPCResult };
  "debug:stepInto": { params: [string?]; result: IPCResult };
  "debug:stepOut": { params: [string?]; result: IPCResult };
  "debug:pause": { params: [string?]; result: IPCResult };
  "debug:restart": { params: [string?]; result: IPCResult };
  "debug:setBreakpoints": { params: [string, Array<{ line: number; condition?: string }>]; result: { success: boolean; breakpoints?: DebugBreakpoint[]; error?: string } };
  "debug:addBreakpoint": { params: [string, number, BreakpointOptions?]; result: { success: boolean; breakpoint?: DebugBreakpoint; error?: string } };
  "debug:removeBreakpoint": { params: [string]; result: IPCResult };
  "debug:toggleBreakpoint": { params: [string, number]; result: IPCResult };
  "debug:getBreakpoints": { params: [string?]; result: { success: boolean; breakpoints: DebugBreakpoint[] } };
  "debug:getVariables": { params: [string?, number?]; result: { success: boolean; variables?: DebugVariable[]; error?: string } };
  "debug:evaluate": { params: [string, number?]; result: { success: boolean; result?: { value: string; type?: string } | null; error?: string } };
  "debug:stackTrace": { params: [string?]; result: { success: boolean; frames?: DebugStackFrame[]; error?: string } };
  "debug:getSession": { params: [string?]; result: { success: boolean; session?: DebugSessionInfo | null; error?: string } };
  "debug:listSessions": { params: []; result: { success: boolean; sessions?: DebugSessionInfo[]; error?: string } };
  "debug:detect": { params: [string]; result: { available: boolean; error?: string } };
  "debug:supportedLanguages": { params: []; result: { languages: string[] } };

  // Index
  "index:indexWorkspace": { params: [string]; result: IPCResult & { message?: string } };
  "index:getProgress": { params: []; result: IndexProgress };
  "index:getStats": { params: []; result: IndexStats };
  "index:search": { params: [IndexSearchQuery]; result: IPCResult<IndexSearchResult> };
  "index:searchSymbols": { params: [string, number?]; result: IPCResult<IndexSymbol[]> };
  "index:getFileSymbols": { params: [string]; result: IPCResult<IndexSymbol[]> };
  "index:findDefinition": { params: [string]; result: IPCResult<IndexSymbol | null> };
  "index:findReferences": { params: [string]; result: IPCResult<IndexSymbol[]> };
  "index:getRelatedCode": { params: [string, number?]; result: IPCResult<RelatedCodeEntry[]> };
  "index:cancel": { params: []; result: IPCResult };
  "index:clear": { params: []; result: IPCResult };

  // Dashboard / Plugins / Marketplace
  "dashboard:stats": { params: []; result: DashboardStats };
  "plugins:list": { params: []; result: IPCResult<InstalledPluginInfo[]> };
  "plugins:verify": { params: [string]; result: IPCResult<PluginVerifyInfo> };
  "plugins:uninstall": { params: [string]; result: IPCResult };
  "plugins:getDir": { params: []; result: IPCResult<string> };
  "marketplace:search": { params: [SearchParams]; result: IPCResult<SanitizedExtension[]> };
  "marketplace:getExtension": { params: [{ namespace?: string; name?: string }]; result: IPCResult<SanitizedExtension> };
}

/** send 通道契约（renderer → main 单向） */
export interface IPCSendChannelMap {
  "ai-chat-stream": { params: [{ model: string; messages: ChatMessage[]; requestId: string }] };
  "ai-chat-stream-with-tools": { params: [{ model: string; messages: ChatMessage[]; tools: ToolSchema[]; requestId: string }] };
  "ai-stream-cancel": { params: [{ requestId: string }] };
  "ai:completion-stream": { params: [CompletionRequest & { requestId: string }] };
  "log:write": { params: [LogWriteEntry] };
  "theme:change": { params: [string] };
  "window:minimize": { params: [] };
  "window:maximize": { params: [] };
  "window:close": { params: [] };
  "window:showMenu": { params: [number, number] };
}

/** 事件通道契约（main → renderer 推送，值为 payload 类型；无载荷用 void） */
export interface IPCEventChannelMap {
  "ai-stream-token": StreamTokenData;
  "ai-stream-complete": StreamCompleteData;
  "ai-stream-error": StreamErrorData;
  "ai-stream-fallback": StreamFallbackData;
  "ai-stream-tool-call": StreamToolCallData;
  "ai:completion-stream-token": CompletionStreamTokenData;
  "ai:completion-stream-done": CompletionStreamDoneData;
  "ai:completion-stream-error": CompletionStreamErrorData;
  "terminal:data": TerminalDataEvent;
  "terminal:exit": TerminalExitEvent;
  "theme:change": string;
  "fs:fileChanged": { filePath: string; type: string };
  "lsp:notification": LSPNotificationData;
  "index:progress": IndexProgress;
  "index:fileIndexed": IndexFileEvent;
  "index:complete": IndexCompleteStats;
  "debug:event": DebugEventPayload;
  "menu:newFile": void;
  "menu:openFile": string;
  "menu:openFolder": string;
  "menu:save": void;
  "menu:saveAs": void;
  "menu:closeEditor": void;
  "menu:find": void;
  "menu:findInFiles": void;
  "menu:replace": void;
  "menu:commandPalette": void;
  "menu:showExplorer": void;
  "menu:showSearch": void;
  "menu:showGit": void;
  "menu:toggleTerminal": void;
  "menu:toggleAI": void;
  "menu:goToFile": void;
  "menu:goToLine": void;
  "menu:newTerminal": void;
}

// ─── 派生辅助类型 ──────────────────────────────────────

export type InvokeParams<K extends InvokeChannel> = IPCInvokeChannelMap[K]["params"];
export type InvokeResult<K extends InvokeChannel> = IPCInvokeChannelMap[K]["result"];
export type SendParams<K extends SendChannel> = IPCSendChannelMap[K]["params"];
export type EventPayload<K extends EventChannel> = IPCEventChannelMap[K];
/** 推送实参：void 载荷不传参，其余传一个 */
export type EventArgs<K extends EventChannel> = [EventPayload<K>] extends [void] ? [] : [EventPayload<K>];

/** preload 中 ipcRenderer.on 回调签名 */
export type IPCEventHandler<K extends EventChannel> = (
  event: Electron.IpcRendererEvent,
  data: EventPayload<K>,
) => void;

// ─── 编译期断言：常量表 与 Map 的 key 集合必须完全一致 ──
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type _InvokeKeysMatch = Expect<Equal<keyof IPCInvokeChannelMap, InvokeChannel>>;
type _SendKeysMatch = Expect<Equal<keyof IPCSendChannelMap, SendChannel>>;
type _EventKeysMatch = Expect<Equal<keyof IPCEventChannelMap, EventChannel>>;
```

删除原来的 `TypedIPCInvoke` / `TypedIPCOn` 两个类型（无消费者，`grep -rn "TypedIPCInvoke\|TypedIPCOn" src` 应为空）。

- [ ] **Step 11: `src/shared/types/index.ts` 转出新文件**

```ts
export * from "./ai";
export * from "./ipc";
export * from "./log";
export * from "./encoding";
```

- [ ] **Step 12: 编译期验证三条断言与全部引用**

```bash
npx tsc --noEmit && npx tsc -p tsconfig.main.json --noEmit && npx tsc -p tsconfig.test.json --noEmit && echo TSC_ALL_OK
```

Expected: `TSC_ALL_OK`。常见失败与处理：
- `Type 'true' does not satisfy the constraint` 指向 `_InvokeKeysMatch`：常量表与 Map 有 key 不一致，逐个对照 Step 10 补齐（用 `npx tsc --noEmit 2>&1 | head` 看差异提示）。
- `type-safety.test.ts` 报某个类型已不存在（`BreakpointInfo`、`EvaluateResult`）：进入 Step 13。
- main 侧报 `DAPBreakpoint`/`DebugSessionInfo` 字段：以 Step 8 的 shared 定义为准修 import，不改字段。

- [ ] **Step 13: 更新 `src/test/unit/ipc/type-safety.test.ts`**

1. import 区删除 `BreakpointInfo`、`DebugSessionInfo`；新增 `INVOKE_CHANNELS, SEND_CHANNELS, EVENT_CHANNELS`（值导入，非 `import type`）与 `IPCSendChannelMap`。
2. 删除文件中使用 `BreakpointInfo`/旧 `DebugSessionInfo` 字段（`name`/`breakpoints`/`stackFrames`）的用例（若有），替换为：

```ts
  describe("Channel 常量表", () => {
    it("三张常量表数量与设计文档一致（96 / 10 / 35）", () => {
      expect(INVOKE_CHANNELS).toHaveLength(96);
      expect(SEND_CHANNELS).toHaveLength(10);
      expect(EVENT_CHANNELS).toHaveLength(35);
    });

    it("常量表内无重复", () => {
      for (const list of [INVOKE_CHANNELS, SEND_CHANNELS, EVENT_CHANNELS]) {
        expect(new Set(list).size).toBe(list.length);
      }
    });

    it("send 与 event 两表可以共享通道名（theme:change），invoke 与 send 不可", () => {
      const invoke = new Set<string>(INVOKE_CHANNELS);
      for (const ch of SEND_CHANNELS) expect(invoke.has(ch)).toBe(false);
    });
  });
```

3. 原 `"IPCInvokeChannelMap 包含所有模块通道"` 用例的 `AssertChannel` 列表追加 `"dashboard:stats"`、`"plugins:list"`、`"marketplace:search"`、`"log:getBuffer"`、`"debug:setBreakpoints"`，并把末尾 `toHaveLength(10)` 改为 `15`；`"IPCEventChannelMap 包含所有事件通道"` 追加 `"debug:event"`、`"menu:openFile"`，`toHaveLength(7)` 改 `9`。
4. 新增 send map 用例：

```ts
    it("IPCSendChannelMap 包含全部单向通道", () => {
      type AssertSend<K extends keyof IPCSendChannelMap> = K;
      const _: [AssertSend<"ai-chat-stream">, AssertSend<"log:write">, AssertSend<"window:showMenu">] = [
        "ai-chat-stream",
        "log:write",
        "window:showMenu",
      ];
      expect(_).toHaveLength(3);
    });
```

- [ ] **Step 14: 跑单测 + 全量 tsc**

```bash
npx vitest run src/test/unit/ipc/type-safety.test.ts 2>&1 | grep -E "Tests|✓|✗|FAIL" | tail -5
npm run lint 2>&1 | tail -2
```

Expected: 该文件全部通过；lint `0 errors`。

- [ ] **Step 15: 修正设计文档计数**

编辑 `docs/refactor/05_M2_M4_DESIGN.md`：
- §1.2 第一条改为：`渲染→主进程：**96 个 \`ipcMain.handle\` + 10 个 \`ipcMain.on\`**（\`ai-chat-stream\`、\`ai-chat-stream-with-tools\`、\`ai-stream-cancel\`、\`ai:completion-stream\`、\`log:write\`、\`theme:change\`、\`window:close/maximize/minimize/showMenu\`），分布在 \`src/main/ipc/\` 11 个 handler 文件、\`src/main/log-setup.ts\`（4 个）与 \`src/main/index.ts\`（5 个）。`
- §1.2 第二条改为：`主→渲染推送：**35 个通道**（ai 流 8、菜单 18、索引 3、终端 2、fs/lsp/theme/debug:event 各 1）。`
- §1.2 "返回值形状"一条中的 `66 个 invoke 通道中约 55 个` 改为 `96 个 invoke 通道中约 80 个`。
- §3.2 三处数量 `66 个`→`96 个`、`8 个`→`10 个`、`34 个`→`35 个`；§3.3 `34 个推送通道`→`35 个推送通道`。
- §4.1、§4.2、§4.7、§4.9 中所有 `74 个` 改为 `106 个`。
- §4.2 第一段末追加一句：`M2 实测 \`ipcMain.on\` 通道为 10 个（含 \`log:write\`、\`ai:completion-stream\`），本文早先按 grep 单行统计的 66+8 口径作废。`

- [ ] **Step 16: Commit**

```bash
git add src/shared src/core/logger/index.ts src/core/encoding/index.ts src/main/marketplace/open-vsx.ts src/main/debugger/dap-client.ts src/main/debugger/session-manager.ts src/test/unit/ipc/type-safety.test.ts docs/refactor/05_M2_M4_DESIGN.md
git commit -m "refactor(shared): IPC 契约单一源——96 invoke / 10 send / 35 event 常量表 + 三张 Map + 编译期一致性断言

- 常量表与 Map 的 key 集合由 Equal 断言保证一致
- Debug/Dashboard/Plugins/Marketplace 类型按 main 侧真实返回形状定义
- LogLevel/LogEntry、EncodingId、SearchParams/SanitizedExtension、DAP 三类型上移 shared
- IPCResult 增加 errorCode，与 main/ipc/types 对齐
- 修正 05 设计文档中按单行 grep 得出的偏低通道计数"
```

---

### Task 4: main 类型胶水 `_typed.ts`

**Files:**
- Create: `src/main/ipc/_typed.ts`
- Test: `src/test/unit/ipc/typed-registry.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `InvokeChannel / SendChannel / EventChannel / InvokeParams / InvokeResult / SendParams / EventArgs`
- Produces:
  - `typedHandle<K extends InvokeChannel>(channel: K, handler: (event: IpcMainInvokeEvent, ...params: InvokeParams<K>) => InvokeResult<K> | Promise<InvokeResult<K>>): void`
  - `typedOn<K extends SendChannel>(channel: K, listener: (event: IpcMainEvent, ...params: SendParams<K>) => void | Promise<void>): void`
  - `sendToRenderer<K extends EventChannel>(target: WebContents | null | undefined, channel: K, ...payload: EventArgs<K>): void`
  - `getRegisteredChannels(): { invoke: string[]; send: string[] }`
  - `resetRegisteredChannelsForTest(): void`

- [ ] **Step 1: 写失败测试 `src/test/unit/ipc/typed-registry.test.ts`**

```ts
/**
 * _typed.ts 行为测试：注册透传、参数透传、推送透传、注册表记录。
 * mock electron.ipcMain 以捕获注册；不启动 Electron。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { handlers, listeners } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => unknown>,
  listeners: {} as Record<string, (...args: unknown[]) => unknown>,
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    },
    on: (channel: string, fn: (...args: unknown[]) => unknown) => {
      listeners[channel] = fn;
    },
  },
}));

import {
  typedHandle,
  typedOn,
  sendToRenderer,
  getRegisteredChannels,
  resetRegisteredChannelsForTest,
} from "../../../main/ipc/_typed";

describe("_typed.ts", () => {
  beforeEach(() => {
    for (const k of Object.keys(handlers)) delete handlers[k];
    for (const k of Object.keys(listeners)) delete listeners[k];
    resetRegisteredChannelsForTest();
  });

  it("typedHandle 把 handler 原样注册到 ipcMain.handle 并透传参数与返回值", async () => {
    typedHandle("fs:exists", async (_event, targetPath) => ({ success: true, data: targetPath === "/a" }));
    expect(Object.keys(handlers)).toEqual(["fs:exists"]);
    const result = await handlers["fs:exists"]({ sender: {} }, "/a");
    expect(result).toEqual({ success: true, data: true });
  });

  it("typedHandle 支持同步返回", async () => {
    typedHandle("get-app-version", () => "1.2.3");
    expect(await handlers["get-app-version"]({ sender: {} })).toBe("1.2.3");
  });

  it("typedOn 注册到 ipcMain.on 并透传参数", () => {
    const seen: number[] = [];
    typedOn("window:showMenu", (_event, x, y) => {
      seen.push(x, y);
    });
    listeners["window:showMenu"]({ sender: {} }, 10, 20);
    expect(seen).toEqual([10, 20]);
  });

  it("sendToRenderer 调用 target.send(channel, payload)；void 载荷只传通道名", () => {
    const send = vi.fn();
    const target = { send } as unknown as Electron.WebContents;
    sendToRenderer(target, "theme:change", "dracula");
    sendToRenderer(target, "menu:save");
    expect(send).toHaveBeenNthCalledWith(1, "theme:change", "dracula");
    expect(send).toHaveBeenNthCalledWith(2, "menu:save");
  });

  it("sendToRenderer 对 null/undefined target 静默返回", () => {
    expect(() => sendToRenderer(null, "menu:save")).not.toThrow();
    expect(() => sendToRenderer(undefined, "theme:change", "nord")).not.toThrow();
  });

  it("注册表记录 invoke 与 send 两类通道名", () => {
    typedHandle("fs:exists", async () => ({ success: true, data: true }));
    typedOn("window:close", () => {});
    expect(getRegisteredChannels()).toEqual({ invoke: ["fs:exists"], send: ["window:close"] });
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/test/unit/ipc/typed-registry.test.ts 2>&1 | tail -5
```

Expected: FAIL，`Cannot find module '../../../main/ipc/_typed'`（或等价的解析错误）。

- [ ] **Step 3: 实现 `src/main/ipc/_typed.ts`**

```ts
/**
 * 类型化 IPC 注册/推送薄包装（M2 临时脚手架，M3 由 _middleware.ts 取代）。
 *
 * - 通道名与参数/返回类型全部由 shared/types/ipc.ts 的契约推导，写错通道名或形状在 tsc 阶段失败。
 * - 零运行时行为改变：仅透传 + 记录已注册通道（供契约一致性测试使用）。
 * - 主进程构建没有路径别名解析（P2-22），因此这里必须用相对路径导入 shared。
 */
import { ipcMain } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron";
import type {
  EventArgs,
  EventChannel,
  InvokeChannel,
  InvokeParams,
  InvokeResult,
  SendChannel,
  SendParams,
} from "../../shared/types/ipc";

const registered = { invoke: new Set<string>(), send: new Set<string>() };

export type InvokeHandler<K extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...params: InvokeParams<K>
) => InvokeResult<K> | Promise<InvokeResult<K>>;

export type SendListener<K extends SendChannel> = (
  event: IpcMainEvent,
  ...params: SendParams<K>
) => void | Promise<void>;

/** 类型化 ipcMain.handle */
export function typedHandle<K extends InvokeChannel>(channel: K, handler: InvokeHandler<K>): void {
  registered.invoke.add(channel);
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as InvokeParams<K>)));
}

/** 类型化 ipcMain.on（renderer → main 单向） */
export function typedOn<K extends SendChannel>(channel: K, listener: SendListener<K>): void {
  registered.send.add(channel);
  ipcMain.on(channel, (event, ...args) => {
    void listener(event, ...(args as SendParams<K>));
  });
}

/** 类型化 webContents.send（main → renderer 推送）；target 为空时静默 */
export function sendToRenderer<K extends EventChannel>(
  target: WebContents | null | undefined,
  channel: K,
  ...payload: EventArgs<K>
): void {
  target?.send(channel, ...payload);
}

/** 已注册通道快照（契约一致性测试用） */
export function getRegisteredChannels(): { invoke: string[]; send: string[] } {
  return { invoke: [...registered.invoke], send: [...registered.send] };
}

/** 仅测试使用 */
export function resetRegisteredChannelsForTest(): void {
  registered.invoke.clear();
  registered.send.clear();
}
```

- [ ] **Step 4: 运行测试通过**

```bash
npx vitest run src/test/unit/ipc/typed-registry.test.ts 2>&1 | grep -E "Tests|passed|failed"
npx tsc -p tsconfig.main.json --noEmit && npx tsc -p tsconfig.test.json --noEmit && echo TSC_OK
```

Expected: `Tests  6 passed (6)`；`TSC_OK`。

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/_typed.ts src/test/unit/ipc/typed-registry.test.ts
git commit -m "feat(main/ipc): typedHandle/typedOn/sendToRenderer 类型化薄包装 + 注册表（M2 脚手架）"
```

---

### Task 5: 迁移批 A —— settings / dashboard / plugin / marketplace / lsp / log-setup / index.ts 窗口通道

**Files:**
- Modify: `src/main/ipc/settings-handlers.ts`（通道 12 个：get-app-version、settings:get/set、3 个 dialog、theme:change(on) 与其推送、ai:completion-settings(-set)）
- Modify: `src/main/ipc/dashboard-handlers.ts`（1）、`src/main/ipc/plugin-handlers.ts`（4）、`src/main/ipc/marketplace-handlers.ts`（2）、`src/main/ipc/lsp-handlers.ts`（6 + 推送 lsp:notification）
- Modify: `src/main/log-setup.ts`（log:write(on)、log:getPath/getBuffer/export）
- Modify: `src/main/index.ts`（window:minimize/maximize/close(on)、window:isMaximized、window:showMenu(on)）

**Interfaces:**
- Consumes: Task 4 的 `typedHandle / typedOn / sendToRenderer`

**通用改写规则（本 Task 与 Task 6、7 共用）：**

1. `import { ipcMain } from "electron";` → 若文件不再直接用 `ipcMain`，删除该 import；新增 `import { typedHandle, typedOn, sendToRenderer } from "./_typed";`（`log-setup.ts`、`index.ts` 用 `"./ipc/_typed"`）。
2. `ipcMain.handle("x", async (event, a: T, b: U) => {...})` → `typedHandle("x", async (event, a, b) => {...})`。**删掉参数上的显式类型注解**，让契约推导；若 handler 内部依赖更窄的类型（如 `EncodingId`），契约已用同一类型，无需再标。
3. `ipcMain.on("x", (event, a) => {...})` → `typedOn("x", (event, a) => {...})`。
4. `xxx?.webContents.send("ev", payload)` / `event.sender.send("ev", payload)` → `sendToRenderer(xxx?.webContents, "ev", payload)` / `sendToRenderer(event.sender, "ev", payload)`。
5. 返回值与契约不符时的处理顺序：① 检查是否漏了 `errorCode`/可选字段 → 改 **shared 类型**；② 若是实现返回了契约没有的字段，同样改 shared（契约以实现为准）；③ 不要在 handler 里 `as` 断言掩盖差异。唯一允许的断言：`settings:get` 的 `return settingsCache[key] as SettingValue;`（存储层是 `Record<string, unknown>`），加注释 `// 存储层无类型，契约层收窄为 SettingValue`。
6. handler 返回类型显式注解（如 `Promise<IPCResult>`）若引用 `./types` 里的 `IPCResult`，改为 shared 的 `IPCResult`（`import type { IPCResult } from "../../shared/types/ipc"`）并补泛型（如 `plugins:list` → `Promise<IPCResult<InstalledPluginInfo[]>>`）。

- [ ] **Step 1: 改写 `settings-handlers.ts`**

按通用规则改 9 个 `ipcMain.handle`、1 个 `ipcMain.on`、1 处推送（第 111 行 `mainWindow()?.webContents.send("theme:change", themeId)` → `sendToRenderer(mainWindow()?.webContents, "theme:change", themeId)`）。`settings:get` 用规则 5 的唯一断言。

- [ ] **Step 2: 改写 `dashboard-handlers.ts`、`plugin-handlers.ts`、`marketplace-handlers.ts`、`lsp-handlers.ts`**

- `dashboard-handlers.ts`：`typedHandle("dashboard:stats", () => { ... })`。若 tsc 报 `ai` 字段与 `DashboardStats.ai` 不符（例如 `PipelineStats` 多了字段），改 shared 的 `DashboardStats.ai`。
- `plugin-handlers.ts`：4 个 handle；返回类型注解改 shared `IPCResult<...>`；`plugins.push({...manifest, _checksum, _dir})` 的 `plugins` 声明改为 `const plugins: InstalledPluginInfo[] = [];`（`manifest` 来自 `JSON.parse`，为 `any`，可赋值）。
- `marketplace-handlers.ts`：2 个 handle；`import type { SearchParams }` 现在来自 shared（open-vsx 已转出，保持 `from "../marketplace/open-vsx"` 亦可）。
- `lsp-handlers.ts`：6 个 handle + 第 53 行推送 → `sendToRenderer(mainWindow()?.webContents, "lsp:notification", { language, method, params })`。`lsp:start` 的返回 `capabilities?: any` 来自 `lsp-manager.ts`，本 Task 不动 lsp-manager（Task 10 处理），tsc 会因 `any` 可赋值而通过。

- [ ] **Step 3: 改写 `log-setup.ts`**

```ts
import { app } from "electron";
import { typedHandle, typedOn } from "./ipc/_typed";
```

- `ipcMain.on("log:write", (_event, entry: {...}) => {...})` → `typedOn("log:write", (_event, entry) => {...})`（删除内联类型，契约为 `LogWriteEntry`）。
- 三个 handle → `typedHandle("log:getPath", () => fileTransport?.getLogPath() ?? null)`、`typedHandle("log:getBuffer", (_event, level) => logger.getBuffer(level))`、`typedHandle("log:export", () => logger.export())`。

- [ ] **Step 4: 改写 `index.ts` 窗口通道（第 126–137 行）**

```ts
import { typedHandle, typedOn } from "./ipc/_typed";

// ==================== Window Control IPC ====================
typedOn("window:minimize", () => mainWindow?.minimize());
typedOn("window:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
typedOn("window:close", () => mainWindow?.close());
typedHandle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
typedOn("window:showMenu", (_event, x, y) => {
  const menu = Menu.getApplicationMenu();
  if (menu && mainWindow) menu.popup({ window: mainWindow, x: Math.round(x), y: Math.round(y) });
});
```

`index.ts` 的 `ipcMain` import 若仍被别处使用则保留，否则从 electron import 列表中删掉。

- [ ] **Step 5: 验证**

```bash
grep -nE 'ipcMain\.(handle|on)\(' src/main/ipc/settings-handlers.ts src/main/ipc/dashboard-handlers.ts src/main/ipc/plugin-handlers.ts src/main/ipc/marketplace-handlers.ts src/main/ipc/lsp-handlers.ts src/main/log-setup.ts src/main/index.ts
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files|Tests "
```

Expected: grep 无输出；lint 0 errors；`Test Files  28 passed (28)`（Task 4 新增 1 个文件）。`marketplace-handlers.test.ts` 与 `git-handlers.test.ts` 用 mock `ipcMain.handle` 捕获——`_typed.ts` 内部仍调用 `ipcMain.handle`，所以现有 mock 继续生效。

- [ ] **Step 6: Commit**

```bash
git add src/main
git commit -m "refactor(main/ipc): settings/dashboard/plugins/marketplace/lsp/log/window 通道改走 typedHandle/typedOn/sendToRenderer"
```

---

### Task 6: 迁移批 B —— fs / git / terminal

**Files:**
- Modify: `src/main/ipc/fs-handlers.ts`（18 handle + `fs:fileChanged` 推送）
- Modify: `src/main/ipc/git-handlers.ts`（12 handle，含 `guarded` 包装）
- Modify: `src/main/ipc/terminal-handlers.ts`（7 handle + `terminal:data/exit` 推送）

**Interfaces:**
- Consumes: Task 4；Task 5 的通用改写规则

- [ ] **Step 1: 改写 `fs-handlers.ts`**

18 个 `ipcMain.handle` 按规则 2 改；第 290 行推送 → `sendToRenderer(mainWindow()?.webContents, "fs:fileChanged", { filePath, type: "write" })`。`fs:readFile`/`fs:writeFile` 的 `encoding` 参数类型由契约给出 `EncodingId | undefined`；`fs:writeFile` 原有默认值 `encoding: EncodingId = "utf8"` 保留写法 `(event, filePath, content, encoding = "utf8")`。`fs:createFile` 的 `content: string = ""` 同理保留默认值。

- [ ] **Step 2: 改写 `git-handlers.ts` 的 `guarded` 与 12 个注册**

把第 60–67 行的 `guarded` 改为契约感知版本：

```ts
  /**
   * 包装每个 git handler：先校验发送者（阻止被注入的 iframe/webview 触发 git 操作，
   * 尤其是 discard/checkout/reset 等破坏性命令），通过后再执行原逻辑。
   * 拒绝时返回 IPCResult 失败对象——所有 git 通道的契约 result 都是 IPCResult 形状。
   */
  const guarded =
    <K extends InvokeChannel>(fn: InvokeHandler<K>): InvokeHandler<K> =>
    async (event, ...args) => {
      if (!validateSender(event, ctx)) {
        return {
          success: false,
          error: "Unauthorized sender",
          errorCode: "ERR_UNAUTHORIZED",
        } as InvokeResult<K>;
      }
      return fn(event, ...args);
    };
```

import 区加 `import type { InvokeChannel, InvokeResult } from "../../shared/types/ipc";` 与 `import { typedHandle, type InvokeHandler } from "./_typed";`。每个注册改为

```ts
  typedHandle(
    "git:isRepo",
    guarded<"git:isRepo">(async (_event, workspacePath) => {
      ...
    }),
  );
```

（显式写 `guarded<"git:isRepo">` 让参数类型可推导；12 个都这样写。）`as InvokeResult<K>` 是本文件唯一允许的断言，原因是泛型 K 下 TS 无法证明失败对象属于每个具体 result；注释已写在函数头。

- [ ] **Step 3: 改写 `terminal-handlers.ts`**

7 个 handle 按规则改；第 281、287 行推送 → `sendToRenderer(mainWindow?.webContents, "terminal:data", { id, data })` / `sendToRenderer(mainWindow?.webContents, "terminal:exit", { id, exitCode })`。`terminal:execute` 在命令被拦截时返回 `{ success:false, error, data:{ stdout:"", stderr } }`，契约 `IPCResult<TerminalExecResult>` 兼容。

- [ ] **Step 4: 验证**

```bash
grep -nE 'ipcMain\.(handle|on)\(|webContents\.send\(|sender\.send\(' src/main/ipc/fs-handlers.ts src/main/ipc/git-handlers.ts src/main/ipc/terminal-handlers.ts
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files|Tests "
```

Expected: grep 无输出；lint 0 errors；28 个测试文件全过（`git-handlers.test.ts` 的 F3 用例继续通过——`guarded` 语义未变）。

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/fs-handlers.ts src/main/ipc/git-handlers.ts src/main/ipc/terminal-handlers.ts
git commit -m "refactor(main/ipc): fs/git/terminal 通道改走类型化包装；git guarded 改为契约感知泛型"
```

---

### Task 7: 迁移批 C —— debug / index / ai（含 `debug:event` 推送）

**Files:**
- Modify: `src/main/ipc/debug-handlers.ts`（20 handle）
- Modify: `src/main/debugger/session-manager.ts`（`sendEvent` 改 `sendToRenderer`）
- Modify: `src/main/ipc/index-handlers.ts`（11 handle + 3 推送）
- Modify: `src/main/ipc/ai-handlers.ts`（5 handle + 4 on + 17 推送）

- [ ] **Step 1: 改写 `debug-handlers.ts`**

20 个 handle 按规则改。`debug:start` 的参数由契约给 `DebugConfig`（`program` 可选），handler 内已有 `if (!config.program || !isWithinWorkspace(...))` 守卫，无需改逻辑。`debug:setBreakpoints` 参数 `breakpoints` 由契约推导。

- [ ] **Step 2: `session-manager.ts` 的推送改类型化**

第 31–33 行改为

```ts
  /** 向渲染进程发送事件 */
  private sendEvent(
    event: DebugEventPayload["event"],
    data: Omit<DebugEventPayload, "event">,
  ): void {
    sendToRenderer(this.mainWindow?.webContents, "debug:event", { event, ...data });
  }
```

import 区加 `import { sendToRenderer } from "../ipc/_typed";` 与 `import type { DebugEventPayload } from "../../shared/types/ipc";`。四处 `this.sendEvent("stopped", {...})` 等调用的对象字面量已含 `sessionId`，其余字段与 `DebugEventPayload` 可选字段一致；`reason: body?.reason || "unknown"` 等保持不变（`body` 仍是 any，Task 10 处理）。

- [ ] **Step 3: 改写 `index-handlers.ts`**

11 个 handle 按规则改；三处推送改为

```ts
      service.on("onProgress", (progress) => {
        sendToRenderer(mainWindow()?.webContents, "index:progress", progress);
      });
      service.on("onFileIndexed", (filePath, symbolCount) => {
        sendToRenderer(mainWindow()?.webContents, "index:fileIndexed", { filePath, symbolCount });
      });
      service.on("onComplete", (stats) => {
        sendToRenderer(mainWindow()?.webContents, "index:complete", stats);
      });
```

若 tsc 报 `progress`/`stats` 与 `IndexProgress`/`IndexCompleteStats` 不符，按 core/indexing 的事件类型修 shared（契约以实现为准）。`index:findDefinition` 契约已放宽为 `IPCResult<IndexSymbol | null>`；若 handler 返回 `undefined`，在 handler 里写 `data: symbol ?? null`——这是**类型层的规范化**，返回值 `undefined→null` 对渲染进程判空逻辑（`if (res.data)`）无影响。

- [ ] **Step 4: 改写 `ai-handlers.ts`**

- 5 个 `ipcMain.handle`（`ai-chat`、`ai-stats`、`ai:completion` 及 settings 相关若在此文件）与 4 个 `ipcMain.on`（`ai-chat-stream`、`ai-chat-stream-with-tools`、`ai-stream-cancel`、`ai:completion-stream`）按规则改；删除 `ai:completion` / `ai:completion-stream` 参数上的内联对象类型（契约已定义）。
- 17 处 `event.sender.send("ai-stream-…", {...})` → `sendToRenderer(event.sender, "ai-stream-…", {...})`。可用 sed 一次完成：

```bash
sed -i '' -E 's/event\.sender\.send\(/sendToRenderer(event.sender, /g' src/main/ipc/ai-handlers.ts
```

- `import { ipcMain } from "electron";` 删除（若无其他用途）；加 `import { typedHandle, typedOn, sendToRenderer } from "./_typed";`。
- `ai-chat-stream` 等 `on` 回调解构 `{ model, messages, requestId }` 现在有类型；若 tsc 报 `messages` 类型与 `LLMClient.chat` 期望不一致，说明 `ChatMessage` 契约与实现漂移——按 `LLMRequest.messages` 的类型修 shared `ai.ts`，不改 handler。

- [ ] **Step 5: 全仓验证 main 无裸注册/推送**

```bash
grep -rnE 'ipcMain\.(handle|on)\(' src/main --include='*.ts' | grep -v "src/main/ipc/_typed.ts"
grep -rnE '(webContents|sender)\.send\(' src/main --include='*.ts' | grep -v "src/main/ipc/_typed.ts"
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -1
```

Expected: 两个 grep 均无输出；lint 0 errors；28 个测试文件全过；`✓ built`。

- [ ] **Step 6: 启动冒烟（保证零行为变化）**

```bash
npm run test:e2e 2>&1 | grep -E "passed|failed"
```

Expected: `20 passed`。

- [ ] **Step 7: Commit**

```bash
git add src/main
git commit -m "refactor(main/ipc): debug/index/ai 通道与推送全部改走类型化包装；debug:event 纳入事件契约"
```

---

### Task 8: 静态契约一致性测试（main 侧）

**Files:**
- Test: `src/test/unit/ipc/contract-registry.test.ts`

**Interfaces:**
- Consumes: Task 3 的三张常量表；Task 4–7 的 `typedHandle / typedOn / sendToRenderer` 调用形态

- [ ] **Step 1: 写测试**

```ts
/**
 * 契约一致性（静态扫描，不加载任何 handler 模块，避免 electron/sql.js 等副作用）：
 * 1. src/main 下除 _typed.ts 外不允许出现裸 ipcMain.handle/on 与 webContents/sender.send。
 * 2. typedHandle 注册的通道集合 == INVOKE_CHANNELS；typedOn == SEND_CHANNELS；sendToRenderer == EVENT_CHANNELS。
 * 任何一端多一个或少一个通道都会失败，防止契约再次漂移。
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { INVOKE_CHANNELS, SEND_CHANNELS, EVENT_CHANNELS } from "@shared/types/ipc";

const MAIN_DIR = fileURLToPath(new URL("../../../main/", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function collect(pattern: RegExp, sources: Array<{ file: string; text: string }>): Set<string> {
  const found = new Set<string>();
  for (const { text } of sources) {
    for (const m of text.matchAll(pattern)) found.add(m[1]);
  }
  return found;
}

const sources = walk(MAIN_DIR)
  .filter((f) => !f.endsWith("preload.ts"))
  .map((file) => ({ file, text: readFileSync(file, "utf8") }));
const nonWrapper = sources.filter((s) => !s.file.endsWith(join("ipc", "_typed.ts")));

describe("IPC 契约一致性（main）", () => {
  it("src/main 中除 _typed.ts 外没有裸 ipcMain.handle/on", () => {
    const offenders = nonWrapper.filter((s) => /ipcMain\.(handle|on)\(/.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("src/main 中除 _typed.ts 外没有裸 webContents.send / sender.send", () => {
    const offenders = nonWrapper.filter((s) => /(webContents|sender)\.send\(/.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("typedHandle 注册集合 == INVOKE_CHANNELS", () => {
    const found = collect(/typedHandle(?:<[^>]*>)?\(\s*"([^"]+)"/g, nonWrapper);
    expect([...found].sort()).toEqual([...INVOKE_CHANNELS].sort());
  });

  it("typedOn 注册集合 == SEND_CHANNELS", () => {
    const found = collect(/typedOn(?:<[^>]*>)?\(\s*"([^"]+)"/g, nonWrapper);
    expect([...found].sort()).toEqual([...SEND_CHANNELS].sort());
  });

  it("sendToRenderer 推送集合 == EVENT_CHANNELS", () => {
    const found = collect(/sendToRenderer\(\s*[^,]+?,\s*"([^"]+)"/g, nonWrapper);
    expect([...found].sort()).toEqual([...EVENT_CHANNELS].sort());
  });

  it("main 侧未使用任何契约之外的字符串通道（模板字符串也不允许）", () => {
    const offenders = nonWrapper
      .filter((s) => /sendToRenderer\(\s*[^,]+?,\s*`/.test(s.text) || /typed(Handle|On)(?:<[^>]*>)?\(\s*`/.test(s.text))
      .map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行**

```bash
npx vitest run src/test/unit/ipc/contract-registry.test.ts 2>&1 | grep -E "✓|✗|×|Tests|Expected|Received" | head -20
```

Expected: 6 个用例全过。若集合断言失败，输出会列出多出/缺少的通道名：多出的说明 Task 3 常量表漏了它（补进常量表与 Map）；缺少的说明某 handler 还没迁移或写错通道名（回到对应 Task 修）。

- [ ] **Step 3: Commit**

```bash
git add src/test/unit/ipc/contract-registry.test.ts
git commit -m "test(ipc): 静态契约一致性——main 无裸通道调用，注册/推送集合与契约常量表相等"
```

---

### Task 9: preload 迁移 + `typeof` 全局声明 + preload 扫描测试

**Files:**
- Modify: `src/main/preload.ts`（144 处 ipcRenderer 调用；第 61–470 行两个 `exposeInMainWorld`；第 475–697 行 `declare global`）
- Modify: `src/test/unit/ipc/contract-registry.test.ts`（追加 preload 用例）
- Modify: 渲染进程中因类型变精确而报错的文件（数量由 tsc 决定）

**Interfaces:**
- Consumes: Task 3 契约；`IPCEventHandler`
- Produces: `window.electronAPI: typeof electronApi`、`window.mindcode: typeof mindcodeApi`，渲染进程获得与实现完全一致的类型

- [ ] **Step 1: 在 preload 顶部加三个类型化助手（放在 import 之后、第一个 `exposeInMainWorld` 之前）**

```ts
import type {
  EventChannel,
  EventPayload,
  InvokeChannel,
  InvokeParams,
  InvokeResult,
  SendChannel,
  SendParams,
} from "../shared/types/ipc";

/** 类型化 ipcRenderer.invoke —— 通道名/参数/返回值由契约推导 */
function typedInvoke<K extends InvokeChannel>(channel: K, ...params: InvokeParams<K>): Promise<InvokeResult<K>> {
  return ipcRenderer.invoke(channel, ...params);
}

/** 类型化 ipcRenderer.send（renderer → main 单向） */
function typedSend<K extends SendChannel>(channel: K, ...params: SendParams<K>): void {
  ipcRenderer.send(channel, ...params);
}

/** 类型化 ipcRenderer.on，返回取消订阅函数 */
function typedOn<K extends EventChannel>(channel: K, listener: (payload: EventPayload<K>) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: EventPayload<K>): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}
```

删除现在多余的 `import type { IPCResult as MainIPCResult } from "./ipc/types";`（Step 4 后不再引用）。

- [ ] **Step 2: 机械替换 invoke / send**

```bash
sed -i '' -E 's/ipcRenderer\.invoke\(/typedInvoke(/g; s/ipcRenderer\.send\(/typedSend(/g' src/main/preload.ts
grep -c "typedInvoke(\|typedSend(" src/main/preload.ts
```

Expected: 计数为 `108`（96 invoke + 12 send 调用点：window 4 + ai 8）。注意 sed 也会把三个助手函数内部的 `ipcRenderer.invoke(`/`ipcRenderer.send(` 改掉——**把这两处改回来**（助手函数体必须调用真正的 `ipcRenderer.*`）。

- [ ] **Step 3: 手工改写 12 个 on/removeListener 方法为 `typedOn`**

逐个替换为如下实现（保持对外签名不变）：

```ts
    completionStream: (request: CompletionRequest, callbacks: CompletionStreamCallbacks): (() => void) => {
      const requestId = `completion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const offToken = typedOn("ai:completion-stream-token", (data) => {
        if (data.requestId === requestId) callbacks.onToken(data.token);
      });
      const offDone = typedOn("ai:completion-stream-done", (data) => {
        if (data.requestId === requestId) {
          callbacks.onDone(data.fullText, data.cached);
          cleanup();
        }
      });
      const offError = typedOn("ai:completion-stream-error", (data) => {
        if (data.requestId === requestId) {
          callbacks.onError(data.error);
          cleanup();
        }
      });
      const cleanup = (): void => {
        offToken();
        offDone();
        offError();
      };
      typedSend("ai:completion-stream", { ...request, requestId });
      return cleanup;
    },
```

**改写前先读原实现**（第 86–112 行、118–151 行、156–200 行），保留原有的 `requestId` 生成方式、过滤条件与回调顺序，只把 `ipcRenderer.on/removeListener` 对换成 `typedOn` 返回的取消函数。`chatStream` 与 `chatStreamWithTools` 的 cleanup 里还要保留 `typedSend("ai-stream-cancel", { requestId })`（P1-4 真取消依赖它）。

其余 9 个（`terminal.onData/onExit`、`onThemeChange`、`onFileSystemChange`、`lsp.onNotification`、`index.onProgress/onFileIndexed/onComplete`）形如：

```ts
    onData: (handler: (data: TerminalDataEvent) => void): (() => void) => typedOn("terminal:data", handler),
```

`onMenuEvent`（第 286–316 行）改为：

```ts
  onMenuEvent: (callback: (event: MenuEvent, data?: string) => void): (() => void) => {
    const MENU_EVENTS = [
      "menu:newFile", "menu:openFile", "menu:openFolder", "menu:save", "menu:saveAs", "menu:closeEditor",
      "menu:find", "menu:findInFiles", "menu:replace", "menu:commandPalette", "menu:showExplorer", "menu:showSearch",
      "menu:showGit", "menu:toggleTerminal", "menu:toggleAI", "menu:goToFile", "menu:goToLine", "menu:newTerminal",
    ] as const satisfies readonly MenuEvent[];
    const offs = MENU_EVENTS.map((ev) =>
      typedOn(ev, (payload) => callback(ev, typeof payload === "string" ? payload : undefined)),
    );
    return () => offs.forEach((off) => off());
  },
```

- [ ] **Step 4: 把两个 API 对象提取为常量，`declare global` 改为 `typeof`**

```ts
// 窗口控制 API (TitleBar 使用)
const electronApi = {
  minimizeWindow: (): void => typedSend("window:minimize"),
  ...
};
contextBridge.exposeInMainWorld("electronAPI", electronApi);

// 暴露安全的 API 给渲染进程
const mindcodeApi = {
  getVersion: () => typedInvoke("get-app-version"),
  ai: { ... },
  ...
};
contextBridge.exposeInMainWorld("mindcode", mindcodeApi);

// ─── 全局类型声明：直接从实现派生，杜绝手写副本漂移 ───
export type ElectronApi = typeof electronApi;
export type MindcodeApi = typeof mindcodeApi;

declare global {
  interface Window {
    electronAPI: ElectronApi;
    mindcode: MindcodeApi;
  }
}
```

删除原第 475–697 行整段手写接口。

- [ ] **Step 5: 修 preload 侧 `debug.getVariables` 与契约的参数错位**

原 `getVariables: (frameId?: number) => ipcRenderer.invoke("debug:getVariables", frameId)` 会被 tsc 拒绝（契约第一参是 `sessionId?: string`）。改为

```ts
    getVariables: (sessionId?: string, frameId?: number) => typedInvoke("debug:getVariables", sessionId, frameId),
```

`grep -rn "debug\.getVariables(" src/renderer` 应无调用方（M2 实测为空）；若有，按新签名补 `undefined` 作为第一参。这是**类型暴露的真实缺陷**（渲染进程把 frameId 当 sessionId 发），按全局约束单独 commit 并在 `01` P1-11 条目下追加一句"M2 修正 preload getVariables 参数错位"。

- [ ] **Step 6: 跑三份 tsc，修渲染进程暴露出的类型错误**

```bash
npx tsc --noEmit 2>&1 | head -40
```

处理规则：
- `MainIPCResult` 消失导致的错误 → 改用 shared `IPCResult<...>`。
- `res.data` 形状变精确导致的属性访问错误（例如 `data.results`、`session.name`）→ 改渲染进程代码使用真实字段；若渲染进程依赖一个实现根本不返回的字段，说明该 UI 分支本来就是死的，改为使用契约字段并在 commit message 里列出文件。
- **禁止**用 `as any`、`as unknown as X`、放宽 shared 类型来消错。
- 重复直到 `npx tsc --noEmit && npx tsc -p tsconfig.main.json --noEmit && npx tsc -p tsconfig.test.json --noEmit` 全绿。

- [ ] **Step 7: 追加 preload 静态用例到 `contract-registry.test.ts`**

```ts
describe("IPC 契约一致性（preload）", () => {
  const preload = readFileSync(join(MAIN_DIR, "preload.ts"), "utf8");

  it("preload 中 ipcRenderer.* 只出现在三个类型化助手内（invoke/send/on/removeListener 各 1 次）", () => {
    const count = (re: RegExp): number => (preload.match(re) ?? []).length;
    expect(count(/ipcRenderer\.invoke\(/g)).toBe(1);
    expect(count(/ipcRenderer\.send\(/g)).toBe(1);
    expect(count(/ipcRenderer\.on\(/g)).toBe(1);
    expect(count(/ipcRenderer\.removeListener\(/g)).toBe(1);
    expect(count(/ipcRenderer\.once\(/g)).toBe(0);
  });

  it("preload 使用的通道名全部在契约内", () => {
    const src = [{ file: "preload.ts", text: preload }];
    const invoke = collect(/typedInvoke\(\s*"([^"]+)"/g, src);
    const send = collect(/typedSend\(\s*"([^"]+)"/g, src);
    const on = collect(/typedOn\(\s*"([^"]+)"/g, src);
    expect([...invoke].filter((c) => !(INVOKE_CHANNELS as readonly string[]).includes(c))).toEqual([]);
    expect([...send].filter((c) => !(SEND_CHANNELS as readonly string[]).includes(c))).toEqual([]);
    expect([...on].filter((c) => !(EVENT_CHANNELS as readonly string[]).includes(c))).toEqual([]);
  });

  it("preload 不再保留手写的 window.mindcode 接口副本", () => {
    expect(preload).toMatch(/mindcode:\s*MindcodeApi;/);
    expect(preload).not.toMatch(/mindcode:\s*\{\s*\n\s*getVersion:/);
  });
});
```

- [ ] **Step 8: 全量验证**

```bash
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -1 && npm run test:e2e 2>&1 | grep -E "passed|failed"
```

Expected: lint 0 errors；28 个测试文件全过；`✓ built`；`20 passed`。

- [ ] **Step 9: Commit（若 Step 5/6 有行为修正，先单独 commit 那部分）**

```bash
git add src/main/preload.ts src/renderer src/test/unit/ipc/contract-registry.test.ts
git commit -m "refactor(preload): typedInvoke/typedSend/typedOn 接契约；window.mindcode 类型改为 typeof 派生，删除 220 行手写副本

- 144 处 ipcRenderer 调用全部经类型化助手，静态测试锁定
- 渲染进程随之修正与实现不一致的字段访问（列表见 diff）"
```

---

### Task 10: any 治理 · main（23 处）+ P2-13 独立修复

**Files:**
- Modify: `src/main/lsp-manager.ts`（17）、`src/main/debugger/session-manager.ts`（4）、`src/main/ipc/ai-handlers.ts`（2）
- Modify: `docs/refactor/01_BUG_AND_RISK_REGISTER.md`（P2-13 → CLOSED）

- [ ] **Step 1: `lsp-manager.ts` 结构化替换**

| 行 | 现状 | 改为 |
|---|---|---|
| 20 | `initOptions?: any;` | `initOptions?: Record<string, unknown>;` |
| 74 | `capabilities: any;` | `capabilities: Record<string, unknown> \| undefined;` |
| 77 | `resolve: (v: any) => void; reject: (e: any) => void` | `resolve: (v: unknown) => void; reject: (e: Error) => void` |
| 86 | `Set<(method: string, params: any) => void>` | `Set<(method: string, params: unknown) => void>` |
| 118 | `Promise<{ success: boolean; capabilities?: any; error?: string }>` | `Promise<{ success: boolean; capabilities?: Record<string, unknown>; error?: string }>` |
| 165–169 | `(server as any)._restartCount` ×5 | 在服务器记录接口（第 70 行附近 `interface LSPServerInstance`/等价名）加 `restartCount: number;`，创建实例处初始化 `restartCount: 0`，五处改为 `server.restartCount` |
| 198 | `catch (err: any)` | `catch (err: unknown)`，取消息用 `err instanceof Error ? err.message : String(err)` |
| 218 | `params: any, timeout = 10000): Promise<any>` | `params: unknown, timeout = 10000): Promise<unknown>` |
| 235 | `params: any` | `params: unknown` |
| 244 | `(method: string, params: any) => void` | `(method: string, params: unknown) => void` |
| 252 | `capabilities?: any` | `capabilities?: Record<string, unknown>` |

第 165 行原逻辑 `(server as any)._restartCount < 3` 在字段从未初始化时恒为 `undefined < 3 === false`，即自动重启从未触发（P2-13）。加 `restartCount: 0` 初始化后重启逻辑开始生效——**这是行为变化**，放在单独 commit（Step 3）。

- [ ] **Step 2: `session-manager.ts` 与 `ai-handlers.ts`**

`session-manager.ts`：
- 第 196 行 `breakpoints?: any[]` → `breakpoints?: DAPBreakpoint[]`。
- 第 291/315/320 行三个事件体：在 `dap-client.ts` 导出

```ts
export interface DAPStoppedEventBody { reason?: string; threadId?: number; text?: string; }
export interface DAPExitedEventBody { exitCode?: number; }
export interface DAPOutputEventBody { category?: string; output?: string; }
```

  三处回调改为 `(body: DAPStoppedEventBody | undefined)`、`(body: DAPExitedEventBody | undefined)`、`(body: DAPOutputEventBody | undefined)`；函数体内 `body?.threadId` 等访问方式不变。

`ai-handlers.ts`：第 491 行 `onError: (err: any)` → `onError: (err: Error)`；第 499 行 `catch (e: any)` → `catch (e: unknown)`，`e?.message` 改为 `e instanceof Error ? e.message : "Completion stream failed"`。

- [ ] **Step 3: 分两次 commit**

先只提交 P2-13 修复：

```bash
npx tsc -p tsconfig.main.json --noEmit && npm run test 2>&1 | grep -E "Test Files"
git add src/main/lsp-manager.ts
git commit -m "fix(lsp): 初始化 restartCount，使自动重启真正生效（P2-13）

原 (server as any)._restartCount 从未初始化，undefined < 3 恒 false，重启分支不可达。
类型治理引入 restartCount: number 字段后该缺陷暴露，单独提交以便回滚。"
```

然后在 `01_BUG_AND_RISK_REGISTER.md` 的 P2-13 行末追加 ` **CLOSED**（M2 类型治理时修复，commit 见 git log）`，与其余 main 侧 any 改动一起提交：

```bash
npx eslint src/main --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | tail -3
git add src/main docs/refactor/01_BUG_AND_RISK_REGISTER.md
git commit -m "refactor(main): 消除 src/main 全部 no-explicit-any（lsp-manager/session-manager/ai-handlers）"
```

Expected: eslint 命令输出 `0 errors`（该命令临时把规则升为 error 只查 main 目录）。

---

### Task 11: any 治理 · core（38 处，跳过 M3 删除清单）

**Files:**
- Modify: `src/core/ai/completion-context.ts`（6）、`src/core/ai/completion-service.ts`（6）、`src/core/ai/thinking-prompt.ts`（2）、`src/core/github/client.ts`（2）、`src/core/indexing/embeddings/index.ts`（1）、`src/core/indexing/parser/typescript.ts`（2）、`src/core/indexing/storage/sqliteStore.ts`（7）、`src/core/lsp/client.ts`（6）、`src/core/lsp/types.ts`（4）、`src/core/performance/index.ts`（2）
- **不动**（M3 删除）：`core/ai/tools/rollback.ts`、`core/ai/tools/impact-analyzer.ts`、`core/composer/planGenerator.ts`、`core/extensions/contributions.ts`、`core/collab/collabService.ts`

- [ ] **Step 1: Monaco 类型（completion-context / completion-service）**

两文件顶部加 `import type * as monaco from "monaco-editor";`（类型导入在主进程构建中被擦除，安全）。

`completion-context.ts`：
- 113–115 行 `editor: any / model: any / position: any` → `editor: monaco.editor.IStandaloneCodeEditor`、`model: monaco.editor.ITextModel`、`position: monaco.Position`。
- 146 行 `extractDiagnosticsFromMonaco(monaco: any, model: any)` → `extractDiagnosticsFromMonaco(monacoApi: typeof monaco, model: monaco.editor.ITextModel)`（参数改名避免与命名空间同名），函数体内 `monaco.editor.getModelMarkers` 改为 `monacoApi.editor.getModelMarkers`。
- 149 行 `(marker: any)` → `(marker: monaco.editor.IMarker)`。

`completion-service.ts` 第 355–357 行：

```ts
export function createMonacoCompletionProvider(
  service: CompletionService,
  monacoApi: typeof monaco,
): monaco.languages.InlineCompletionsProvider {
  return {
    provideInlineCompletions: async (
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      context: monaco.languages.InlineCompletionContext,
      token: monaco.CancellationToken,
    ) => {
```

函数体内对 `monaco.*` 的值访问改为 `monacoApi.*`。若返回对象缺少 `InlineCompletionsProvider` 要求的 `freeInlineCompletions`，补空实现 `freeInlineCompletions: () => {}`（接口必需成员，无行为影响）。

- [ ] **Step 2: 其余 core 文件**

| 文件:行 | 改为 |
|---|---|
| `thinking-prompt.ts:156` `isValidThinkingOutput(obj: any)` | `(obj: unknown): obj is ThinkingUIOutput`，函数体开头加 `if (typeof obj !== "object" \|\| obj === null) return false; const o = obj as Record<string, unknown>;` 后续用 `o.xxx` 判断 |
| `thinking-prompt.ts:220` `uiMatch[1] as any` | `uiMatch[1] as ThinkingUIOutput["ui"]["mode"]` |
| `github/client.ts:10` `const win = window as any;` | 删除该行，后续 `win.mindcode` 改为 `window.mindcode`（全局已有精确类型） |
| `github/client.ts:138` `body?: any` | `body?: unknown` |
| `indexing/embeddings/index.ts:59` `catch (error: any)` | `catch (error: unknown)` + `error instanceof Error ? error.message : String(error)` |
| `indexing/parser/typescript.ts:450` `(node as any).jsDoc` | `(node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc` |
| `indexing/parser/typescript.ts:459` `(c: any) => c.text` | `(c: ts.JSDocComment) => c.text` |
| `indexing/storage/sqliteStore.ts:8–26` | 文件顶部加 `type SqlValue = number \| string \| Uint8Array \| null;` 与 `type SqlRow = Record<string, SqlValue>;`；接口内 `any[]` → `SqlValue[]`，`exec(sql): any[]` → `exec(sql): Array<{ columns: string[]; values: SqlValue[][] }>`，`getAsObject(): Record<string, any>` → `SqlRow`；408 行 `rowToSymbol(row: Record<string, any>)` → `rowToSymbol(row: SqlRow)`，函数体内对数值/字符串字段用 `Number(row.x)` / `String(row.x)` 显式转换 |
| `lsp/client.ts:10` `(data: any)` | `(data: unknown)` |
| `lsp/client.ts:11` `const win = window as any;` | 删除，改用 `window.mindcode` |
| `lsp/client.ts:118` `request(method, params: any): Promise<any>` | `request<T = unknown>(method: string, params: unknown): Promise<T>`，内部 `return result as T` |
| `lsp/client.ts:125` `params: any` | `params: unknown` |
| `lsp/client.ts:137` `params: any` | `params: unknown`（该回调类型来自 `lsp.onNotification`，改用契约 `LSPNotificationData` 后此注解可整体删除） |
| `lsp/types.ts:22` `data?: any` | `data?: unknown` |
| `lsp/types.ts:37–39` `params?: any` / `result?: any` | `unknown` |
| `performance/index.ts:77–78` | `Map<string, Promise<unknown>>`、`{ data: unknown; timestamp: number }`（`dedupe<T>` 内已有 `as T`/`as Promise<T>` 断言，无需改） |

`lsp/client.ts` 把 `request` 改为泛型后，调用方（`src/renderer/services/lspProviders.ts` 等）若把返回值当具体类型用，改为 `client.request<Hover>("textDocument/hover", ...)` 这种显式泛型，不加断言。

- [ ] **Step 3: 验证并提交**

```bash
npx eslint src/core --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -E "error|problems" | grep -vE "tools/(rollback|impact-analyzer)|composer/|extensions/|collab/"
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files"
git add src/core src/renderer
git commit -m "refactor(core): 消除 src/core 非删除清单内全部 no-explicit-any（monaco/sql.js/LSP/GitHub 边界类型化）"
```

Expected: 第一条命令过滤后无 `error` 行；lint 0 errors；测试全过。

---

### Task 12: any 治理 · renderer services / utils / hooks（29 处）

**Files:**
- Modify: `src/renderer/services/agentToolService.ts`（14）、`lspProviders.ts`（4）、`indexedDB.ts`（2）、`bugFixes.ts`（1）、`startupOptimizer.ts`（1）；`src/renderer/utils/lazyLoad.tsx`（3）、`utils/preload.ts`（2）；`src/renderer/hooks/index.ts`（1）；`src/renderer/components/AIPanel/hooks/useScrollAnchor.ts`（1）

- [ ] **Step 1: `agentToolService.ts` —— 引入 `ToolArgs` 与读取助手**

文件顶部加：

```ts
/** 工具调用实参：来自模型输出的 JSON，键固定为字符串，值需逐个收窄 */
export type ToolArgs = Record<string, unknown>;

function argString(args: ToolArgs, key: string, fallback = ""): string {
  const v = args[key];
  return typeof v === "string" ? v : fallback;
}
function argNumber(args: ToolArgs, key: string, fallback: number): number {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function argBoolean(args: ToolArgs, key: string, fallback = false): boolean {
  const v = args[key];
  return typeof v === "boolean" ? v : fallback;
}
```

然后：
- 第 20 行 `data?: any` → `data?: unknown`；第 27 行 `args: Record<string, any>` → `args: ToolArgs`。
- 第 73、207、298、333、350、388、408、435、460、486、517、605 行的 `args: Record<string, any>` → `args: ToolArgs`。
- 各 `handleXxx` 内 `args.path`、`args.query`、`args.line` 等访问改为 `argString(args, "path")`、`argNumber(args, "line", 1)`、`argBoolean(args, "recursive")`；原本对缺失值的默认行为（如 `args.maxResults || 50`）改为 `argNumber(args, "maxResults", 50)`，语义一致。
- `execute()` 第 85 行 `args.path` → `argString(args, "path")`（空串视为无 path，与原 `if (... && args.path)` 判真一致）。
- `isToolCallBlocked(name, args)`（schemas.ts:361）的 `args` 参数类型若为 `Record<string, any>`，同步改为 `Record<string, unknown>` 并在其实现内用同样的 `typeof` 收窄；这属于 `schemas.ts`（保留文件），一并改。

- [ ] **Step 2: 其余文件**

| 文件:行 | 改为 |
|---|---|
| `lspProviders.ts:75` `range: undefined as any` | 在 `provideCompletionItems` 里计算 `const word = model.getWordUntilPosition(position); const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);` 并传入转换函数，`range` 字段填该值。Monaco 原本会自动填充同一范围，行为不变 |
| `lspProviders.ts:157` `(hover.contents as any).value` | `hover.contents` 类型是 `MarkupContent \| string`，前一分支已处理 `string`，此处直接 `hover.contents.value`（TS 已收窄） |
| `lspProviders.ts:296` `(symbol as any).detail` | `core/lsp/types.ts` 的 `DocumentSymbol` 加 `detail?: string;`（LSP 规范字段），此处改 `symbol.detail ?? ""` |
| `lspProviders.ts:374` `(model as any).getVersionId?.() \|\| 1` | `model.getVersionId()`（`ITextModel` 自带） |
| `indexedDB.ts:229/237` `data: any` | `data: unknown` |
| `bugFixes.ts:104` `catch (error: any)` | `catch (error: unknown)` + `getErrorMessage(error)`（`import { getErrorMessage } from "../../shared/utils/errors"`） |
| `startupOptimizer.ts:32`、`utils/preload.ts:20/37` `(window as any).requestIdleCallback` | `window.requestIdleCallback`（lib.dom 已声明）；若需兼容不存在的环境，保留原有 `if ("requestIdleCallback" in window)` 判断 |
| `lazyLoad.tsx:18` `ComponentType<any>` | 保留并加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React ComponentType 泛型边界：需接受任意 props 的组件`（第三方泛型边界，允许形态） |
| `lazyLoad.tsx:240/243` `Promise<any>` | `Promise<unknown>` |
| `hooks/index.ts:68` `deps: any[] = []` | `deps: React.DependencyList = []`（文件需 `import type React from "react"` 或 `import type { DependencyList } from "react"`） |
| `useScrollAnchor.ts:12` `dependencies: any[]` | `dependencies: DependencyList`（`import type { DependencyList } from "react"`） |

- [ ] **Step 3: 验证并提交**

```bash
npx eslint src/renderer/services src/renderer/utils src/renderer/hooks src/renderer/components/AIPanel/hooks/useScrollAnchor.ts --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -E "problems|error" | head
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files"
git add src/renderer src/core/lsp/types.ts src/core/ai/tools/schemas.ts
git commit -m "refactor(renderer): services/utils/hooks 消除 no-explicit-any；agentToolService 引入 ToolArgs 与收窄助手"
```

Expected: 仅剩 `lazyLoad.tsx` 一处带说明的 disable，其余 0 error。

---

### Task 13: any 治理 · renderer components / AIPanel（39 处）

**Files:**
- Modify: `src/renderer/components/AIPanel/ContextPicker.tsx`（12）、`ToolBlock.tsx`（4）、`CodeReviewer.tsx`（3）、`AISettings.tsx`（2）、`MessageList.tsx`（2）、`PlanView.tsx`（2）、`hooks/useMultiFileChanges.ts`（2）、`hooks/useThinkingUI.ts`（2）、`AgentView.tsx`（1）、`DebugView.tsx`（1）、`WriteFileToolBlock.tsx`（1）、`hooks/useApplyCode.ts`（1）、`hooks/useChatEngine.ts`（1）
- Modify: `src/renderer/stores/useAIStore.ts`（`ContextType` 联合补齐）

- [ ] **Step 1: `ContextPicker.tsx`**

- `useAIStore.ts:13` 的 `ContextType` 补上 ContextPicker 实际产生的 4 种：`| "codebase" | "web" | "docs" | "git"`（纯类型扩展）。
- 第 37 行 `data: any` → `data: ContextItem["data"] & { relevance?: number; line?: number }`（`import type { ContextItem } from "../../stores/useAIStore"`）。
- 第 99/105 行 `(f: any)` → `(f: FileListEntry | string)`；两处 `typeof f === "string" ? f : f.path` 的收窄保持。
- 第 157 行 `(s: any)` → `(s: IndexSymbol)`；第 185 行 `(r: any, i: number)` → `(r: RelatedCodeEntry, i: number)`；第 232/234 行 `(r: any)` → `(r: SearchMatch)`；第 261/267 行 `(c: any)` → `(c: GitCommitLog)`；第 354 行 `(f: any)` → `(f: FileEntry)`。类型全部 `import type { ... } from "../../../shared/types/ipc"`。
- 第 370 行 `type: item.type as any` → 删除断言，`item.type` 现在是 `PickerMode`；若 `PickerMode` 含 `"menu"`/`"selection"` 等不属于 `ContextType` 的值，在 `handleSelect` 开头加 `if (item.type === "menu") return;` 之类的显式排除，或把 `PickerMode` 拆为 `"menu" | ContextType`。
- 第 389 行 `handleSelect(items[selectedIndex] as any)` → 让 `items` 的元素类型与 `handleSelect` 参数类型一致（同为第 37 行的结果项类型），删除断言。

- [ ] **Step 2: 其余 AIPanel 文件**

| 文件:行 | 改为 |
|---|---|
| `ToolBlock.tsx:11/114/126` `Record<string, any>` | `Record<string, unknown>` |
| `ToolBlock.tsx:13` `result?: any` | `result?: unknown` |
| `AgentView.tsx:66` `args: Record<string, any>` | `args: Record<string, unknown>` |
| `CodeReviewer.tsx:45` `catch (err: any)` | `catch (err: unknown)` + `getErrorMessage(err)` |
| `CodeReviewer.tsx:65` `e.target.value as any` | `e.target.value as keyof typeof REVIEW_PROMPTS` |
| `CodeReviewer.tsx:97` `getIssueStyle(type as any)` | `getIssueStyle(type as ReviewIssue["type"])`，若 `type` 变量本就是该类型则删断言 |
| `AISettings.tsx:136` `tab.id as any` | `tab.id as "model" \| "params" \| "prompt"`，并把 tabs 数组声明为 `as const` 使 `tab.id` 自动是该联合后删断言 |
| `AISettings.tsx:175` `key as any` | `key as keyof typeof PROVIDERS` |
| `MessageList.tsx:17–18` `toolCalls?: any[]; plan?: any` | 删除本地 `Message` 接口，`import type { Message } from "../../stores/useAIStore"`；若本地接口字段少于 store 的 `Message`，改为 `Pick<Message, "id" \| "role" \| "content" \| "mode" \| "toolCalls" \| "plan" \| "isStreaming">` |
| `PlanView.tsx:51/57` `(m: any, i)` / `(t: any, i)` | `(m: Record<string, string>, i: number)`、`(t: Record<string, string>, i: number)`（与 `useChatEngine.parsePlan` 同款） |
| `DebugView.tsx:49` `(f: any)` | `(f: GitFileStatus)` |
| `WriteFileToolBlock.tsx:78`、`useApplyCode.ts:123`、`useMultiFileChanges.ts:142/190` `catch (err: any)` | `catch (err: unknown)` + `getErrorMessage(err)` |
| `useThinkingUI.ts:72` `isValidThinkingOutput(obj: any)` | 与 Task 11 `thinking-prompt.ts` 相同写法（`unknown` + 收窄） |
| `useThinkingUI.ts:124` `modeMatch[1] as any` | `modeMatch[1] as ThinkingUIOutput["ui"]["mode"]` |
| `useChatEngine.ts:152` `data?: any` | `data?: unknown` |

- [ ] **Step 3: 验证并提交**

```bash
npx eslint src/renderer/components/AIPanel --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -E "problems|error" | head
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files"
git add src/renderer
git commit -m "refactor(renderer/AIPanel): 消除 AIPanel 全部 no-explicit-any；ContextType 补齐 codebase/web/docs/git"
```

---

### Task 14: any 治理 · renderer 其余组件（46 处）

**Files:**
- Modify: `EditorSettings.tsx`（6）、`Git/BranchManager.tsx`（5）、`PerformancePanel.tsx`（4）、`SettingsPanel.tsx`（4）、`Git/StashManager.tsx`（3）、`GitPanel.tsx`（3）、`SettingsView.tsx`（3）、`ComposerPanel.tsx`（2）、`GitHubPanel.tsx`（2）、`Settings/SettingsPanel.tsx`（2）、`StatusBar/StatusBar.tsx`（2）、`Terminal.tsx`（2）、`CodeEditor.tsx`（1）、`CodeReview/ReviewPanel.tsx`（1）、`Debugger/DebugConsole.tsx`（1）、`LSP/LSPStatus.tsx`（1）、`SearchPanel.tsx`（1）、`SearchReplace.tsx`（1）、`TaskRunner.tsx`（1）、`Terminal/TerminalManager.tsx`（1）、`TerminalPanel.tsx`（1）、`ToolConfirmDialog.tsx`（1）
- **不动**（M3 删除）：`components/Composer/ComposerPanel.tsx`、`StatusBarEnhanced.tsx`、`contexts/`、`stores/createStore.ts`

- [ ] **Step 1: 统一处理 `catch (x: any)`（17 处）**

文件与行：`BranchManager.tsx:38/54/66/76/86`、`StashManager.tsx:53/64/75`、`GitPanel.tsx:251/270/320`、`ComposerPanel.tsx:39/55`、`Terminal.tsx:107/142`、`CodeEditor.tsx:307`、`DebugConsole.tsx:63`、`SearchReplace.tsx:55`、`TerminalManager.tsx:61`。全部改为 `catch (err: unknown) { setError(getErrorMessage(err)); }`（保留原有其他语句），`import { getErrorMessage } from "../../shared/utils/errors";`（按各文件相对路径）。

- [ ] **Step 2: 其余按表**

| 文件:行 | 改为 |
|---|---|
| `EditorSettings.tsx:53` `value: any` | `value: unknown` |
| `EditorSettings.tsx:54` `config[key] as any` | `config[key] as Record<string, unknown>` |
| `EditorSettings.tsx:132/147/191/206` `e.target.value as any` | 分别 `as EditorConfig["wordWrap"]`、`as EditorConfig["lineNumbers"]`、`as EditorConfig["cursorStyle"]`、`as EditorConfig["renderWhitespace"]` |
| `PerformancePanel.tsx:37/145` `performance as any` | 文件顶部加 `type PerformanceWithMemory = Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };`，两处改 `performance as PerformanceWithMemory` |
| `PerformancePanel.tsx:128` `(window as any).gc` ×2 | `const w = window as Window & { gc?: () => void }; if (w.gc) w.gc();` |
| `SettingsPanel.tsx:13` `default: any` | `default: SettingValue`（`import type { SettingValue } from "../../shared/types/ipc"`） |
| `SettingsPanel.tsx:125/136/143` `Record<string, any>` / `value: any` | `Record<string, SettingValue>` / `value: SettingValue`；`JSON.parse(stored)` 处写 `setValues(JSON.parse(stored) as Record<string, SettingValue>)`（localStorage 边界，唯一断言） |
| `SettingsView.tsx:9/119/234` `value: any` / `val: any` | `SettingValue` |
| `Settings/SettingsPanel.tsx:138` `value: any` | `value: (typeof settings)[T][keyof (typeof settings)[T]]` |
| `Settings/SettingsPanel.tsx:453` `key as any` | `key as keyof typeof settings.shortcuts` |
| `GitHubPanel.tsx:62` `(i: any) => !(i as any).pull_request` | `(i: GitHubIssue & { pull_request?: unknown }) => !i.pull_request`（GitHub API 在 issues 列表里混入 PR 时带该字段，`core/github/types.ts` 的 `GitHubIssue` 未声明；不改 types，就地交叉） |
| `StatusBar/StatusBar.tsx:123/124` `(f: any)` | `(f: GitFileStatus)` |
| `ReviewPanel.tsx:107` `e.target.value as any` | `e.target.value as "all" \| "error" \| "warning" \| "info"` |
| `LSPStatus.tsx:17` `useState<any>(null)` | `useState<Record<string, unknown> \| null>(null)` |
| `SearchPanel.tsx:50` `(res.data as any).results` | `res.data` 契约为 `SearchMatch[]`，`Array.isArray` 分支已覆盖；删除 `.results` 回退：`const items: SearchMatch[] = res.data;`，循环内 `it.filePath \|\| it.file` 改为 `it.file`（`SearchMatch` 无 `filePath`，原代码该分支是死路径） |
| `TaskRunner.tsx:12`、`TerminalPanel.tsx:22` `const win = window as any;` | 删除，`win.mindcode` → `window.mindcode`；原 `win.mindcode?.fs?.readFile` 的可选链保留为 `window.mindcode?.fs?.readFile`（全局类型下 `mindcode` 非可选，TS 允许对非可选值使用 `?.`；若 lint 报 `no-unnecessary-condition` 则去掉多余 `?.`） |
| `ToolConfirmDialog.tsx:12` `Record<string, any>` | `Record<string, unknown>` |

- [ ] **Step 3: 验证并提交**

```bash
npx eslint src/renderer --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -E "^\s+[0-9]+:[0-9]+\s+error" | grep -vE "contexts/|createStore|components/Composer/|StatusBarEnhanced|lazyLoad" | head
npm run lint 2>&1 | tail -2 && npm run test 2>&1 | grep -E "Test Files" && npm run build 2>&1 | tail -1
git add src/renderer
git commit -m "refactor(renderer): 其余组件消除 no-explicit-any（错误对象 unknown 收窄、设置值 SettingValue、Monaco/Performance 边界类型）"
```

Expected: 第一条命令无输出；lint 0 errors；测试全过；build 通过。

---

### Task 15: test 侧 any、规则升 error、`--max-warnings`、文档同步、最终门禁

**Files:**
- Modify: `src/test/integration/lsp.test.ts`（7）、`src/test/e2e/file-operations.spec.ts`（3）
- Modify: `eslint.config.js`、`package.json`
- Modify: `docs/refactor/01_BUG_AND_RISK_REGISTER.md`、`docs/refactor/03_REFACTOR_ROADMAP.md`、`docs/refactor/05_M2_M4_DESIGN.md`

- [ ] **Step 1: 测试文件消 any**

`lsp.test.ts`：文件顶部 `import { mindcodeMock } from "../setup";`，把 6 处 `(window as any).mindcode.lsp.xxx.mockResolvedValue(...)` 改为 `mindcodeMock.lsp.xxx.mockResolvedValue(...)`；第 66 行 `(c: any) => c.label` → `(c: CompletionItem) => c.label`（`import type { CompletionItem } from "../../core/lsp/types"`）。

`file-operations.spec.ts`（Playwright，`page.evaluate` 在渲染进程中执行）：三处 `(window as any)` 改为 `(window as Window & { mindcode?: { getVersion?: () => Promise<string> }; electronAPI?: unknown })`——e2e 文件不在 preload 的 `declare global` 作用域内吗？它在 `src/test/e2e` 且被 `tsconfig.test.json` 包含，因此 `window.mindcode` 已有全局类型，可直接写 `typeof window.mindcode !== "undefined"`、`window.mindcode?.getVersion?.()`；优先用这种写法，编译不过再用上面的交叉类型。

- [ ] **Step 2: `eslint.config.js` 规则升级 + M3 删除清单覆盖块**

第 31 行 `"@typescript-eslint/no-explicit-any": "warn",` 改为 `"error",`。在 renderer 配置块之后追加：

```js
  // M3 删除清单（docs/refactor/05_M2_M4_DESIGN.md §4.5）：这些模块 0 引用、即将整体删除，
  // 不为它们消 any。M3 删除模块时必须同时删掉本块。
  {
    files: [
      "src/renderer/contexts/**",
      "src/renderer/stores/createStore.ts",
      "src/renderer/i18n/**",
      "src/renderer/components/Composer/**",
      "src/renderer/components/StatusBarEnhanced.tsx",
      "src/core/extensions/**",
      "src/core/workspace/**",
      "src/core/collab/**",
      "src/core/remote/**",
      "src/core/learning/**",
      "src/core/ai/router.ts",
      "src/core/composer/**",
      "src/core/ai/tools/rollback.ts",
      "src/core/ai/tools/impact-analyzer.ts",
      "src/core/ai/tools/executor.ts",
      "src/core/ai/tools/audit-log.ts",
      "src/core/ai/tools/file-chunker.ts",
      "src/types/index.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
```

（`src/types/index.ts` 仅被 `renderer/contexts/index.ts` 引用，随 M3 一起删；`src/types/*.d.ts` 保留。）

- [ ] **Step 3: 跑 eslint，确认 0 error，并记录 warning 数**

```bash
npx eslint src/ 2>&1 | tail -2
```

Expected: `✖ N problems (0 errors, N warnings)`。记下 N（预期约 580：801 − 213 个 any 警告 − 个别顺带消除的 warning）。

- [ ] **Step 4: `package.json` 加 `--max-warnings`**

把 `lint` 脚本中的 `eslint src/` 改为 `eslint src/ --max-warnings <N>`（N 为 Step 3 实测值）。这样其余五类 warning 只能降不能升。

- [ ] **Step 5: 文档同步**

- `01_BUG_AND_RISK_REGISTER.md`：P2-24 行末追加 ` **CLOSED**（M2：tsconfig.test.json 入 lint）`；P1-11 条目追加一句 `M2 修正 preload getVariables 参数错位（sessionId/frameId），调试功能整体仍待 M6`（若 Task 9 Step 5 发生了该修正）。
- `03_REFACTOR_ROADMAP.md`：M2 段末追加 `**状态**：✅ 完成于 2026-xx-xx（分支 refactor/m2-type-contracts）。实测通道 96 invoke / 10 send / 35 event；any 213→0（M3 删除清单内文件用 eslint 覆盖块跳过，随 M3 删除）；no-explicit-any 已为 error；lint --max-warnings=N。`（填实际日期与 N。）
- `05_M2_M4_DESIGN.md` §6：第一行 `- [ ] M2：P2-24 → CLOSED；\`03\` M2 勾选。` 改为 `- [x] M2：P2-24 → CLOSED；P2-13 顺带 CLOSED；\`03\` M2 勾选。`

- [ ] **Step 6: 最终四道门禁**

```bash
npm run gate 2>&1 | grep -E "problems|Test Files|Tests |built in|passed|failed|ERR!|error TS" 
echo GATE_EXIT=$?
```

Expected：`✖ N problems (0 errors, N warnings)`；`Test Files  28 passed (28)`；`✓ built in …`；`20 passed`；无 `error TS`；命令整体退出 0（若 `grep` 吞掉了退出码，用 `npm run gate > /tmp/m2-gate.log 2>&1; echo $?` 再看日志）。把这段输出原样贴进最终报告。

- [ ] **Step 7: Commit**

```bash
git add src/test eslint.config.js package.json docs/refactor
git commit -m "chore(lint): no-explicit-any 升为 error（0 违规）+ lint --max-warnings 门禁；测试消 any；M2 文档收尾

- M3 删除清单内文件用覆盖块跳过，删除时同步移除
- 01: P2-24 CLOSED；03: M2 完成状态；05 §6 勾选"
```

- [ ] **Step 8: 收尾交接**

按 `superpowers:finishing-a-development-branch` 处理分支：从主仓 `main` 以 `--no-ff` 合并 `refactor/m2-type-contracts`，合并后在主仓再跑一次 `npm run gate`，通过后 push main、删除分支与 worktree（`git worktree remove ../MindCode-IDE-m2`）。push 与删分支是对外动作，按会话既有授权执行；若授权不明确，停在"本地已合并、未 push"并报告。

---

## 自审记录（写完计划后对照 spec §3）

- **覆盖**：§3.2 契约单一源 → Task 3；§3.3 两端胶水 → Task 4–7（main）、Task 9（preload）；§3.4 一致性测试 → Task 8（运行时注册表 + 静态扫描）与 Task 9 Step 7（preload）；§3.5 测试入 tsc → Task 2；§3.6 any 治理与规则升级 → Task 10–15；§3.8 验收 → Task 15 Step 6；§3.9 回滚 → 每 Task 独立 commit。
- **偏差声明**：spec §3.4 写的是"加载全部 register 函数"的运行时对比；本计划改为静态扫描 + `_typed.ts` 注册表单测，原因是 `settings-handlers.ts` 等在模块顶层调用 `app.getPath`，运行时加载需要大范围 mock electron，脆弱且与"不改运行时"目标无关。静态扫描同样能保证"注册集合 == 契约集合"，且额外锁定了"无裸调用"。
- **偏差声明**：spec §3.6 要求 213 处清零；本计划对 M3 删除清单内的 23 处（另加 `src/types/index.ts` 8 处）用 eslint 覆盖块跳过并在覆盖块注释里注明，避免给即将删除的代码做类型工作。规则仍升为 error，非清单文件 0 违规。
- **类型一致性**：`typedHandle/typedOn/sendToRenderer/getRegisteredChannels/resetRegisteredChannelsForTest`（Task 4）在 Task 5–8 中名称一致；`InvokeChannel/InvokeResult/InvokeHandler` 在 Task 6 `guarded` 中一致；`DebugEventPayload`（Task 3）在 Task 7 一致；`ToolArgs/argString/argNumber/argBoolean`（Task 12）仅本任务使用；`mindcodeMock` 导出名与 `src/test/setup.ts` 现有导出一致。
- **占位符扫描**：无 TBD/TODO；所有"按表改"的表都给出了行号与目标类型；tsc 驱动的修错步骤给出了禁止项与优先顺序。
