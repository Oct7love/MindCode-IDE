import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { useAIStore, AIMode, Plan, ToolCallStatus } from '../../stores';
import { useFileStore } from '../../stores';
import { ContextPicker } from './ContextPicker';
import { ContextChip } from './ContextChip';
import { ModelPicker, MODELS, TOOL_CAPABLE_MODELS } from './ModelPicker';
import { MarkdownRenderer } from '../MarkdownRenderer';
import './UnifiedChatView.css';

const MODE_OPTIONS: { mode: AIMode; icon: string; label: string; shortcut?: string }[] = [
  { mode: 'agent', icon: '∞', label: 'Agent', shortcut: 'Ctrl+I' },
  { mode: 'plan', icon: '☰', label: 'Plan' },
  { mode: 'debug', icon: '⚙', label: 'Debug' },
  { mode: 'chat', icon: '◇', label: 'Ask' },
];

export const UnifiedChatView: React.FC = memo(() => {
  const { mode, setMode, model, setModel, getCurrentConversation, addMessage, isLoading, setLoading, streamingText, setStreamingText, appendStreamingText, contexts, removeContext, updateLastMessage, updateLastMessageToolCall, setPlan, currentPlan } = useAIStore();
  const { workspaceRoot, getActiveFile } = useFileStore();
  const [input, setInput] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | undefined>();
  const [pendingConfirm, setPendingConfirm] = useState<{ call: ToolCallStatus; resolve: (ok: boolean) => void } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const abortRef = useRef(false);

  const conversation = getCurrentConversation();
  const messages = conversation?.messages || [];
  const currentModel = MODELS.find(m => m.id === model) || MODELS[0];
  const currentModeOption = MODE_OPTIONS.find(m => m.mode === mode) || MODE_OPTIONS[0];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'; } }, [input]);
  useEffect(() => { // 点击外部关闭菜单
    if (!showModeMenu) return;
    const handleClick = (e: MouseEvent) => { if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) setShowModeMenu(false); };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModeMenu(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [showModeMenu]);

  const resolvePath = useCallback((p: string) => p?.match(/^[a-zA-Z]:[/\\]/) || p?.startsWith('/') ? p : workspaceRoot ? `${workspaceRoot}/${p}`.replace(/\\/g, '/') : p, [workspaceRoot]);

  const executeTool = useCallback(async (name: string, args: any): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      switch (name) {
        case 'workspace_listDir': return await window.mindcode?.fs?.readDir?.(resolvePath(args.path)) || { success: false, error: 'API 不可用' };
        case 'workspace_readFile': { const res = await window.mindcode?.fs?.readFile?.(resolvePath(args.path)); if (!res?.success) return res || { success: false, error: '读取失败' }; let content = res.data || ''; if (args.startLine || args.endLine) { const lines = content.split('\n'); content = lines.slice((args.startLine || 1) - 1, args.endLine || lines.length).join('\n'); } return { success: true, data: { content, lines: res.data?.split('\n').length } }; }
        case 'workspace_writeFile': return await window.mindcode?.fs?.writeFile?.(resolvePath(args.path), args.content) || { success: false, error: '写入失败' };
        case 'workspace_search': return await window.mindcode?.fs?.searchInFiles?.({ workspacePath: workspaceRoot || '', query: args.query, maxResults: args.maxResults || 50 }) || { success: false, error: '搜索失败' };
        case 'editor_getActiveFile': { const f = getActiveFile(); return { success: true, data: f ? { path: f.path, content: f.content } : null }; }
        case 'terminal_execute': return await window.mindcode?.terminal?.execute?.(args.command, args.cwd ? resolvePath(args.cwd) : workspaceRoot || undefined) || { success: false, error: '执行失败' };
        case 'git_status': return await window.mindcode?.git?.status?.(workspaceRoot || '') || { success: false, error: 'Git 不可用' };
        case 'git_diff': return await window.mindcode?.git?.diff?.(workspaceRoot || '', args.path, args.staged) || { success: false, error: 'Git 不可用' };
        default: return { success: false, error: `未知工具: ${name}` };
      }
    } catch (e: any) { return { success: false, error: e.message }; }
  }, [workspaceRoot, getActiveFile, resolvePath]);

  const confirmTool = useCallback((call: ToolCallStatus): Promise<boolean> => new Promise(resolve => setPendingConfirm({ call, resolve })), []);

  const parsePlan = useCallback((text: string): Plan | null => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"title"[\s\S]*"tasks"[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const json = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(json);
      return { id: Date.now().toString(), title: parsed.title || '开发计划', goal: parsed.goal || '', status: 'draft', version: 1, assumptions: parsed.assumptions || [], risks: parsed.risks || [], milestones: (parsed.milestones || []).map((m: any, i: number) => ({ id: m.id || `m${i}`, label: m.label || m, estimated: m.estimated || '', completed: false })), tasks: (parsed.tasks || []).map((t: any, i: number) => ({ id: t.id || `t${i}`, label: t.label || t, completed: false })) };
    } catch { return null; }
  }, []);

  const getSystemPrompt = useCallback(() => {
    const activeFile = getActiveFile();
    const base = `你是 MindCode AI（${currentModel.name}），集成在 MindCode IDE 中。工作区: ${workspaceRoot || '未打开'}，当前文件: ${activeFile?.path || '无'}。`;
    switch (mode) {
      case 'chat': return `${base}\n【Ask 模式】普通对话，回答问题，解释代码。使用 Markdown 格式回复。`;
      case 'plan': return `${base}\n【Plan 模式】帮助用户制定开发计划。输出:\n1. 分析需求\n2. JSON 计划（代码块）:\n\`\`\`json\n{"title":"标题","goal":"目标","assumptions":[],"milestones":[{"id":"m1","label":"里程碑","estimated":"1天"}],"tasks":[{"id":"t1","label":"任务"}],"risks":[]}\n\`\`\``;
      case 'agent': return `${base}\n【Agent 模式】自主使用工具完成编程任务。\n可用工具: workspace_listDir, workspace_readFile, workspace_writeFile, workspace_search, editor_getActiveFile, terminal_execute, git_status, git_diff\n执行原则: 先了解代码，修改前先读取，最小改动，完成后说明。`;
      case 'debug': return `${base}\n【Debug 模式】分析错误，提供调试方案。输出:\n1. 问题理解\n2. 可能原因（概率排序）\n3. 验证步骤\n4. 修复建议`;
      default: return base;
    }
  }, [mode, currentModel, workspaceRoot, getActiveFile]);

  const getTools = useCallback(() => mode === 'agent' ? [
    { name: 'workspace.listDir', description: '列出目录', parameters: { type: 'object' as const, properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'workspace.readFile', description: '读取文件', parameters: { type: 'object' as const, properties: { path: { type: 'string' }, startLine: { type: 'number' }, endLine: { type: 'number' } }, required: ['path'] } },
    { name: 'workspace.writeFile', description: '写入文件', parameters: { type: 'object' as const, properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'workspace.search', description: '搜索代码', parameters: { type: 'object' as const, properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
    { name: 'editor.getActiveFile', description: '获取当前文件', parameters: { type: 'object' as const, properties: {} } },
    { name: 'terminal.execute', description: '执行命令', parameters: { type: 'object' as const, properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } },
    { name: 'git.status', description: 'Git状态', parameters: { type: 'object' as const, properties: {} } },
    { name: 'git.diff', description: 'Git差异', parameters: { type: 'object' as const, properties: { path: { type: 'string' }, staged: { type: 'boolean' } }, required: ['path'] } },
  ] : [], [mode]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    let finalContent = userContent;
    if (contexts.length > 0) { finalContent = contexts.map(c => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`).join('\n\n') + `\n\n用户: ${userContent}`; }
    addMessage({ role: 'user', content: userContent, mode });
    setInput('');
    setLoading(true);
    setStreamingText('');
    abortRef.current = false;

    const systemPrompt = getSystemPrompt();
    const chatHistory = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    let apiMessages: any[] = [{ role: 'system', content: systemPrompt }, ...chatHistory, { role: 'user', content: finalContent }];
    const tools = getTools();
    const useTools = mode === 'agent' && tools.length > 0 && TOOL_CAPABLE_MODELS.includes(model);
    const requiresConfirm = ['workspace_writeFile', 'terminal_execute'];

    if (useTools) {
      addMessage({ role: 'assistant', content: '', mode });
      let iterations = 0, maxIterations = 15;
      while (iterations < maxIterations && !abortRef.current) {
        iterations++;
        let responseText = '', toolCalls: any[] = [];
        try {
          await new Promise<void>((resolve, reject) => {
            if (!window.mindcode?.ai?.chatStreamWithTools) { reject(new Error('API 不可用')); return; }
            window.mindcode.ai.chatStreamWithTools(model, apiMessages, tools, {
              onToken: (token) => { responseText += token; appendStreamingText(token); },
              onToolCall: (calls) => { toolCalls = calls; },
              onComplete: () => resolve(),
              onError: (err) => reject(new Error(err))
            });
          });
        } catch (e: any) { updateLastMessage(`错误: ${e.message}`); break; }
        if (abortRef.current) break;
        if (toolCalls.length === 0) { updateLastMessage(responseText); break; }
        const calls: ToolCallStatus[] = toolCalls.map(tc => ({ id: tc.id, name: tc.name, args: tc.arguments, status: 'pending' as const }));
        updateLastMessage(responseText, { toolCalls: calls });
        setStreamingText('');
        apiMessages.push({ role: 'assistant', content: responseText, toolCalls });
        for (const call of calls) {
          if (abortRef.current) break;
          if (requiresConfirm.includes(call.name)) {
            const confirmed = await confirmTool(call);
            if (!confirmed) { updateLastMessageToolCall(call.id, { status: 'failed', error: '用户取消' }); apiMessages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify({ error: '用户取消' }) }); continue; }
          }
          updateLastMessageToolCall(call.id, { status: 'running' });
          const result = await executeTool(call.name, call.args);
          updateLastMessageToolCall(call.id, { status: result.success ? 'success' : 'failed', result: result.data, error: result.error });
          apiMessages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(result.success ? result.data : { error: result.error }) });
        }
      }
    } else {
      addMessage({ role: 'assistant', content: '', mode });
      const cleanup = window.mindcode?.ai?.chatStream?.(model, apiMessages, {
        onToken: (token: string) => appendStreamingText(token),
        onComplete: (fullText: string) => {
          const plan = mode === 'plan' ? parsePlan(fullText) : null;
          updateLastMessage(fullText, plan ? { plan } : undefined);
          if (plan) setPlan(plan);
          setStreamingText('');
          setLoading(false);
          stopStreamRef.current = null;
        },
        onError: (error: string) => { updateLastMessage(`错误: ${error}`); setStreamingText(''); setLoading(false); stopStreamRef.current = null; }
      });
      stopStreamRef.current = cleanup || null;
      return;
    }
    setStreamingText('');
    setLoading(false);
  }, [input, model, mode, isLoading, contexts, messages, getSystemPrompt, getTools, addMessage, setLoading, setStreamingText, appendStreamingText, updateLastMessage, updateLastMessageToolCall, executeTool, confirmTool, parsePlan, setPlan]);

  const handleStop = useCallback(() => { stopStreamRef.current?.(); abortRef.current = true; if (streamingText) updateLastMessage(streamingText + '\n\n[已停止]'); setStreamingText(''); setLoading(false); }, [streamingText, updateLastMessage, setStreamingText, setLoading]);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } if (e.key === 'Escape' && isLoading) handleStop(); if (e.key === '@' && !showPicker) { const rect = textareaRef.current?.getBoundingClientRect(); if (rect) setPickerPos({ x: rect.left, y: rect.top - 330 }); setTimeout(() => setShowPicker(true), 50); } };
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setInput(e.target.value); if (e.target.value.endsWith('@') && !showPicker) { const rect = textareaRef.current?.getBoundingClientRect(); if (rect) setPickerPos({ x: rect.left, y: rect.top - 330 }); setShowPicker(true); } };
  const handleConfirm = useCallback((ok: boolean) => { pendingConfirm?.resolve(ok); setPendingConfirm(null); }, [pendingConfirm]);
  const handleModeSelect = useCallback((m: AIMode) => { setMode(m); setShowModeMenu(false); }, [setMode]);

  const displayMessages = messages.map((msg, idx) => ({ ...msg, content: (idx === messages.length - 1 && msg.role === 'assistant' && isLoading && streamingText) ? streamingText : msg.content, isStreaming: idx === messages.length - 1 && msg.role === 'assistant' && isLoading && !!streamingText }));
  const statusIcon: Record<string, string> = { pending: '○', running: '⟳', success: '✓', failed: '✗' };
  const statusColor: Record<string, string> = { pending: 'var(--text-muted)', running: 'var(--accent-primary)', success: 'var(--semantic-success)', failed: 'var(--semantic-error)' };

  return (
    <div className="unified-chat-view">
      <div className="unified-messages" role="log">
        {displayMessages.length <= 1 && (
          <div className="unified-empty">
            <div className="unified-empty-icon">{currentModeOption.icon}</div>
            <div className="unified-empty-title">{currentModeOption.label}</div>
          </div>
        )}
        {displayMessages.slice(1).map(msg => (
          <div key={msg.id} className={`unified-msg unified-msg-${msg.role}`}>
            <div className="unified-msg-avatar">{msg.role === 'user' ? '◯' : '✦'}</div>
            <div className="unified-msg-body">
              <div className="unified-msg-content"><MarkdownRenderer content={msg.content} /></div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="unified-tools">
                  {msg.toolCalls.map(tc => (
                    <div key={tc.id} className={`unified-tool unified-tool-${tc.status}`}>
                      <span className="unified-tool-icon" style={{ color: statusColor[tc.status] }}>{statusIcon[tc.status]}</span>
                      <span className="unified-tool-name">{tc.name}</span>
                      <span className="unified-tool-args">{JSON.stringify(tc.args).slice(0, 50)}...</span>
                      {tc.error && <span className="unified-tool-error">{tc.error}</span>}
                    </div>
                  ))}
                </div>
              )}
              {msg.plan && (
                <div className="unified-plan-card">
                  <div className="unified-plan-title">{msg.plan.title}</div>
                  <div className="unified-plan-tasks">{msg.plan.tasks.slice(0, 3).map(t => <div key={t.id} className="unified-plan-task">○ {t.label}</div>)}{msg.plan.tasks.length > 3 && <div className="unified-plan-more">+{msg.plan.tasks.length - 3} 更多</div>}</div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && !streamingText && <div className="unified-loading"><span /><span /><span /></div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="unified-composer">
        {contexts.length > 0 && <div className="unified-contexts">{contexts.map(ctx => <ContextChip key={ctx.id} item={ctx} onRemove={() => removeContext(ctx.id)} />)}</div>}
        <div className="unified-input-row">
          <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="输入消息..." disabled={isLoading} rows={1} />
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
            <ModelPicker model={model} onModelChange={setModel} whitelist={mode === 'agent' ? TOOL_CAPABLE_MODELS : undefined} disabled={isLoading} compact />
            <button className="unified-ctx-btn" onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }} title="添加上下文" type="button">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.5 6.5h-4v-4h-3v4h-4v3h4v4h3v-4h4z"/></svg>
            </button>
          </div>
          <div className="unified-footer-right">
            {isLoading ? (
              <button className="unified-stop" onClick={handleStop}>Stop <span className="unified-shortcut">Ctrl+Shift+⌫</span></button>
            ) : (
              <button className="unified-review" onClick={handleSend} disabled={!input.trim()}>Review</button>
            )}
          </div>
        </div>
      </div>

      <ContextPicker isOpen={showPicker} onClose={() => { setShowPicker(false); setInput(input.replace(/@$/, '')); }} position={pickerPos} inputRef={textareaRef} />
      {pendingConfirm && (
        <div className="unified-confirm-overlay">
          <div className="unified-confirm-dialog">
            <div className="unified-confirm-title">⚠️ 确认执行</div>
            <div className="unified-confirm-tool">{pendingConfirm.call.name}</div>
            <pre className="unified-confirm-args">{JSON.stringify(pendingConfirm.call.args, null, 2)}</pre>
            <div className="unified-confirm-actions"><button onClick={() => handleConfirm(false)}>取消</button><button className="primary" onClick={() => handleConfirm(true)}>确认</button></div>
          </div>
        </div>
      )}
    </div>
  );
});
