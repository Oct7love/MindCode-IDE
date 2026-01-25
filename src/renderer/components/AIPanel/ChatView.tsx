import React, { useRef, useEffect, useState } from 'react';
import { useAIStore } from '../../stores';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ContextPicker } from './ContextPicker';
import { ContextChip } from './ContextChip';
import './ChatView.css';

interface ChatViewProps {
  model: string;
  onModelChange: (model: string) => void;
  contexts: import('../../stores').ContextItem[];
}

const MODELS = [
  { id: 'claude-opus-4-5-thinking', name: 'Claude Opus 4.5', icon: '🧠', desc: '最强思维' },
  { id: 'claude-sonnet-4-5-thinking', name: 'Claude Sonnet 4.5', icon: '💡', desc: '思维链' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', icon: '⚡', desc: '代码推理' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', icon: '⚡', desc: '极速预览' },
  { id: 'gemini-3-pro-high', name: 'Gemini 3 Pro', icon: '🎯', desc: '最强推理' },
  { id: 'gemini-3-pro-low', name: 'Gemini 3 Lite', icon: '💨', desc: '轻量极速' },
  { id: 'gemini-3-pro-image', name: 'Gemini 3 Image', icon: '🖼️', desc: '图片生成' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡', desc: '极速响应' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Lite', icon: '💨', desc: '轻量极速' },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Think', icon: '🧠', desc: '思维链' },
];

export const ChatView: React.FC<ChatViewProps> = ({ model, onModelChange }) => {
  const { getCurrentConversation, addMessage, isLoading, setLoading, streamingText, setStreamingText, appendStreamingText, contexts, removeContext } = useAIStore();
  const [input, setInput] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const conversation = getCurrentConversation();
  const messages = conversation?.messages || [];
  const currentModel = MODELS.find(m => m.id === model) || MODELS[0];

  useEffect(() => { // 点击外部关闭模型选择器
    const handleClick = (e: MouseEvent) => { if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) setShowModelPicker(false); };
    if (showModelPicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModelPicker]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    // 构建带上下文的消息
    let finalContent = userContent;
    if (contexts.length > 0) {
      const contextStr = contexts.map(c => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`).join('\n\n');
      finalContent = `${contextStr}\n\n用户问题: ${userContent}`;
    }
    addMessage({ role: 'user', content: userContent });
    setInput('');
    setLoading(true);
    setStreamingText('');

    const systemPrompt = `你是 MindCode AI 助手，当前模型是 ${model}。回复要简洁专业，代码块使用 \`\`\` 包裹并标注语言，中文回复。`;
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: finalContent }
    ];

    if (window.mindcode?.ai?.chatStream) {
      addMessage({ role: 'assistant', content: '' }); // 占位消息
      window.mindcode.ai.chatStream(model, chatMessages, {
        onToken: (token: string) => appendStreamingText(token),
        onComplete: (fullText: string) => {
          useAIStore.getState().updateLastMessage(fullText);
          setStreamingText('');
          setLoading(false);
        },
        onError: (error: string) => {
          useAIStore.getState().updateLastMessage(`错误: ${error}`);
          setStreamingText('');
          setLoading(false);
        }
      });
    } else {
      addMessage({ role: 'assistant', content: `[开发模式] 请在 Electron 中运行。\n\n您的消息: "${userContent}"` });
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === '@' && !showPicker) { // @ 触发上下文选择器
      const rect = textareaRef.current?.getBoundingClientRect();
      if (rect) setPickerPos({ x: rect.left, y: rect.top - 330 });
      setTimeout(() => setShowPicker(true), 50);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // 检测 @ 符号触发
    const val = e.target.value;
    if (val.endsWith('@') && !showPicker) {
      const rect = textareaRef.current?.getBoundingClientRect();
      if (rect) setPickerPos({ x: rect.left, y: rect.top - 330 });
      setShowPicker(true);
    }
  };
  const formatTime = (date: Date) => date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // 显示内容：对于最后一条消息，如果正在流式输出则显示 streamingText
  const displayMessages = messages.map((msg, idx) => {
    if (idx === messages.length - 1 && msg.role === 'assistant' && isLoading && streamingText) {
      return { ...msg, content: streamingText };
    }
    return msg;
  });

  return (
    <div className="ai-chat-view">
      <div className="ai-messages-area">
        {displayMessages.map(msg => (
          <div key={msg.id} className={`ai-message ${msg.role}`}>
            <div className="ai-message-header">
              <div className="ai-message-avatar">{msg.role === 'user' ? 'U' : 'AI'}</div>
              <span className="ai-message-name">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
              <span className="ai-message-time">{formatTime(new Date(msg.timestamp))}</span>
            </div>
            <div className="ai-message-body">
              <MarkdownRenderer content={msg.content || ''} onApplyCode={(code, lang) => console.log('Apply code:', code, lang)} />
            </div>
          </div>
        ))}
        {isLoading && !streamingText && <div className="ai-loading"><div className="ai-loading-dot" /><div className="ai-loading-dot" /><div className="ai-loading-dot" /></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-composer">
        {contexts.length > 0 && <div className="ai-composer-contexts">{contexts.map(ctx => <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />)}</div>}
        <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Ask anything... @ to mention" disabled={isLoading} className="ai-composer-input" />
        <div className="ai-composer-footer">
          <div className="ai-composer-left">
            <button className="ai-composer-btn" onClick={() => setShowPicker(!showPicker)} title="Add context (@)"><svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 4v3.25H4v1.5h3.25V12h1.5V8.75H12v-1.5H8.75V4h-1.5z"/></svg></button>
            <div className="ai-model-picker" ref={modelPickerRef}>
              <button className="ai-model-trigger" onClick={() => setShowModelPicker(!showModelPicker)}>
                <span className="ai-model-icon">{currentModel.icon}</span>
                <span className="ai-model-name">{currentModel.name}</span>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 6l4 4 4-4z"/></svg>
              </button>
              {showModelPicker && (
                <div className="ai-model-dropdown">
                  {MODELS.map(m => (
                    <button key={m.id} className={`ai-model-option ${m.id === model ? 'active' : ''}`} onClick={() => { onModelChange(m.id); setShowModelPicker(false); }}>
                      <span className="ai-model-option-icon">{m.icon}</span>
                      <div className="ai-model-option-info"><span className="ai-model-option-name">{m.name}</span><span className="ai-model-option-desc">{m.desc}</span></div>
                      {m.id === model && <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button className="ai-composer-send" onClick={handleSend} disabled={!input.trim() || isLoading}><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1.17 2.32L14.5 8l-13.33 5.68.17-4.18L8.5 8l-7.16-1.5-.17-4.18z"/></svg></button>
        </div>
      </div>
      <ContextPicker isOpen={showPicker} onClose={() => { setShowPicker(false); setInput(input.replace(/@$/, '')); }} position={pickerPos} inputRef={textareaRef} />
    </div>
  );
};
