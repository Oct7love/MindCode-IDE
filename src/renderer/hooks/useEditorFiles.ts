/**
 * useEditorFiles — 编辑器文件操作的薄封装。
 * 权威状态在 useFileStore；此处只保留 Monaco editorRef。
 */
import { useCallback, useRef } from "react";
import { useFileStore, type EditorFile } from "../stores";

export function useEditorFiles(_workspaceRoot: string | null) {
  const openFiles = useFileStore((s) => s.openFiles);
  const activeFileId = useFileStore((s) => s.activeFileId);
  const setFileLanguage = useFileStore((s) => s.setFileLanguage);
  const editorRef = useRef<{ getValue: () => string; setValue: (v: string) => void } | null>(null);
  const untitledCounterRef = useRef(0);

  const activeFile = openFiles.find((f) => f.id === activeFileId);

  const openFile = useCallback(async (path: string, name: string) => {
    await useFileStore.getState().openFileByPath(path, name);
  }, []);

  const closeFile = useCallback(
    (id: string, opts?: { force?: boolean }): { closed: boolean; requiresConfirm: boolean } => {
      return useFileStore.getState().requestCloseFile(id, opts);
    },
    [],
  );

  const switchFile = useCallback((id: string) => {
    const store = useFileStore.getState();
    const file = store.openFiles.find((f) => f.id === id);
    if (file?.isPreview && store.activeFileId === id) {
      store.pinPreview(id);
      return;
    }
    store.setActiveFile(id);
  }, []);

  const updateFileContent = useCallback((content: string) => {
    useFileStore.getState().updateActiveFileContent(content);
  }, []);

  const saveFile = useCallback(async (content: string) => {
    const { activeFileId: id, openFiles: files, saveFileById } = useFileStore.getState();
    if (!id) return;
    const file = files.find((f) => f.id === id);
    if (!file) return;
    await saveFileById(file.id, file.path, content);
  }, []);

  const saveAllFiles = useCallback(async () => {
    await useFileStore.getState().saveAllDirty();
  }, []);

  const saveUntitledFile = useCallback(
    async (file: EditorFile, content: string, refreshTreeFn?: () => Promise<void>) => {
      useFileStore.getState().updateFileContent(file.id, content);
      const ok = await useFileStore.getState().saveFile(file.id);
      if (ok && refreshTreeFn) await refreshTreeFn();
      return ok;
    },
    [],
  );

  const createNewFile = useCallback(() => {
    untitledCounterRef.current += 1;
    return useFileStore.getState().createNewFile();
  }, []);

  const updateFilePath = useCallback((path: string, newPath: string, newName: string) => {
    useFileStore.getState().updateFilePathByPath(path, newPath, newName);
  }, []);

  const closeFilesStartingWith = useCallback((pathPrefix: string) => {
    useFileStore.getState().closeFilesStartingWith(pathPrefix);
  }, []);

  const clearFiles = useCallback(() => {
    useFileStore.getState().clearOpenFiles();
  }, []);

  const setActiveFileId = useCallback((id: string | null) => {
    useFileStore.getState().setActiveFile(id);
  }, []);

  const setOpenFiles = useCallback(
    (next: EditorFile[] | ((prev: EditorFile[]) => EditorFile[])) => {
      const prev = useFileStore.getState().openFiles;
      const openFilesNext = typeof next === "function" ? next(prev) : next;
      useFileStore.setState({ openFiles: openFilesNext });
    },
    [],
  );

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
