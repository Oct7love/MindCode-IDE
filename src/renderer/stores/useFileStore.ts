import { create } from 'zustand';

export interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path?: string;
  children?: TreeNode[];
}

export interface EditorFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language?: string;
  isDirty?: boolean;
  isUntitled?: boolean;        // 是否为未保存的新文件
  encoding?: string;           // 文件编码 (默认 utf8)
  // Phase 2: 预览文件支持
  isPreview?: boolean;         // 是否为预览文件
  originalPath?: string;       // 原始文件路径（预览文件用）
  previewSource?: 'ai' | 'diff'; // 预览来源
}

// 支持的语言列表
export const SUPPORTED_LANGUAGES = [
  { id: 'plaintext', name: 'Plain Text', ext: '.txt' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts' },
  { id: 'javascript', name: 'JavaScript', ext: '.js' },
  { id: 'typescriptreact', name: 'TypeScript React', ext: '.tsx' },
  { id: 'javascriptreact', name: 'JavaScript React', ext: '.jsx' },
  { id: 'python', name: 'Python', ext: '.py' },
  { id: 'json', name: 'JSON', ext: '.json' },
  { id: 'html', name: 'HTML', ext: '.html' },
  { id: 'css', name: 'CSS', ext: '.css' },
  { id: 'scss', name: 'SCSS', ext: '.scss' },
  { id: 'markdown', name: 'Markdown', ext: '.md' },
  { id: 'c', name: 'C', ext: '.c' },
  { id: 'cpp', name: 'C++', ext: '.cpp' },
  { id: 'csharp', name: 'C#', ext: '.cs' },
  { id: 'java', name: 'Java', ext: '.java' },
  { id: 'go', name: 'Go', ext: '.go' },
  { id: 'rust', name: 'Rust', ext: '.rs' },
  { id: 'ruby', name: 'Ruby', ext: '.rb' },
  { id: 'php', name: 'PHP', ext: '.php' },
  { id: 'sql', name: 'SQL', ext: '.sql' },
  { id: 'shell', name: 'Shell', ext: '.sh' },
  { id: 'yaml', name: 'YAML', ext: '.yaml' },
  { id: 'xml', name: 'XML', ext: '.xml' },
] as const;

interface FileState {
  workspaceRoot: string | null; // 工作区根路径
  workspaceName: string; // 工作区名称
  fileTree: TreeNode[]; // 文件树
  openFiles: EditorFile[]; // 打开的文件列表（权威源）
  activeFileId: string | null; // 当前活动文件 ID
  selectedPath: string; // 选中的文件路径
  lastSavedById: Record<string, string>; // 保存基线：dirty = content !== baseline
  fileIdSeq: number;
}

export type CloseFileResult = { closed: boolean; requiresConfirm: boolean };

interface FileActions {
  setWorkspace: (root: string | null, name?: string) => void;
  setFileTree: (tree: TreeNode[]) => void;
  openFile: (file: EditorFile) => void;
  openFileByPath: (path: string, name: string) => Promise<void>;
  closeFile: (id: string) => void;
  requestCloseFile: (id: string, opts?: { force?: boolean }) => CloseFileResult;
  setActiveFile: (id: string | null) => void;
  setSelectedPath: (path: string) => void;
  updateFileContent: (id: string, content: string) => void;
  updateActiveFileContent: (content: string) => void;
  markFileSaved: (id: string) => void;
  updateFilePath: (id: string, newPath: string, newName: string) => void;
  updateFilePathByPath: (path: string, newPath: string, newName: string) => void;
  closeFilesStartingWith: (pathPrefix: string) => void;
  clearOpenFiles: () => void;
  getActiveFile: () => EditorFile | undefined;
  nextFileId: () => string;
  createNewFile: (language?: string) => string;
  setFileLanguage: (id: string, language: string) => void;
  setFileEncoding: (id: string, encoding: string) => void;
  saveFile: (id: string, targetPath?: string) => Promise<boolean>;
  saveFileById: (fileId: string, path: string, content: string) => Promise<boolean>;
  saveAllDirty: () => Promise<void>;
  openPreviewFile: (originalPath: string, content: string, source: 'ai' | 'diff', language?: string) => void;
  pinPreview: (id: string) => void;
  closePreviewFiles: () => void;
  savePreviewFile: (id: string) => Promise<boolean>;
}

export const useFileStore = create<FileState & FileActions>((set, get) => ({
  workspaceRoot: null,
  workspaceName: 'MindCode',
  fileTree: [],
  openFiles: [],
  activeFileId: null,
  selectedPath: '',
  lastSavedById: {},
  fileIdSeq: 0,

  setWorkspace: (root, name) => set({ 
    workspaceRoot: root, 
    workspaceName: name || root?.split(/[/\\]/).pop() || 'Workspace',
    openFiles: [],
    activeFileId: null,
    selectedPath: '',
    lastSavedById: {},
  }),

  setFileTree: (fileTree) => set({ fileTree }),

  nextFileId: () => {
    const seq = get().fileIdSeq + 1;
    set({ fileIdSeq: seq });
    return `f-${Date.now()}-${seq}`;
  },

  openFile: (file) => set((state) => {
    const existing = state.openFiles.find(f => f.path === file.path);
    if (existing) return { activeFileId: existing.id, selectedPath: existing.path };
    const baseline = file.content;
    return {
      openFiles: [...state.openFiles, { ...file, isDirty: file.isDirty ?? false }],
      activeFileId: file.id,
      selectedPath: file.path,
      lastSavedById: { ...state.lastSavedById, [file.id]: baseline },
    };
  }),

  openFileByPath: async (path, name) => {
    const existing = get().openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFileId: existing.id, selectedPath: existing.path });
      return;
    }
    let content = `// ${name}\n// 文件内容加载中...`;
    if (window.mindcode?.fs) {
      const result = await window.mindcode.fs.readFile(path);
      if (result.success && result.data !== undefined) {
        content = result.data;
      } else {
        content = `// 无法读取文件: ${result.error || "未知错误"}`;
      }
    }
    const again = get().openFiles.find((f) => f.path === path);
    if (again) {
      set({ activeFileId: again.id, selectedPath: again.path });
      return;
    }
    const id = get().nextFileId();
    const newFile: EditorFile = { id, path, name, content, isDirty: false };
    set((state) => ({
      openFiles: [...state.openFiles, newFile],
      activeFileId: id,
      selectedPath: path,
      lastSavedById: { ...state.lastSavedById, [id]: content },
    }));
  },

  closeFile: (id) => {
    get().requestCloseFile(id, { force: true });
  },

  requestCloseFile: (id, opts) => {
    const state = get();
    const target = state.openFiles.find((f) => f.id === id);
    if (target?.isDirty && !opts?.force) {
      return { closed: false, requiresConfirm: true };
    }
    const newFiles = state.openFiles.filter((f) => f.id !== id);
    let newActiveId = state.activeFileId;
    if (state.activeFileId === id) {
      const closedIndex = state.openFiles.findIndex((f) => f.id === id);
      const newIndex = Math.min(closedIndex, newFiles.length - 1);
      newActiveId = newFiles[newIndex]?.id || null;
    }
    const lastSavedById = { ...state.lastSavedById };
    delete lastSavedById[id];
    set({
      openFiles: newFiles,
      activeFileId: newActiveId,
      selectedPath: newFiles.find((f) => f.id === newActiveId)?.path || "",
      lastSavedById,
    });
    return { closed: true, requiresConfirm: false };
  },

  setActiveFile: (activeFileId) => set((state) => {
    const file = state.openFiles.find(f => f.id === activeFileId);
    return { activeFileId, selectedPath: file?.path || state.selectedPath };
  }),

  setSelectedPath: (selectedPath) => set({ selectedPath }),

  updateFileContent: (id, content) => set((state) => {
    const baseline = state.lastSavedById[id] ?? "";
    const dirty = content !== baseline;
    return {
      openFiles: state.openFiles.map((f) =>
        f.id === id ? { ...f, content, isDirty: dirty } : f,
      ),
    };
  }),

  updateActiveFileContent: (content) => {
    const id = get().activeFileId;
    if (!id) return;
    get().updateFileContent(id, content);
  },

  markFileSaved: (id) => set((state) => {
    const file = state.openFiles.find((f) => f.id === id);
    return {
      openFiles: state.openFiles.map((f) => (f.id === id ? { ...f, isDirty: false } : f)),
      lastSavedById: file
        ? { ...state.lastSavedById, [id]: file.content }
        : state.lastSavedById,
    };
  }),

  updateFilePath: (id, newPath, newName) => set((state) => ({
    openFiles: state.openFiles.map(f => f.id === id ? { ...f, path: newPath, name: newName } : f)
  })),

  updateFilePathByPath: (path, newPath, newName) => set((state) => ({
    openFiles: state.openFiles.map((f) =>
      f.path === path ? { ...f, path: newPath, name: newName } : f,
    ),
  })),

  closeFilesStartingWith: (pathPrefix) => set((state) => {
    const removed = state.openFiles.filter((f) => f.path.startsWith(pathPrefix));
    const openFiles = state.openFiles.filter((f) => !f.path.startsWith(pathPrefix));
    const lastSavedById = { ...state.lastSavedById };
    for (const f of removed) delete lastSavedById[f.id];
    const activeGone = state.activeFileId
      ? removed.some((f) => f.id === state.activeFileId)
      : false;
    return {
      openFiles,
      lastSavedById,
      activeFileId: activeGone ? (openFiles[0]?.id || null) : state.activeFileId,
    };
  }),

  clearOpenFiles: () => set({
    openFiles: [],
    activeFileId: null,
    lastSavedById: {},
  }),

  getActiveFile: () => {
    const state = get();
    return state.openFiles.find(f => f.id === state.activeFileId);
  },

  // 新建未命名文件
  createNewFile: (language = 'plaintext') => {
    const state = get();
    // 计算新文件编号
    const untitledFiles = state.openFiles.filter(f => f.isUntitled);
    const maxNum = untitledFiles.reduce((max, f) => {
      const match = f.name.match(/Untitled-(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    const newNum = maxNum + 1;

    const langInfo = SUPPORTED_LANGUAGES.find(l => l.id === language) || SUPPORTED_LANGUAGES[0];
    const newId = get().nextFileId();
    const newFile: EditorFile = {
      id: newId,
      path: `Untitled-${newNum}${langInfo.ext}`,
      name: `Untitled-${newNum}${langInfo.ext}`,
      content: '',
      language: langInfo.id,
      isDirty: false,
      isUntitled: true,
    };

    set((s) => ({
      openFiles: [...s.openFiles, newFile],
      activeFileId: newId,
      lastSavedById: { ...s.lastSavedById, [newId]: "" },
    }));

    return newId;
  },

  // 设置文件语言
  setFileLanguage: (id, language) => set((state) => {
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.id === language);
    if (!langInfo) return state;

    return {
      openFiles: state.openFiles.map(f => {
        if (f.id !== id) return f;
        // 如果是未保存文件，同时更新扩展名
        if (f.isUntitled) {
          const baseName = f.name.replace(/\.[^.]+$/, '');
          return {
            ...f,
            language,
            name: `${baseName}${langInfo.ext}`,
            path: `${baseName}${langInfo.ext}`,
          };
        }
        return { ...f, language };
      }),
    };
  }),

  // 设置文件编码
  setFileEncoding: (id, encoding) => set((state) => ({
    openFiles: state.openFiles.map(f => f.id === id ? { ...f, encoding, isDirty: true } : f)
  })),

  // 保存文件
  saveFile: async (id, targetPath) => {
    const state = get();
    const file = state.openFiles.find(f => f.id === id);
    if (!file) return false;

    // 如果是未命名文件且没有指定路径，需要弹出保存对话框
    if (file.isUntitled && !targetPath) {
      // 使用 Electron 的保存对话框
      const result = await window.mindcode?.dialog?.showSaveDialog?.({
        defaultPath: file.name,
        filters: [
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!result?.filePath) return false;
      targetPath = result.filePath;
    }

    const savePath = targetPath || file.path;
    const writeResult = await window.mindcode?.fs?.writeFile?.(savePath, file.content);

    if (writeResult?.success) {
      const newName = savePath.split(/[/\\]/).pop() || file.name;
      set((s) => ({
        openFiles: s.openFiles.map(f =>
          f.id === id
            ? { ...f, path: savePath, name: newName, content: file.content, isDirty: false, isUntitled: false }
            : f
        ),
        lastSavedById: { ...s.lastSavedById, [id]: file.content },
      }));
      return true;
    }
    return false;
  },

  saveFileById: async (fileId, path, content) => {
    let ok = true;
    if (window.mindcode?.fs) {
      const result = await window.mindcode.fs.writeFile(path, content);
      ok = !!result.success;
      if (!ok) {
        console.error("[Editor] Save failed:", result.error);
        window.mindcode?.dialog?.showMessageBox?.({
          type: "error",
          title: "保存失败",
          message: `无法保存文件: ${result.error || "未知错误"}`,
        });
      }
    }
    if (ok) {
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.id === fileId ? { ...f, content, isDirty: false, isUntitled: false } : f,
        ),
        lastSavedById: { ...s.lastSavedById, [fileId]: content },
      }));
    }
    return ok;
  },

  saveAllDirty: async () => {
    const dirtyFiles = get().openFiles.filter((f) => f.isDirty && !f.isUntitled && !f.isPreview);
    for (const f of dirtyFiles) {
      await get().saveFileById(f.id, f.path, f.content);
    }
  },

  // Phase 2: 预览文件支持
  openPreviewFile: (originalPath, content, source, language) => {
    const state = get();
    const fileName = originalPath.split(/[/\\]/).pop() || 'preview';
    const existingPreview = state.openFiles.find(f => f.isPreview && f.originalPath === originalPath);
    if (existingPreview) {
      set({
        openFiles: state.openFiles.map(f =>
          f.id === existingPreview.id ? { ...f, content, isDirty: true } : f
        ),
        activeFileId: existingPreview.id,
        lastSavedById: { ...state.lastSavedById, [existingPreview.id]: content },
      });
      return;
    }

    const previewId = get().nextFileId();
    set((s) => {
    const previewFile: EditorFile = {
      id: previewId,
      path: `[Preview] ${originalPath}`,
      name: `[Preview] ${fileName}`,
      content,
      language,
      isDirty: true,
      isPreview: true,
      originalPath,
      previewSource: source
    };

    return {
      openFiles: [...s.openFiles, previewFile],
      activeFileId: previewId,
      selectedPath: originalPath,
      lastSavedById: { ...s.lastSavedById, [previewId]: content },
    };
    });
  },

  pinPreview: (id) => set((state) => ({
    openFiles: state.openFiles.map((f) =>
      f.id === id && f.isPreview
        ? {
            ...f,
            isPreview: false,
            path: f.originalPath || f.path.replace(/^\[Preview\]\s*/, ""),
            name: (f.originalPath || f.name).split(/[/\\]/).pop() || f.name.replace(/^\[Preview\]\s*/, ""),
          }
        : f,
    ),
  })),

  closePreviewFiles: () => set((state) => {
    const nonPreviewFiles = state.openFiles.filter(f => !f.isPreview);
    const newActiveId = state.activeFileId && state.openFiles.find(f => f.id === state.activeFileId)?.isPreview
      ? (nonPreviewFiles[0]?.id || null)
      : state.activeFileId;
    return { openFiles: nonPreviewFiles, activeFileId: newActiveId };
  }),

  savePreviewFile: async (id) => {
    const state = get();
    const file = state.openFiles.find(f => f.id === id);
    if (!file?.isPreview || !file.originalPath) return false;

    // 保存到原始路径
    const result = await window.mindcode?.fs?.writeFile?.(file.originalPath, file.content);
    if (result?.success) {
      // 转换为普通文件
      set((s) => ({
        openFiles: s.openFiles.map(f =>
          f.id === id ? {
            ...f,
            path: file.originalPath!,
            name: file.originalPath!.split(/[/\\]/).pop() || 'file',
            isPreview: false,
            originalPath: undefined,
            previewSource: undefined,
            isDirty: false
          } : f
        ),
        lastSavedById: { ...s.lastSavedById, [id]: file.content },
      }));
      return true;
    }
    return false;
  },
}));
