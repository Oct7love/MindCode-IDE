# 03 · 重构路线图（MindCode-IDE）

> 分 milestone、小步提交、每步可验证、可回滚。基点 `git HEAD = fec7ebf`。
> 通用回滚策略：每个 milestone 在独立分支上以小 commit 推进，`git revert <sha>` 或 `git reset --hard <milestone起点>` 回滚；不自动 push；每步前后 `git status`。
> 通用验证基线：`npm run build` 通过 + `npm run test` 通过 + 相关 `git status` 干净。

---

## M0 · 基线工程可用性

**目标**：项目能稳定 `install / lint / build / test`，e2e 可跑，依赖漏洞做非破坏性修复。

**不做什么**：不改任何业务逻辑；不关闭任何 lint/type 规则；不删测试；不做 electron/vite major 升级（排 M9）；不动安全边界（M1）。

**涉及文件**：`eslint.config.js`/`.mjs`、各源码文件的 type-import/no-empty/no-case-declarations 修正、`src/test/e2e/*.spec.ts`、`playwright.config.ts`、`package.json`、`tsconfig.main.json`、`.gitattributes`、`.prettierrc`、`=0.24.0`、`python_examples/`、`.kiro/`。

**任务列表**：
1. `eslint --fix` 自动修 type-import/prefer-const 等；手动修 no-empty（补注释或逻辑）、no-case-declarations（块级作用域）、no-restricted-globals、no-require-imports、no-unused-expressions。
2. 删死配置 `eslint.config.mjs`；`package.json` 加 `"type":"module"` 消解析告警（确认 postcss.config.mjs 仍工作）。
3. 主进程 path-alias：`build:main`/`dev:main` 接 `tsc-alias`（P2-22），或改相对导入（先验证是否已有值导入）。
4. e2e 3 个失败用例：给关键容器加 `data-testid`，修正选择器与视口断言（不删测试）。
5. `npm audit fix`（非破坏性）；记录需 major 升级的项到 M9。
6. 仓库卫生：删 `=0.24.0`；`python_examples/`、`.kiro/` 移出或归档；加 `.gitattributes (* text=auto eol=lf)` + `.prettierrc` 改 `endOfLine:lf`（P3-2/3/4）。
7. ESLint 规则：给 `npm run lint` 加 `--max-warnings` 目标或将 no-explicit-any 逐步升级策略写入（不一次性升 error，避免海量失败）。

**验收标准**：`npm run lint` 退出码 0；`npm run build` 0；`npm run test` 0；`npm run test:e2e` 0（或明确标注 CI 环境限制）；`npm audit` critical=0。

**验证命令**：`npm run lint && npm run build && npm run test && npm run test:e2e && npm audit --audit-level=high`

**回滚**：M0 全在风格/配置层，`git revert` 单个 commit 即可；不影响运行时行为。

---

## M1 · Electron 安全边界最小修复

**目标**：消除已确认的高危安全边界问题——默认出站、隐私上传、fs 越权、debug 越权、日志泄漏、外链导航、命令 env 泄漏。

**不做什么**：不重构 IPC 架构（M3）；不补插件沙箱（M7）；不改 AI 调用链逻辑（M4）；不做 UI；不动伪实现的补齐。只做"最小、可验证、低风险"的安全修复 + 配套回归测试。

**涉及文件**：`src/core/ai/config.ts`、`src/core/indexing/indexService.ts`、`src/main/ipc/fs-handlers.ts`、`src/main/ipc/debug-handlers.ts`、`src/main/ipc/git-handlers.ts`、`src/main/index.ts`、`src/main/log-setup.ts`、`src/core/logger/*`、`src/main/security/*`（新增）、`src/test/**`（回归）。

**任务列表**（按依赖顺序）：
1. **P0-2** 默认 baseURL 改官方端点（config.ts DEFAULT_BASE_URLS），中转仅显式 env；写 ADR-0001。
2. **P0-3** `enableEmbeddings` 默认 false（indexService.ts + types 默认值）；无 key 时短路不发请求。
3. **P1-1** fs 读/搜索/枚举统一加 `validateSender` + `isPathAllowed(realpath, workspace)`；未开工作区拒绝；删 denylist 兜底。
4. **P1-2** `debug:start` 加 validateSender + 工作区信任门 + program/cwd 限工作区 + env 白名单。
5. **P2-2** logger 写入前统一 redact（sk-/Bearer/x-api-key/token/password/secret）；删 codesuc key 日志。
6. **P2-5** git 子进程 env 走 `getSafeEnv`（删 `MINDCODE_*_API_KEY`）。
7. **P2-8** `createWindow` 加 `setWindowOpenHandler`（deny + shell.openExternal for https）+ `will-navigate` 拦截离开 origin。
8. **P3-1** `log:write` 的 level 做白名单校验。
9. 为 P1-1/P1-2/P2-2/P2-8 各补最小回归单测（fs 越权拒绝、debug 越权拒绝、日志脱敏、外链 deny）。

