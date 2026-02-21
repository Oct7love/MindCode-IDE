/**
 * 多文件编辑操作 Hook
 * 管理 FileChange[] 状态，提供接受/拒绝/批量操作
 */
import { useState, useCallback } from "react";
import type { FileChange } from "../components/AIPanel/MultiFileChanges";
import { useAIStore } from "../stores";

interface UseMultiFileEditOptions {
  messageId?: string;
  initialChanges: FileChange[];
  onChangesUpdate?: (changes: FileChange[]) => void;
}

export function useMultiFileEdit({
  messageId,
  initialChanges,
  onChangesUpdate,
}: UseMultiFileEditOptions) {
  const [changes, setChanges] = useState<FileChange[]>(initialChanges);
  const [isApplying, setIsApplying] = useState(false);
  const addPendingChange = useAIStore((s) => s.addPendingChange);

  const updateChanges = useCallback(
    (updater: (prev: FileChange[]) => FileChange[]) => {
      setChanges((prev) => {
        const next = updater(prev);
        onChangesUpdate?.(next);
        return next;
      });
    },
    [onChangesUpdate],
  );

  const handleAccept = useCallback(
    async (id: string) => {
      const change = changes.find((c) => c.id === id);
      if (!change || change.status !== "pending") return;

      setIsApplying(true);
      try {
        await window.mindcode?.fs?.writeFile?.(change.filePath, change.newContent);
        updateChanges((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "accepted" as const } : c)),
        );
        addPendingChange({
          path: change.filePath,
          oldContent: change.originalContent,
          newContent: change.newContent,
          messageId,
        });
      } catch (err) {
        console.error("[MultiFileEdit] 写入文件失败:", change.filePath, err);
      } finally {
        setIsApplying(false);
      }
    },
    [changes, messageId, addPendingChange, updateChanges],
  );

  const handleReject = useCallback(
    (id: string) => {
      updateChanges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "rejected" as const } : c)),
      );
    },
    [updateChanges],
  );

  const handleAcceptAll = useCallback(async () => {
    setIsApplying(true);
    const pending = changes.filter((c) => c.status === "pending");
    for (const change of pending) {
      try {
        await window.mindcode?.fs?.writeFile?.(change.filePath, change.newContent);
        addPendingChange({
          path: change.filePath,
          oldContent: change.originalContent,
          newContent: change.newContent,
          messageId,
        });
      } catch (err) {
        console.error("[MultiFileEdit] 批量写入失败:", change.filePath, err);
      }
    }
    updateChanges((prev) =>
      prev.map((c) => (c.status === "pending" ? { ...c, status: "accepted" as const } : c)),
    );
    setIsApplying(false);
  }, [changes, messageId, addPendingChange, updateChanges]);

  const handleRejectAll = useCallback(() => {
    updateChanges((prev) =>
      prev.map((c) => (c.status === "pending" ? { ...c, status: "rejected" as const } : c)),
    );
  }, [updateChanges]);

  return {
    changes,
    isApplying,
    handleAccept,
    handleReject,
    handleAcceptAll,
    handleRejectAll,
  };
}
