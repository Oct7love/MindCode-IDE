# 00 · 项目基线审查报告（MindCode-IDE）

> 审查日期：2026-07-05
> 审查方法：完整实跑基线命令 + 9 领域并行深读审计（Electron 安全 / 密钥 / AI 子系统 / Renderer / Core 服务 / 插件 / 构建 / 测试 / 文档），对每条 P0/P1 做独立**对抗验证**（重新打开文件尝试反驳）。
> 审查基点：`git HEAD = fec7ebf`（fix: GLM-5 模型支持 + 启动黑屏修复 + dotenv 路径修正）
> 环境：macOS Darwin 25.3.0 / Node v20.20.2 / npm 10.8.2
> 原则：以**实际代码和实跑结果**为准。文档宣称与代码冲突时，以代码为准并记录差异。

---

## 0. 一句话结论

MindCode-IDE 是一个**体量真实、可以构建和启动、但被营销文档系统性夸大**的 AI IDE 半成品。约 350 个 TS/TSX 文件、73k 行代码，LSP / 索引 / AI 多 Provider / 编码检测等核心模块**确有真实实现**；但同时存在 **4 个 P0（含 git 历史泄漏真实密钥、源码默认经第三方中转出站、切文件数据破坏）**、**11 个 P1**，以及大量"UI 可见但底层不工作"的伪实现（插件系统、扩展市场、GitHub、协作、远程 SSH、断点、崩溃恢复）。

**真实健康度评分：4.5 / 10**（可构建可跑但安全债与伪实现债很重，详见第 8 节）。

---

## 1. 基线命令实跑结果

全部命令在本机真实执行，日志留存于审查工作区。

| 命令 | 退出码 | 结论 | 关键数据 |
|---|---|---|---|
| `npm install` | **0 ✅** | 可安装 | 但 `npm audit` 报 **39 个漏洞（4 critical / 22 high / 11 moderate / 2 low）**，多数在 devDeps（electron-builder 链、vitest、concurrently/shell-quote） |
| `npm run lint` | **1 ❌** | 失败 | eslint：**265 error + 796 warning**；两次 `tsc --noEmit` 均 **0 类型错误** |
| `npm run build` | **0 ✅** | 可构建 | main（tsc）+ renderer（vite）均成功；monaco chunk 3.3MB 未分包告警 |
| `npm run test` | **0 ✅** | 通过 | vitest：**16 文件 / 256 用例全绿 / 1.67s**，无需真实 API Key |
| `npm run test:e2e` | **1 ❌** | 部分失败 | Playwright 真启 Electron：**11 passed / 3 failed**（窗口最小尺寸、Activity Bar、状态栏定位断言） |

### 1.1 失败项归因

**`npm run lint` 失败（工程问题，非业务 bug）**
- 265 个 error 全部是 ESLint 风格/约束规则，**不是编译错误**（`tsc --noEmit` 两个工程都 0 报错）。
- error 分布：`consistent-type-imports` 135、`no-restricted-globals` 68、`no-empty` 31、`no-unused-expressions` 10、`no-require-imports` 8、`no-case-declarations` 7、其余零星。
- warning 分布：`explicit-function-return-type` 392、`no-explicit-any` 213、`no-console` 83、`no-unused-vars` 36。
- **最小修复**：绝大多数 error 可由 `eslint --fix` 自动修（type-import、prefer-const），少量需手动（no-empty 补注释、no-case-declarations 加块级作用域）。**严禁关规则来"通过"**。属 M0 范畴。

**`npm run test:e2e` 失败（测试选择器脆弱，非应用崩溃）**
- 3 个失败用例的失败原因是**选择器/断言与真实 DOM 不匹配**（如状态栏找 `.status-bar, footer`，实际结构不同），而非应用无法启动——同一批 11 个用例（含"窗口成功创建""标题含 MindCode""页面无 JS 错误"）通过，证明**应用能真实启动并渲染**。
- `viewportSize` 断言 `>=800×600` 失败，是因为 e2e 环境窗口实际视口尺寸与 BrowserWindow 尺寸口径不一致。
- **最小修复**：修正 e2e 选择器（给关键容器加 `data-testid`）而非删测试。属 M0/M8 范畴。

