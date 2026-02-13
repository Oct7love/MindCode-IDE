/**
 * AssistantMessage - AI 消息卡片 (增强版)
 * Cursor 风格的高级 IDE 消息组件
 *
 * 特性:
 * - 卡片式设计，带微妙边框和阴影
 * - hover 显示操作栏 (复制/引用/重试)
 * - 右键菜单支持多种复制格式
 * - 快捷键支持 (Ctrl/Cmd+C)
 * - 流式输出时末尾闪烁光标
 * - 工具调用块渲染
 * - Plan 卡片渲染
 * - Thinking UI 支持
 */
import React, { memo, useState, useCallback, useRef, useEffect } from "react";
import { MarkdownRenderer, getLanguageFromPath } from "../MarkdownRenderer";
import type { ToolStatus } from "./ToolBlock";
import { ToolBlock } from "./ToolBlock";
import { ThinkingBlock } from "./ThinkingBlock";
import { ThinkingUI } from "./ThinkingUI";
import { MessageActions } from "./MessageActions";
import type { ContextMenuPosition } from "./MessageContextMenu";
import { MessageContextMenu } from "./MessageContextMenu";
import { CopyFeedback } from "./CopyFeedback";
import type { ThinkingUIData, AIMode } from "../../stores";
import { useFileStore } from "../../stores";
import { cleanCodeForApply, detectFilePath, getExtensionForLanguage } from "./utils/applyService";
import "./AssistantMessage.css";
import "./MessageContextMenu.css";

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  mode?: AIMode;
  toolCalls?: any[];
  plan?: any;
  isStreaming?: boolean;
  thinkingUI?: ThinkingUIData; // Thinking UI 结构化数据
}

