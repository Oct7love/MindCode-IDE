import React, { useState, useCallback, memo } from "react";
import { MarkdownRenderer } from "../MarkdownRenderer";
import { MultiFileChanges } from "./MultiFileChanges";
import { useMultiFileEdit } from "../../hooks/useMultiFileEdit";
import type { Message as StoreMessage } from "../../stores";
import { useAIStore } from "../../stores";
import "./MessageItem.css";

export interface Message extends StoreMessage {
  model?: string;
  status?: "complete" | "streaming" | "error" | "interrupted";
}
interface Props {
  message: Message;
  isStreaming?: boolean;
  onRetry?: () => void;
  onContinue?: () => void;
  onCopy?: () => void;
  onEdit?: (content: string) => void;
}

// 多文件编辑面板子组件（Hooks 不能条件调用，故抽离）
const FileChangesPanel: React.FC<{ message: Message }> = ({ message }) => {
  const updateMessageFileChanges = useAIStore((s) => s.updateMessageFileChanges);
  const [visible, setVisible] = useState(true);
  const { changes, isApplying, handleAccept, handleReject, handleAcceptAll, handleRejectAll } =
    useMultiFileEdit({
      messageId: message.id,
      initialChanges: message.fileChanges || [],
      onChangesUpdate: (next) => updateMessageFileChanges(message.id, next),
    });

  if (!visible || changes.length === 0) return null;
  return (
    <MultiFileChanges
      changes={changes}
      onAccept={handleAccept}
      onReject={handleReject}
      onAcceptAll={handleAcceptAll}
      onRejectAll={handleRejectAll}
      onClose={() => setVisible(false)}
      isApplying={isApplying}
    />
  );
};

export const MessageItem: React.FC<Props> = memo(
  ({ message, isStreaming, onRetry, onContinue, onCopy, onEdit }) => {
    const [showActions, setShowActions] = useState(false);
    const [copied, setCopied] = useState(false);
    const isUser = message.role === "user";
    const isError = message.status === "error" || message.content.startsWith("错误:");
    const isInterrupted =
      message.status === "interrupted" || message.content.includes("[已停止生成]");
    const hasFileChanges = !!(message.fileChanges && message.fileChanges.length > 0);

    const handleCopy = useCallback(async () => {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      onCopy?.();
    }, [message.content, onCopy]);

    const formatTime = (ts: Date) =>
      ts.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

    return (
      <div
        className={`chat-message chat-message--${message.role} ${isError ? "chat-message--error" : ""} ${isInterrupted ? "chat-message--interrupted" : ""}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        role="article"
        aria-label={`${isUser ? "用户" : "AI"}消息`}
      >
        <div className="chat-message__avatar">{isUser ? <UserIcon /> : <AIIcon />}</div>
        <div className="chat-message__body">
          <div className="chat-message__header">
            <span className="chat-message__role">{isUser ? "You" : "Assistant"}</span>
            <span className="chat-message__time">{formatTime(message.timestamp)}</span>
            {message.model && !isUser && (
              <span className="chat-message__model">{message.model}</span>
            )}
          </div>
          <div className="chat-message__content">
            <MarkdownRenderer
              content={message.content || ""}
              onApplyCode={(code) => navigator.clipboard.writeText(code)}
            />
            {isStreaming && <span className="chat-message__cursor">▌</span>}
          </div>
          {hasFileChanges && <FileChangesPanel message={message} />}
          {isError && (
            <div className="chat-message__status chat-message__status--error">
              <ErrorIcon /> <span>请求失败</span>
              {onRetry && (
                <button onClick={onRetry} className="chat-message__action-btn">
                  重试
                </button>
              )}
            </div>
          )}
          {isInterrupted && !isError && (
            <div className="chat-message__status chat-message__status--interrupted">
              <PauseIcon /> <span>已停止</span>
              {onContinue && (
                <button onClick={onContinue} className="chat-message__action-btn">
                  继续
                </button>
              )}
            </div>
          )}
        </div>
        {showActions && message.status !== "streaming" && (
          <div className="chat-message__actions">
            <button onClick={handleCopy} title="复制" className="chat-message__action-btn">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
            {!isUser && onRetry && (
              <button onClick={onRetry} title="重试" className="chat-message__action-btn">
                <RefreshIcon />
              </button>
            )}
            {isUser && onEdit && (
              <button
                onClick={() => onEdit(message.content)}
                title="编辑"
                className="chat-message__action-btn"
              >
                <EditIcon />
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);
const AIIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);
const CopyIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z" />
    <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z" />
  </svg>
);
const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M5.75 3a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75v-8.5a.75.75 0 00-.75-.75h-1.5zm4 0a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75v-8.5a.75.75 0 00-.75-.75h-1.5z" />
  </svg>
);
