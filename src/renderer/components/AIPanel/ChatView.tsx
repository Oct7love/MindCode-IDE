import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { useAIStore } from '../../stores';
import { ContextPicker } from './ContextPicker';
import { ContextChip } from './ContextChip';
import { MessageItem } from './MessageItem';
import { ModelPicker, MODELS } from './ModelPicker';
import { QuickActions } from './QuickActions';
import './ChatView.css';

interface ChatViewProps { model: string; onModelChange: (model: string) => void; contexts: import('../../stores').ContextItem[]; }

export const ChatView: React.FC<ChatViewProps> = memo(({ model, onModelChange }) => {
  const { getCurrentConversation, addMessage, isLoading, setLoading, streamingText, setStreamingText, appendStreamingText, contexts, removeContext } = useAIStore();
  const [input, setInput] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const conversation = getCurrentConversation();
  const messages = conversation?.messages || [];
  const currentModel = MODELS.find(m => m.id === model) || MODELS[0];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  
  useEffect(() => { // 自动增高
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    let finalContent = userContent;
    if (contexts.length > 0) {
      const contextStr = contexts.map(c => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`).join('\n\n');
      finalContent = `${contextStr}\n\n用户问题: ${userContent}`;
    }
    addMessage({ role: 'user', content: userContent });
    setInput('');
    setLoading(true);
    setStreamingText('');

    const systemPrompt = `你是 MindCode AI 编程助手（${currentModel.name}），集成在 MindCode IDE 中。
【回复规范】
- 中文回复，专业详尽
- 代码块标注语言
- 使用 Markdown 格式
- 重要信息用 :::info / :::warning / :::error / :::success 提示块
当用户问你是什么模型时，回答：${currentModel.name}。`;

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: finalContent }
    ];

    if (window.mindcode?.ai?.chatStream) {
      addMessage({ role: 'assistant', content: '' });
      const cleanup = window.mindcode.ai.chatStream(model, chatMessages, {
        onToken: (token: string) => appendStreamingText(token),
        onComplete: (fullText: string) => { useAIStore.getState().updateLastMessage(fullText); setStreamingText(''); setLoading(false); stopStreamRef.current = null; },
        onError: (error: string) => { useAIStore.getState().updateLastMessage(`错误: ${error}`); setStreamingText(''); setLoading(false); stopStreamRef.current = null; }
      });
      stopStreamRef.current = cleanup;
    } else {
      addMessage({ role: 'assistant', content: `[开发模式] 请在 Electron 中运行。\n\n您的消息: "${userContent}"` });
      setLoading(false);
    }
  }, [input, model, isLoading, contexts, messages, currentModel, addMessage, setLoading, setStreamingText, appendStreamingText]);

  const handleStop = useCallback(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;
    if (streamingText) useAIStore.getState().updateLastMessage(streamingText + '\n\n[已停止生成]');
    setStreamingText('');
    setLoading(false);
  }, [streamingText, setStreamingText, setLoading]);

  const handleRetry = useCallback((msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx > 0 && messages[idx - 1].role === 'user') {
      const userContent = messages[idx - 1].content;
      // 删除 AI 回复后重新发送
      useAIStore.getState().deleteLastMessage();
      setInput(userContent);
      setTimeout(() => handleSend(), 50);
    }
  }, [messages, handleSend]);

  const handleContinue = useCallback(() => {
    setInput('请继续');
    setTimeout(() => handleSend(), 50);
  }, [handleSend]);

  const handleQuickAction = useCallback((actionId: string, prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape' && isLoading) handleStop();
    if (e.key === '@' && !showPicker) {
      const rect = textareaRef.current?.getBoundingClientRect();
      if (rect) setPickerPos({ x: rect.left, y: rect.top - 330 });
      setTimeout(() => setShowPicker(true), 50);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (e.target.value.endsWith('@') && !showPicker) {
      const rect = textareaRef.current?.getBoundingClientRect();
      if (rect) setPickerPos({ x: rect.left, y: rect.top - 330 });
      setShowPicker(true);
    }
  };

  // 显示内容
  const displayMessages = messages.map((msg, idx) => ({
    ...msg,
    content: (idx === messages.length - 1 && msg.role === 'assistant' && isLoading && streamingText) ? streamingText : msg.content,
    status: (idx === messages.length - 1 && msg.role === 'assistant' && isLoading && streamingText) ? 'streaming' as const : 'complete' as const
  }));

  return (
    <div className="ai-chat-view">
      <div className="ai-messages-area" role="log" aria-label="聊天消息" aria-live="polite">
        {displayMessages.length === 0 && (
          <div className="ai-empty-state">
            <div className="ai-empty-icon">💬</div>
            <div className="ai-empty-title">开始对话</div>
            <div className="ai-empty-desc">在下方输入框中输入问题，或使用快捷操作</div>
          </div>
        )}
        {displayMessages.map(msg => (
          <MessageItem 
            key={msg.id} 
            message={msg} 
            isStreaming={msg.status === 'streaming'}
            onRetry={() => handleRetry(msg.id)}
            onContinue={handleContinue}
            onCopy={() => {}}
          />
        ))}
        {isLoading && !streamingText && (
          <div className="ai-loading">
            <div className="ai-loading-dot" />
            <div className="ai-loading-dot" />
            <div className="ai-loading-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-composer">
        <QuickActions onAction={handleQuickAction} disabled={isLoading} />
        {contexts.length > 0 && (
          <div className="ai-composer-contexts">
            {contexts.map(ctx => <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />)}
          </div>
        )}
        <div className="ai-composer-input-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入问题... (Enter 发送, Shift+Enter 换行, @ 添加上下文)"
            disabled={isLoading}
            className="ai-composer-input"
            rows={1}
            aria-label="输入消息"
          />
        </div>
        <div className="ai-composer-footer">
          <div className="ai-composer-left">
            <button className="ai-composer-btn" onClick={() => setShowPicker(!showPicker)} title="添加上下文 (@)" aria-label="添加上下文">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 4v3.25H4v1.5h3.25V12h1.5V8.75H12v-1.5H8.75V4h-1.5z"/></svg>
            </button>
            <ModelPicker model={model} onModelChange={onModelChange} disabled={isLoading} />
          </div>
          {isLoading ? (
            <button className="ai-composer-stop" onClick={handleStop} title="停止生成 (Esc)" aria-label="停止生成">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
              <span>停止</span>
            </button>
          ) : (
            <button className="ai-composer-send" onClick={handleSend} disabled={!input.trim()} title="发送 (Enter)" aria-label="发送">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1.17 2.32L14.5 8l-13.33 5.68.17-4.18L8.5 8l-7.16-1.5-.17-4.18z"/></svg>
            </button>
          )}
        </div>
      </div>
      <ContextPicker isOpen={showPicker} onClose={() => { setShowPicker(false); setInput(input.replace(/@$/, '')); }} position={pickerPos} inputRef={textareaRef} />
    </div>
  );
});