interface AssistantMessageProps {
  message: Message;
  isLast: boolean;
  /** 思考过程文本（仅流式时传入） */
  thinkingText?: string;
  /** 是否正在思考 */
  isThinking?: boolean;
  /** 流式 Thinking UI 数据（仅流式时传入） */
  streamingThinkingUI?: Partial<ThinkingUIData>;
  /** Thinking UI 开始时间 */
  thinkingUIStartTime?: number | null;
  onCopy?: (content: string) => void;
  onCopyTool?: (content: string) => void;
  onRetry?: (messageId: string) => void;
  /** 全局复制成功回调 (用于显示 Toast) */
  onCopySuccess?: (format: string) => void;
  /** 全局复制失败回调 */
  onCopyError?: (error: string) => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = memo(
  ({
    message,
    isLast,
    thinkingText,
    isThinking = false,
    streamingThinkingUI,
    thinkingUIStartTime,
    onCopy,
    onCopyTool,
    onRetry,
    onCopySuccess,
    onCopyError,
  }) => {
    // 所有 useState 放在最前面，顺序固定
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
      isOpen: boolean;
      position: ContextMenuPosition;
    }>({ isOpen: false, position: { x: 0, y: 0 } });
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [isApplying, setIsApplying] = useState(false);

    const messageRef = useRef<HTMLDivElement>(null);

    // useFileStore 只调用一次，获取所有需要的方法
    const {
      workspaceRoot,
      openFile,
      updateFileContent,
      getActiveFile,
      openFiles,
      openPreviewFile,
    } = useFileStore();

    const hasError = message.content.startsWith("错误:") || message.content.startsWith("Error:");
    const wasInterrupted = message.content.includes("[已停止]");

    // Apply 代码回调 - 流式输出中也可应用（超越 Cursor 的体验）
    const handleApplyCode = useCallback(
      async (code: string, language: string) => {
        console.log("[ApplyCode] Starting apply, language:", language);
        setIsApplying(true);

        try {
          // 1. 清理代码
          const cleanedCode = cleanCodeForApply(code);

          // 2. 检测文件路径
          let targetPath = detectFilePath(code, language, message.content);
          console.log("[ApplyCode] Detected path:", targetPath);

          // 3. 如果没有路径，尝试使用当前活动文件
          if (!targetPath) {
            const activeFile = getActiveFile();
            if (activeFile && !activeFile.path.includes("[Preview]")) {
              targetPath = activeFile.path;
              console.log("[ApplyCode] Using active file:", targetPath);
            }
          }

          // 4. 如果还是没有，生成新文件路径
          if (!targetPath) {
            const ext = getExtensionForLanguage(language);
            targetPath = `untitled-${Date.now()}.${ext}`;
            console.log("[ApplyCode] Generated new path:", targetPath);
          }

          const fileName = targetPath.split(/[/\\]/).pop() || "untitled";

          // 5. 如果有工作区，尝试写入文件
          if (workspaceRoot && window.mindcode?.fs?.writeFile) {
            // 构建完整路径
            const fullPath =
              targetPath.startsWith("/") || targetPath.match(/^[a-zA-Z]:/)
                ? targetPath
                : `${workspaceRoot}/${targetPath}`;

            console.log("[ApplyCode] Writing to:", fullPath);
            const result = await window.mindcode.fs.writeFile(fullPath, cleanedCode);

            if (result.success) {
              // 检查文件是否已打开
              const existingFile = openFiles.find((f) => f.path === fullPath);
              if (existingFile) {
                updateFileContent(existingFile.id, cleanedCode);
              }

              openFile({
                id: existingFile?.id || `file_${Date.now()}`,
                path: fullPath,
                name: fileName,
                content: cleanedCode,
                language: language,
                isDirty: false,
              });

              setFeedbackMessage(`已应用到 ${fileName}`);
              setShowFeedback(true);
              console.log("[ApplyCode] Applied to file:", fullPath);
              return;
            } else {
              console.warn("[ApplyCode] Write failed:", result.error);
            }
          }

          // 6. 没有工作区或写入失败，使用预览模式打开
          console.log("[ApplyCode] Using preview mode");
          openPreviewFile(targetPath, cleanedCode, "ai", language);

          setFeedbackMessage(`已在编辑器中打开`);
          setShowFeedback(true);
        } catch (err: any) {
          console.error("[ApplyCode] Error:", err);
          setFeedbackMessage("应用失败: " + (err.message || "未知错误"));
          setShowFeedback(true);
        } finally {
          setIsApplying(false);
        }
      },
      [
        message.isStreaming,
        message.content,
        workspaceRoot,
        getActiveFile,
        openFile,
        openFiles,
        updateFileContent,
        openPreviewFile,
      ],
    );

    // 点击代码预览 - 在编辑器中显示代码（不写入文件）
    const handlePreviewCode = useCallback(
      (code: string, language: string) => {
        // 流式输出时不允许预览
        if (message.isStreaming) {
          console.log("[PreviewCode] Blocked during streaming");
          return;
        }

        console.log("[PreviewCode] Opening preview, language:", language);

        // 清理代码
        const cleanedCode = cleanCodeForApply(code);

        // 生成预览文件名
        const ext = getExtensionForLanguage(language);
        const previewPath = `preview-${Date.now()}.${ext}`;

        // 使用预览模式打开
        openPreviewFile(previewPath, cleanedCode, "ai", language);

        setFeedbackMessage("已在编辑器中预览");
        setShowFeedback(true);
      },
      [message.isStreaming, openPreviewFile],
    );

    // 右键菜单处理
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      // 如果用户选中了文本，不劫持默认行为
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      e.preventDefault();
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
      });
    }, []);

    // 关闭右键菜单
    const handleCloseContextMenu = useCallback(() => {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    }, []);

    // 复制成功处理
    const handleCopySuccess = useCallback(
      (format: string) => {
        setFeedbackMessage(`已复制 ${format} 到剪贴板`);
        setShowFeedback(true);
        onCopySuccess?.(format);
        onCopy?.(message.content);
      },
      [message.content, onCopy, onCopySuccess],
    );

    // 复制失败处理
    const handleCopyError = useCallback(
      (error: string) => {
        setFeedbackMessage("复制失败");
        setShowFeedback(true);
        onCopyError?.(error);
      },
      [onCopyError],
    );

    // 隐藏反馈
    const handleHideFeedback = useCallback(() => {
      setShowFeedback(false);
    }, []);

    // Phase 2: 在编辑器中打开代码预览
    const handleOpenInEditor = useCallback(
      (code: string, language: string, filename?: string) => {
        // 根据语言推断文件扩展名
        const extMap: Record<string, string> = {
          typescript: "ts",
          javascript: "js",
          python: "py",
          java: "java",
          go: "go",
          rust: "rs",
          c: "c",
          cpp: "cpp",
          css: "css",
          html: "html",
          json: "json",
          yaml: "yml",
          bash: "sh",
          sql: "sql",
          text: "txt",
        };
        const ext = extMap[language.toLowerCase()] || "txt";
        const path = filename || `untitled-${Date.now()}.${ext}`;
        openPreviewFile(path, code, "ai", language);
      },
      [openPreviewFile],
    );

    // 快捷键处理
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // 只在当前消息被 hover 或 focus 时响应
        if (!isHovered && !isFocused) return;

        // 如果用户选中了文本，不劫持
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          return;
        }

        // 如果是流式输出中，不响应
        if (message.isStreaming) return;

        const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        const modKey = isMac ? e.metaKey : e.ctrlKey;

        // Ctrl/Cmd + C
        if (modKey && e.key === "c") {
          e.preventDefault();
          // 导入并使用 copyService
          import("./utils/copyService").then(({ copyMessage }) => {
            const format = e.shiftKey ? "plaintext" : "markdown";
            copyMessage(message.content, format).then((result) => {
              if (result.success) {
                handleCopySuccess(e.shiftKey ? "Plain Text" : "Markdown");
              } else {
                handleCopyError(result.error || "Copy failed");
              }
            });
          });
        }
      };

      if (isHovered || isFocused) {
        document.addEventListener("keydown", handleKeyDown);
      }

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [
      isHovered,
      isFocused,
      message.content,
      message.isStreaming,
      handleCopySuccess,
      handleCopyError,
    ]);

    return (
      <div
        ref={messageRef}
        className={`assistant-message group ${message.isStreaming ? "streaming" : ""} ${hasError ? "error" : ""} ${wasInterrupted ? "interrupted" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onContextMenu={handleContextMenu}
        tabIndex={0}
        role="article"
        aria-label="AI 消息"
      >
        {/* 角色标签 */}
        <div className="message-role-label">
          <span className="message-role-ai">✦ Assistant</span>
        </div>

        {/* 消息体 */}
        <div className="message-body">
          {/* Thinking UI 模式：使用结构化 UI */}
          {message.thinkingUI || streamingThinkingUI ? (
            <ThinkingUI
              data={message.thinkingUI || streamingThinkingUI || {}}
              isStreaming={message.isStreaming}
              startTime={thinkingUIStartTime || undefined}
              renderMarkdown={(content) => (
                <MarkdownRenderer content={content} onOpenInEditor={handleOpenInEditor} />
              )}
            />
          ) : (
            <>
              {/* 传统模式：思考过程块 - 流式时用 thinkingText，完成后用 message.thinkingContent */}
              {(thinkingText || isThinking || (message as any).thinkingContent) && (
                <ThinkingBlock
                  content={thinkingText || (message as any).thinkingContent || ""}
                  isThinking={isThinking}
                />
              )}

              {/* 内容卡片 */}
              <div className="message-card">
                <div className="message-content">
                  <MarkdownRenderer
                    content={message.content}
                    onOpenInEditor={handleOpenInEditor}
                    onApplyCode={handleApplyCode}
                    onPreviewCode={handlePreviewCode}
                  />
                  {message.isStreaming && <span className="streaming-cursor" />}
                </div>
              </div>
            </>
          )}

          {/* 操作栏 - 文本下方，hover 显示 */}
          {(isHovered || isFocused) && !message.isStreaming && (
            <MessageActions
              content={message.content}
              onCopySuccess={handleCopySuccess}
              onCopyError={handleCopyError}
              onRetry={hasError || wasInterrupted ? () => onRetry?.(message.id) : undefined}
              position="inline"
              showCopyMenu={true}
              compact={true}
            />
          )}

          {/* 工具调用块 */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="message-tools">
              {message.toolCalls.map((tc) => (
                <ToolBlock
                  key={tc.id}
                  id={tc.id}
                  name={tc.name}
                  args={tc.args}
                  status={tc.status as ToolStatus}
                  result={tc.result}
                  error={tc.error}
                  onCopy={onCopyTool}
                />
              ))}
            </div>
          )}

          {/* Plan 卡片 */}
          {message.plan && (
            <div className="message-plan">
              <div className="plan-header">
                <span className="plan-icon">📋</span>
                <span className="plan-title">{message.plan.title}</span>
              </div>
              <div className="plan-tasks">
                {message.plan.tasks.slice(0, 4).map((t: any) => (
                  <div key={t.id} className="plan-task">
                    <span className="task-bullet">○</span>
                    <span className="task-label">{t.label}</span>
                  </div>
                ))}
                {message.plan.tasks.length > 4 && (
                  <div className="plan-more">+{message.plan.tasks.length - 4} 更多任务</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右键菜单 */}
        <MessageContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          content={message.content}
          onClose={handleCloseContextMenu}
          onCopySuccess={handleCopySuccess}
          onCopyError={handleCopyError}
        />

        {/* 本地反馈 (复制/应用成功) */}
        <CopyFeedback
          show={showFeedback}
          message={feedbackMessage}
          position="top"
          duration={1500}
          onHide={handleHideFeedback}
        />
      </div>
    );
  },
);

AssistantMessage.displayName = "AssistantMessage";
