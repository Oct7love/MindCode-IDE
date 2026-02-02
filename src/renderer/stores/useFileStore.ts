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
  openFiles: EditorFile[]; // 打开的文件列表
  activeFileId: string | null; // 当前活动文件 ID
  selectedPath: string; // 选中的文件路径
}

interface FileActions {
  setWorkspace: (root: string | null, name?: string) => void;
  setFileTree: (tree: TreeNode[]) => void;
  openFile: (file: EditorFile) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string | null) => void;
  setSelectedPath: (path: string) => void;
  updateFileContent: (id: string, content: string) => void;
  markFileSaved: (id: string) => void;
  updateFilePath: (id: string, newPath: string, newName: string) => void;
  getActiveFile: () => EditorFile | undefined;
  // 新建文件支持
  createNewFile: (language?: string) => string; // 返回新文件的 id
  setFileLanguage: (id: string, language: string) => void;
  setFileEncoding: (id: string, encoding: string) => void; // 设置文件编码
  saveFile: (id: string, targetPath?: string) => Promise<boolean>;
  // Phase 2: 预览文件支持
  openPreviewFile: (originalPath: string, content: string, source: 'ai' | 'diff', language?: string) => void;
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

  setWorkspace: (root, name) => set({ 
    workspaceRoot: root, 
    workspaceName: name || root?.split(/[/\\]/).pop() || 'Workspace',
    openFiles: [],
    activeFileId: null,
    selectedPath: ''
  }),

  setFileTree: (fileTree) => set({ fileTree }),

  openFile: (file) => set((state) => {
    const existing = state.openFiles.find(f => f.path === file.path);
    if (existing) return { activeFileId: existing.id, selectedPath: file.path };
    return { openFiles: [...state.openFiles, file], activeFileId: file.id, selectedPath: file.path };
  }),

  closeFile: (id) => set((state) => {
    const newFiles = state.openFiles.filter(f => f.id !== id);
    let newActiveId = state.activeFileId;
    if (state.activeFileId === id) {
      const closedIndex = state.openFiles.findIndex(f => f.id === id);
      const newIndex = Math.min(closedIndex, newFiles.length - 1);
      newActiveId = newFiles[newIndex]?.id || null;
    }
    return { openFiles: newFiles, activeFileId: newActiveId, selectedPath: newFiles.find(f => f.id === newActiveId)?.path || '' };
  }),

  setActiveFile: (activeFileId) => set((state) => {
    const file = state.openFiles.find(f => f.id === activeFileId);
    return { activeFileId, selectedPath: file?.path || state.selectedPath };
  }),

  setSelectedPath: (selectedPath) => set({ selectedPath }),

  updateFileContent: (id, content) => set((state) => ({
    openFiles: state.openFiles.map(f => f.id === id ? { ...f, content, isDirty: true } : f)
  })),

  markFileSaved: (id) => set((state) => ({
    openFiles: state.openFiles.map(f => f.id === id ? { ...f, isDirty: false } : f)
  })),

  updateFilePath: (id, newPath, newName) => set((state) => ({
    openFiles: state.openFiles.map(f => f.id === id ? { ...f, path: newPath, name: newName } : f)
  })),

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
    const newId = `untitled_${Date.now()}`;
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
            ? { ...f, path: savePath, name: newName, isDirty: false, isUntitled: false }
            : f
        ),
      }));
      return true;
    }
    return false;
  },

  // Phase 2: 预览文件支持
  openPreviewFile: (originalPath, content, source, language) => set((state) => {
    const previewId = `preview_${originalPath}_${Date.now()}`;
    const fileName = originalPath.split(/[/\\]/).pop() || 'preview';

    // 检查是否已有该路径的预览文件，如果有则更新
    const existingPreview = state.openFiles.find(f => f.isPreview && f.originalPath === originalPath);
    if (existingPreview) {
      return {
        openFiles: state.openFiles.map(f =>
          f.id === existingPreview.id ? { ...f, content, isDirty: true } : f
        ),
        activeFileId: existingPreview.id
      };
    }

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
      openFiles: [...state.openFiles, previewFile],
      activeFileId: previewId,
      selectedPath: originalPath
    };
  }),

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
        )
      }));
      return true;
    }
    return false;
  },
}));
