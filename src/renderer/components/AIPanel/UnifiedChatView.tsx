/**
 * UnifiedChatView - AI 对话主视图（精简版）
 * 职责: 组件编排，UI 渲染
 * 逻辑已提取至 hooks/useChatEngine, useComposerState, useScrollAnchor
 */
import React, { useState, useCallback, useRef, useEffect, memo, ImgHTMLAttributes } from 'react';
import { useAIStore, AIMode, ToolCallStatus, ImageAttachment } from '../../stores';
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
import { AssistantMessage } from './AssistantMessage';
import { MessageActions } from './MessageActions';
import '../../styles/chat-tokens.css';
import '../../styles/markdown.css';
import './UnifiedChatView.css';

const MODE_OPTIONS: { mode: AIMode; icon: string; label: string; shortcut?: string }[] = [
  { mode: 'agent', icon: '∞', label: 'Agent', shortcut: 'Ctrl+I' },
  { mode: 'plan', icon: '☰', label: 'Plan' },
  { mode: 'debug', icon: '⚙', label: 'Debug' },
  { mode: 'chat', icon: '◇', label: 'Ask' },
];

// 图片预览组件 - 处理加载状态和错误
const ImagePreview: React.FC<{
  src: string; // data URL 或 blob URL
  blobUrl?: string; // 优先使用的 blob URL
  alt?: string;
  className?: string;
  onClick?: () => void;
}> = memo(({ src, blobUrl, alt, className, onClick }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  
  // 优先使用 blobUrl，否则使用 data URL
  const imgSrc = blobUrl || src;
  
  const handleLoad = useCallback(() => {
    console.log('[ImagePreview] Image loaded successfully');
    setStatus('loaded');
  }, []);
  
  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('[ImagePreview] Image load error, src type:', imgSrc?.slice(0, 20));
    setStatus('error');
  }, [imgSrc]);
  
  // 重置状态当 src 改变
  useEffect(() => {
    setStatus('loading');
  }, [imgSrc]);
  
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
  
  if (status === 'error') {
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
      {status === 'loading' && <div className="image-loading-spinner" />}
      <img
        src={imgSrc}
        alt={alt || '图片'}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        style={{ opacity: status === 'loaded' ? 1 : 0 }}
      />
    </div>
  );
});

interface UnifiedChatViewProps {
  isResizing?: boolean;
}

