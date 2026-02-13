import React, { useState, useCallback } from "react";
import { UnifiedChatView } from "./UnifiedChatView";
import { ConversationList } from "./ConversationList";
import { useAIStore } from "../../stores";
import { agentToolService } from "../../services/agentToolService";
import "./AIPanel.css";

interface AIPanelProps {
  onClose: () => void;
  width: number;
  isResizing?: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({ onClose, width, isResizing }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { createConversation, mode } = useAIStore();
  const [checkpointCount, setCheckpointCount] = useState(0);
  const [rollingBack, setRollingBack] = useState(false);

  // 定期检查检查点数量
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCheckpointCount(agentToolService.getCheckpoints().length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleRollbackAll = useCallback(async () => {
    setRollingBack(true);
    const results = await agentToolService.rollbackAll();
    const succeeded = results.filter((r) => r.success).length;
    setCheckpointCount(0);
    setRollingBack(false);
    if (succeeded > 0) {
      console.log(`[Agent] 回滚了 ${succeeded} 个文件修改`);
    }
  }, []);

  return (
    <div className="ai-panel" style={{ width }}>
      {/* Context Bar */}
      <div className="ai-ctx-bar">
        <div className="ai-ctx-bar-left">
          <svg
            className="ai-ctx-bar-icon"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="currentColor"
          >
            <path d="M8 1L9.3 5.7 14 7l-4.7 1.3L8 13l-1.3-4.7L2 7l4.7-1.3L8 1z" />
          </svg>
          <span className="ai-ctx-bar-label">AI</span>
        </div>
        <div className="ai-ctx-bar-actions">
          <button className="ai-ctx-btn" title="新建对话" onClick={createConversation}>
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <line x1="8" y1="3.5" x2="8" y2="12.5" />
              <line x1="3.5" y1="8" x2="12.5" y2="8" />
            </svg>
          </button>
          <button
            className={`ai-ctx-btn ${showHistory ? "active" : ""}`}
            title="历史对话"
            onClick={() => setShowHistory(!showHistory)}
          >
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="5" />
              <polyline points="8,5 8,8 10.5,9.5" />
            </svg>
          </button>
          <button className="ai-ctx-btn" title="关闭面板" onClick={onClose}>
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" />
              <line x1="11.5" y1="4.5" x2="4.5" y2="11.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Agent 检查点回滚指示器 */}
      {mode === "agent" && checkpointCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: "var(--vscode-editorWarning-background, rgba(255,200,0,0.08))",
            borderBottom: "1px solid var(--vscode-panel-border, #333)",
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--vscode-editorWarning-foreground, #cca700)" }}>
            ⚡ {checkpointCount} 个文件修改可回滚
          </span>
          <button
            onClick={handleRollbackAll}
            disabled={rollingBack}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "1px solid var(--vscode-editorWarning-foreground, #cca700)",
              color: "var(--vscode-editorWarning-foreground, #cca700)",
              padding: "1px 8px",
              borderRadius: 3,
              fontSize: 10,
              cursor: rollingBack ? "wait" : "pointer",
            }}
          >
            {rollingBack ? "回滚中..." : "全部回滚"}
          </button>
          <button
            onClick={() => {
              agentToolService
                .getCheckpoints()
                .forEach((cp) => agentToolService.confirmCheckpoint(cp.id));
              setCheckpointCount(0);
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--vscode-foreground, #666)",
              color: "var(--vscode-foreground, #888)",
              padding: "1px 8px",
              borderRadius: 3,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            确认全部
          </button>
        </div>
      )}

      <UnifiedChatView isResizing={isResizing} />
      <ConversationList isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
};
