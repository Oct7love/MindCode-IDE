/**
 * useWorkspace - 工作区管理 Hook
 *
 * 负责：工作区根路径、文件树加载/刷新、文件夹打开、拖拽打开、文件系统监听
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useFileStore, type TreeNode } from "../stores";
import { useIndexStore, initIndexServiceListeners } from "../services/indexService";
import { addRecentWorkspace } from "../services/recentWorkspaces";

const WORKSPACE_KEY = "mindcode.workspace";

/** 代码索引启动延迟（毫秒），避免阻塞应用启动 */
const INDEX_START_DELAY_MS = 3000;

export function useWorkspace() {
  const { setWorkspace: setStoreWorkspace, setFileTree: setStoreFileTree } = useFileStore();

  // 工作区状态 - 从 localStorage 恢复
  const [workspaceRoot, setWorkspaceRootState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(WORKSPACE_KEY);
    } catch {
      return null;
    }
  });
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [workspaceName, setWorkspaceName] = useState(() => {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    return saved ? saved.split(/[/\\]/).pop() || "Workspace" : "MindCode";
  });

  // 包装 setWorkspaceRoot 以同步 localStorage
  const setWorkspaceRoot = useCallback((path: string | null) => {
    setWorkspaceRootState(path);
    if (path) localStorage.setItem(WORKSPACE_KEY, path);
    else localStorage.removeItem(WORKSPACE_KEY);
  }, []);

  // 加载目录树
  const loadDirectory = useCallback(
    async (dirPath: string, isRoot = false): Promise<TreeNode[]> => {
      if (!window.mindcode?.fs) return [];
      const result = await window.mindcode.fs.readDir(dirPath);
      if (!result.success || !result.data) return [];

      const nodes: TreeNode[] = [];
      for (const item of result.data) {
        const node: TreeNode = {
          name: item.name,
          path: item.path,
          type: item.type as "file" | "folder",
        };
        if (item.type === "folder" && isRoot) {
          node.children = await loadDirectory(item.path, false);
        } else if (item.type === "folder") {
          node.children = []; // 延迟加载
        }
        nodes.push(node);
      }
      return nodes;
    },
    [],
  );

  // 打开文件夹
  const handleOpenFolder = useCallback(async () => {
    if (!window.mindcode?.fs) {
      console.error("[Workspace] File system API not available");
      return;
    }
    const folderPath = await window.mindcode.fs.openFolder();
    if (folderPath) {
      // 同步工作区路径到主进程（安全边界验证依赖此调用）
      await window.mindcode.fs.setWorkspace?.(folderPath);
      setWorkspaceRoot(folderPath);
      setWorkspaceName(folderPath.split(/[/\\]/).pop() || "Workspace");
      const tree = await loadDirectory(folderPath, true);
      setFileTree(tree);
      setStoreWorkspace(folderPath, folderPath.split(/[/\\]/).pop() || "Workspace");
      setStoreFileTree(tree);
      addRecentWorkspace(folderPath);
      return folderPath;
    }
    return null;
  }, [loadDirectory, setWorkspaceRoot, setStoreWorkspace, setStoreFileTree]);

  // 通过路径打开文件夹（供菜单/拖拽使用）
  const openFolderByPath = useCallback(
    async (folderPath: string) => {
      // 同步工作区路径到主进程（安全边界验证依赖此调用）
      await window.mindcode.fs.setWorkspace?.(folderPath);
      setWorkspaceRoot(folderPath);
      setWorkspaceName(folderPath.split(/[/\\]/).pop() || "Workspace");
      const tree = await loadDirectory(folderPath, true);
      setFileTree(tree);
      setStoreWorkspace(folderPath, folderPath.split(/[/\\]/).pop() || "Workspace");
      setStoreFileTree(tree);
      addRecentWorkspace(folderPath);
    },
    [loadDirectory, setWorkspaceRoot, setStoreWorkspace, setStoreFileTree],
  );

  // 刷新文件树
  const refreshFileTree = useCallback(async () => {
    if (workspaceRoot) {
      const tree = await loadDirectory(workspaceRoot, true);
      setFileTree(tree);
      setStoreFileTree(tree);
    }
  }, [workspaceRoot, loadDirectory, setStoreFileTree]);

  // 启动时恢复工作区
  const workspaceRestoredRef = useRef(false);
  useEffect(() => {
    if (workspaceRestoredRef.current) return;
    const restoreWorkspace = async () => {
      const saved = localStorage.getItem(WORKSPACE_KEY);
      if (saved) {
        workspaceRestoredRef.current = true;
        try {
          // 恢复时同步工作区路径到主进程
          await window.mindcode.fs.setWorkspace?.(saved);
          const tree = await loadDirectory(saved, true);
          if (tree.length > 0) {
            const name = saved.split(/[/\\]/).pop() || "Workspace";
            setWorkspaceRootState(saved);
            setFileTree(tree);
            setStoreFileTree(tree);
            setWorkspaceName(name);
            setStoreWorkspace(saved, name);
          } else {
            localStorage.removeItem(WORKSPACE_KEY);
          }
        } catch (e) {
          console.warn("[App] 恢复工作区失败:", e);
          localStorage.removeItem(WORKSPACE_KEY);
        }
      }
    };
    restoreWorkspace();
  }, [loadDirectory, setStoreFileTree, setStoreWorkspace]);

  // 监听文件系统变更
  useEffect(() => {
    if (!window.mindcode?.onFileSystemChange) return;

    const cleanup = window.mindcode.onFileSystemChange(() => {
      refreshFileTree();
    });

    return cleanup;
  }, [refreshFileTree]);

  // 代码索引 - 工作区打开/恢复后自动触发后台索引
  const indexStore = useIndexStore();

  useEffect(() => {
    if (!workspaceRoot) return;

    // 初始化索引事件监听器
    const cleanupListeners = initIndexServiceListeners();

    // 延迟启动索引（避免阻塞启动）
    const timer = setTimeout(() => {
      if (indexStore.status === "idle" || indexStore.status === "error") {
        // 自动触发后台代码索引
        indexStore.startIndexing(workspaceRoot);
      }
    }, INDEX_START_DELAY_MS);

    return () => {
      clearTimeout(timer);
      cleanupListeners();
    };
  }, [workspaceRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    workspaceRoot,
    workspaceName,
    fileTree,
    loadDirectory,
    handleOpenFolder,
    openFolderByPath,
    refreshFileTree,
    setWorkspaceRoot,
    setFileTree,
    setWorkspaceName,
  };
}
