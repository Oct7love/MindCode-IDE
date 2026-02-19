import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useAIStore, useFileStore } from "../../stores";
import { ModelPicker, TOOL_CAPABLE_MODELS } from "./ModelPicker";
import { MarkdownRenderer } from "../MarkdownRenderer";
import "./AgentView.css";
import { createNamedLogger } from "../../utils/logger";

const log = createNamedLogger("Agent");

interface ToolCall {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
  status: "pending" | "running" | "success" | "failed";
  result?: unknown;
  error?: string;
}
interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export const AgentView: React.FC = memo(() => {
  const { model, setModel, contexts } = useAIStore();
  const { workspaceRoot, getActiveFile } = useFileStore();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<{
    call: ToolCall;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const resolvePath = useCallback(
    (p: string) =>
      p?.match(/^[a-zA-Z]:[/\\]/) || p?.startsWith("/")
        ? p
        : workspaceRoot
          ? `${workspaceRoot}/${p}`.replace(/\\/g, "/")
          : p,
    [workspaceRoot],
  );

  const executeTool = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (
      name: string,
      args: Record<string, any>,
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      log.debug(`executeTool: ${name}`, args);
      try {
        switch (name) {
          case "workspace_listDir":
            return (
              (await window.mindcode?.fs?.readDir?.(resolvePath(args.path))) || {
                success: false,
                error: "API 不可用",
              }
            );
          case "workspace_readFile": {
            const res = await window.mindcode?.fs?.readFile?.(resolvePath(args.path));
            if (!res?.success) return res || { success: false, error: "读取失败" };
            let content = res.data || "";
            if (args.startLine || args.endLine) {
              const lines = content.split("\n");
              content = lines
                .slice((args.startLine || 1) - 1, args.endLine || lines.length)
                .join("\n");
            }
            return { success: true, data: { content, lines: res.data?.split("\n").length } };
          }
          case "workspace_writeFile":
            return (
              (await window.mindcode?.fs?.writeFile?.(resolvePath(args.path), args.content)) || {
                success: false,
                error: "写入失败",
              }
            );
          case "workspace_search":
            return (
              (await window.mindcode?.fs?.searchInFiles?.({
                workspacePath: workspaceRoot || "",
                query: args.query,
                maxResults: args.maxResults || 50,
              })) || { success: false, error: "搜索失败" }
            );
          case "editor_getActiveFile": {
            const f = getActiveFile();
            return { success: true, data: f ? { path: f.path, content: f.content } : null };
          }
          case "terminal_execute":
            return (
              (await window.mindcode?.terminal?.execute?.(
                args.command,
                args.cwd ? resolvePath(args.cwd) : workspaceRoot || undefined,
              )) || { success: false, error: "执行失败" }
            );
          case "git_status":
            return (
              (await window.mindcode?.git?.status?.(workspaceRoot || "")) || {
                success: false,
                error: "Git 不可用",
              }
            );
          case "git_diff":
            return (
              (await window.mindcode?.git?.diff?.(workspaceRoot || "", args.path, args.staged)) || {
                success: false,
                error: "Git 不可用",
              }
            );
          default:
            return { success: false, error: `未知工具: ${name}` };
        }
      } catch (e: unknown) {
        log.error(`Tool error: ${name}`, e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    [workspaceRoot, getActiveFile, resolvePath],
  );

  const confirmTool = useCallback(
    (call: ToolCall): Promise<boolean> =>
      new Promise((resolve) => setPendingConfirm({ call, resolve })),
    [],
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || isRunning) return;
    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsRunning(true);
    setStreamingText("");
    abortRef.current = false;

    const activeFile = getActiveFile();
    const systemPrompt = `你是 MindCode Agent，一个智能编程助手，可以通过工具自主完成编程任务。
【工作区】${workspaceRoot || "未打开"}
【当前文件】${activeFile?.path || "无"}
【可用工具】workspace_listDir, workspace_readFile, workspace_writeFile, workspace_search, editor_getActiveFile, terminal_execute, git_status, git_diff
【行为准则】
1. 理解用户需求，必要时询问澄清
2. 需要查看代码时主动使用工具
3. 修改文件前先读取内容确认
4. 每次只做必要的改动
5. 完成后清晰说明所做的事情
6. 遇到问题时说明原因并提供建议`;

    const tools = [
      {
        name: "workspace_listDir",
        description: "列出目录内容",
        parameters: {
          type: "object" as const,
          properties: { path: { type: "string", description: "目录路径" } },
          required: ["path"],
        },
      },
      {
        name: "workspace_readFile",
        description: "读取文件内容",
        parameters: {
          type: "object" as const,
          properties: {
            path: { type: "string" },
            startLine: { type: "number" },
            endLine: { type: "number" },
          },
          required: ["path"],
        },
      },
      {
        name: "workspace_writeFile",
        description: "写入/创建文件",
        parameters: {
          type: "object" as const,
          properties: { path: { type: "string" }, content: { type: "string" } },
          required: ["path", "content"],
        },
      },
      {
        name: "workspace_search",
        description: "搜索代码",
        parameters: {
          type: "object" as const,
          properties: { query: { type: "string" }, maxResults: { type: "number" } },
          required: ["query"],
        },
      },
      {
        name: "editor_getActiveFile",
        description: "获取当前编辑文件",
        parameters: { type: "object" as const, properties: {} },
      },
      {
        name: "terminal_execute",
        description: "执行终端命令",
        parameters: {
          type: "object" as const,
          properties: { command: { type: "string" }, cwd: { type: "string" } },
          required: ["command"],
        },
      },
      {
        name: "git_status",
        description: "获取 Git 状态",
        parameters: { type: "object" as const, properties: {} },
      },
      {
        name: "git_diff",
        description: "获取文件差异",
        parameters: {
          type: "object" as const,
          properties: { path: { type: "string" }, staged: { type: "boolean" } },
          required: ["path"],
        },
      },
    ];

    const chatHistory = messages
      .filter((m) => m.role !== "tool")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiMessages: Record<string, any>[] = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: userMsg.content },
    ];
    const requiresConfirm = ["workspace_writeFile", "terminal_execute"];
    let iterations = 0,
      maxIterations = 15;

    while (iterations < maxIterations && !abortRef.current) {
      iterations++;
      let responseText = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let toolCalls: any[] = [];
      try {
        await new Promise<void>((resolve, reject) => {
          if (!window.mindcode?.ai?.chatStreamWithTools) {
            reject(new Error("API 不可用"));
            return;
          }
          window.mindcode.ai.chatStreamWithTools(
            model,
            apiMessages as import("@shared/types/ai").ChatMessage[],
            tools,
            {
              onToken: (token) => {
                responseText += token;
                setStreamingText((prev) => prev + token);
              },
              onToolCall: (calls) => {
                toolCalls = calls;
              },
              onComplete: () => resolve(),
              onError: (err) => reject(new Error(err)),
            },
          );
        });
      } catch (e: unknown) {
        setMessages((m) => [
          ...m,
          {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: `错误: ${e instanceof Error ? e.message : String(e)}`,
            timestamp: Date.now(),
          },
        ]);
        break;
      }

      if (abortRef.current) break;

      if (toolCalls.length === 0) {
        // 无工具调用，对话结束
        if (responseText)
          setMessages((m) => [
            ...m,
            {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: responseText,
              timestamp: Date.now(),
            },
          ]);
        break;
      }

      // 有工具调用
      const calls: ToolCall[] = toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        args: tc.arguments,
        status: "pending" as const,
      }));
      const assistantMsg: AgentMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: responseText,
        toolCalls: calls,
        timestamp: Date.now(),
      };
      setMessages((m) => [...m, assistantMsg]);
      setStreamingText("");
      apiMessages.push({ role: "assistant", content: responseText, toolCalls });

      for (const call of calls) {
        if (abortRef.current) break;
        // 更新状态为 pending
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantMsg.id
              ? {
                  ...msg,
                  toolCalls: msg.toolCalls?.map((c) =>
                    c.id === call.id ? { ...c, status: "pending" as const } : c,
                  ),
                }
              : msg,
          ),
        );

        if (requiresConfirm.includes(call.name)) {
          const confirmed = await confirmTool(call);
          if (!confirmed) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantMsg.id
                  ? {
                      ...msg,
                      toolCalls: msg.toolCalls?.map((c) =>
                        c.id === call.id
                          ? { ...c, status: "failed" as const, error: "用户取消" }
                          : c,
                      ),
                    }
                  : msg,
              ),
            );
            apiMessages.push({
              role: "tool",
              toolCallId: call.id,
              content: JSON.stringify({ error: "用户取消操作" }),
            });
            continue;
          }
        }

        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantMsg.id
              ? {
                  ...msg,
                  toolCalls: msg.toolCalls?.map((c) =>
                    c.id === call.id ? { ...c, status: "running" as const } : c,
                  ),
                }
              : msg,
          ),
        );
        const result = await executeTool(call.name, call.args);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantMsg.id
              ? {
                  ...msg,
                  toolCalls: msg.toolCalls?.map((c) =>
                    c.id === call.id
                      ? {
                          ...c,
                          status: result.success ? ("success" as const) : ("failed" as const),
                          result: result.data,
                          error: result.error,
                        }
                      : c,
                  ),
                }
              : msg,
          ),
        );
        apiMessages.push({
          role: "tool",
          toolCallId: call.id,
          content: JSON.stringify(result.success ? result.data : { error: result.error }),
        });
      }
    }
    setIsRunning(false);
    setStreamingText("");
  }, [input, isRunning, model, messages, workspaceRoot, getActiveFile, executeTool, confirmTool]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setStreamingText("");
  }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && isRunning) handleStop();
  };
  const handleConfirm = useCallback(
    (ok: boolean) => {
      pendingConfirm?.resolve(ok);
      setPendingConfirm(null);
    },
    [pendingConfirm],
  );
  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamingText("");
  }, []);

  const statusIcon = { pending: "○", running: "⟳", success: "✓", failed: "✗" };
  const statusColor = {
    pending: "var(--text-muted)",
    running: "var(--accent-primary)",
    success: "var(--semantic-success)",
    failed: "var(--semantic-error)",
  };

  return (
    <div className="ai-agent-view">
      <div className="ai-agent-messages">
        {messages.length === 0 && !streamingText && (
          <div className="ai-empty-state">
            <div className="ai-empty-icon">🤖</div>
            <div className="ai-empty-title">Agent 模式</div>
            <div className="ai-empty-desc">
              我可以自主使用工具帮你完成编程任务
              <br />
              读取文件、修改代码、执行命令，一步到位
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-agent-msg ai-agent-msg-${msg.role}`}>
            <div className="ai-agent-msg-avatar">{msg.role === "user" ? "👤" : "🤖"}</div>
            <div className="ai-agent-msg-body">
              {msg.content && (
                <div className="ai-agent-msg-content">
                  <MarkdownRenderer content={msg.content} />
                </div>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="ai-agent-tools">
                  {msg.toolCalls.map((tc) => (
                    <div key={tc.id} className={`ai-agent-tool ai-agent-tool-${tc.status}`}>
                      <span
                        className="ai-agent-tool-icon"
                        style={{ color: statusColor[tc.status] }}
                      >
                        {statusIcon[tc.status]}
                      </span>
                      <span className="ai-agent-tool-name">{tc.name}</span>
                      <span className="ai-agent-tool-args">
                        {JSON.stringify(tc.args).slice(0, 60)}
                        {JSON.stringify(tc.args).length > 60 ? "..." : ""}
                      </span>
                      {tc.error && <span className="ai-agent-tool-error">{tc.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {streamingText && (
          <div className="ai-agent-msg ai-agent-msg-assistant">
            <div className="ai-agent-msg-avatar">🤖</div>
            <div className="ai-agent-msg-body">
              <div className="ai-agent-msg-content">
                <MarkdownRenderer content={streamingText} />
              </div>
            </div>
          </div>
        )}
        {isRunning && !streamingText && (
          <div className="ai-agent-loading">
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-agent-composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你想完成的任务... (Enter 发送)"
          disabled={isRunning}
          rows={1}
        />
        <div className="ai-agent-composer-footer">
          <div className="ai-agent-composer-left">
            <ModelPicker
              model={model}
              onModelChange={setModel}
              whitelist={TOOL_CAPABLE_MODELS}
              disabled={isRunning}
            />
            {messages.length > 0 && (
              <button className="ai-agent-clear-btn" onClick={clearChat} disabled={isRunning}>
                清空
              </button>
            )}
          </div>
          {isRunning ? (
            <button className="ai-agent-stop-btn" onClick={handleStop}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
              停止
            </button>
          ) : (
            <button className="ai-agent-send-btn" onClick={handleSend} disabled={!input.trim()}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M1.17 2.32L14.5 8l-13.33 5.68.17-4.18L8.5 8l-7.16-1.5-.17-4.18z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {pendingConfirm && (
        <div className="ai-agent-confirm-overlay">
          <div className="ai-agent-confirm-dialog">
            <div className="ai-agent-confirm-title">⚠️ 确认执行</div>
            <div className="ai-agent-confirm-tool">{pendingConfirm.call.name}</div>
            <pre className="ai-agent-confirm-args">
              {JSON.stringify(pendingConfirm.call.args, null, 2)}
            </pre>
            <div className="ai-agent-confirm-actions">
              <button onClick={() => handleConfirm(false)}>取消</button>
              <button className="primary" onClick={() => handleConfirm(true)}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
