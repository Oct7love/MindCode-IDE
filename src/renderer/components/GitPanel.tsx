import React, { useState, useEffect, useCallback } from "react";
import {
  reviewStagedFiles,
  fixIssue,
  type ReviewResult,
  type ReviewIssue,
} from "../services/codeReviewService";

interface GitFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted";
  staged: boolean;
}

interface GitPanelProps {
  workspacePath: string | null;
}

// 状态图标
const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    modified: "#e2c08d",
    added: "#89d185",
    deleted: "#f14c4c",
    renamed: "#4ec9b0",
    untracked: "#73c991",
    conflicted: "#f48771",
  };
  const labels: Record<string, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
    untracked: "U",
    conflicted: "!",
  };
  return (
    <span
      style={{
        color: colors[status] || "#888",
        fontWeight: 600,
        fontSize: 11,
        marginLeft: "auto",
        paddingRight: 8,
      }}
    >
      {labels[status] || "?"}
    </span>
  );
};

// AI 审查问题项
const ReviewIssueItem: React.FC<{ issue: ReviewIssue; onFix: () => void }> = ({ issue, onFix }) => {
  const sevColor =
    issue.severity === "error" ? "#f14c4c" : issue.severity === "warning" ? "#cca700" : "#3794ff";
  const sevIcon = issue.severity === "error" ? "●" : issue.severity === "warning" ? "▲" : "ℹ";
  const catLabel: Record<string, string> = {
    security: "安全",
    performance: "性能",
    style: "风格",
    bug: "缺陷",
    "best-practice": "规范",
  };

  return (
    <div
      style={{
        padding: "6px 8px",
        borderBottom: "1px solid var(--vscode-panel-border, #2a2a2a)",
        fontSize: 11,
        cursor: "pointer",
      }}
      title={`${issue.filePath}:${issue.line}\n${issue.description}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: sevColor, fontWeight: 600 }}>{sevIcon}</span>
        <span
          style={{
            color: "var(--vscode-foreground, #ccc)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {issue.title}
        </span>
        <span style={{ color: "var(--vscode-descriptionForeground, #666)", fontSize: 10 }}>
          {catLabel[issue.category] || issue.category}
        </span>
        {issue.fixable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFix();
            }}
            style={{
              background: "var(--vscode-button-background, #0078d4)",
              color: "#fff",
              border: "none",
              borderRadius: 2,
              padding: "1px 6px",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            修复
          </button>
        )}
      </div>
      <div
        style={{
          color: "var(--vscode-descriptionForeground, #666)",
          fontSize: 10,
          marginTop: 2,
          paddingLeft: 16,
        }}
      >
        {issue.filePath.split(/[/\\]/).pop()}:{issue.line}
        {issue.code && (
          <span style={{ marginLeft: 6, fontFamily: "monospace" }}>{issue.code.slice(0, 60)}</span>
        )}
      </div>
    </div>
  );
};

export const GitPanel: React.FC<GitPanelProps> = ({ workspacePath }) => {
  const [isRepo, setIsRepo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState("");
  const [stagedFiles, setStagedFiles] = useState<GitFile[]>([]);
  const [changedFiles, setChangedFiles] = useState<GitFile[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);

  // AI 代码审查状态
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);

  // 刷新 Git 状态
  const refreshStatus = useCallback(async () => {
    if (!workspacePath || !window.mindcode?.git) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 检查是否是 Git 仓库
      const repoResult = await window.mindcode.git.isRepo(workspacePath);
      if (!repoResult.success || !repoResult.data) {
        setIsRepo(false);
        setLoading(false);
        return;
      }
      setIsRepo(true);

      // 获取当前分支
      const branchResult = await window.mindcode.git.currentBranch(workspacePath);
      if (branchResult.success && branchResult.data) {
        setBranch(branchResult.data);
      }

      // 获取文件状态
      const statusResult = await window.mindcode.git.status(workspacePath);
      if (statusResult.success && statusResult.data) {
        const staged = statusResult.data.filter((f) => f.staged);
        const unstaged = statusResult.data.filter((f) => !f.staged);
        setStagedFiles(staged as GitFile[]);
        setChangedFiles(unstaged as GitFile[]);
      }
    } catch (err) {
      console.error("[GitPanel] Git status error:", err);
      setIsRepo(false);
    }
    setLoading(false);
  }, [workspacePath]);

  // 初始加载
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 暂存文件
  const stageFile = async (filePath: string) => {
    if (!workspacePath || !window.mindcode?.git) return;
    await window.mindcode.git.stage(workspacePath, [filePath]);
    refreshStatus();
  };

  // 暂存所有
  const stageAll = async () => {
    if (!workspacePath || !window.mindcode?.git) return;
    const paths = changedFiles.map((f) => f.path);
    if (paths.length > 0) {
      await window.mindcode.git.stage(workspacePath, paths);
      refreshStatus();
    }
  };

  // 取消暂存
  const unstageFile = async (filePath: string) => {
    if (!workspacePath || !window.mindcode?.git) return;
    await window.mindcode.git.unstage(workspacePath, [filePath]);
    refreshStatus();
  };

  // 取消暂存所有
  const unstageAll = async () => {
    if (!workspacePath || !window.mindcode?.git) return;
    const paths = stagedFiles.map((f) => f.path);
    if (paths.length > 0) {
      await window.mindcode.git.unstage(workspacePath, paths);
      refreshStatus();
    }
  };

  // 放弃修改
  const discardFile = async (filePath: string) => {
    if (!workspacePath || !window.mindcode?.git) return;
    // 使用原生 confirm（Electron 环境中可用）
    const confirmed = window.confirm(
      `确定要放弃对 ${filePath.split(/[/\\]/).pop()} 的修改吗？此操作不可撤销。`,
    );
    if (confirmed) {
      await window.mindcode.git.discard(workspacePath, filePath);
      refreshStatus();
    }
  };

  // 提交
  const commit = async () => {
    if (!workspacePath || !window.mindcode?.git || !commitMessage.trim()) return;
    setCommitting(true);
    try {
      const result = await window.mindcode.git.commit(workspacePath, commitMessage.trim());
      if (result.success) {
        setCommitMessage("");
        refreshStatus();
      } else {
        console.error("[Git] Commit failed:", result.error);
        window.mindcode?.dialog?.showMessageBox?.({
          type: "error",
          title: "提交失败",
          message: `Git 提交失败: ${result.error || "未知错误"}`,
        });
      }
    } catch (err: any) {
      console.error("[Git] Commit error:", err);
      window.mindcode?.dialog?.showMessageBox?.({
        type: "error",
        title: "提交失败",
        message: `Git 提交失败: ${err.message || "未知错误"}`,
      });
    }
    setCommitting(false);
  };

  // AI 代码审查
  const runReview = async () => {
    if (!workspacePath || stagedFiles.length === 0) return;
    setReviewing(true);
    setShowReview(true);
    try {
      const result = await reviewStagedFiles(workspacePath);
      setReviewResult(result);
    } catch (err: any) {
      console.error("[Review] 审查失败:", err);
      setReviewResult({
        issues: [],
        summary: { totalFiles: 0, totalIssues: 0, errors: 0, warnings: 0, infos: 0 },
        duration: 0,
      });
    }
    setReviewing(false);
  };

  // AI 生成提交信息（独家功能）
  const generateCommitMessage = async () => {
    if (!workspacePath || stagedFiles.length === 0 || !window.mindcode?.ai?.chat) return;
    setGeneratingMessage(true);
    try {
      // 收集所有暂存文件的 diff
      const diffs: string[] = [];
      for (const file of stagedFiles.slice(0, 8)) {
        // 最多 8 个文件
        if (file.status === "deleted") {
          diffs.push(`--- ${file.path} (deleted)`);
          continue;
        }
        const diffResult = await window.mindcode?.git?.diff?.(workspacePath, file.path, true);
        if (diffResult?.success && diffResult.data) {
          const d = typeof diffResult.data === "string" ? diffResult.data : "";
          diffs.push(`--- ${file.path} ---\n${d.slice(0, 800)}`);
        }
      }

      const diffSummary = diffs.join("\n\n");
      const prompt = `根据以下 Git diff，生成一条简洁的提交信息（中文或英文均可，取决于代码内容语言）。
格式要求：一行标题（50字以内），不需要正文。直接返回提交信息文本，不要任何解释。

修改的文件: ${stagedFiles.map((f) => f.path).join(", ")}

Diff:
${diffSummary.slice(0, 3000)}`;

      const result = await window.mindcode.ai.chat("claude-haiku-4-5-20251001", [
        { role: "user", content: prompt },
      ]);
      if (result?.success && result.data) {
        const msg = result.data
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/^提交信息[:：]\s*/i, "");
        setCommitMessage(msg);
      }
    } catch (e: any) {
      console.warn("[Git] AI 生成提交信息失败:", e);
      setCommitMessage(""); // 清空，让用户手动输入
    }
    setGeneratingMessage(false);
  };

  // 一键修复
  const handleFix = async (issue: ReviewIssue) => {
    if (!workspacePath) return;
    const result = await fixIssue(workspacePath, issue);
    if (result.success) {
      // 刷新审查结果
      setReviewResult((prev) =>
        prev
          ? {
              ...prev,
              issues: prev.issues.filter((i) => i.id !== issue.id),
              summary: {
                ...prev.summary,
                totalIssues: prev.summary.totalIssues - 1,
                errors: prev.summary.errors - (issue.severity === "error" ? 1 : 0),
                warnings: prev.summary.warnings - (issue.severity === "warning" ? 1 : 0),
                infos: prev.summary.infos - (issue.severity === "info" ? 1 : 0),
              },
            }
          : null,
      );
      refreshStatus();
    }
  };

  if (loading) {
    return (
      <div className="git-panel">
        <div className="git-loading">加载中...</div>
      </div>
    );
  }

  if (!workspacePath) {
    return (
      <div className="git-panel">
        <div className="git-empty">请先打开一个文件夹</div>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div className="git-panel">
        <div className="git-empty">
          <p>当前文件夹不是 Git 仓库</p>
          <button
            className="git-init-btn"
            onClick={async () => {
              if (window.mindcode?.terminal) {
                await window.mindcode.terminal.execute("git init", workspacePath);
                refreshStatus();
              }
            }}
          >
            初始化仓库
          </button>
        </div>
      </div>
    );
  }

  const totalChanges = stagedFiles.length + changedFiles.length;

  return (
    <div className="git-panel">
      {/* 分支信息 */}
      <div className="git-branch">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" />
        </svg>
        <span>{branch || "main"}</span>
        <button className="git-refresh-btn" onClick={refreshStatus} title="刷新">
          ↻
        </button>
      </div>

      {/* 提交输入框 */}
      <div className="git-commit-box">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="text"
            className="git-commit-input"
            placeholder={generatingMessage ? "AI 正在生成提交信息..." : "提交信息"}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            style={{ flex: 1 }}
          />
          <button
            onClick={generateCommitMessage}
            disabled={generatingMessage || stagedFiles.length === 0}
            title="AI 生成提交信息"
            style={{
              background: "transparent",
              border: "1px solid var(--vscode-button-secondaryBackground, #3a3a3a)",
              color: "var(--vscode-foreground, #ccc)",
              cursor: stagedFiles.length === 0 ? "not-allowed" : "pointer",
              padding: "4px 6px",
              borderRadius: 3,
              fontSize: 11,
              whiteSpace: "nowrap",
              opacity: stagedFiles.length === 0 ? 0.5 : 1,
            }}
          >
            {generatingMessage ? "..." : "✨"}
          </button>
        </div>
        <button
          className="git-review-btn"
          onClick={runReview}
          disabled={reviewing || stagedFiles.length === 0}
          title="AI 审查暂存的更改"
          style={{
            background: "transparent",
            border: "1px solid var(--vscode-button-secondaryBackground, #3a3a3a)",
            color: "var(--vscode-foreground, #ccc)",
            cursor: stagedFiles.length === 0 ? "not-allowed" : "pointer",
            padding: "4px 8px",
            borderRadius: 3,
            fontSize: 12,
            opacity: stagedFiles.length === 0 ? 0.5 : 1,
          }}
        >
          {reviewing ? "审查中..." : "🔍 AI 审查"}
        </button>
        <button
          className="git-commit-btn"
          onClick={commit}
          disabled={committing || !commitMessage.trim() || stagedFiles.length === 0}
          title={stagedFiles.length === 0 ? "没有暂存的更改" : "提交"}
        >
          {committing ? "..." : "✓"}
        </button>
      </div>

      {/* 暂存的更改 */}
      {stagedFiles.length > 0 && (
        <div className="git-section">
          <div className="git-section-header">
            <span>暂存的更改</span>
            <span className="git-count">{stagedFiles.length}</span>
            <button className="git-action-btn" onClick={unstageAll} title="取消全部暂存">
              −
            </button>
          </div>
          <div className="git-file-list">
            {stagedFiles.map((file) => (
              <div key={file.path} className="git-file-item">
                <span className="git-file-name" title={file.path}>
                  {file.path.split(/[/\\]/).pop()}
                </span>
                <StatusIcon status={file.status} />
                <button
                  className="git-file-action"
                  onClick={() => unstageFile(file.path)}
                  title="取消暂存"
                >
                  −
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 更改 */}
      {changedFiles.length > 0 && (
        <div className="git-section">
          <div className="git-section-header">
            <span>更改</span>
            <span className="git-count">{changedFiles.length}</span>
            <button className="git-action-btn" onClick={stageAll} title="暂存全部">
              +
            </button>
          </div>
          <div className="git-file-list">
            {changedFiles.map((file) => (
              <div key={file.path} className="git-file-item">
                <span className="git-file-name" title={file.path}>
                  {file.path.split(/[/\\]/).pop()}
                </span>
                <StatusIcon status={file.status} />
                <button
                  className="git-file-action"
                  onClick={() => stageFile(file.path)}
                  title="暂存"
                >
                  +
                </button>
                {file.status !== "untracked" && (
                  <button
                    className="git-file-action"
                    onClick={() => discardFile(file.path)}
                    title="放弃更改"
                  >
                    ↩
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 无更改 */}
      {totalChanges === 0 && <div className="git-empty">没有更改</div>}

      {/* AI 代码审查结果 */}
      {showReview && (
        <div
          className="git-review-panel"
          style={{
            borderTop: "1px solid var(--vscode-panel-border, #333)",
            marginTop: 8,
            paddingTop: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 8px",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--vscode-foreground, #ccc)",
              }}
            >
              AI 代码审查
            </span>
            <button
              onClick={() => setShowReview(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--vscode-foreground, #888)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>

          {reviewing && (
            <div
              style={{
                padding: "12px 8px",
                fontSize: 12,
                color: "var(--vscode-descriptionForeground, #888)",
                textAlign: "center",
              }}
            >
              <div style={{ marginBottom: 4 }}>正在分析暂存的更改...</div>
              <div
                style={{
                  width: "60%",
                  height: 3,
                  background: "var(--vscode-progressBar-background, #333)",
                  borderRadius: 2,
                  margin: "0 auto",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "60%",
                    height: "100%",
                    background: "var(--vscode-progressBar-foreground, #0078d4)",
                    borderRadius: 2,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}

          {!reviewing && reviewResult && (
            <>
              {/* 审查摘要 */}
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  display: "flex",
                  gap: 8,
                  color: "var(--vscode-descriptionForeground, #888)",
                }}
              >
                <span>{reviewResult.summary.totalFiles} 文件</span>
                {reviewResult.summary.errors > 0 && (
                  <span style={{ color: "#f14c4c" }}>● {reviewResult.summary.errors} 错误</span>
                )}
                {reviewResult.summary.warnings > 0 && (
                  <span style={{ color: "#cca700" }}>● {reviewResult.summary.warnings} 警告</span>
                )}
                {reviewResult.summary.infos > 0 && (
                  <span style={{ color: "#3794ff" }}>● {reviewResult.summary.infos} 提示</span>
                )}
                <span style={{ marginLeft: "auto" }}>{reviewResult.duration}ms</span>
              </div>

              {/* 问题列表 */}
              {reviewResult.issues.length === 0 ? (
                <div
                  style={{
                    padding: "12px 8px",
                    fontSize: 12,
                    textAlign: "center",
                    color: "#89d185",
                  }}
                >
                  ✓ 未发现问题，可以放心提交！
                </div>
              ) : (
                <div style={{ maxHeight: 200, overflow: "auto" }}>
                  {reviewResult.issues.map((issue) => (
                    <ReviewIssueItem key={issue.id} issue={issue} onFix={() => handleFix(issue)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GitPanel;
