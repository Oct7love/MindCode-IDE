# M5 · 编辑器状态完整性审查（P0-4）

> 日期：2026-07-07 · 分支 `refactor/m5-editor-state-integrity` · 基点 main `0e2a614`
> 方法：4 路并行只读审查（buffer/state · Monaco 生命周期 · 保存逻辑 · tab/关闭/外部变更）+ 本人一手核实。
> 目标：修复 P0-4「编辑器切 tab 数据破坏」，把编辑器核心数据流修稳。

---

## 1. 当前编辑器数据流图

```
侧边栏/搜索/命令面板 openFile ─┐
                              ▼
App.tsx:57  const editor = useEditorFiles(workspaceRoot)
            └─ 本地 useState: openFiles[] / activeFileId   ← 真源①（编辑器 UI 唯一在用）
                              │  activeFile = openFiles.find(id===activeFileId)
                              ▼
App.tsx:575  <CodeEditor                       ← 单实例，无 key，永不 remount
               file={{path, content}}          （每渲染新对象字面量）
               onContentChange={editor.updateFileContent}   ← useCallback([activeFileId])
               onSave={editor.saveFile} />                    ← useCallback([activeFileId,openFiles])
                              │
              CodeEditor.tsx:360  init effect  deps=[]  →  只挂载一次
                ├─ :363 monaco.editor.create（单 editor + 单 model，永不重建）
                ├─ :474 editor.onDidChangeModelContent(()=> onContentChange(getValue()))  ← 冻结 mount 期回调
                └─ :480 addCommand(Ctrl+S, ()=> onSave(getValue()))                        ← 冻结 mount 期回调
              CodeEditor.tsx:582  file 同步 effect deps=[file.path,file.content]
                └─ :593 if(model.getValue()!==file.content) model.setValue(file.content)   ← 切 tab 触发

AI 面板 / StatusBar / Composer ── 读写 ── useFileStore(zustand) openFiles/activeFileId  ← 真源②（与①不同步）
Monaco model 内部 value ─────────────────────────────────────────────────────────────── ← 真源③（真实键入文本）
autoSave.dirtyFiles + localStorage ─────────────────────────────────────────────────── ← 真源④（死代码，从不更新）
磁盘 via IPC fs:readFile/fs:writeFile（无 mtime/版本校验，last-write-wins）
```

## 2. 多真源（split-brain）盘点

| # | 真源 | 位置 | 谁用 | 问题 |
|---|---|---|---|---|
| ① | useEditorFiles 本地 state | `useEditorFiles.ts:16-17` | 编辑器 UI / tab / 保存 | 与②③不同步 |
| ② | useFileStore zustand | `useFileStore.ts:87-88` | AI 面板 / StatusBar / Composer | 用户打开的文件从不进②，故②几乎恒空、activeFileId=null |
| ③ | Monaco model value | `CodeEditor.tsx:328,474` | 真实键入文本 | 靠 setValue 单向同步；与①靠冻结闭包错误回写 |
| ④ | autoSave.dirtyFiles + localStorage | `autoSave.ts:24,121` | 设计上的草稿保护 | 死代码，`init()` 从不调用 |

无 `lastSaved` 快照；`isDirty` 只是布尔标志。

## 3. P0-4 可复现路径（根因）

**根因**：`CodeEditor` 是单实例单 model（无 `key`，不 remount），其初始化 effect 依赖数组为空（`CodeEditor.tsx:579 }, []`），在其中一次性注册的 `onDidChangeModelContent`（:474）与 `Ctrl+S`（:480）**永久捕获挂载那一刻的 `onContentChange`/`onSave`**。这两个 prop 来自 `useEditorFiles` 的 `useCallback([activeFileId])`（`updateFileContent`）/ `useCallback([activeFileId,openFiles])`（`saveFile`），切 tab 会重建新函数，但监听器仍握旧的——**绑定到第一个打开文件的 id**。

**复现 1（切 tab 破坏未保存内容）**：
1. 打开 A.txt（CodeEditor 挂载，监听器冻结绑定 `updateFileContent_A`）。
2. 在 A 输入 `X` → `openFiles[A].content='...X'`（此步正确）。
3. 打开/切到 B.txt → 同步 effect `setValue(B.content)`（:593）→ 触发 `onDidChangeModelContent` → 冻结的 `updateFileContent_A(B.content)` → **把 A 的 content 覆写成 B 的文本并把 A 标脏**，A 的未保存 `X` 当场丢失。
4. 之后在 B 键入 → 每次都写进 A，B 的 content/isDirty 永不更新（**dirty 不准**）。切回 A 显示 B 的文本，A 原内容不可恢复。

**复现 2（保存误存到别的 tab）**：打开 A 再打开 B，焦点在编辑器时按 Ctrl+S → Monaco 内建命令（:480）用冻结的 `saveFile_A` 把当前可见文本（B 的）写入 **A.path**，并把 A 标为已保存；B 从未落盘。

**复现 3（假 dirty）**：仅来回点 tab（未编辑）→ `setValue` 触发变更 → `updateFileContent` 无条件置 `isDirty:true` → 干净文件被标脏。

## 4. 涉及文件

- `src/renderer/components/CodeEditor.tsx`（P0-4 核心：陈旧闭包 + 单 model setValue）
- `src/renderer/hooks/useEditorFiles.ts`（真源① + dirty 布尔 + saveFile/closeFile/id）
- `src/renderer/App.tsx`（CodeEditor 挂载、保存三入口、close 入口）
- `src/renderer/stores/useFileStore.ts`（真源②，AI/StatusBar）
- 关联死代码：`services/autoSave.ts`、`components/Editor.tsx`、`services/fileWatcher.ts`

