# 01 · Bug 与风险登记册（MindCode-IDE）

> 基点：`git HEAD = fec7ebf` · 审查日期 2026-07-05
> 每条问题：编号 / 标题 / 严重级 / 对抗验证结论 / 影响范围 / 文件位置 / 风险 / 修复建议 / 验证方式。
> 「对抗验证」= 独立 agent 重新打开文件尝试**反驳**该发现，只有无法反驳才记 CONFIRMED。本册所有 P0/P1 均 **CONFIRMED（17/17，0 反驳）**。
> 分级：P0 安全漏洞/无法构建/主流程不可用/数据破坏 · P1 核心功能 bug/架构阻塞/严重类型/Electron 边界 · P2 可维护性/性能/测试缺失 · P3 体验/文档/风格。

---

## P0 — 立即处理（安全 / 数据破坏 / 主流程不可用）

### P0-1 · git 历史中提交了至少 4 个真实 API Key ✅CONFIRMED
- **影响**：凭证泄漏、盗刷、账单。仓库已在 GitHub 公开（Oct7love/MindCode-IDE）。
- **位置**：git 历史 `src/core/ai/config.ts:44`、`src/completion-server/server.py:24`；出现于 commit `5fd1361`/`542647c`/`d9e96ac`/`64db7e9`，在 `ec55777` 才从工作树移除。
- **证据**：`git log --all -S 'sk-' -- src/core/ai/config.ts` 命中；`git show 64db7e9:src/core/ai/config.ts` 含 `sk-f93353...`（DeepSeek/中转）、`sk-EJimY2...`（Gemini 中转）等明文。当前工作树已 0 硬编码 key。
- **风险**：任何人 clone 后 `git log -S sk-` 即可提取历史密钥并盗刷（DeepSeek 官方 key 直接产生账单；willapi/novai 中转 key 消耗预付余额）。移除工作树 ≠ 移除历史。
- **修复**：① **【需 Owner】立即在 DeepSeek 控制台与 willapi/novai 中转站轮换/吊销这些 key**；② 若仓库继续公开，用 `git filter-repo` 重写历史清除（破坏性、需团队协调，改写后所有协作者需重新 clone）；③ 加 pre-commit `gitleaks` 扫描防复发。
- **验证**：轮换后旧 key 调用返回 401；`gitleaks detect` 无历史命中（重写后）；pre-commit 拦截含 `sk-` 的提交。

### P0-2 · AI 默认 baseURL 指向第三方个人中转，API Key 与源码默认外发 ✅CONFIRMED
- **影响**：全部 AI 出站（聊天/补全/上下文）在用户不改环境变量时默认经第三方。
- **位置**：`src/core/ai/config.ts:18-20`（现存 HEAD）；`.env.example:7/11/15` 反而写官方端点。
- **证据**：`DEFAULT_BASE_URLS = { claude:'https://sub2.willapi.one', openai:'https://sub2.willapi.one/v1', gemini:'https://2api.novai.su/v1', ... }`；`getEnvVar(key, fallback)` 在未设 `MINDCODE_*_BASE_URL` 时返回该中转默认值；`ai-handlers.ts:67` 用此构造 provider。
- **风险**：用户配置**自己的官方 API Key** 但没改 BASE_URL 时，Key + 代码/对话明文发往个人中转站，运营者可记录全部流量与凭据。`.env.example` 写官方端点更让用户误以为默认走官方。同时把私有中转域名写死进公开仓库=内部基础设施泄漏。
- **修复**：默认 baseURL 改为各厂商官方端点（与 `.env.example` 对齐）；第三方中转仅作用户**显式**环境变量配置；`claude.ts` 删掉多余 Authorization 头。
- **验证**：不设任何 `*_BASE_URL` 启动，抓包确认请求发往 `api.anthropic.com` / `api.openai.com` 等官方域名而非 willapi/novai。

