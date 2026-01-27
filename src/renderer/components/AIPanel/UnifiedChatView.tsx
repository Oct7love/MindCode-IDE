/**
 * UnifiedChatView - AI 对话主视图（精简版）
 * 职责: 组件编排，UI 渲染
 * 逻辑已提取至 hooks/useChatEngine, useComposerState, useScrollAnchor
 */
import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useAIStore, AIMode, ToolCallStatus } from '../../stores';
import { useChatEngine, useComposerState, useScrollAnchor } from './hooks';
import { ChatHeader } from './ChatHeader';
import { ConfirmDialog } from './ConfirmDialog';
import { QueueIndicator } from './QueueIndicator';
import { EmptyState } from './EmptyState';
import { ContextPicker } from './ContextPicker';
import { ContextChip } from './ContextChip';
import { ModelPicker, MODELS, TOOL_CAPABLE_MODELS } from './ModelPicker';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolBlock, ToolStatus } from './ToolBlock';
import { TypingIndicator } from './TypingIndicator';
import { useCopyFeedback } from './CopyFeedback';
import { ConversationList } from './ConversationList';
import '../../styles/chat-tokens.css';
import '../../styles/markdown.css';
import './UnifiedChatView.css';

const MODE_OPTIONS: { mode: AIMode; icon: string; label: string; shortcut?: string }[] = [
  { mode: 'agent', icon: '∞', label: 'Agent', shortcut: 'Ctrl+I' },
  { mode: 'plan', icon: '☰', label: 'Plan' },
  { mode: 'debug', icon: '⚙', label: 'Debug' },
  { mode: 'chat', icon: '◇', label: 'Ask' },
];

interface UnifiedChatViewProps {
  isResizing?: boolean;
}

