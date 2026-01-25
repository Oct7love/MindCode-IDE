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
}

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
}));