### P0-3 · 工作区索引默认开启 embeddings，源码块静默上传第三方中转 ✅CONFIRMED
- **影响**：点"索引工作区"即触发；闭源/涉密项目直接泄露。
- **位置**：`src/core/indexing/indexService.ts:84`（`enableEmbeddings: true`）、`:249-253`（`chunk.text.slice(0,2000)` → `embService.embedBatch`）、`embeddings/index.ts:22`（复用 openai 配置 = 默认中转）。
- **证据**：默认配置 `enableEmbeddings:true`；索引流程把源码 chunk 逐批 POST 到 embedding 端点，无任何提示/开关。
- **风险**：整个代码库被逐批发往 `sub2.willapi.one`，用户无感知、无法关闭。叠加 P0-2 的中转默认值，构成"默认把私有代码上传给第三方"。
- **修复**：`enableEmbeddings` 默认 **false**；首次开启弹窗告知数据将发往哪个端点；未配置 key 时直接短路不发请求（而非靠异常吞掉）。
- **验证**：全新配置下索引工作区，抓包确认无 embedding 出站请求；开启开关前有明确告知弹窗。

### P0-4 · CodeEditor 陈旧闭包：切 tab 把新文件内容写进上一个文件的缓冲，数据破坏 ✅CONFIRMED
- **影响**：多文件切换场景（IDE 核心操作），静默污染编辑缓冲，autoSave 生效时可写盘。
- **位置**：`src/renderer/components/CodeEditor.tsx:474`（`onDidChangeModelContent` 回调）、`:582`（init effect 依赖 `[]`）、`App.tsx:577`、`useEditorFiles.ts:99`。
- **证据**：init effect 依赖数组为空 `[]`，其内 `editor.onDidChangeModelContent(() => onContentChange?.(editor.getValue()))` 闭包捕获**挂载时**的 `onContentChange`；切文件用 `setValue` 触发该事件，但回调仍指向旧 `activeFileId`，把新文件内容写进上一个文件的 state 并置 `isDirty=true`。全文件无 ref 同步、无程序化变更抑制标志。
- **风险**：A 文件被静默改写成 B 的内容，autoSave 可进一步落盘 → 用户代码丢失。这是数据破坏，故对抗验证将其从 P1 上调为 **P0**。
- **修复**：用 ref 保存最新 `onContentChange/onSave`（每次渲染同步 ref），监听器内调 `ref.current`；或在 `setValue` 前后用标志位抑制程序化变更触发 `onDidChangeModelContent`。
- **验证**：打开 A、B 两文件，在 A 编辑后切到 B 再切回，A 内容不被污染；autoSave 开启下多次切换后逐文件校验磁盘内容正确。

---

## P1 — 核心功能 / 架构 / Electron 边界

### P1-1 · fs 读取/搜索类 IPC 绕过工作区沙箱，可读磁盘任意文件 ✅CONFIRMED
- **影响**：整个文件读取面。**Electron 安全边界问题。**
- **位置**：`src/main/ipc/fs-handlers.ts:329`（`fs:getAllFiles`）、`:342/361`（`fs:searchInFiles`）、`:104`（denylist）、`:213`。
- **证据**：`fs:getAllFiles`/`fs:searchInFiles` 直接对渲染进程传入的 `workspacePath` 递归 + `fs.readFileSync`，**全程不调用 `isPathAllowed`、不带 `validateSender`**。未打开工作区时 `isPathAllowed` 落到 denylist 分支，`dangerousPaths=['/etc','/usr','/bin',...]` 不含 `/Users`、`~/.ssh`、`~/.aws`，故 `readFile('/Users/mac/.ssh/id_rsa')` 被放行。写类 handler 却已有 `validateSender + isPathAllowed`——安全模型自相矛盾。
- **风险**：被攻破/被诱导的渲染进程、未来的 XSS、恶意 LSP/插件回传，可无视沙箱枚举并读出 SSH 私钥、云凭证、浏览器数据，再经 AI provider 出站外泄。
- **修复**：所有 fs 读取 + getAllFiles/searchInFiles 统一加 `validateSender`，强制 `isPathAllowed(target, ctx.getWorkspacePath())`；未打开工作区一律拒绝；删除依赖系统 denylist 的兜底分支（改为白名单）。
- **验证**：`window.mindcode.fs.searchInFiles({workspacePath:'/etc',query:'root'})` 与 `fs.readFile('~/.ssh/id_rsa')` 应返回 Access denied。