export const UnifiedChatView: React.FC<UnifiedChatViewProps> = memo(({ isResizing }) => {
  const { mode, setMode, model, setModel, getCurrentConversation, contexts, removeContext, createConversation } = useAIStore();
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | undefined>();
  const [pendingConfirm, setPendingConfirm] = useState<{ call: ToolCallStatus; resolve: (ok: boolean) => void } | null>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const conversation = getCurrentConversation();
  const messages = conversation?.messages || [];
  const currentModeOption = MODE_OPTIONS.find(m => m.mode === mode) || MODE_OPTIONS[0];

  // 核心引擎
  const { handleSend: engineSend, handleStop, isLoading, streamingText, messageQueue, clearMessageQueue } = useChatEngine({
    onPendingConfirm: setPendingConfirm
  });

  // 输入框状态
  const { input, setInput, textareaRef, showPicker, closePicker, setShowPicker, handleKeyDown, handleInputChange, handleSend } = useComposerState({
    onSend: engineSend,
    onStop: handleStop,
    onPickerOpen: setPickerPos,
    isLoading
  });

  // 滚动锚定
  const { messagesEndRef } = useScrollAnchor({ dependencies: [messages, streamingText] });

  // 复制功能
  const { copy, FeedbackComponent } = useCopyFeedback();
  const handleCopyTool = useCallback((content: string) => copy(content, '工具数据已复制'), [copy]);

  // 点击外部关闭模式菜单
  useEffect(() => {
    if (!showModeMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) setShowModeMenu(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModeMenu(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showModeMenu]);

  const handleModeSelect = useCallback((m: AIMode) => { setMode(m); setShowModeMenu(false); }, [setMode]);
  const handleConfirm = useCallback((ok: boolean) => { pendingConfirm?.resolve(ok); setPendingConfirm(null); }, [pendingConfirm]);

  const displayMessages = messages.map((msg, idx) => ({
    ...msg,
    content: (idx === messages.length - 1 && msg.role === 'assistant' && isLoading && streamingText) ? streamingText : msg.content,
    isStreaming: idx === messages.length - 1 && msg.role === 'assistant' && isLoading && !!streamingText
  }));

  return (
    <div className="unified-chat-view">
      <ChatHeader onNewChat={createConversation} onShowHistory={() => setShowConvList(true)} />

      <div className="unified-messages" role="log">
        {displayMessages.length <= 1 && <EmptyState mode={mode} icon={currentModeOption.icon} label={currentModeOption.label} />}
        {displayMessages.slice(1).map(msg => (
          <div key={msg.id} className={`unified-msg unified-msg-${msg.role}`}>
            <div className="unified-msg-avatar">{msg.role === 'user' ? '◯' : '✦'}</div>
            <div className="unified-msg-body">
              <div className="unified-msg-content"><MarkdownRenderer content={msg.content} /></div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="unified-tools">
                  {msg.toolCalls.map(tc => (
                    <ToolBlock key={tc.id} id={tc.id} name={tc.name} args={tc.args} status={tc.status as ToolStatus} result={tc.result} error={tc.error} onCopy={handleCopyTool} />
                  ))}
                </div>
              )}
              {msg.plan && (
                <div className="unified-plan-card">
                  <div className="unified-plan-title">{msg.plan.title}</div>
                  <div className="unified-plan-tasks">
                    {msg.plan.tasks.slice(0, 3).map(t => <div key={t.id} className="unified-plan-task">○ {t.label}</div>)}
                    {msg.plan.tasks.length > 3 && <div className="unified-plan-more">+{msg.plan.tasks.length - 3} 更多</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && !streamingText && (
          <div className="unified-loading-wrapper">
            <div className="unified-msg-avatar">✦</div>
            <TypingIndicator variant="dots" size="md" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="unified-composer">
        <QueueIndicator count={messageQueue.length} onClear={clearMessageQueue} />
        {contexts.length > 0 && (
          <div className="unified-contexts">
            {contexts.map(ctx => <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />)}
          </div>
        )}
        <div className="unified-input-row">
          <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={isLoading ? "消息将排队执行..." : "输入消息..."} rows={1} />
        </div>
        <div className="unified-footer">
          <div className="unified-footer-left">
            <div className="unified-mode-selector" ref={modeMenuRef}>
              <button className="unified-mode-btn" onClick={(e) => { e.stopPropagation(); setShowModeMenu(!showModeMenu); }} type="button">
                <span className="unified-mode-icon">{currentModeOption.icon}</span>
                <span className="unified-mode-label">{currentModeOption.label}</span>
                <svg className="unified-mode-arrow" viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 6l4 4 4-4H4z"/></svg>
              </button>
              {showModeMenu && (
                <div className="unified-mode-menu">
                  {MODE_OPTIONS.map(opt => (
                    <div key={opt.mode} className={`unified-mode-item ${mode === opt.mode ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleModeSelect(opt.mode); }}>
                      <span className="unified-mode-item-icon">{opt.icon}</span>
                      <span className="unified-mode-item-label">{opt.label}</span>
                      {mode === opt.mode && <span className="unified-mode-item-check">✓</span>}
                      {opt.shortcut && <span className="unified-mode-item-shortcut">{opt.shortcut}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <ModelPicker model={model} onModelChange={setModel} whitelist={mode === 'agent' ? TOOL_CAPABLE_MODELS : undefined} disabled={isLoading} compact isResizing={isResizing} />
            <button className="unified-ctx-btn" onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }} title="添加上下文" type="button">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.5 6.5h-4v-4h-3v4h-4v3h4v4h3v-4h4z"/></svg>
            </button>
          </div>
          <div className="unified-footer-right">
            {isLoading ? (
              <button className="unified-stop" onClick={handleStop}>Stop <span className="unified-shortcut">Esc</span></button>
            ) : (
              <button className="unified-review" onClick={handleSend} disabled={!input.trim()}>Send</button>
            )}
          </div>
        </div>
      </div>

      <ContextPicker isOpen={showPicker} onClose={closePicker} position={pickerPos} inputRef={textareaRef} />
      {pendingConfirm && <ConfirmDialog call={pendingConfirm.call} onConfirm={() => handleConfirm(true)} onCancel={() => handleConfirm(false)} />}
      {FeedbackComponent}
      <ConversationList isOpen={showConvList} onClose={() => setShowConvList(false)} />
    </div>
  );
});

UnifiedChatView.displayName = 'UnifiedChatView';
