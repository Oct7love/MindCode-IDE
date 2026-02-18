/**
 * ChatComposer - Cursor 风格输入区
 *
 * 特性:
 * - 一体化卡片设计
 * - focus 时发光边框
 * - 自动增高 textarea
 * - 上下文芯片显示
 * - 图片粘贴/拖拽支持
 * - 底栏: 模式选择 + 模型选择 + 发送按钮
 */
import React, { memo, useCallback } from "react";
import type { ImageAttachment } from "../../stores";
import { useAIStore } from "../../stores";
import { ContextChip } from "./ContextChip";
import { ModelPicker, TOOL_CAPABLE_MODELS } from "./ModelPicker";
import { ModeSelector } from "./ModeSelector";
import { SendButton } from "./SendButton";
import { QueueIndicator } from "./QueueIndicator";
import "./ChatComposer.css";

interface ChatComposerProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onStop: () => void;
  onPickerToggle: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isLoading: boolean;
  isResizing?: boolean;
  queueCount: number;
  onClearQueue: () => void;
  // 图片相关
  images?: ImageAttachment[];
  onImagesChange?: (images: ImageAttachment[]) => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = memo(
  ({
    input,
    onInputChange,
    onKeyDown,
    onSend,
    onStop,
    onPickerToggle,
    textareaRef,
    isLoading,
    isResizing,
    queueCount,
    onClearQueue,
    images = [],
    onImagesChange,
  }) => {
    const { mode, setMode, model, setModel, contexts, removeContext } = useAIStore();

    // 处理粘贴图片
    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items || !onImagesChange) return;

        const _newImages: ImageAttachment[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                const img: ImageAttachment = {
                  id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  data: base64,
                  mimeType: item.type as ImageAttachment["mimeType"],
                  name: file.name || "pasted-image",
                  size: file.size,
                };
                onImagesChange([...images, img]);
              };
              reader.readAsDataURL(file);
            }
          }
        }
      },
      [images, onImagesChange],
    );

    // 处理拖拽图片
    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!onImagesChange) return;

        const files = e.dataTransfer?.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              const img: ImageAttachment = {
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                data: base64,
                mimeType: file.type as ImageAttachment["mimeType"],
                name: file.name,
                size: file.size,
              };
              onImagesChange([...images, img]);
            };
            reader.readAsDataURL(file);
          }
        }
      },
      [images, onImagesChange],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    // 移除图片
    const removeImage = useCallback(
      (id: string) => {
        if (onImagesChange) {
          onImagesChange(images.filter((img) => img.id !== id));
        }
      },
      [images, onImagesChange],
    );

    return (
      <div
        className={`chat-composer ${isLoading ? "loading" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* 队列指示器 */}
        <QueueIndicator count={queueCount} onClear={onClearQueue} />

        {/* 上下文芯片 */}
        {contexts.length > 0 && (
          <div className="composer-contexts">
            {contexts.map((ctx) => (
              <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />
            ))}
          </div>
        )}

        {/* 图片预览 */}
        {images.length > 0 && (
          <div className="composer-images">
            {images.map((img) => (
              <div key={img.id} className="composer-image-preview">
                <img src={img.data} alt={img.name || "图片"} />
                <button
                  className="composer-image-remove"
                  onClick={() => removeImage(img.id)}
                  title="移除图片"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入区 */}
        <div className="composer-input-area">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            placeholder={isLoading ? "消息将排队执行..." : "发送消息... (可粘贴图片)"}
            rows={1}
            aria-label="消息输入"
          />
        </div>

        {/* 底栏 */}
        <div className="composer-footer">
          <div className="composer-footer-left">
            <ModeSelector mode={mode} onModeChange={setMode} disabled={isLoading} />
            <ModelPicker
              model={model}
              onModelChange={setModel}
              whitelist={mode === "agent" ? TOOL_CAPABLE_MODELS : undefined}
              disabled={isLoading}
              compact
              isResizing={isResizing}
            />
            <button
              className="composer-ctx-btn"
              onClick={onPickerToggle}
              title="添加上下文 (@)"
              type="button"
              aria-label="添加上下文"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z" />
              </svg>
            </button>
          </div>

          <div className="composer-footer-right">
            <SendButton
              isLoading={isLoading}
              disabled={!input.trim() && images.length === 0 && !isLoading}
              onSend={onSend}
              onStop={onStop}
            />
          </div>
        </div>
      </div>
    );
  },
);

ChatComposer.displayName = "ChatComposer";
