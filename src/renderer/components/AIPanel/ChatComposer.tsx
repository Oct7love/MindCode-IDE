/**
 * ChatComposer - Cursor 风格输入区
 *
 * 特性:
 * - 一体化卡片设计
 * - focus 时发光边框
 * - 自动增高 textarea
 * - 上下文芯片显示
 * - 底栏: 模式选择 + 模型选择 + 发送按钮
 */
import React, { memo } from 'react';
import { useAIStore, AIMode } from '../../stores';
import { ContextChip } from './ContextChip';
import { ModelPicker, TOOL_CAPABLE_MODELS } from './ModelPicker';
import { ModeSelector } from './ModeSelector';
import { SendButton } from './SendButton';
import { QueueIndicator } from './QueueIndicator';
import './ChatComposer.css';

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
}

export const ChatComposer: React.FC<ChatComposerProps> = memo(({
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
  onClearQueue
}) => {
  const { mode, setMode, model, setModel, contexts, removeContext } = useAIStore();

  return (
    <div className={`chat-composer ${isLoading ? 'loading' : ''}`}>
      {/* 队列指示器 */}
      <QueueIndicator count={queueCount} onClear={onClearQueue} />

      {/* 上下文芯片 */}
      {contexts.length > 0 && (
        <div className="composer-contexts">
          {contexts.map(ctx => (
            <ContextChip
              key={ctx.id}
              item={ctx}
              onRemove={() => removeContext(ctx.id)}
            />
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
          placeholder={isLoading ? "消息将排队执行..." : "发送消息..."}
          rows={1}
          aria-label="消息输入"
        />
      </div>

      {/* 底栏 */}
      <div className="composer-footer">
        <div className="composer-footer-left">
          <ModeSelector
            mode={mode}
            onModeChange={setMode}
            disabled={isLoading}
          />
          <ModelPicker
            model={model}
            onModelChange={setModel}
            whitelist={mode === 'agent' ? TOOL_CAPABLE_MODELS : undefined}
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
              <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
            </svg>
          </button>
        </div>

        <div className="composer-footer-right">
          <SendButton
            isLoading={isLoading}
            disabled={!input.trim() && !isLoading}
            onSend={onSend}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
});

ChatComposer.displayName = 'ChatComposer';
