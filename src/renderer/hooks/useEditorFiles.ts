/**
 * useEditorFiles - 编辑器文件管理 Hook
 *
 * 负责：文件打开/关闭/切换/保存、预览文件同步、文件内容更新
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useFileStore, type EditorFile } from "../stores";

export function useEditorFiles(workspaceRoot: string | null) {
  const {
    openFiles: storeOpenFiles,
    createNewFile: storeCreateNewFile,
    setFileLanguage,
  } = useFileStore();

  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const editorRef = useRef<{ getValue: () => string; setValue: (v: string) => void } | null>(null);
  const untitledCounterRef = useRef(0);

  // 当前活动文件
  const activeFile = openFiles.find((f) => f.id === activeFileId);

  // 同步 Store 中的预览文件到本地状态
  useEffect(() => {
    const previewFiles = storeOpenFiles.filter((f) => f.isPreview);
    if (previewFiles.length === 0) return;

    setOpenFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const newPreviewFiles = previewFiles.filter((f) => !existingIds.has(f.id));
      if (newPreviewFiles.length === 0) return prev;

      const merged = [...prev, ...newPreviewFiles];
      const latestPreview = newPreviewFiles[newPreviewFiles.length - 1];
      setTimeout(() => setActiveFileId(latestPreview.id), 0);
      return merged;
    });
  }, [storeOpenFiles]);

  // 打开文件
  const openFile = useCallback(
    async (path: string, name: string) => {
      const existing = openFiles.find((f) => f.path === path);
      if (existing) {
        setActiveFileId(existing.id);
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

      const newFile: EditorFile = {
        id: Date.now().toString(),
        path,
        name,
        content,
        isDirty: false,
      };

      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(newFile.id);
    },
    [openFiles],
  );

  // 关闭文件
  const closeFile = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setOpenFiles((prev) => {
        const newFiles = prev.filter((f) => f.id !== id);
        if (activeFileId === id && newFiles.length > 0) {
          const closedIndex = prev.findIndex((f) => f.id === id);
          const newActiveIndex = Math.min(closedIndex, newFiles.length - 1);
          setActiveFileId(newFiles[newActiveIndex]?.id || null);
        } else if (newFiles.length === 0) {
          setActiveFileId(null);
        }
        return newFiles;
      });
    },
    [activeFileId],
  );

  // 切换活动文件
  const switchFile = useCallback((id: string) => {
    setActiveFileId(id);
  }, []);

  // 更新文件内容
  const updateFileContent = useCallback(
    (content: string) => {
      if (!activeFileId) return;
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content, isDirty: true } : f)),
      );
    },
    [activeFileId],
  );

  // 保存文件
  const saveFile = useCallback(
    async (content: string) => {
      if (!activeFileId) return;
      const file = openFiles.find((f) => f.id === activeFileId);
      if (!file) return;

      if (window.mindcode?.fs) {
        const result = await window.mindcode.fs.writeFile(file.path, content);
        if (result.success) {
          setOpenFiles((prev) =>
            prev.map((f) => (f.id === activeFileId ? { ...f, content, isDirty: false } : f)),
          );
        } else {
          console.error("[Editor] Save failed:", result.error);
          // 通过 window.mindcode.dialog 显示错误（如果可用），否则使用 console
          window.mindcode?.dialog?.showMessageBox?.({
            type: "error",
            title: "保存失败",
            message: `无法保存文件: ${result.error || "未知错误"}`,
          });
        }
      } else {
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === activeFileId ? { ...f, content, isDirty: false } : f)),
        );
      }
    },
    [activeFileId, openFiles],
  );

  // 保存未命名文件（弹出对话框）
  const saveUntitledFile = useCallback(
    async (file: EditorFile, content: string, refreshTreeFn?: () => Promise<void>) => {
      const result = await window.mindcode?.dialog?.showSaveDialog?.({
        defaultPath: file.name,
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (result?.filePath) {
        const writeResult = await window.mindcode?.fs?.writeFile?.(result.filePath, content);
        if (writeResult?.success) {
          const newName = result.filePath.split(/[/\\]/).pop() || file.name;
          setOpenFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, path: result.filePath!, name: newName, isDirty: false, isUntitled: false }
                : f,
            ),
          );
          if (refreshTreeFn) await refreshTreeFn();
          return true;
        }
      }
      return false;
    },
    [],
  );

  // 创建新文件
  const createNewFile = useCallback(() => {
    untitledCounterRef.current++;
    const newFileId = `untitled_${Date.now()}`;
    const newFileName = `Untitled-${untitledCounterRef.current}.txt`;
    const newFile: EditorFile = {
      id: newFileId,
      path: newFileName,
      name: newFileName,
      content: "",
      language: "plaintext",
      isDirty: false,
      isUntitled: true,
    };
    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    return newFileId;
  }, []);

  // 更新文件路径（重命名后）
  const updateFilePath = useCallback((path: string, newPath: string, newName: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => {
        if (f.path === path) return { ...f, path: newPath, name: newName };
        return f;
      }),
    );
  }, []);

  // 关闭路径开头的文件（删除文件夹后清理）
  const closeFilesStartingWith = useCallback((pathPrefix: string) => {
    setOpenFiles((prev) => prev.filter((f) => !f.path.startsWith(pathPrefix)));
  }, []);

  // 清空所有文件
  const clearFiles = useCallback(() => {
    setOpenFiles([]);
    setActiveFileId(null);
  }, []);

  return {
    openFiles,
    setOpenFiles,
    activeFileId,
    setActiveFileId,
    activeFile,
    editorRef,
    openFile,
    closeFile,
    switchFile,
    updateFileContent,
    saveFile,
    saveUntitledFile,
    createNewFile,
    updateFilePath,
    closeFilesStartingWith,
    clearFiles,
    untitledCounterRef,
    setFileLanguage,
  };
}