**Owner 决策项（不由 M1 自动执行）**：
- **P0-1** 轮换 git 历史泄漏的 4 个 API Key；决定是否 `git filter-repo` 重写历史。这属破坏性 + 需团队协调，M1 只提供 pre-commit gitleaks 防复发的配置建议，等 Owner 拍板。

**验收标准**：不设 `*_BASE_URL` 时出站为官方域名；索引默认不发 embedding；fs 越权/ debug 越权被拒；日志无明文 key；外链走系统浏览器；新增回归测试通过；`npm run build && npm run test` 绿。

**验证命令**：`npm run build && npm run test`；手工/脚本验证：`fs.readFile('~/.ssh/id_rsa')` 返回 denied、抓包无中转/无 embedding、日志文件 grep 无 `sk-`。

**回滚**：每个任务独立 commit；配置类（P0-2/P0-3）`git revert` 即恢复；handler 校验类修改向后兼容（只增拒绝路径），revert 安全。

---

## M2 · 类型系统治理 + shared 契约

**目标**：减少 any、建立 IPC 类型契约单一源、测试纳入类型检查。

**不做什么**：不为消 any 引入错误的宽泛类型；不动运行时行为。

**涉及文件**：`src/shared/types/**`、`src/types/index.ts`、`tsconfig.test.json`（新增）、各 handler/preload。

**任务列表**：① 建 `tsconfig.test.json` 纳入 lint（P2-24）；② IPC 每 channel 补 `{req,res}` shared 类型，preload 与 handler 共引；③ 高频 any 分批替换为精确类型（213 处，分批）；④ no-explicit-any 逐步升 error。

**验收**：`tsc --noEmit`（含 test）0；any 数量下降且有门禁；IPC 契约类型覆盖全 channel。
**验证命令**：`npm run lint`（含 test typecheck）。
**回滚**：类型层改动，revert 无运行时风险。

---

## M3 · main/preload/renderer/core 边界收敛

**目标**：统一 IPC 校验中间件、拆 index.ts 菜单、删死模块、收敛双真源。

**不做什么**：不搬大目录制造巨型 diff；死代码删除前必须逐一确认 0 引用。

**涉及文件**：`src/main/ipc/_middleware.ts`（新增）、`src/main/menu.ts`（拆出）、`src/main/security/*`、删除清单（见 02 §3）、`useEditorFiles`→editorStore。

**任务列表**：① 抽 `_middleware.ts`（validateSender+schema+信任门）套到全 handler；② index.ts 菜单模板拆到 menu.ts；③ 逐一确认并删死模块（contexts/createStore/extensions/workspace/collab/remote/learning/router/composer 死支/StatusBarEnhanced）；④ **修复 P1-6 双真源**：editorStore 收敛。

**验收**：全 handler 走中间件；死代码删除后 build/test 绿；双真源合一后 AI 读当前文件正确。
**验证命令**：`npm run build && npm run test` + 手工验证 AI 上下文取当前文件。
**回滚**：删除类改动风险最高——每删一个模块单独 commit，`git revert` 可逐个恢复。

---

## M4 · AI 子系统重构

**目标**：真取消、provider 基类抽取、单一路由、Composer 真 diff+checkpoint、工具权限单一裁决、成本预算。

**涉及文件**：`src/core/ai/providers/*`、`llm-client.ts`、`ai-handlers.ts`、`agent/composer.ts`、`agentToolService.ts`、`useChatEngine.ts`。

**任务列表**：① P1-4 AbortSignal 全链；② P2-17 抽 OpenAICompatible/AnthropicCompatible 基类 + 清 console.log；③ P2-18 单一 getProviderForModel；④ P1-5 Composer 读原文+真 diff+持久化 checkpoint；⑤ P2-4 工具权限单一裁决点；⑥ P2-19/20 超时启用 + 成本预算；⑦ P2-3 跨厂商降级确认。

**验收**：cancel 真断上游；provider 无重复；Composer 有真 diff 且可回滚；工具确认统一；单测覆盖降级/abort/回滚。
**验证命令**：`npm run test`（新增 AI mock 测试）+ 手工 cancel/composer 验证。
**回滚**：分任务 commit；provider 基类抽取风险较高，保留旧逐 provider 实现的 revert 点。

