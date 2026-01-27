/**
 * useChatEngine - AI 对话核心引擎
 * 提取自 UnifiedChatView，负责 API 调用、工具执行、消息队列处理
 */
import { useCallback, useRef } from 'react';
import { useAIStore, AIMode, Plan, ToolCallStatus } from '../../../stores';
import { useFileStore } from '../../../stores';
import { MODELS, TOOL_CAPABLE_MODELS } from '../ModelPicker';

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface PendingConfirm {
  call: ToolCallStatus;
  resolve: (ok: boolean) => void;
}

interface ChatEngineOptions {
  onPendingConfirm: (confirm: PendingConfirm | null) => void;
}

export function useChatEngine(options: ChatEngineOptions) {
  const {
    mode, model, getCurrentConversation, addMessage, isLoading, setLoading,
    streamingText, setStreamingText, appendStreamingText, contexts,
    updateLastMessage, updateLastMessageToolCall, setPlan,
    enqueueMessage, dequeueMessage, clearMessageQueue, messageQueue
  } = useAIStore();
  const { workspaceRoot, getActiveFile } = useFileStore();

  const stopStreamRef = useRef<(() => void) | null>(null);
  const abortRef = useRef(false);

  // 路径解析
  const resolvePath = useCallback((p: string) => {
    if (p?.match(/^[a-zA-Z]:[/\\]/) || p?.startsWith('/')) return p;
    return workspaceRoot ? `${workspaceRoot}/${p}`.replace(/\\/g, '/') : p;
  }, [workspaceRoot]);

  // 工具执行
  const executeTool = useCallback(async (name: string, args: any): Promise<ToolResult> => {
    try {
      switch (name) {
        case 'workspace_listDir':
          return await window.mindcode?.fs?.readDir?.(resolvePath(args.path)) || { success: false, error: 'API 不可用' };
        case 'workspace_readFile': {
          const res = await window.mindcode?.fs?.readFile?.(resolvePath(args.path));
          if (!res?.success) return res || { success: false, error: '读取失败' };
          let content = res.data || '';
          if (args.startLine || args.endLine) {
            const lines = content.split('\n');
            content = lines.slice((args.startLine || 1) - 1, args.endLine || lines.length).join('\n');
          }
          return { success: true, data: { content, lines: res.data?.split('\n').length } };
        }
        case 'workspace_writeFile':
          return await window.mindcode?.fs?.writeFile?.(resolvePath(args.path), args.content) || { success: false, error: '写入失败' };
        case 'workspace_search':
          return await window.mindcode?.fs?.searchInFiles?.({
            workspacePath: workspaceRoot || '',
            query: args.query,
            maxResults: args.maxResults || 50
          }) || { success: false, error: '搜索失败' };
        case 'editor_getActiveFile': {
          const f = getActiveFile();
          return { success: true, data: f ? { path: f.path, content: f.content } : null };
        }
        case 'terminal_execute':
          return await window.mindcode?.terminal?.execute?.(
            args.command,
            args.cwd ? resolvePath(args.cwd) : workspaceRoot || undefined
          ) || { success: false, error: '执行失败' };
        case 'git_status':
          return await window.mindcode?.git?.status?.(workspaceRoot || '') || { success: false, error: 'Git 不可用' };
        case 'git_diff':
          return await window.mindcode?.git?.diff?.(workspaceRoot || '', args.path, args.staged) || { success: false, error: 'Git 不可用' };
        default:
          return { success: false, error: `未知工具: ${name}` };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, [workspaceRoot, getActiveFile, resolvePath]);

  // 工具确认 Promise
  const confirmTool = useCallback((call: ToolCallStatus): Promise<boolean> => {
    return new Promise(resolve => options.onPendingConfirm({ call, resolve }));
  }, [options]);

  // 解析计划
  const parsePlan = useCallback((text: string): Plan | null => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"title"[\s\S]*"tasks"[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const json = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(json);
      return {
        id: Date.now().toString(),
        title: parsed.title || '开发计划',
        goal: parsed.goal || '',
        status: 'draft',
        version: 1,
        assumptions: parsed.assumptions || [],
        risks: parsed.risks || [],
        milestones: (parsed.milestones || []).map((m: any, i: number) => ({
          id: m.id || `m${i}`,
          label: m.label || m,
          estimated: m.estimated || '',
          completed: false
        })),
        tasks: (parsed.tasks || []).map((t: any, i: number) => ({
          id: t.id || `t${i}`,
          label: t.label || t,
          completed: false
        }))
      };
    } catch {
      return null;
    }
  }, []);

  // 生成系统提示词
  const getSystemPrompt = useCallback(() => {
    const activeFile = getActiveFile();
    const modelInfo = MODELS.find(m => m.id === model) || MODELS[0];
    const toolsInfo = `
【工具能力】
你拥有完整的文件系统访问权限。当用户提到路径、文件或需要了解项目结构时，务必使用工具（workspace_listDir, workspace_readFile 等）获取真实信息。
不要猜测文件内容。修改文件前必须先读取。执行命令前必须解释意图。
`;
    const base = `你是 MindCode AI（${modelInfo.name}），集成在 MindCode IDE 中。工作区: ${workspaceRoot || '未打开'}，当前文件: ${activeFile?.path || '无'}。重要：当用户问你是什么模型时，必须回答 ${modelInfo.name}。\n${toolsInfo}`;
    switch (mode) {
      case 'chat': return `${base}\n【Ask 模式】回答问题，解释代码。当问题涉及具体文件时，主动使用工具读取。`;
      case 'plan': return `${base}\n【Plan 模式】制定开发计划。先使用工具探索项目结构，再输出 JSON 计划。`;
      case 'agent': return `${base}\n【Agent 模式】自主完成任务。执行原则: 1.探索(listDir/search) 2.读取(readFile) 3.思考 4.修改(writeFile)。`;
      case 'debug': return `${base}\n【Debug 模式】分析错误。主动读取报错文件和日志。`;
      default: return base;
    }
  }, [mode, model, workspaceRoot, getActiveFile]);

  // 获取工具定义
  const getTools = useCallback(() => [
    { name: 'workspace_listDir', description: '列出目录', parameters: { type: 'object' as const, properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'workspace_readFile', description: '读取文件', parameters: { type: 'object' as const, properties: { path: { type: 'string' }, startLine: { type: 'number' }, endLine: { type: 'number' } }, required: ['path'] } },
    { name: 'workspace_writeFile', description: '写入文件', parameters: { type: 'object' as const, properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'workspace_search', description: '搜索代码', parameters: { type: 'object' as const, properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
    { name: 'editor_getActiveFile', description: '获取当前文件', parameters: { type: 'object' as const, properties: {} } },
    { name: 'terminal_execute', description: '执行终端命令（用户确认后执行）', parameters: { type: 'object' as const, properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } },
    { name: 'git_status', description: 'Git状态', parameters: { type: 'object' as const, properties: {} } },
    { name: 'git_diff', description: 'Git差异', parameters: { type: 'object' as const, properties: { path: { type: 'string' }, staged: { type: 'boolean' } }, required: ['path'] } },
  ], []);

  // 发送消息核心逻辑
  const handleSend = useCallback(async (input: string) => {
    if (!input.trim()) return;
    const userContent = input.trim();

    // 如果正在加载中，将消息加入队列
    if (isLoading) {
      enqueueMessage(userContent, [...contexts], mode);
      return true; // 返回 true 表示已入队
    }

    let finalContent = userContent;
    if (contexts.length > 0) {
      finalContent = contexts.map(c => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`).join('\n\n') + `\n\n用户: ${userContent}`;
    }
    addMessage({ role: 'user', content: userContent, mode });
    setLoading(true);
    setStreamingText('');
    abortRef.current = false;

    const conversation = getCurrentConversation();
    const messages = conversation?.messages || [];
    const systemPrompt = getSystemPrompt();
    const chatHistory = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    let apiMessages: any[] = [{ role: 'system', content: systemPrompt }, ...chatHistory, { role: 'user', content: finalContent }];
    const tools = getTools();

    const isAgentMode = mode === 'agent';
    const useTools = tools.length > 0 && (isAgentMode || TOOL_CAPABLE_MODELS.includes(model));
    const requiresConfirm = ['workspace_writeFile', 'terminal_execute'];

    let usedFallbackModel: string | null = null;

    // 完成后处理队列的函数
    const processQueue = () => {
      const nextMsg = dequeueMessage();
      if (nextMsg) {
        setTimeout(() => {
          addMessage({ role: 'user', content: nextMsg.content, mode: nextMsg.mode });
          setLoading(true);
          setStreamingText('');
          abortRef.current = false;

          const newSystemPrompt = getSystemPrompt();
          const currentConv = getCurrentConversation();
          const newChatHistory = currentConv?.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) || [];
          let queueFinalContent = nextMsg.content;
          if (nextMsg.contexts.length > 0) {
            queueFinalContent = nextMsg.contexts.map(c => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`).join('\n\n') + `\n\n用户: ${nextMsg.content}`;
          }
          const queueApiMessages: any[] = [{ role: 'system', content: newSystemPrompt }, ...newChatHistory, { role: 'user', content: queueFinalContent }];

          addMessage({ role: 'assistant', content: '', mode: nextMsg.mode });
          const cleanup = window.mindcode?.ai?.chatStream?.(model, queueApiMessages, {
            onToken: (token: string) => appendStreamingText(token),
            onComplete: (fullText: string) => {
              updateLastMessage(fullText);
              setStreamingText('');
              setLoading(false);
              processQueue();
            },
            onError: (error: string) => {
              updateLastMessage(error);
              setStreamingText('');
              setLoading(false);
              processQueue();
            },
          });
          stopStreamRef.current = cleanup || null;
        }, 300);
      }
    };

    if (useTools) {
      if (!window.mindcode?.ai?.chatStreamWithTools) {
        updateLastMessage('错误: 当前环境不支持工具调用 API');
        setLoading(false);
        processQueue();
        return false;
      }
      addMessage({ role: 'assistant', content: '', mode });
      let iterations = 0;
      const maxIterations = 15;

      while (iterations < maxIterations && !abortRef.current) {
        iterations++;
        let responseText = '';
        let toolCalls: any[] = [];
        try {
          await new Promise<void>((resolve, reject) => {
            if (!window.mindcode?.ai?.chatStreamWithTools) {
              reject(new Error('API 不可用'));
              return;
            }
            window.mindcode.ai.chatStreamWithTools(model, apiMessages, tools, {
              onToken: (token) => {
                responseText += token;
                appendStreamingText(token);
              },
              onToolCall: (calls) => {
                toolCalls = calls;
              },
              onComplete: (_fullText, meta) => {
                if (meta?.usedFallback) usedFallbackModel = meta.model;
                resolve();
              },
              onError: (err) => reject(new Error(err)),
              onFallback: (from, to) => {
                appendStreamingText(`\n\n> ⚠️ ${from} 服务繁忙，已自动切换到 ${to}\n\n`);
                usedFallbackModel = to;
              }
            });
          });
        } catch (e: any) {
          updateLastMessage(e.message || '请求失败');
          break;
        }

        if (abortRef.current) break;
        if (toolCalls.length === 0) {
          updateLastMessage(responseText + (usedFallbackModel ? `\n\n*已自动切换到 ${usedFallbackModel}*` : ''));
          break;
        }

        const calls: ToolCallStatus[] = toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.arguments,
          status: 'pending' as const
        }));
        updateLastMessage(responseText, { toolCalls: calls });
        setStreamingText('');
        apiMessages.push({ role: 'assistant', content: responseText, toolCalls });

        for (const call of calls) {
          if (abortRef.current) break;
          if (requiresConfirm.includes(call.name)) {
            const confirmed = await confirmTool(call);
            if (!confirmed) {
              updateLastMessageToolCall(call.id, { status: 'failed', error: '用户取消' });
              apiMessages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify({ error: '用户取消' }) });
              continue;
            }
          }
          updateLastMessageToolCall(call.id, { status: 'running' });
          const result = await executeTool(call.name, call.args);
          updateLastMessageToolCall(call.id, {
            status: result.success ? 'success' : 'failed',
            result: result.data,
            error: result.error
          });
          apiMessages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify(result.success ? result.data : { error: result.error })
          });
        }
      }
      setStreamingText('');
      setLoading(false);
      processQueue();
    } else {
      addMessage({ role: 'assistant', content: '', mode });
      const cleanup = window.mindcode?.ai?.chatStream?.(model, apiMessages, {
        onToken: (token: string) => appendStreamingText(token),
        onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => {
          const plan = mode === 'plan' ? parsePlan(fullText) : null;
          const suffix = meta?.usedFallback ? `\n\n*已自动切换到 ${meta.model}*` : '';
          updateLastMessage(fullText + suffix, plan ? { plan } : undefined);
          if (plan) setPlan(plan);
          setStreamingText('');
          setLoading(false);
          stopStreamRef.current = null;
          processQueue();
        },
        onError: (error: string) => {
          updateLastMessage(error);
          setStreamingText('');
          setLoading(false);
          stopStreamRef.current = null;
          processQueue();
        },
        onFallback: (from: string, to: string) => {
          appendStreamingText(`\n\n> ⚠️ ${from} 服务繁忙，已自动切换到 ${to}\n\n`);
        }
      });
      stopStreamRef.current = cleanup || null;
    }
    return false;
  }, [
    model, mode, isLoading, contexts, getSystemPrompt, getTools, addMessage,
    setLoading, setStreamingText, appendStreamingText, updateLastMessage,
    updateLastMessageToolCall, executeTool, confirmTool, parsePlan, setPlan,
    enqueueMessage, dequeueMessage, getCurrentConversation
  ]);

  // 停止生成
  const handleStop = useCallback(() => {
    stopStreamRef.current?.();
    abortRef.current = true;
    if (streamingText) {
      updateLastMessage(streamingText + '\n\n[已停止]');
    }
    setStreamingText('');
    setLoading(false);
  }, [streamingText, updateLastMessage, setStreamingText, setLoading]);

  return {
    handleSend,
    handleStop,
    isLoading,
    streamingText,
    messageQueue,
    clearMessageQueue
  };
}