**`npm audit` 高危项**
- critical：`vitest`（UI server 任意文件读执行）、`@vitest/coverage-v8`、`concurrently`→`shell-quote`。
- high：`electron`（ASAR 完整性绕过 / macOS AppleScript 注入，需升 major）、`vite`（路径穿越）、`axios`/`lodash`/`tar`/`ws`/`form-data` 等传递依赖。
- 多数可 `npm audit fix` 无痛修；`electron`/`electron-builder`/`vite` 需 semver-major 升级，需评估兼容性（M0 只做非破坏性修复，major 升级排到 M0 尾/M9）。

---

## 2. 能否安装 / 启动 / 构建 / 测试（汇总）

- **能安装**：✅（伴随依赖漏洞）
- **能构建**：✅ main + renderer 均通过
- **能启动**：✅ e2e 真启 Electron，窗口创建、标题、无 JS 错误三项通过。**但仅限开发场景**——见 P1「打包后 dotenv 路径失效 / dotenv 是 devDep 幽灵依赖」，**发行版启动即 require 失败或所有 API Key 为空**。
- **能测试**：单测 ✅（但集中在外围工具类，核心链路 0 覆盖）；e2e ⚠️（脆弱、CI 从不运行）。
- **能发行打包**：❌ `electron-builder` 引用的 `resources/icons/*` 不存在，`npm run dist` 会失败。

---

## 3. 模块结构图（Electron main / preload / renderer / core）