### P1-2 · debug:start 可让主进程执行任意本地程序（带自定义 env）✅CONFIRMED
- **影响**：调试启动链路。**Electron 边界 / 代码执行面。**
- **位置**：`src/main/ipc/debug-handlers.ts:17`、`debugger/session-manager.ts:36`、`adapter-registry.ts:41`。
- **证据**：`ipcMain.handle('debug:start', async(_event, config) => debugSessionManager.startSession(config.type,{program,args,cwd,env,...}))`，无 `validateSender`、无工作区信任门；`program/args/cwd/env` 原样传给 DAP 适配器 launch，debugpy 会以该 env 执行任意 program。
- **风险**：渲染进程用 `type='python', program='/tmp/evil.py', env={...}` 即可触发主进程侧任意脚本执行（门槛仅"调试器已安装"）。与 terminal 明确要求"先打开工作区"的信任门相比完全缺失。
- **修复**：加 `validateSender` + 工作区信任门；`program/cwd` 限制在工作区内（`isPathAllowed`）；`env` 走白名单过滤（复用 terminal 的 `getSafeEnv`）。
- **验证**：未打开工作区或以工作区外 program 调用 `debug:start` 应被拒绝；debuggee 进程 env 不含 API Key。

### P1-3 · 打包后 dotenv 路径失效 + dotenv 是 devDep 幽灵依赖，发行版 AI 全废 ✅CONFIRMED
- **影响**：发行版主流程不可用。**主流程阻塞。**
- **位置**：`src/main/index.ts:14`（`loadDotenv({ path: _path.resolve(__dirname,'../../../.env') })`）、`package.json:31`（dotenv 不在 dependencies）。
- **证据**：`__dirname` 打包后 = `app.asar/dist/main/main`，`../../../.env` 指向 asar 内不存在的路径；且 `dotenv` 若仅在 devDependencies，`electron-builder` 只打 production 依赖，运行时 `require('dotenv')` 失败。
- **风险**：发行版要么启动即崩溃，要么所有 provider `apiKey` 为空串，聊天/补全/索引全部不可用；且用户无任何 UI 途径输入 key。
- **修复**：① dotenv 移入 dependencies（或改用 electron 内建方式）；② `.env` 路径用 `app.isPackaged` 分支；③ 打包场景改为从 `userData` 读用户配置 + 设置 UI + `safeStorage`/keytar 存储。
- **验证**：`npm run pack` 后启动发行版，能读到配置且不崩溃；设置 UI 可输入 key。

### P1-4 · AI 停止/取消是假取消，provider 请求从不 abort，token 继续烧 ✅CONFIRMED
- **影响**：所有 AI 流式请求。
- **位置**：`src/main/preload.ts:84/109`、`ai-handlers.ts:295`、`useChatEngine.ts:1276`、`providers/claude.ts:58`。
- **证据**：preload `chatStream` 内部自造 `requestId` 不外泄，cleanup 仅 `removeListener`；`ai-stream-cancel` handler 只置 `cancelled` 标志 + 销毁 buffer，`activeStreams` 从不保存请求句柄/AbortController，底层 provider 请求继续跑到服务端完成。整条 AbortController 链缺失。
- **风险**：点"停止"后 UI 解锁但上游持续计费/占用并发槽；工具循环模式下 stop 只能等当前一轮返回。
- **修复**：每个 provider 的 chat/chatStream/chatWithTools 接入 `AbortSignal`；`ai-handlers` 在 activeStreams 保存 `AbortController`，cancel 时 `controller.abort()` + `res.destroy()`；preload 把 requestId 返回给调用方以便 cancel 可达。
- **验证**：发起长响应后点停止，抓包确认上游连接被 RST/关闭，token 计数停止增长。

### P1-5 · Composer 盲写整文件：从不读原文，假 diff，内存 checkpoint ✅CONFIRMED
- **影响**：Composer 多文件编辑（数据破坏面）。
- **位置**：`src/core/agent/composer.ts:66/130/228`、`ComposerPanel.tsx:36/344`、`checkpointManager.ts:10`。
- **证据**：`analyze` 前从不 `readFile` 目标文件；`buildAnalysisPrompt` 仅当 `relatedCode` 存在时附代码，而唯一调用方 `ComposerPanel.tsx:36` 不传；系统提示要求"newContent 必须是完整文件内容"；`ComposerPanel:344` 的 diff 预览 `oldContent` 恒为 `""`；checkpoint 仅内存态。
- **风险**：对已有文件执行 Composer 时 AI 未见原文即生成整文件覆盖，极易删除未知代码；用户看到的"Diff"是纯新内容无法判断损失；崩溃/关闭后内存 checkpoint 丢失无法回滚。
- **修复**：analyze 前读原文作为 `context.relatedCode` 传入；预览改真实 old vs new diff；写盘前落盘持久化 checkpoint（或走 git stash/备份）；对无原文的"整文件覆盖"给高危确认。
- **验证**：对已有文件跑 Composer，AI 上下文含原文；预览显示真实增删；kill 应用后仍可回滚。