## 5. 根因判断（分级）

| 级 | 缺陷 | 位置 |
|---|---|---|
| **P0** | 陈旧闭包把所有编辑/保存路由到首个文件，切 tab 破坏未保存内容 | `CodeEditor.tsx:474,480,579` |
| **P0** | Ctrl+S 保存误存到别的 tab（同源） | `CodeEditor.tsx:480` |
| P1 | `editor.editorRef` 从未接到 CodeEditor → 菜单/命令面板保存恒失效 | `App.tsx:137,307`、`CodeEditor` 无 forwardRef |
| P1 | dirty 是布尔标志、无 lastSaved 基线 → dirty 失真（改回原样仍脏） | `useEditorFiles.ts:103` |
| P1 | split-brain：编辑器①与 AI/StatusBar② 不同步 | `useEditorFiles.ts` vs `useFileStore.ts` |
| P1 | 关闭 dirty tab 无确认，静默丢弃 | `useEditorFiles.ts:75-91` |
| P1 | 「保存全部」未实现（只有快捷键定义） | `shortcutManager.ts:226`，无 dispatcher |
| P2 | 切 tab 产生假 dirty（setValue 触发变更） | `CodeEditor.tsx:593` |
| P2 | 无外部文件变更/冲突检测，save 盲写 last-write-wins | `fs-handlers.ts:290`，无 watcher |
| P3 | 文件 id=`Date.now().toString()` 可碰撞 | `useEditorFiles.ts:61` |

## 6. 最小修复方案（本次 M5 范围）

遵循「小步修复、不大规模重写、不碰 AI/Provider」。本次修**数据安全核心 + 可测行为**：

1. **CodeEditor 陈旧闭包 → ref 转发**（治 P0 复现 1/2/5）：新增 `onContentChangeRef`/`onSaveRef`，每渲染同步；`onDidChangeModelContent`/Ctrl+S 改调 `ref.current`。仓库已有范式（`DiffEditor.tsx:37-40`）。
2. **程序化 setValue 抑制标志**（治假 dirty + setValue 反噬，复现 3）：`isProgrammaticRef`，切文件 effect 在 `setValue` 前后 `try/finally` 置 true/false；变更回调开头 `if(isProgrammaticRef.current) return;`。
3. **dirty 用 lastSaved 基线**（治 dirty 失真）：`EditorFile` 加 `lastSavedContent`；`updateFileContent` 按 `content!==lastSavedContent` 计 `isDirty`；`saveFile` 成功后 `lastSavedContent=content`、`isDirty=false`。
4. **editorRef 接线**（治菜单/命令面板保存失效）：`CodeEditor` 改 `forwardRef`+`useImperativeHandle` 暴露 `{getValue,setValue}`，App 传 `ref={editor.editorRef}`。
5. **saveAll 只存 dirty**（治保存全部缺失）：`useEditorFiles.saveAllFiles()` 遍历 `isDirty` 文件各自 writeFile；App 加 `Ctrl+Shift+S` 分支。
6. **关闭 dirty tab 保护**：`closeFile` 对 dirty 文件走确认（保存/丢弃/取消），三入口（tab X / Ctrl+W / menu:closeEditor）统一经此。
7. **文件 id 去碰撞**：改用单调计数器 + Date.now。

## 7. 测试计划

- **useEditorFiles 单测**（`src/test/unit/hooks/useEditorFiles.test.ts`，`@testing-library/react` renderHook + mock `window.mindcode.fs`）：
  1. 打开 A、改 A、切 B、再切回 A → A 未保存内容仍在（**每次 updateFileContent 写当前 active，不串**）。
  2. A/B 都改，保存 A → 只写 A.path、B 不受影响、B 仍 dirty。
  3. dirty 基线：改 A 后再改回原样 → 不脏；保存后 → 不脏。
  4. saveAllFiles 只写 dirty 文件、清其 dirty。
  5. 重开已打开文件 → 不覆盖内存 buffer（openFile 命中 existing 只切 active）。
  6. closeFile 对 dirty 文件返回需确认信号 / 干净文件直接关。
  7. 文件 id 唯一（连续 open 不碰撞）。
- **回归说明**：CodeEditor 的陈旧闭包属 Monaco 集成层（测试环境 `vi.mock("monaco-editor")` 为桩，无法完整驱动 onDidChangeModelContent）。故核心不变量在**状态层（useEditorFiles）**用单测锁死：只要监听器永远调「当前 active 的 action」（ref 修复）且 hook action 正确，数据即安全。CodeEditor 的 ref/suppress 改动由类型检查 + 构建 + 现有 e2e（app-launch）+ 人工冒烟兜底。

## 8. 不做事项（M5 明确不碰，记为后续）

- **split-brain 收敛**（①②统一真源）：涉及 AI 面板 / StatusBar / Composer 大面积改动，属跨切面重构，**本次不做**（另立 PR；边界禁止碰 AI）。
- **每文件独立 Monaco model**（保留 undo/滚动/选区）：更彻底但更大，本次用 ref+suppress 先根治**数据破坏**；model-per-tab 记为后续优化。
- **外部文件变更 watcher / 冲突检测**：需暴露 fs.watch / 接 chokidar 事件，本次不做，记为后续。
- **autoSave 接线 / Editor.tsx 死代码清理 / fileWatcher.ts 死代码**：本次不动（避免无关重构）。
- 不碰 AI Provider/Model/SDK、不接 key/network、不做 UI 美化、不改主题。