```
src/
├── main/                     Electron 主进程
│   ├── index.ts (516)        入口：BrowserWindow(sandbox+ctxIsolation+nodeIntegration:false ✅)
│   │                         CSP 注入 ✅ / 注册 10 组 IPC / dotenv 从仓库根加载 ⚠️
│   ├── preload.ts (820)      contextBridge → window.electronAPI + window.mindcode（契约完整、带 TS 类型 ✅）
│   ├── lsp-manager.ts (324)  spawn 真实 language-server（真实 ✅，但自动重启是死代码）
│   ├── log-setup.ts (63)     渲染日志落盘（level 动态方法调用隐患 P3）
│   ├── ipc/                  90+ 个 IPC channel，分 10 个 handler 文件
│   │   ├── fs-handlers.ts (568)      读写/搜索；写类有 validateSender+路径白名单，读类几乎无防护 ⚠️P1
│   │   ├── ai-handlers.ts (505)      多 provider 流式；activeStreams 不存请求句柄 → 假取消 ⚠️P1
│   │   ├── terminal-handlers.ts (453) node-pty 真实 PTY；命令白名单只覆盖回退路径（摆设）P2
│   │   ├── debug-handlers.ts (236)   DAP；start 任意程序执行 P1；断点存根返回空 P1
│   │   ├── git-handlers.ts (209)     spawn git shell:false；env 未过滤 P2
│   │   └── index/settings/dashboard/plugin/lsp-handlers
│   └── debugger/             DAP 会话管理（会话控制真实，断点链路断）
├── preload —— 无独立目录，preload 实体在 src/main/preload.ts（命名与直觉不符，非缺陷）
├── renderer/                 React UI
│   ├── stores/ (Zustand)     仅 3 个真 store：useAIStore(638)/useFileStore(306)/useUIStore(59)
│   │                         createStore.ts(142, persist/immer/undo 工厂) 全仓 0 引用 = 死代码
│   ├── contexts/ (263)       AppProvider/EditorProvider/... 全部从未挂载 = 死代码
│   ├── hooks/                真正在用：useWorkspace/useEditorFiles/usePanelLayout/useFileOperations
│   │                         useEditorFiles 本地 state 与 useFileStore 割裂 = 双真源 P1
│   ├── components/ (130 个)   最大：MarkdownRenderer(1132)/CodeEditor(705)/GitPanel(663)
│   │   └── AIPanel/hooks/useChatEngine.ts (~1300) 巨型 hook，AI 主引擎
│   ├── i18n/ (278)           完全未接线 = 摆设 P2
│   ├── services/             agentToolService（AI 工具真实执行点）/completionService/indexedDB
│   └── workers/
├── core/                     领域服务（跨 main/renderer 复用）
│   ├── ai/ (5831 行)         真实核心：llm-client(熔断/重试/降级) + 6 provider + tools + 补全上下文
│   │   ├── config.ts         默认 baseURL = 第三方中转 ⚠️P0
│   │   ├── router.ts         第三套未使用路由 = 死代码
│   │   └── tools/executor.ts "官方"权限模型 = 死代码（真实确认硬编码在 useChatEngine）
│   ├── agent/composer.ts     盲写整文件 + 假 diff ⚠️P1
│   ├── indexing/             真实：sql.js + TS 编译器 AST 抽符号 + embeddings；但主进程同步跑冻结 UI P1
│   ├── lsp/                  真实客户端
│   ├── encoding/             真实 iconv-lite（但未接 chardet，多编码误判）
│   ├── plugins/              loader/manager/marketplace/integrity——加载链永不运行 P1
│   ├── extensions/           第三套贡献点系统 = 孤立死代码
│   ├── github/               REST 客户端真实，但无认证通路（keytar 未接）= 空壳
│   ├── recovery/             引擎完整但 init 从不调用 = 休眠
│   ├── collab/               纯 mock（TODO: 实现真实 WebSocket）
│   ├── remote/               纯 mock（setTimeout 模拟 SSH）
│   ├── review/               真实正则规则扫描（但"AI 修复"是硬编码字典）
│   ├── learning/             全仓 0 引用 = 死代码
│   └── logger/performance/   真实、已接线（logger 无脱敏层）
├── shared/types/             IPC/AI 共享类型（较规范）
├── completion-server/        Python FastAPI 补全服务——未接入构建/打包 = 死代码 + 垃圾文件 `=0.24.0`
└── test/                     256 用例集中在外围工具，核心链路 0 覆盖
```

**Electron 边界基础是合规的**：`sandbox:true` + `contextIsolation:true` + `nodeIntegration:false` + `webviewTag` 未开 + CSP 已注入 + preload 用 contextBridge 且不暴露 Node。问题不在窗口配置，而在 **IPC handler 层的输入校验和信任门覆盖面严重不一致**（写类严、读类松、debug/lsp 无门）。

---

## 4. 依赖版本：文档宣称 vs 实际

| 项目 | 文档宣称 | package.json 实际 | 差异 |
|---|---|---|---|
| Electron | 40（README） | **30.5.1** | 文档超前 10 个大版本 |
| 应用版本 | v0.2.0 / v0.3.0（README_CN / About 对话框） | **0.1.0** | 三处不一致 |
| AI Provider 数 | 7 个（含 Codesuc / Ollama） | 实际可用 **5 个**（Claude/OpenAI/Gemini/DeepSeek/GLM） | Codesuc 已弃用、Ollama 无任何实现 |
| 完成度 | 92% / "生产就绪✅" | 自带 TROUBLESHOOTING.md 承认"应用无法启动、核心功能待验证" | 系统性夸大 |
| API Key 存储 | docs 称"已迁移 keytar 加密存储"（T4 完成） | 实际仅环境变量；该 commit 反而**硬编码了真实 key** | 虚假完成记录 |
| docs/API.md | 记录 `git.push/pull`、`ai.complete/ai.stream` | preload 无这些方法 | 文档描述幽灵接口 |

---

## 5. 高风险模块列表

