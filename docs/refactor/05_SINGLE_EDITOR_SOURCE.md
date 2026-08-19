# 单一编辑器状态源

## 问题

打开文件列表、active、内容、dirty、保存基线同时存在于：

- `useEditorFiles` 的 React state + `lastSaved` ref
- `useFileStore` 的 Zustand `openFiles`

两边可独立变化。预览 tab 从 store 单向灌入 hook，搜索/AI apply 写 store，主编辑器写 hook，形成 P1-6 双真源。

## 决定

不新建第三套 store。

- **权威源**：现有 `useFileStore`（文件树/工作区已在此）。
- **M5 不变量迁入 store**：`lastSavedById`、dirty = 内容≠基线、按 path 重开只切 active、保存用显式 id/path、dirty 关闭需确认、单调 file id。
- **`useEditorFiles`**：只读 store + 委托 action + 本地 `editorRef`（Monaco 句柄不是文件状态）。
- **预览/搜索/AI apply**：全部走同一 store。预览 tab 再点一次即 pin 为普通 tab。

## 不改

- 每文件 Monaco model / undo / 选区（CodeEditor，P0-4）
- CSP、AI 取消、autoSave、外部 watcher（后续 PR）