### P1-6 · 文件状态双真源（split-brain），AI 核心链路实际失效 ✅CONFIRMED
- **影响**：AI 上下文/应用代码/agent/debug 读"当前文件"全链路。**架构阻塞。**
- **位置**：`useEditorFiles.ts:16`（本地 useState openFiles/activeFileId）、`App.tsx:57`、`useApplyCode.ts:33/65`、`useFileStore.ts:56`。
- **证据**：用户通过文件树打开/编辑用 `useEditorFiles` 的本地 state，而 AI 侧读写 `useFileStore.openFiles/activeFileId`，两者无桥接。故用户操作时 `useFileStore.openFiles` 恒空，AI 的 `getActiveFile()`、`editor_getActiveFile` 工具、"当前文件加入上下文"、applyCode 落点全拿到 undefined/错误目标。
- **风险**：AI 核心链路（上下文/应用/agent/debug 读当前文件）在真实使用中失效。
- **修复**：收敛为单一数据源——让 `useEditorFiles` 以 `useFileStore` 为唯一源（openFiles/activeFileId/操作迁进 store，hook 只订阅）；或最小改动下在 useEditorFiles 的 openFile/switchFile/updateFileContent 里同步镜像 store。
- **验证**：文件树打开文件后，AI"加入当前文件到上下文"能拿到正确内容；applyCode 落到正确文件。

### P1-7 · 本地插件加载链路永不运行（半实现），UI 显示可用实则死路径 ✅CONFIRMED
- **位置**：`loader.ts:191`、`preload.ts:424`、`manager.ts:112`、`PluginPanel.tsx:14`。
- **证据**：`loadModule()` 依赖 `window.mindcode.plugins.loadModule`，但 preload 只暴露 `{list,verify,uninstall,getDir}`，全仓 grep `loadModule` 仅 loader.ts 自身；`manager.init()` 从不被调用。
- **风险**：`plugins/hello-world`、`plugins/react-snippets` 永不加载；PluginPanel 恒显示"无插件"、"启用"按钮无对象；整套 loader/manager/权限模型是死路径，却被 UI 展示为可用。
- **修复**：二选一——(a) preload 实现 `plugins.loadModule`（配 Worker/独立上下文沙箱），启动时调 `init()+activateAll()`；(b) 暂不实现则从 UI 移除本地插件面板避免误导。
- **验证**：(a) 示例插件真实加载执行；(b) UI 不再展示不可用的插件入口。

### P1-8 · 扩展市场 Open VSX 被 CSP 全阻断，静默降级为 8 条硬编码 ✅CONFIRMED
- **位置**：`marketplace.ts:257/294`、`main/index.ts:475`（CSP `connect-src`）。
- **证据**：渲染进程 fetch `open-vsx.org`，但 dev/prod CSP `connect-src` 均不含该域，请求必被拦，恒降级到 `FALLBACK_EXTENSIONS`（8 条静态项），远程图标也加载不出。
- **风险**：README 宣称"浏览/搜索/安装扩展"名不副实，永远只见 8 条静态数据。
- **修复**：由**主进程代理 fetch** 经 IPC 回传（优于放开渲染层网络白名单）；或 CSP 增加 `connect-src https://open-vsx.org` + `img-src https://*.open-vsx.org`。
- **验证**：搜索返回真实 Open VSX 结果，图标可加载。

### P1-9 · 扩展"安装"是空操作（fake install）✅CONFIRMED
- **位置**：`marketplace.ts:355/470`、`plugin-handlers.ts:43`。
- **证据**：`install()` 只 `{...ext, installed:true}` 写 localStorage + 调 activate；`downloadUrl(.vsix)` 从不下载，无主进程 install handler，仅 dracula/nord 两个内置主题真生效。
- **风险**：点安装 ESLint/Prettier/GitLens 显示"已安装"但无任何实际效果，欺骗性 UI。
- **修复**：实现真实 .vsix 下载+解包+贡献点激活；或 UI 明确标注非主题类为"暂不支持"。
- **验证**：安装非主题扩展后有真实效果，或 UI 显示"暂不支持"而非虚假成功。