| 模块 | 风险等级 | 一句话 |
|---|---|---|
| `src/core/ai/config.ts` | **P0** | 默认 baseURL = `sub2.willapi.one`/`2api.novai.su` 第三方中转，Key+源码默认外发 |
| `src/core/indexing/indexService.ts` | **P0** | embeddings 默认开，索引时源码块静默上传中转；且主进程同步跑冻结 UI |
| `src/renderer/components/CodeEditor.tsx` | **P0** | onContentChange 陈旧闭包，切 tab 把新内容写进旧文件 buffer → 数据破坏 |
| git 历史（config.ts / server.py） | **P0** | 4 个真实 API Key 已进历史，`git log -S sk-` 可提取 |
| `src/main/ipc/fs-handlers.ts` | **P1** | getAllFiles/searchInFiles 无路径校验，可读 SSH/云凭证 |
| `src/main/ipc/debug-handlers.ts` | **P1** | debug:start 任意本地程序执行，无信任门/validateSender |
| `src/main/index.ts`（dotenv 路径） | **P1** | 打包后 `.env` 路径失效 + dotenv 是 devDep，发行版 AI 全废 |
| `src/core/agent/composer.ts` | **P1** | 盲写整文件、假 diff、内存 checkpoint → 覆盖未知代码 |
| `src/main/ipc/ai-handlers.ts`（取消） | **P1** | 假取消，provider 请求从不 abort，持续计费 |

---

## 6. 伪实现 / 半实现功能清单（UI 可见但底层不工作）

> 这些是最危险的"债"——用户界面显示功能可用，实际是空操作或 mock，给人虚假信心。

| 功能 | 现状 | 证据 |
|---|---|---|
| **本地插件系统** | 加载链永不运行 | `loader.ts:191` loadModule 返回 null（preload 未暴露）；`manager.init()` 从不被调用；两个示例插件永不加载 |
| **扩展市场** | mock 伪装在线市场 | Open VSX fetch 被 CSP 全阻断，永远只显示 8 条硬编码 `FALLBACK_EXTENSIONS` |
| **扩展"安装"** | 空操作 | `marketplace.ts:355` 只写 localStorage，不下载 .vsix，仅 2 个内置主题真生效 |
| **GitHub 集成** | 空壳 | REST 客户端真实，但 `github:login` 未实现、keytar 未暴露，永远登录不了 |
| **多人协作** | 纯 mock | `collab/collabService.ts` 全是 `// TODO: 实现真实 WebSocket`，无任何网络层 |
| **远程 SSH** | 纯 mock | `remote/sshClient.ts` 用 `setTimeout(1000)` 模拟连接，exec 返回 `模拟执行:` |
| **调试断点** | 存根返回空 | `debug:removeBreakpoint/toggleBreakpoint/getBreakpoints` 恒 `{success:true}`/`{breakpoints:[]}` |
| **崩溃恢复/自动保存** | 引擎休眠 | RecoveryManager 完整但 `init/saveFileState` 从不被调用 |
| **Composer Diff 预览** | 假 diff | `oldContent` 恒为空，只渲染 AI 生成的新内容全文 |
| **AI 停止/取消** | 假取消 | cancel IPC 不可达，底层请求继续跑 |
| **完整性校验/危险模式检测** | 死代码 | `integrity.ts` 的校验函数从不在任何真实路径执行 |
| **i18n 多语言** | 摆设 | 模块存在但从未在 main.tsx 挂载 |
| **诊断日志工具** | mock | `diagnostics_getLogs` 返回 `{logs:'暂无日志', hint:'开发中'}` |

---

## 7. 废代码 / 重复代码 / 过度设计清单

