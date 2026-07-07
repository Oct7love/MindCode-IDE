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
  // 单调递增计数器，保证同一毫秒连续 openFile 也不会产生重复 id（Date.now 可碰撞）。
  const fileIdCounterRef = useRef(0);
  // 每个文件的「已保存基线内容」(id -> content)，用于按内容比较计算 dirty，
  // 而非零散布尔标志：改回原样即不脏，保存后基线更新。
  const lastSavedContentRef = useRef<Map<string, string>>(new Map());

  const nextFileId = useCallback(() => {
    fileIdCounterRef.current += 1;
    return `f-${Date.now()}-${fileIdCounterRef.current}`;
  }, []);

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
        id: nextFileId(),
        path,
        name,
        content,
        isDirty: false,
      };
      lastSavedContentRef.current.set(newFile.id, content);

      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(newFile.id);
    },
    [openFiles, nextFileId],
  );

  // 关闭文件。
  // 返回 { closed, requiresConfirm }：对有未保存改动的文件，默认【不】立即关闭，而是
  // 返回 requiresConfirm=true 交由调用方确认（防止静默丢弃）；opts.force=true 可强制关闭。
  const closeFile = useCallback(
    (id: string, opts?: { force?: boolean }): { closed: boolean; requiresConfirm: boolean } => {
      const target = openFiles.find((f) => f.id === id);
      if (target?.isDirty && !opts?.force) {
        return { closed: false, requiresConfirm: true };
      }
      lastSavedContentRef.current.delete(id);
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
      return { closed: true, requiresConfirm: false };
    },
    [activeFileId, openFiles],
  );

  // 切换活动文件
  const switchFile = useCallback((id: string) => {
    setActiveFileId(id);
  }, []);

  // 更新文件内容。dirty 由「内容 !== 已保存基线」推导，改回原样即不脏。
  const updateFileContent = useCallback(
    (content: string) => {
      if (!activeFileId) return;
      const baseline = lastSavedContentRef.current.get(activeFileId) ?? "";
      const dirty = content !== baseline;
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content, isDirty: dirty } : f)),
      );
    },
    [activeFileId],
  );

  // 保存单个文件（内部）：按显式 fileId + path 写盘，成功后更新基线并清 dirty。
  // 显式传 fileId/path 而非依赖闭包里的 activeFileId，避免「保存误存到别的 tab」。
  const saveFileById = useCallback(
    async (fileId: string, path: string, content: string): Promise<boolean> => {
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
        lastSavedContentRef.current.set(fileId, content);
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, content, isDirty: false } : f)),
        );
      }
      return ok;
    },
    [],
  );

  // 保存当前活动文件
  const saveFile = useCallback(
    async (content: string) => {
      if (!activeFileId) return;
      const file = openFiles.find((f) => f.id === activeFileId);
      if (!file) return;
      await saveFileById(file.id, file.path, content);
    },
    [activeFileId, openFiles, saveFileById],
  );

  // 保存全部：只写有未保存改动（isDirty）的文件，未命名文件跳过（需走另存对话框）。
  const saveAllFiles = useCallback(async () => {
    const dirtyFiles = openFiles.filter((f) => f.isDirty && !f.isUntitled);
    for (const f of dirtyFiles) {
      await saveFileById(f.id, f.path, f.content);
    }
  }, [openFiles, saveFileById]);

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
          lastSavedContentRef.current.set(file.id, content);
          setOpenFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    path: result.filePath!,
                    name: newName,
                    content,
                    isDirty: false,
                    isUntitled: false,
                  }
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
    const newFileId = nextFileId();
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
    lastSavedContentRef.current.set(newFileId, "");
    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    return newFileId;
  }, [nextFileId]);

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
    saveAllFiles,
    saveUntitledFile,
    createNewFile,
    updateFilePath,
    closeFilesStartingWith,
    clearFiles,
    untitledCounterRef,
    setFileLanguage,
  };
}