### P1-10 · 代码索引在主进程同步执行，大 repo 冻结主进程 ✅CONFIRMED
- **影响**：索引工作区时整个 UI 卡死。**Electron 边界 / 性能。**
- **位置**：`index-handlers.ts:40`、`indexService.ts:150/395`、`parser/typescript.ts:39`。
- **证据**：`index-handlers.ts:14` `createIndexService()` 运行在主进程；全 src grep `worker_threads|utilityProcess|new Worker` 零命中；`indexService.ts:395` 用 `readFileSync` 同步 I/O，最多 1 万文件全部在主进程解析。
- **风险**：无 key/关 embeddings 时是纯同步 CPU 密集循环，期间 IPC/窗口全卡死。OOM 上限只防崩溃不防阻塞。
- **修复**：解析/索引移入 `worker_threads` 或 `utilityProcess`；或每 N 文件 `await new Promise(setImmediate)` 让出事件循环；`readFileSync` 改异步。
- **验证**：对大 repo 索引期间窗口仍可交互、IPC 有响应。

### P1-11 · 调试断点功能整体不可用（IPC 存根返回空）✅CONFIRMED
- **位置**：`debug-handlers.ts:158/164/169`、`DebugPanel.tsx:54/192`。
- **证据**：`debug:removeBreakpoint/toggleBreakpoint` 空操作恒 `{success:true}`，`getBreakpoints` 恒 `{breakpoints:[]}`；`DebugPanel` 读 `result.data` 字段名不符；无编辑器 gutter 设断点入口。会话控制（step/continue）虽真实，但没断点等于不可用。
- **修复**：preload 暴露 `setBreakpoints`，编辑器 gutter 点击调 `debug:setBreakpoints`（真实的 session-manager.setBreakpoints 已存在）；渲染端维护断点 Map 整文件重设（DAP 语义）；修正 DebugPanel 读 `result.breakpoints`。
- **验证**：编辑器点 gutter 设断点，运行到断点处真实暂停。

---

## P2 — 可维护性 / 性能 / 测试缺失

