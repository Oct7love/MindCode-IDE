/**
 * 把 EditorAutoSave 接到 FileStore：编辑调度、关 tab 取消、工作区切换清空。
 */
import { useEffect, useRef } from "react";
import { EditorAutoSave } from "../services/editorAutoSave";
import { useFileStore } from "../stores/useFileStore";

const DEFAULT_DELAY_MS = 1000;

export function useEditorAutoSave(enabled = true, delayMs = DEFAULT_DELAY_MS): void {
  const svcRef = useRef<EditorAutoSave | null>(null);
  if (!svcRef.current) {
    svcRef.current = new EditorAutoSave({
      delayMs,
      isEnabled: () => enabled,
      getFile: (fileId) => {
        const f = useFileStore.getState().openFiles.find((x) => x.id === fileId);
        if (!f) return undefined;
        return {
          path: f.path,
          content: f.content,
          generation: f.generation ?? 0,
          isUntitled: f.isUntitled,
          isPreview: f.isPreview,
        };
      },
      save: (fileId, path, content) => useFileStore.getState().saveFileById(fileId, path, content),
    });
  }

  const openFiles = useFileStore((s) => s.openFiles);
  const workspaceRoot = useFileStore((s) => s.workspaceRoot);

  useEffect(() => {
    const svc = svcRef.current!;
    const liveIds = new Set(openFiles.map((f) => f.id));
    for (const f of openFiles) {
      if (f.isDirty && !f.isUntitled && !f.isPreview) {
        svc.noteEdit({
          fileId: f.id,
          path: f.path,
          content: f.content,
          generation: f.generation ?? 0,
        });
      } else {
        svc.cancel(f.id);
      }
    }
    return () => {
      for (const id of liveIds) {
        if (!useFileStore.getState().openFiles.some((f) => f.id === id)) {
          svc.cancel(id);
        }
      }
    };
  }, [openFiles]);

  useEffect(() => {
    return () => {
      svcRef.current?.cancelAll();
    };
  }, [workspaceRoot]);
}
