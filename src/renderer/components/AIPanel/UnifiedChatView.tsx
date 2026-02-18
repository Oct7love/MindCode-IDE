/**
 * UnifiedChatView - AI 对话主视图（精简版）
 * 职责: 组件编排，UI 渲染
 * 逻辑已提取至 hooks/useChatEngine, useComposerState, useScrollAnchor
 */
import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import type { AIMode, ToolCallStatus, ImageAttachment } from "../../stores";
import { useAIStore } from "../../stores";
import { useChatEngine, useComposerState, useScrollAnchor } from "./hooks";
import { ConfirmDialog } from "./ConfirmDialog";
import { QueueIndicator } from "./QueueIndicator";
import { EmptyState } from "./EmptyState";
import { ContextPicker } from "./ContextPicker";
import { ContextChip } from "./ContextChip";
import { ModelPicker, MODELS, TOOL_CAPABLE_MODELS } from "./ModelPicker";
import { MarkdownRenderer } from "../MarkdownRenderer";
import { TypingIndicator } from "./TypingIndicator";
import { useCopyFeedback } from "./CopyFeedback";
import { AssistantMessage } from "./AssistantMessage";
import "../../styles/chat-tokens.css";
import "../../styles/markdown.css";
import "./UnifiedChatView.css";

const MODE_OPTIONS: { mode: AIMode; icon: string; label: string; shortcut?: string }[] = [
  { mode: "agent", icon: "∞", label: "Agent", shortcut: "Ctrl+I" },
  { mode: "plan", icon: "☰", label: "Plan" },
  { mode: "debug", icon: "⚙", label: "Debug" },
  { mode: "chat", icon: "◇", label: "Ask" },
];

// 支持图片的模型列表
const VISION_CAPABLE_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
  "codesuc-opus",
  "codesuc-sonnet",
  "codesuc-haiku",
];

// 图片预览组件 - 处理加载状态和错误，支持自动回退
const ImagePreview: React.FC<{
  src: string; // data URL (base64) - 作为备用
  blobUrl?: string; // blob URL - 优先使用（但可能失效）
  alt?: string;
  className?: string;
  onClick?: () => void;
}> = memo(({ src, blobUrl, alt, className, onClick }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false); // 是否使用 data URL 作为回退

  // 优先使用 blobUrl，如果失败则回退到 data URL (src)
  const imgSrc = useFallback ? src : blobUrl || src;

  const handleLoad = useCallback(() => {
    setStatus("loaded");
  }, []);

  const handleError = useCallback(
    (_e: React.SyntheticEvent<HTMLImageElement>) => {
      // 如果 blob URL 加载失败，且有 data URL 可用，则回退
      if (!useFallback && blobUrl && src && src.startsWith("data:")) {
        // Blob URL failed, falling back to data URL
        setUseFallback(true);
        setStatus("loading");
      } else {
        // Image load error, no fallback available
        setStatus("error");
      }
    },
    [useFallback, blobUrl, src],
  );

  // 重置状态当原始 src 改变（新图片）
  useEffect(() => {
    setStatus("loading");
    setUseFallback(false);
  }, [src, blobUrl]);

  if (!imgSrc) {
    return (
      <div className="image-preview-wrapper error">
        <div className="image-error-placeholder">
          <span className="image-error-icon">🖼️</span>
          <span className="image-error-text">无图片</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="image-preview-wrapper error">
        <div className="image-error-placeholder">
          <span className="image-error-icon">🖼️</span>
          <span className="image-error-text">加载失败</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`image-preview-wrapper ${status}`}>
      {status === "loading" && <div className="image-loading-spinner" />}
      <img
        src={imgSrc}
        alt={alt || "图片"}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        style={{ opacity: status === "loaded" ? 1 : 0 }}
      />
    </div>
  );
});

interface UnifiedChatViewProps {
  isResizing?: boolean;
}