| 编号 | 标题 | 位置 | 修复要点 |
|---|---|---|---|
| P2-1 | keytar/electron-store 装了 0 引用（伪安全），GitHub 集成无认证通路=空壳 | `package.json:41`、`github/client.ts:19`、`preload.ts:40` | 真接线（preload 暴露 keytar 桥 + main 实现 IPC）或删依赖+改 electron-store |
| P2-2 | 日志系统零脱敏，secrets/token 明文落盘；codesuc 把 apiKey 前 10 字符写日志 | `logger/file-transport.ts:43`、`providers/codesuc.ts:77`、`log-setup.ts:22` | Transport 写入前统一 redact（sk-/Bearer/x-api-key/token/password）；删 codesuc key 日志 |
| P2-3 | 跨厂商静默降级：Claude 失败自动改发 DeepSeek/GLM，用户内容被转投 | `llm-client.ts:19`（FALLBACK_MODELS） | 跨厂商降级默认关或首次弹窗确认；同厂商内降级保留 |
| P2-4 | 工具权限模型双轨，"官方"一套是死代码，真实确认硬编码在 useChatEngine | `tools/executor.ts:158`、`schemas.ts:234`、`useChatEngine.ts:941`、`agentToolService.ts:73` | 让 agentToolService.execute 成唯一裁决点，读 toolPermissions 统一确认；删死的 ToolExecutor |
| P2-5 | git 子进程继承完整 process.env，.env 的 API Key 传给 git hooks | `git-handlers.ts:21` | spawn 前删 `MINDCODE_*_API_KEY` 或复用 getSafeEnv 白名单 |
| P2-6 | terminal 命令白名单只覆盖极少用的 execute 回退，PTY 主链路零校验；write/close 缺 validateSender | `terminal-handlers.ts:242/298/155/349` | 明确 PTY=任意命令执行（边界应是工作区信任+可见性）；给 write/resize/close 补 validateSender；删误导性头注释 |
| P2-7 | lsp:start 以渲染可控 cwd 启动语言服务器，本地二进制劫持 | `lsp-manager.ts:147`、`lsp-handlers.ts:14` | 加信任门+validateSender；cwd 限受信工作区；npx 用绝对路径解析 |
| P2-8 | 未设 setWindowOpenHandler/will-navigate，外链在应用内窗口打开 | `main/index.ts:66`、`GitHubPanel.tsx:241` | setWindowOpenHandler 返回 deny + shell.openExternal；will-navigate 阻止离开 origin |
| P2-9 | 代码索引无持久化接线，每次启动全量重建 | `sqliteStore.ts:56`、`indexService.ts:92/491` | 初始化 persistent+dbPath，退出/定时 export 到 userData，启动 loadFrom |
| P2-10 | 实时增量索引（chokidar startWatching）已实现但从未调用 | `indexService.ts:511/539` | indexWorkspace 完成后调 startWatching 或提供 IPC 开关 |
| P2-11 | 编码检测未用 chardet，仅 UTF BOM + GBK 启发式，多编码误判 | `encoding/index.ts:69/113` | detectEncoding 接入 chardet.detect 映射 iconv |
| P2-12 | 崩溃恢复/自动保存引擎休眠（init/saveFileState 从不调用） | `recovery/index.ts:49/67` | 启动 await init，编辑/会话变更调 saveFileState，启动接 hasRecoverableState |
| P2-13 | LSP 自动重启逻辑死代码（`undefined < 3` 恒 false） | `lsp-manager.ts:165` | 初始化 `_restartCount=0` 或 `(?? 0) < 3` |
| P2-14 | i18n 完全未接线（摆设） | `i18n/index.ts:12/252` | main.tsx 挂 I18nProvider + t() 或删模块并去掉多语言宣称 |
| P2-15 | 死模块：contexts 整套 Provider + createStore 工厂零引用 | `contexts/index.ts`、`stores/createStore.ts` | 删除，或让 store 真接入工厂 |
| P2-16 | useChatEngine 巨型 hook（~1300 行）职责过载 | `AIPanel/hooks/useChatEngine.ts` | 拆 useStreaming/useToolLoop/useMessageQueue/useModelRouting |
| P2-17 | Provider 适配器复制粘贴（openai/gemini/deepseek 近逐行相同，残留 console.log） | `providers/openai.ts:91`、`gemini.ts:105`、`deepseek.ts:119` | 抽 OpenAICompatibleProvider 基类；清 console.log |
| P2-18 | 3 套 model→provider 路由不一致，gemini 前缀匹配错会误路由到 claude | `ai-handlers.ts:119`、`llm-client.ts:226`、`router.ts:24` | 统一到一个 getProviderForModel；修 gemini 前缀；删 AIRouter |
| P2-19 | llm-client 超时常量声明未使用，非流式 chat 无整体超时 | `llm-client.ts:15/157` | withRetry/provider 处按 TIMEOUT_READ_MS 加超时 |
| P2-20 | Agent 工具循环 maxIterations=50 无 token/成本上限，每轮重发全量历史 | `useChatEngine.ts:1026/1048` | 加累计 token/轮次预算超限询问；循环内 cleanup 存 stopStreamRef |
| P2-21 | electron-builder 引用的 resources/icons 不存在，dist/pack 打包失败 | `package.json:94/102/107` | 补图标或移除 icon 字段；CI 加 `electron-builder --dir` smoke |
| P2-22 | 主进程构建无 path-alias 解析，任何值导入 @shared/@core 会运行期崩溃 | `tsconfig.main.json:10`、`package.json:14` | build:main 接 tsc-alias，或 main/core 统一相对导入 |
| P2-23 | 两套 ESLint flat config，.mjs 是死配置且规则已分叉 | `eslint.config.mjs`、`eslint.config.js` | 删 .mjs；package.json 加 `type:module` 消告警 |
| P2-24 | 测试代码从不类型检查（两 tsconfig 都排除 src/test） | `tsconfig.json:30`、`tsconfig.main.json:16` | 新增 tsconfig.test.json 入 lint，或 CI 加 vitest --typecheck |
| P2-25 | 产品核心链路（AI 调用/IPC/Agent 文件写入）0 测试，256 用例集中外围 | `ai/tools/executor.ts`、`rollback.ts`、`fs-handlers.ts`、`llm-client.ts` | 优先补 executor/rollback 写入回滚单测 + fs 路径穿越 + llm 降级 |
| P2-26 | StatusBar.test 测死组件 StatusBarEnhanced，生产 StatusBar 0 测试 | `test/components/StatusBar.test.tsx:7` | 删死组件、测试改指生产 StatusBar |
| P2-27 | integration 目录名不副实（jsdom+mock 单测冒充集成） | `test/integration/*` | 重命名 unit 或补真跨进程集成 |
| P2-28 | e2e 从不进 CI，多个条件断言元素缺失时静默通过 | `.github/workflows/ci.yml:35`、`app-launch.spec.ts:36` | e2e（至少 app-launch）纳入 CI（build+xvfb）；去条件断言 |