---

## M5 · 编辑器与工作区稳定化

**目标**：修 P0-4 切 tab 数据破坏、每文件 model、文件树/tab/保存/搜索稳定。

**涉及文件**：`CodeEditor.tsx`、`useEditorFiles`/editorStore、`App.tsx`。

**任务列表**：① **P0-4** onContentChange ref 化 + 程序化变更抑制；② P3-6 每文件独立 model（setModel 切换，保 undo/滚动/选区）；③ 保存/搜索链路回归。

**验收**：切 tab 不污染缓冲（回归测试）；每文件 undo 独立；autoSave 不写错文件。
**验证命令**：`npm run test:e2e`（切 tab 回归用例）。
**回滚**：editor 层改动，revert 恢复。

---

## M6 · LSP / 索引 / git / 终端整理

**目标**：索引离开主线程、持久化、增量、LSP 自动重启、编码 chardet、断点可用。

**涉及文件**：`indexService.ts`、`src/main/workers/`、`lsp-manager.ts`、`encoding/index.ts`、`debug-handlers.ts`、`DebugPanel.tsx`。

**任务列表**：① P1-10 索引移 worker/utilityProcess；② P2-9/10 持久化 + startWatching；③ P2-13 LSP 自动重启修复；④ P2-11 chardet 接入；⑤ P1-11 断点链路打通（gutter→setBreakpoints）；⑥ P2-12 崩溃恢复接线。

**验收**：大 repo 索引不冻结 UI；重启复用索引;断点真实暂停;多编码文件不乱码。
**验证命令**：`npm run test` + 手工大 repo/断点/编码验证。

---

## M7 · 插件系统沙箱与权限模型

**目标**：插件真实加载（Worker 沙箱）+ 权限 enforcement，或明确从 UI 摘除；扩展市场真实化或标注。

**涉及文件**：`core/plugins/*`、`preload.ts`、`plugin-handlers.ts`、`marketplace.ts`、CSP。

**任务列表**（依 ADR 决策）：① P1-7 loadModule Worker 沙箱 + init 接线，或 UI 摘除；② 加载前 integrity/permission enforcement；③ P1-8 市场改主进程代理 fetch；④ P1-9 真实安装或标注"暂不支持"。

**验收**：示例插件真加载且权限受限；或 UI 无不可用入口。
**验证命令**：`npm run test`（plugin sandbox 测试）。

---

## M8 · 测试体系与 CI

**目标**：核心链路测试补齐、e2e 进 CI、契约测试、gitleaks。

**涉及文件**：`src/test/**`、`.github/workflows/ci.yml`、`vitest.config.ts`。

**任务列表**：① P2-25 核心链路单测（executor/rollback/llm/fs）；② P2-26/27 删死组件测试、重命名 integration；③ P2-28 e2e 进 CI（build+xvfb）；④ IPC 契约测试；⑤ gitleaks pre-commit + CI；⑥ coverage 阈值门禁。

**验收**：核心模块有测试；CI 跑 lint+typecheck+unit+integration+e2e+audit+gitleaks 全绿。
**验证命令**：CI 全流程。

---

## M9 · 性能与发行工程

**目标**：依赖 major 升级、打包可用、monaco 分包、发行流程。

**涉及文件**：`package.json`、`vite.config.ts`、`electron-builder` 配置、`resources/icons/*`。

**任务列表**：① electron/vite/electron-builder major 升级 + 兼容验证；② P2-21 补 resources/icons + `electron-builder --dir` smoke；③ P1-3 打包 dotenv/secrets 从 userData 读 + 设置 UI；④ monaco 动态 import/manualChunks；⑤ 发行 checklist。

**验收**：`npm run dist` 产出可安装包并能启动读到配置；audit 高危清零；启动性能达标。
**验证命令**：`npm run dist` + 安装启动冒烟。

---

## 执行顺序与依赖

```
M0 (工程可用) ──→ M1 (安全边界) ──→ M2 (类型) ──→ M3 (边界收敛)
                     │                              │
                     └── P0-1 Owner 决策(密钥轮换)    ├──→ M4 (AI)
                                                     ├──→ M5 (编辑器, 含 P0-4)
                                                     └──→ M6 (LSP/索引/git/终端)
                                                            └──→ M7 (插件)
                                                                   └──→ M8 (测试/CI) ──→ M9 (发行)
```

M0 与 M1 是本次交付执行范围。M2 起需 Owner 确认后再推进。