**废代码（0 引用）**
- `src/renderer/contexts/index.ts`（263 行，整套 Provider 从未挂载）
- `src/renderer/stores/createStore.ts`（142 行，persist/immer/undo 工厂无人用）
- `src/renderer/i18n/index.ts`（278 行）
- `src/core/extensions/contributions.ts`（第三套贡献点系统）
- `src/core/workspace/index.ts`（WorkspaceManager，且混用 Node fs + 浏览器 localStorage）
- `src/core/collab/*`、`src/core/remote/*`、`src/core/learning/*`
- `src/core/ai/router.ts`（第三套 model→provider 路由）
- `src/core/composer/*`（第二套 Composer，仅被未渲染的 ComposerPanel 引用）
- `src/completion-server/`（Python 服务未接入）+ 垃圾文件 `=0.24.0`（泄漏 Windows 路径）
- `python_examples/`、`.kiro/`（无关目录）
- `StatusBarEnhanced.tsx`（死组件，却被测试引用 → 伪覆盖）

**重复/多套并存（改错风险高）**
- **3 套 model→provider 路由**：ai-handlers / llm-client / core/ai/router.ts，逻辑不一致
- **2 套 Composer**：core/agent（活）vs core/composer（死）
- **2 套工具执行/权限**：agentToolService（活）vs ToolExecutor（死）
- **3 套插件贡献点/扩展系统**：core/plugins、core/extensions、marketplace
- **2 套 ESLint flat config**：`eslint.config.js`（生效）vs `eslint.config.mjs`（死，规则已分叉）
- **多份同名组件**：ComposerPanel、SettingsPanel、ContextPicker、StatusBar 各有现役+废弃版

**过度设计**
- Provider 适配器 openai/gemini/deepseek 的 chatStream+chatWithTools 近乎逐行复制粘贴（应抽 OpenAICompatible 基类）
- createStore 中间件栈（persist/immer/devtools/undo/logger/perf）为 0 引用的"假门面"

---

## 8. 健康度评分（分维度）

| 维度 | 分数 | 依据 |
|---|---:|---|
| 可构建性 | 7/10 | main+renderer 可构建；发行打包因图标缺失失败 |
| 可运行性 | 5/10 | 开发可启动；打包后 dotenv 失效导致 AI 全废 |
| **安全性** | **2/10** | git 历史泄漏密钥、默认第三方中转、源码静默上传、fs/debug IPC 越权 |
| 类型健康 | 6/10 | tsc 0 报错，但 213+ any、测试不做类型检查、主进程无 path-alias 解析 |
| 架构清晰度 | 4/10 | Electron 边界合规，但多套重复系统、双真源、死代码遍布 |
| 功能真实度 | 3/10 | 大量 UI 可见但底层伪实现 |
| 测试可信度 | 3/10 | 256 绿灯但集中外围，核心 AI/IPC/Agent 链路 0 覆盖，e2e 不进 CI |
| 文档可信度 | 2/10 | 营销文案系统性夸大，与代码多处矛盾 |
| 工程化 | 5/10 | 有 husky/lint-staged/CI，但 lint 未通过、规则偏弱、两套 config |
| **综合** | **4.5/10** | 真实基座 + 重安全债 + 重伪实现债 |

---

## 9. 结论与下一步

1. **项目值得重构而非重写**：LSP / 索引 / AI / 编码等核心是真实且可观的实现，推倒重来会丢失真实价值。违反「禁止全量重写」原则。
2. **安全必须最优先**：4 个 P0 中 3 个是数据/凭证外泄或破坏，1 个需 Owner 立即轮换密钥。**不允许降级为"后续优化"**。
3. **伪实现要么补齐要么从 UI 摘除**：不能让"显示可用实则空操作"的功能继续误导用户，但这属 M4+ 范畴，M0/M1 先不动。
4. **M0/M1 边界明确**（详见 `03_REFACTOR_ROADMAP.md`）：M0 只做工程可用性（lint/build/test/audit 非破坏性修复），M1 只做已确认的 Electron 安全边界最小修复。

问题清单见 `01_BUG_AND_RISK_REGISTER.md`，目标架构见 `02_TARGET_ARCHITECTURE.md`，执行路线见 `03_REFACTOR_ROADMAP.md`。