export const UnifiedChatView: React.FC<UnifiedChatViewProps> = memo(({ isResizing }) => {
  const { mode, setMode, model, setModel, getCurrentConversation, contexts, removeContext, createConversation } = useAIStore();
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | undefined>();
  const [pendingConfirm, setPendingConfirm] = useState<{ call: ToolCallStatus; resolve: (ok: boolean) => void } | null>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageAttachment[][]>([]); // 图片历史用于撤销
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const conversation = getCurrentConversation();
  const messages = conversation?.messages || [];
  const currentModeOption = MODE_OPTIONS.find(m => m.mode === mode) || MODE_OPTIONS[0];

  // 核心引擎
  const { 
    handleSend: engineSend, handleStop, isLoading, streamingText, thinkingText, isThinking, 
    messageQueue, clearMessageQueue,
    // Thinking UI 相关
    thinkingUIData, thinkingUIStartTime, useThinkingUIMode
  } = useChatEngine({
    onPendingConfirm: setPendingConfirm
  });

  // 输入框状态
  const { input, setInput, textareaRef, showPicker, closePicker, setShowPicker, handleKeyDown: originalKeyDown, handleInputChange, handleSend: originalHandleSend } = useComposerState({
    onSend: (text) => {
      engineSend(text, images);
      setImages([]); // 发送后清空图片
      setImageHistory([]); // 清空历史
    },
    onStop: handleStop,
    onPickerOpen: setPickerPos,
    isLoading
  });

  // 包装发送函数，支持只有图片的发送
  const handleSend = useCallback(() => {
    if (input.trim() || images.length > 0) {
      engineSend(input, images);
      setInput('');
      setImages([]);
    }
  }, [input, images, engineSend, setInput]);

  // 处理粘贴图片 - 使用 Blob URL
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // 使用 Blob URL 而不是 data URL
          const blobUrl = URL.createObjectURL(file);
          console.log('[ImagePaste] Created blob URL:', blobUrl, 'file size:', file.size);
          
          // 同时保存 base64 用于 API 请求
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const img: ImageAttachment = {
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              data: base64, // 保留 base64 用于 API
              blobUrl: blobUrl, // 用于显示
              mimeType: item.type as ImageAttachment['mimeType'],
              name: file.name || 'pasted-image',
              size: file.size
            };
            // 保存当前状态到历史（用于撤销）
            setImageHistory(prev => [...prev, images]);
            setImages(prev => [...prev, img]);
          };
          reader.onerror = (err) => {
            console.error('[ImagePaste] FileReader error:', err);
            URL.revokeObjectURL(blobUrl);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [images]);

  // 移除图片（保存历史用于撤销）
  const removeImage = useCallback((id: string) => {
    setImageHistory(prev => [...prev, images]);
    setImages(prev => prev.filter(img => img.id !== id));
  }, [images]);

  // 撤销图片操作 (Ctrl+Z)
  const undoImageAction = useCallback(() => {
    if (imageHistory.length > 0) {
      const previousState = imageHistory[imageHistory.length - 1];
      setImageHistory(prev => prev.slice(0, -1));
      setImages(previousState);
      console.log('[Undo] 撤销图片操作');
      return true;
    }
    return false;
  }, [imageHistory]);

  // 包装 handleKeyDown，添加 Ctrl+Z 撤销图片功能
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Z 撤销图片操作（仅当有图片历史且输入框为空或光标在开头时）
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      const textarea = e.currentTarget;
      // 如果输入框为空，或者光标在开头，则撤销图片
      if (textarea.value === '' || textarea.selectionStart === 0) {
        if (undoImageAction()) {
          e.preventDefault();
          return;
        }
      }
    }
    // 其他按键交给原始处理
    originalKeyDown(e);
  }, [originalKeyDown, undoImageAction]);

  // 滚动锚定（智能版：用户滚动时不强制回底部）
  const { messagesEndRef, containerRef, showScrollToBottom, scrollToBottom } = useScrollAnchor({ 
    dependencies: [messages, streamingText, thinkingText],
    threshold: 150
  });

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
    // isStreaming 需要考虑 thinkingText 和 thinkingUIData，因为思考阶段 streamingText 可能为空
    isStreaming: idx === messages.length - 1 && msg.role === 'assistant' && isLoading && (!!streamingText || !!thinkingText || !!thinkingUIData)
  }));

  return (
    <div className="unified-chat-view">
      <ChatHeader onNewChat={createConversation} onShowHistory={() => setShowConvList(true)} />

      <div className="unified-messages" role="log" ref={containerRef}>
        {displayMessages.length <= 1 && <EmptyState mode={mode} icon={currentModeOption.icon} label={currentModeOption.label} />}
        {displayMessages.slice(1).map((msg, idx) => (
          msg.role === 'assistant' ? (
            <AssistantMessage
              key={msg.id}
              message={msg}
              isLast={idx === displayMessages.length - 2}
              thinkingText={msg.isStreaming ? thinkingText : undefined}
              isThinking={msg.isStreaming ? isThinking : false}
              streamingThinkingUI={msg.isStreaming && useThinkingUIMode ? thinkingUIData || undefined : undefined}
              thinkingUIStartTime={msg.isStreaming && useThinkingUIMode ? thinkingUIStartTime : undefined}
              onCopy={(content) => copy(content, '消息已复制')}
              onCopyTool={handleCopyTool}
              onCopySuccess={(format) => copy(msg.content, `${format} 已复制`)}
            />
          ) : (
            <div key={msg.id} className="unified-msg unified-msg-user group">
              <div className="unified-msg-avatar">◯</div>
              <div className="unified-msg-body">
                {/* 用户消息中的图片 */}
                {msg.images && msg.images.length > 0 && (
                  <div className="unified-msg-images">
                    {msg.images.map((img: ImageAttachment) => (
                      <div key={img.id} className="unified-msg-image">
                        <ImagePreview src={img.data} blobUrl={img.blobUrl} alt={img.name || '图片'} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="unified-msg-content">
                  <MarkdownRenderer content={msg.content} />
                </div>
                <MessageActions
                  content={msg.content}
                  onCopySuccess={(format) => copy(msg.content, `${format} 已复制`)}
                  position="inline"
                  compact={true}
                  showCopyMenu={false}
                />
              </div>
            </div>
          )
        ))}
        {isLoading && !streamingText && !thinkingText && (
          <div className="unified-loading-wrapper">
            <div className="unified-msg-avatar">✦</div>
            <TypingIndicator variant="dots" size="md" />
          </div>
        )}
        <div ref={messagesEndRef} />
        
        {/* 回到底部按钮 */}
        {showScrollToBottom && (
          <button 
            className="scroll-to-bottom-btn"
            onClick={() => scrollToBottom()}
            aria-label="回到底部"
          >
            <span className="scroll-arrow">↓</span>
            {isLoading && <span className="scroll-hint">AI 正在输出...</span>}
          </button>
        )}
      </div>

      <div className="unified-composer">
        <QueueIndicator count={messageQueue.length} onClear={clearMessageQueue} />
        {contexts.length > 0 && (
          <div className="unified-contexts">
            {contexts.map(ctx => <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />)}
          </div>
        )}
        {/* 图片预览 */}
        {images.length > 0 && (
          <div className="unified-images">
            {images.map(img => (
              <div key={img.id} className="unified-image-preview">
                <ImagePreview src={img.data} blobUrl={img.blobUrl} alt={img.name || '图片'} />
                <button
                  className="unified-image-remove"
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
        <div className="unified-input-row">
          <textarea 
            ref={textareaRef} 
            value={input} 
            onChange={handleInputChange} 
            onKeyDown={handleKeyDown} 
            onPaste={handlePaste}
            placeholder={isLoading ? "消息将排队执行..." : "输入消息... (可粘贴图片)"} 
            rows={1} 
          />
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
              <button className="unified-review" onClick={handleSend} disabled={!input.trim() && images.length === 0}>Send</button>
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