export const UnifiedChatView: React.FC<UnifiedChatViewProps> = memo(({ isResizing }) => {
  const {
    mode,
    setMode,
    model,
    setModel,
    getCurrentConversation,
    contexts,
    removeContext,
    createConversation: _createConversation,
  } = useAIStore();
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | undefined>();
  const [pendingConfirm, setPendingConfirm] = useState<{
    call: ToolCallStatus;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageAttachment[][]>([]); // 图片历史用于撤销（限制最大深度）
  const MAX_IMAGE_HISTORY = 10; // 限制撤销历史深度，避免内存泄漏
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const conversation = getCurrentConversation();
  const messages = conversation?.messages || [];
  const currentModeOption = MODE_OPTIONS.find((m) => m.mode === mode) || MODE_OPTIONS[0];

  // 核心引擎
  const {
    handleSend: engineSend,
    handleStop,
    isLoading,
    streamingText,
    thinkingText,
    isThinking,
    messageQueue,
    clearMessageQueue,
    // Thinking UI 相关
    thinkingUIData,
    thinkingUIStartTime,
    useThinkingUIMode,
  } = useChatEngine({
    onPendingConfirm: setPendingConfirm,
  });

  // 输入框状态
  const {
    input,
    setInput,
    textareaRef,
    showPicker,
    closePicker,
    setShowPicker,
    handleKeyDown: originalKeyDown,
    handleInputChange,
    handleSend: _originalHandleSend,
  } = useComposerState({
    onSend: (text) => {
      engineSend(text, images);
      // 释放 Blob URL 防止内存泄漏
      images.forEach((img) => {
        if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
      });
      setImages([]);
      setImageHistory([]);
    },
    onStop: handleStop,
    onPickerOpen: setPickerPos,
    isLoading,
  });

  // 包装发送函数，支持只有图片的发送
  const handleSend = useCallback(() => {
    if (input.trim() || images.length > 0) {
      engineSend(input, images);
      setInput("");
      images.forEach((img) => {
        if (img.blobUrl) URL.revokeObjectURL(img.blobUrl);
      });
      setImages([]);
    }
  }, [input, images, engineSend, setInput]);

  // 检查当前模型是否支持图片
  const _supportsVision = VISION_CAPABLE_MODELS.includes(model);

  // 处理粘贴图片 - 使用 Blob URL
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();

          // 检查模型是否支持图片
          if (!VISION_CAPABLE_MODELS.includes(model)) {
            console.warn("[ImagePaste] 当前模型不支持图片:", model);
            window.mindcode?.dialog?.showMessageBox?.({
              type: "warning",
              title: "不支持图片",
              message: `当前模型 (${MODELS.find((m) => m.id === model)?.name || model}) 不支持图片识别。\n请切换到 Claude 模型后再上传图片。`,
            });
            return;
          }

          const file = item.getAsFile();
          if (file) {
            // 使用 Blob URL 而不是 data URL
            const blobUrl = URL.createObjectURL(file);
            // Debug: blob URL created for image paste

            // 同时保存 base64 用于 API 请求
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              const img: ImageAttachment = {
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                data: base64, // 保留 base64 用于 API
                blobUrl: blobUrl, // 用于显示
                mimeType: item.type as ImageAttachment["mimeType"],
                name: file.name || "pasted-image",
                size: file.size,
              };
              // 保存当前状态到历史（用于撤销），限制最大深度
              setImageHistory((prev) => [...prev.slice(-MAX_IMAGE_HISTORY + 1), images]);
              setImages((prev) => [...prev, img]);
            };
            reader.onerror = (err) => {
              console.error("[ImagePaste] FileReader error:", err);
              URL.revokeObjectURL(blobUrl);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    },
    [images, model],
  );

  // 移除图片（保存历史用于撤销，限制深度，释放 Blob URL）
  const removeImage = useCallback(
    (id: string) => {
      const target = images.find((img) => img.id === id);
      if (target?.blobUrl) URL.revokeObjectURL(target.blobUrl);
      setImageHistory((prev) => [...prev.slice(-MAX_IMAGE_HISTORY + 1), images]);
      setImages((prev) => prev.filter((img) => img.id !== id));
    },
    [images],
  );

  // 撤销图片操作 (Ctrl+Z)
  const undoImageAction = useCallback(() => {
    if (imageHistory.length > 0) {
      const previousState = imageHistory[imageHistory.length - 1];
      setImageHistory((prev) => prev.slice(0, -1));
      setImages(previousState);
      // 撤销图片操作成功
      return true;
    }
    return false;
  }, [imageHistory]);

  // 包装 handleKeyDown，添加 Ctrl+Z 撤销图片功能
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Z 撤销图片操作（仅当有图片历史且输入框为空或光标在开头时）
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        const textarea = e.currentTarget;
        // 如果输入框为空，或者光标在开头，则撤销图片
        if (textarea.value === "" || textarea.selectionStart === 0) {
          if (undoImageAction()) {
            e.preventDefault();
            return;
          }
        }
      }
      // 其他按键交给原始处理
      originalKeyDown(e);
    },
    [originalKeyDown, undoImageAction],
  );

  // 滚动锚定（智能版：用户滚动时不强制回底部）
  const { messagesEndRef, containerRef, showScrollToBottom, scrollToBottom } = useScrollAnchor({
    dependencies: [messages, streamingText, thinkingText],
    threshold: 150,
  });

  // 复制功能
  const { copy, FeedbackComponent } = useCopyFeedback();
  const handleCopyTool = useCallback((content: string) => copy(content, "工具数据已复制"), [copy]);

  // 点击外部关闭模式菜单
  useEffect(() => {
    if (!showModeMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node))
        setShowModeMenu(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModeMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showModeMenu]);

  const handleModeSelect = useCallback(
    (m: AIMode) => {
      setMode(m);
      setShowModeMenu(false);
    },
    [setMode],
  );
  const handleConfirm = useCallback(
    (ok: boolean) => {
      pendingConfirm?.resolve(ok);
      setPendingConfirm(null);
    },
    [pendingConfirm],
  );

  const displayMessages = messages.map((msg, idx) => ({
    ...msg,
    content:
      idx === messages.length - 1 && msg.role === "assistant" && isLoading && streamingText
        ? streamingText
        : msg.content,
    // isStreaming 需要考虑 thinkingText 和 thinkingUIData，因为思考阶段 streamingText 可能为空
    isStreaming:
      idx === messages.length - 1 &&
      msg.role === "assistant" &&
      isLoading &&
      (!!streamingText || !!thinkingText || !!thinkingUIData),
  }));

  return (
    <div className="unified-chat-view">
      {/* === 消息滚动区 === */}
      <div className="unified-messages" role="log" ref={containerRef}>
        {displayMessages.length <= 1 && (
          <EmptyState mode={mode} icon={currentModeOption.icon} label={currentModeOption.label} />
        )}
        {displayMessages.slice(1).map((msg, idx) =>
          msg.role === "assistant" ? (
            <AssistantMessage
              key={msg.id}
              message={msg}
              isLast={idx === displayMessages.length - 2}
              thinkingText={msg.isStreaming ? thinkingText : undefined}
              isThinking={msg.isStreaming ? isThinking : false}
              streamingThinkingUI={
                msg.isStreaming && useThinkingUIMode ? thinkingUIData || undefined : undefined
              }
              thinkingUIStartTime={
                msg.isStreaming && useThinkingUIMode ? thinkingUIStartTime : undefined
              }
              onCopy={(content) => copy(content, "消息已复制")}
              onCopyTool={handleCopyTool}
              onCopySuccess={(format) => copy(msg.content, `${format} 已复制`)}
            />
          ) : (
            <div key={msg.id} className="unified-msg unified-msg-user">
              <div className="unified-msg-role">You</div>
              <div className="unified-msg-body">
                {msg.images && msg.images.length > 0 && (
                  <div className="unified-msg-images">
                    {msg.images.map((img: ImageAttachment) => (
                      <div key={img.id} className="unified-msg-image">
                        <ImagePreview
                          src={img.data}
                          blobUrl={img.blobUrl}
                          alt={img.name || "图片"}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="unified-msg-content">
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            </div>
          ),
        )}
        {isLoading && !streamingText && !thinkingText && (
          <div className="unified-loading-wrapper">
            <TypingIndicator variant="dots" size="md" />
          </div>
        )}
        <div ref={messagesEndRef} />
        {showScrollToBottom && (
          <button
            className="scroll-to-bottom-btn"
            onClick={() => scrollToBottom()}
            aria-label="回到底部"
          >
            ↓ {isLoading && <span>输出中</span>}
          </button>
        )}
      </div>

      {/* === 底部 Composer (固定) === */}
      <div className="ai-composer">
        <QueueIndicator count={messageQueue.length} onClear={clearMessageQueue} />
        {contexts.length > 0 && (
          <div className="ai-composer-ctx">
            {contexts.map((ctx) => (
              <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />
            ))}
          </div>
        )}
        {images.length > 0 && (
          <div className="ai-composer-images">
            {images.map((img) => (
              <div key={img.id} className="ai-composer-img">
                <ImagePreview src={img.data} blobUrl={img.blobUrl} alt={img.name || "图片"} />
                <button
                  className="ai-composer-img-rm"
                  onClick={() => removeImage(img.id)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="ai-composer-input">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isLoading ? "排队中..." : "输入消息... 按 Enter 发送"}
            rows={1}
          />
          <div className="ai-composer-actions">
            <button
              className="ai-composer-attach"
              onClick={(e) => {
                e.stopPropagation();
                setShowPicker(!showPicker);
              }}
              title="添加上下文 @"
              type="button"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M13.5 6.5h-4v-4h-3v4h-4v3h4v4h3v-4h4z" />
              </svg>
            </button>
            {isLoading ? (
              <button className="ai-composer-stop" onClick={handleStop} title="停止 (Esc)">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                className="ai-composer-send"
                onClick={handleSend}
                disabled={!input.trim() && images.length === 0}
                title="发送 (Enter)"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M1 1.5l14 6.5-14 6.5V9l8-1-8-1V1.5z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="ai-composer-footer" ref={modeMenuRef}>
          <div className="ai-mode-dropdown">
            <button
              className="ai-mode-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setShowModeMenu(!showModeMenu);
              }}
              type="button"
            >
              <span className="ai-mode-trigger-icon">{currentModeOption.icon}</span>
              <span className="ai-mode-trigger-label">{currentModeOption.label}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="currentColor"
                style={{ opacity: 0.5 }}
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {showModeMenu && (
              <div className="ai-mode-menu">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    className={`ai-mode-option ${mode === opt.mode ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModeSelect(opt.mode);
                    }}
                  >
                    <span className="ai-mode-option-icon">{opt.icon}</span>
                    <span className="ai-mode-option-label">{opt.label}</span>
                    {opt.shortcut && (
                      <span className="ai-mode-option-shortcut">{opt.shortcut}</span>
                    )}
                    {mode === opt.mode && <span className="ai-mode-option-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ModelPicker
            model={model}
            onModelChange={setModel}
            whitelist={mode === "agent" ? TOOL_CAPABLE_MODELS : undefined}
            disabled={isLoading}
            compact
            isResizing={isResizing}
          />
        </div>
      </div>

      <ContextPicker
        isOpen={showPicker}
        onClose={closePicker}
        position={pickerPos}
        inputRef={textareaRef}
      />
      {pendingConfirm && (
        <ConfirmDialog
          call={pendingConfirm.call}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}
      {FeedbackComponent}
    </div>
  );
});

UnifiedChatView.displayName = "UnifiedChatView";
