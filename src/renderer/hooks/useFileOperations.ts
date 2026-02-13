/**
 * useFileOperations - 文件操作 Hook
 *
 * 负责：右键菜单、新建/重命名/删除/复制/粘贴、拖拽文件夹
 */
import { useState, useCallback } from "react";

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  targetPath: string;
  targetName: string;
  isFolder: boolean;
}

interface InputDialogState {
  isOpen: boolean;
  title: string;
  placeholder: string;
  defaultValue: string;
  confirmText: string;
  onConfirm: (value: string) => void;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export function useFileOperations(
  refreshFileTree: () => Promise<void>,
  openFile: (path: string, name: string) => Promise<void>,
  updateFilePath: (path: string, newPath: string, newName: string) => void,
  closeFilesStartingWith: (pathPrefix: string) => void,
) {
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetPath: "",
    targetName: "",
    isFolder: false,
  });

  // 对话框状态
  const [inputDialog, setInputDialog] = useState<InputDialogState>({
    isOpen: false,
    title: "",
    placeholder: "",
    defaultValue: "",
    confirmText: "确认",
    onConfirm: () => {},
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // 复制路径
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);

  // 右键菜单处理
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string, name: string, isFolder: boolean) => {
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        targetPath: path,
        targetName: name,
        isFolder,
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 新建文件
  const handleNewFile = useCallback(
    (parentPath: string) => {
      setInputDialog({
        isOpen: true,
        title: "新建文件",
        placeholder: "输入文件名",
        defaultValue: "",
        confirmText: "创建",
        onConfirm: async (fileName) => {
          if (!window.mindcode?.fs) return;
          const targetPath = parentPath ? `${parentPath}/${fileName}` : fileName;
          const result = await window.mindcode.fs.createFile(targetPath);
          if (result.success) {
            await refreshFileTree();
            openFile(targetPath, fileName);
          } else {
            alert(`创建失败: ${result.error}`);
          }
          setInputDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [refreshFileTree, openFile],
  );

  // 新建文件夹
  const handleNewFolder = useCallback(
    (parentPath: string) => {
      setInputDialog({
        isOpen: true,
        title: "新建文件夹",
        placeholder: "输入文件夹名",
        defaultValue: "",
        confirmText: "创建",
        onConfirm: async (folderName) => {
          if (!window.mindcode?.fs) return;
          const targetPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          const result = await window.mindcode.fs.createFolder(targetPath);
          if (result.success) {
            await refreshFileTree();
          } else {
            alert(`创建失败: ${result.error}`);
          }
          setInputDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [refreshFileTree],
  );

  // 重命名
  const handleRename = useCallback(
    (path: string, name: string) => {
      setInputDialog({
        isOpen: true,
        title: "重命名",
        placeholder: "输入新名称",
        defaultValue: name,
        confirmText: "确定",
        onConfirm: async (newName) => {
          if (!window.mindcode?.fs || newName === name) {
            setInputDialog((prev) => ({ ...prev, isOpen: false }));
            return;
          }
          const parentPath = path.replace(/[/\\][^/\\]+$/, "");
          const newPath = parentPath ? `${parentPath}/${newName}` : newName;
          const result = await window.mindcode.fs.rename(path, newPath);
          if (result.success) {
            await refreshFileTree();
            updateFilePath(path, newPath, newName);
          } else {
            alert(`重命名失败: ${result.error}`);
          }
          setInputDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [refreshFileTree, updateFilePath],
  );

  // 删除
  const handleDelete = useCallback(
    (path: string, name: string, isFolder: boolean) => {
      setConfirmDialog({
        isOpen: true,
        title: "确认删除",
        message: `确定要删除${isFolder ? "文件夹" : "文件"} "${name}" 吗？此操作不可撤销。`,
        onConfirm: async () => {
          if (!window.mindcode?.fs) return;
          const result = await window.mindcode.fs.delete(path);
          if (result.success) {
            await refreshFileTree();
            closeFilesStartingWith(path);
          } else {
            alert(`删除失败: ${result.error}`);
          }
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [refreshFileTree, closeFilesStartingWith],
  );

  // 复制 / 粘贴
  const handleCopy = useCallback((path: string) => setCopiedPath(path), []);

  const handlePaste = useCallback(
    async (targetPath: string) => {
      if (!copiedPath || !window.mindcode?.fs) return;
      const fileName = copiedPath.split(/[/\\]/).pop() || "";
      const newPath = `${targetPath}/${fileName}`;
      const result = await window.mindcode.fs.copy(copiedPath, newPath);
      if (result.success) {
        await refreshFileTree();
      } else {
        alert(`粘贴失败: ${result.error}`);
      }
    },
    [copiedPath, refreshFileTree],
  );

  // 拖拽处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const closeInputDialog = useCallback(() => {
    setInputDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    // 右键菜单
    contextMenu,
    handleContextMenu,
    closeContextMenu,

    // 对话框
    inputDialog,
    confirmDialog,
    closeInputDialog,
    closeConfirmDialog,

    // 文件操作
    handleNewFile,
    handleNewFolder,
    handleRename,
    handleDelete,
    handleCopy,
    handlePaste,
    copiedPath,

    // 拖拽
    isDragging,
    setIsDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
  };
}