---

## P3 — 体验 / 文档 / 风格

| 编号 | 标题 | 位置 | 修复要点 |
|---|---|---|---|
| P3-1 | log:write 用渲染传入字符串做 `logger[level]` 动态方法调用 | `log-setup.ts:42` | level 白名单校验（debug/info/warn/error），非法回退 info |
| P3-2 | completion-server（Python）未接入构建/打包=死代码 + 垃圾文件 `=0.24.0`（泄漏 Windows 路径） | `src/completion-server/` | 删除该目录或文档化+spawn 集成；无条件删 `=0.24.0` |
| P3-3 | 无关目录混入仓库（python_examples、.kiro 空 tasks.md） | `python_examples/`、`.kiro/` | 移出仓库或归入 docs/examples 说明用途 |
| P3-4 | .prettierrc/.editorconfig 强制 CRLF 但无 .gitattributes，跨平台行尾抖动 | `.prettierrc:9` | 改 `endOfLine:lf` + 加 `.gitattributes (* text=auto eol=lf)` |
| P3-5 | ESLint 规则偏弱（no-explicit-any 仅 warn 且无 --max-warnings；no-empty-catch 笔误规则） | `eslint.config.js:31/46` | any 升 error 或 lint 加 --max-warnings=0；修 no-empty 配置 |
| P3-6 | Monaco 单 model + setValue 切文件，丢每文件 undo/滚动/选区 | `CodeEditor.tsx:582/363` | 每文件独立 model，切换用 setModel |
| P3-7 | 轮询：DebugPanel 每 1s、StatusBar 每 5s IPC 轮询 | `DebugPanel.tsx:28`、`StatusBar.tsx:136` | 改事件驱动或仅活动会话时轮询 |
| P3-8 | 占位/凑数断言（`expect(true).toBe(true)`、测内联函数） | `requestPipeline.test.ts:68`、`example.test.ts:96` | 改为断言真实源码行为，删无价值用例 |
| P3-9 | 文档系统性夸大与矛盾：生产就绪/92%、版本号、API.md 幽灵接口、模型清单 | `README*.md`、`docs/API.md`、`docs/ARCHITECTURE_AUDIT.md` | 以单一事实源为准；删无依据结论；API.md 对齐 preload 实际契约 |
| P3-10 | 无 LICENSE 文件但声明 MIT；多处文档链接断链 | `README.md:164` | 补 LICENSE；修断链 |

---

## 附：M0 / M1 覆盖映射

- **M0（工程可用性）**：lint 265 error（不关规则）、e2e 3 失败选择器、npm audit 非破坏性修复、P2-21/22/23/24、P3-2/3/4/5。
- **M1（Electron 安全边界最小修复）**：**P0-2、P0-3**（默认端点/embeddings 默认关，纯配置改动，低风险高收益）、**P1-1**（fs 读路径校验）、**P1-2**（debug:start 信任门）、**P2-2**（日志脱敏）、**P2-5**（git env 过滤）、**P2-8**（will-navigate/setWindowOpenHandler）、**P3-1**（log level 白名单）。
- **需 Owner 决策，不由 M0/M1 自动执行**：**P0-1**（轮换密钥 + 是否 filter-repo 重写历史）。
- **排入后续 milestone**：P0-4（M5 编辑器）、P1-3（M1 尾/M3 发行）、P1-4/5/6（M4/M5）、P1-7~11（M4/M6/M7）、其余 P2/P3 分散到 M2–M9。
