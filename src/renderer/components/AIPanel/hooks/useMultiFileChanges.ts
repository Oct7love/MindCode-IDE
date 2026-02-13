/**
 * useMultiFileChanges - 多文件变更管理 Hook
 *
 * 管理 Agent 模式的多文件变更流程
 */
import { useState, useCallback } from "react";
import type { FileChange } from "../MultiFileChanges";
import { useFileStore } from "../../../stores";

interface UseMultiFileChangesReturn {
  /** 变更列表 */
  changes: FileChange[];
  /** 是否有待处理的变更 */
  hasPendingChanges: boolean;
  /** 是否正在应用 */
  isApplying: boolean;
  /** 添加变更 */
  addChange: (change: Omit<FileChange, "id" | "status" | "additions" | "deletions">) => void;
  /** 添加多个变更 */
  addChanges: (changes: Omit<FileChange, "id" | "status" | "additions" | "deletions">[]) => void;
  /** 接受单个变更 */
  acceptChange: (id: string) => Promise<boolean>;
  /** 拒绝单个变更 */
  rejectChange: (id: string) => void;
  /** 全部接受 */
  acceptAll: () => Promise<boolean>;
  /** 全部拒绝 */
  rejectAll: () => void;
  /** 清除所有变更 */
  clearChanges: () => void;
  /** 错误信息 */
  error: string | null;
}

// 计算 additions 和 deletions
function calculateStats(
  original: string,
  modified: string,
): { additions: number; deletions: number } {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");

  let additions = 0;
  let deletions = 0;

  const maxLen = Math.max(originalLines.length, modifiedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = originalLines[i];
    const mod = modifiedLines[i];

    if (orig === undefined && mod !== undefined) {
      additions++;
    } else if (orig !== undefined && mod === undefined) {
      deletions++;
    } else if (orig !== mod) {
      additions++;
      deletions++;
    }
  }

  return { additions, deletions };
}

export function useMultiFileChanges(): UseMultiFileChangesReturn {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { workspaceRoot, openPreviewFile } = useFileStore();

  const hasPendingChanges = changes.some((c) => c.status === "pending");

  // 添加单个变更
  const addChange = useCallback(
    (change: Omit<FileChange, "id" | "status" | "additions" | "deletions">) => {
      const stats = calculateStats(change.originalContent, change.newContent);
      const newChange: FileChange = {
        ...change,
        id: `change_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "pending",
        additions: stats.additions,
        deletions: stats.deletions,
      };
      setChanges((prev) => [...prev, newChange]);
    },
    [],
  );

  // 添加多个变更
  const addChanges = useCallback(
    (newChanges: Omit<FileChange, "id" | "status" | "additions" | "deletions">[]) => {
      const fullChanges: FileChange[] = newChanges.map((change) => {
        const stats = calculateStats(change.originalContent, change.newContent);
        return {
          ...change,
          id: `change_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: "pending" as const,
          additions: stats.additions,
          deletions: stats.deletions,
        };
      });
      setChanges((prev) => [...prev, ...fullChanges]);
    },
    [],
  );

  // 接受单个变更
  const acceptChange = useCallback(
    async (id: string): Promise<boolean> => {
      const change = changes.find((c) => c.id === id);
      if (!change) return false;

      setIsApplying(true);
      setError(null);

      try {
        const fullPath =
          change.filePath.startsWith("/") || change.filePath.match(/^[a-zA-Z]:/)
            ? change.filePath
            : workspaceRoot
              ? `${workspaceRoot}/${change.filePath}`
              : change.filePath;

        // 写入文件
        if (window.mindcode?.fs?.writeFile) {
          const result = await window.mindcode.fs.writeFile(fullPath, change.newContent);
          if (!result.success) {
            throw new Error(result.error || "写入失败");
          }
        }

        // 打开预览
        openPreviewFile(fullPath, change.newContent, "ai", change.language);

        // 更新状态
        setChanges((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "accepted" as const } : c)),
        );

        return true;
      } catch (err: any) {
        setError(err.message || "应用变更失败");
        return false;
      } finally {
        setIsApplying(false);
      }
    },
    [changes, workspaceRoot, openPreviewFile],
  );

  // 拒绝单个变更
  const rejectChange = useCallback((id: string) => {
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "rejected" as const } : c)),
    );
  }, []);

  // 全部接受
  const acceptAll = useCallback(async (): Promise<boolean> => {
    const pendingChanges = changes.filter((c) => c.status === "pending");
    if (pendingChanges.length === 0) return true;

    setIsApplying(true);
    setError(null);

    try {
      for (const change of pendingChanges) {
        const fullPath =
          change.filePath.startsWith("/") || change.filePath.match(/^[a-zA-Z]:/)
            ? change.filePath
            : workspaceRoot
              ? `${workspaceRoot}/${change.filePath}`
              : change.filePath;

        if (window.mindcode?.fs?.writeFile) {
          const result = await window.mindcode.fs.writeFile(fullPath, change.newContent);
          if (!result.success) {
            throw new Error(`${change.filePath}: ${result.error || "写入失败"}`);
          }
        }
      }

      // 更新所有为 accepted
      setChanges((prev) =>
        prev.map((c) => (c.status === "pending" ? { ...c, status: "accepted" as const } : c)),
      );

      return true;
    } catch (err: any) {
      setError(err.message || "批量应用失败");
      return false;
    } finally {
      setIsApplying(false);
    }
  }, [changes, workspaceRoot]);

  // 全部拒绝
  const rejectAll = useCallback(() => {
    setChanges((prev) =>
      prev.map((c) => (c.status === "pending" ? { ...c, status: "rejected" as const } : c)),
    );
  }, []);

  // 清除所有变更
  const clearChanges = useCallback(() => {
    setChanges([]);
    setError(null);
  }, []);

  return {
    changes,
    hasPendingChanges,
    isApplying,
    addChange,
    addChanges,
    acceptChange,
    rejectChange,
    acceptAll,
    rejectAll,
    clearChanges,
    error,
  };
}

export default useMultiFileChanges;
