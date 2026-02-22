/**
 * useChatEngine - AI 对话核心引擎
 * 提取自 UnifiedChatView，负责 API 调用、工具执行、消息队列处理
 * 支持 Thinking UI 模式（Cursor 风格）
 * 支持智能模型路由（自动选择 Haiku/Sonnet/Opus）
 */
import { useCallback, useRef, useEffect } from "react";
import { createNamedLogger } from "../../../utils/logger";
import type { AIMode, Plan, ToolCallStatus, ThinkingUIData } from "../../../stores";
import { useAIStore } from "../../../stores";
import { useFileStore } from "../../../stores";
import { MODELS, TOOL_CAPABLE_MODELS } from "../ModelPicker";
import {
  THINKING_UI_SYSTEM_PROMPT,
  buildThinkingUserPrompt,
  parseThinkingOutput,
} from "../../../../core/ai/thinking-prompt";
import { ModelRouter } from "../../../../core/ai/model-router";
import type { ToolCallInfo } from "@shared/types/ai";
import { agentToolService } from "../../../services/agentToolService";
import { collectCodebaseContext, formatCodebaseContext } from "../../../services/indexService";
import { messageCompressor } from "../../../../core/ai/messageCompressor";

const log = createNamedLogger("ChatEngine");

// 模型上下文窗口大小（token 数）
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  claude: 180000,
  codesuc: 180000, // 已弃用，保留兼容
  gemini: 900000,
  deepseek: 120000,
  glm: 128000,
  gpt: 120000,
};

/** 根据模型名获取上下文窗口大小 */
function getContextWindow(model: string): number {
  for (const [prefix, limit] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (model.startsWith(prefix)) return limit;
  }
  return 100000;
}

// 模式工具权限映射 - 对标 Cursor 的模式差异化设计
const MODE_TOOLS: Record<AIMode, string[]> = {
  chat: [
    "workspace_listDir",
    "workspace_readFile",
    "workspace_search",
    "codebase_semantic",
    "editor_getActiveFile",
    "git_status",
    "git_diff",
  ], // Ask: 只读 + 语义搜索
  plan: [
    "workspace_listDir",
    "workspace_readFile",
    "workspace_search",
    "codebase_semantic",
    "editor_getActiveFile",
    "git_status",
    "git_diff",
  ], // Plan: 只读
  agent: [
    "workspace_listDir",
    "workspace_readFile",
    "workspace_writeFile",
    "workspace_search",
    "codebase_semantic",
    "editor_getActiveFile",
    "terminal_execute",
    "git_status",
    "git_diff",
  ], // Agent: 完整
  debug: [
    "workspace_listDir",
    "workspace_readFile",
    "workspace_search",
    "codebase_semantic",
    "editor_getActiveFile",
    "terminal_execute",
    "git_status",
    "git_diff",
  ], // Debug: 只读+执行
};

// 支持图片/视觉的模型列表（Claude Vision API 格式）
const VISION_CAPABLE_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
  // OpenAI 也支持，但格式不同，暂不处理
];

// 检测是否是询问模型身份的问题
const isModelIdentityQuestion = (text: string): boolean => {
  const patterns = [
    /你是什么模型/i,
    /你是哪个模型/i,
    /你是谁/i,
    /你叫什么/i,
    /what model/i,
    /which model/i,
    /who are you/i,
    /你的名字/i,
    /你是.*(?:AI|助手|模型)/i,
    /使用的.*模型/i,
    /(?:当前|现在).*模型/i,
    /模型.*是什么/i,
    /什么.*模型/i,
  ];
  return patterns.some((p) => p.test(text));
};

// 检测消息是否包含模型身份声明（用于过滤历史）
const containsModelIdentity = (text: string): boolean => {
  const patterns = [
    /^(?:你好[！!]?\s*)?我是\s*\**\s*(?:Claude|GPT|Gemini|DeepSeek|GLM|Qwen|通义|文心|星火|MindCode)/im,
    /^(?:Hi[,.]?\s*)?I(?:'m| am)\s*(?:Claude|GPT|Gemini|DeepSeek|GLM)/im,
    /我是.*(?:由|开发的).*(?:AI|助手|模型)/i,
    /I am an? AI (?:assistant|model)/i,
    /📊\s*\*\*模型信息\*\*/, // 我们追加的模型信息块
  ];
  return patterns.some((p) => p.test(text));
};

// 生成模型身份信息后缀
const getModelInfoSuffix = (modelId: string, modelName: string, provider: string): string => {
  // 获取实际调用的底层模型（用于特价渠道等）
  const actualModelMap: Record<string, string> = {
    "codesuc-opus": "claude-opus-4-6",
    "codesuc-sonnet": "claude-sonnet-4-5-20250929",
    "codesuc-haiku": "claude-haiku-4-5-20251001",
  };
  const actualModel = actualModelMap[modelId] || modelId;
  const isProxy = actualModel !== modelId;

  return `\n\n---\n📊 **模型信息**\n- 显示名称: ${modelName}\n- 实际模型: \`${actualModel}\`\n- 服务商: ${provider}${isProxy ? "\n- 渠道类型: 特价代理" : ""}`;
};

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
    mode,
    model,
    getCurrentConversation,
    addMessage,
    isLoading,
    setLoading,
    streamingText,
    setStreamingText,
    appendStreamingText,
    contexts,
    thinkingText,
    setThinkingText,
    appendThinkingText,
    isThinking,
    setIsThinking,
    updateLastMessage,
    updateLastMessageToolCall,
    setPlan,
    enqueueMessage,
    dequeueMessage,
    clearMessageQueue,
    messageQueue,
    // Thinking UI 相关
    useThinkingUIMode,
    thinkingUIData,
    thinkingUIStartTime,
    setThinkingUIData,
    setThinkingUIStartTime,
    updateLastMessageThinkingUI,
    // 对话切换相关
    activeConversationId,
    // 智能模型路由
    useSmartRouting,
    setLastRoutingDecision,
  } = useAIStore();
  const { workspaceRoot, getActiveFile } = useFileStore();

  // 模型路由器实例
  const routerRef = useRef<ModelRouter | null>(null);
  if (!routerRef.current || routerRef.current["primaryModel"] !== model) {
    routerRef.current = new ModelRouter(model);
  }

  const stopStreamRef = useRef<(() => void) | null>(null);
  const abortRef = useRef(false);
  const lastConversationIdRef = useRef<string | null>(null);

  // 监听对话切换，自动停止当前流式请求
  useEffect(() => {
    if (
      lastConversationIdRef.current !== null &&
      lastConversationIdRef.current !== activeConversationId &&
      stopStreamRef.current
    ) {
      log.info("对话切换，停止当前流式请求");
      stopStreamRef.current();
      stopStreamRef.current = null;
      abortRef.current = true;
    }
    lastConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Thinking 标签解析状态（传统模式）
  const thinkingStateRef = useRef({ isInThinking: false, buffer: "" });

  // Thinking UI 流式解析状态（新模式）
  const thinkingUIBufferRef = useRef("");

  // 处理流式 token，解析 <thinking> 标签
  // 核心原则：尽可能快速输出内容，只缓冲可能是标签的部分
  const handleStreamToken = useCallback(
    (token: string) => {
      const state = thinkingStateRef.current;
      state.buffer += token;

      // 调试日志
      log.debug(
        "ThinkingParser token:",
        JSON.stringify(token.slice(0, 50)),
        "isInThinking:",
        state.isInThinking,
        "bufferLen:",
        state.buffer.length,
      );

      // 循环处理 buffer 直到无法继续
      let processing = true;
      while (processing) {
        processing = false;

        if (!state.isInThinking) {
          // === 未在思考模式 ===
          const startIdx = state.buffer.indexOf("<thinking>");
          if (startIdx !== -1) {
            // 找到完整的开始标签
            log.debug("ThinkingParser >>> ENTER thinking mode");
            const before = state.buffer.slice(0, startIdx);
            if (before) appendStreamingText(before);
            state.isInThinking = true;
            setIsThinking(true);
            state.buffer = state.buffer.slice(startIdx + 10);
            processing = true;
          } else {
            // 检查是否有部分 <thinking> 标签
            // 只需要保留最后可能是标签开头的部分
            const partialMatch = state.buffer.match(
              /<(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/,
            );
            if (partialMatch) {
              // 有部分标签，输出前面的安全内容
              const safeEnd = state.buffer.length - partialMatch[0].length;
              if (safeEnd > 0) {
                appendStreamingText(state.buffer.slice(0, safeEnd));
                state.buffer = state.buffer.slice(safeEnd);
              }
              // 等待更多数据
            } else {
              // 没有部分标签，全部输出
              appendStreamingText(state.buffer);
              state.buffer = "";
            }
          }
        } else {
          // === 在思考模式中 ===
          const endIdx = state.buffer.indexOf("</thinking>");
          if (endIdx !== -1) {
            // 找到完整的结束标签
            log.debug("ThinkingParser <<< EXIT thinking mode, content length:", endIdx);
            const thinkContent = state.buffer.slice(0, endIdx);
            if (thinkContent) {
              log.debug("ThinkingParser appendThinkingText:", thinkContent.slice(0, 100));
              appendThinkingText(thinkContent);
            }
            state.isInThinking = false;
            setIsThinking(false);
            state.buffer = state.buffer.slice(endIdx + 11);
            processing = true;
          } else {
            // 检查是否有部分 </thinking> 标签
            const partialMatch = state.buffer.match(
              /<(?:\/(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?)?$/,
            );
            if (partialMatch) {
              // 有部分结束标签，输出前面的思考内容
              const safeEnd = state.buffer.length - partialMatch[0].length;
              if (safeEnd > 0) {
                log.debug(
                  "ThinkingParser streaming thinking (partial end):",
                  state.buffer.slice(0, safeEnd).slice(0, 50),
                );
                appendThinkingText(state.buffer.slice(0, safeEnd));
                state.buffer = state.buffer.slice(safeEnd);
              }
              // 等待更多数据
            } else {
              // 没有部分标签，全部输出为思考内容
              log.debug("ThinkingParser streaming thinking:", state.buffer.slice(0, 50));
              appendThinkingText(state.buffer);
              state.buffer = "";
            }
          }
        }
      }
    },
    [appendStreamingText, appendThinkingText, setIsThinking],
  );

  // 重置思考状态
  const resetThinkingState = useCallback(() => {
    thinkingStateRef.current = { isInThinking: false, buffer: "" };
    setThinkingText("");
    setIsThinking(false);
  }, [setThinkingText, setIsThinking]);

  // 从文本中移除 <thinking> 标签及其内容
  const stripThinkingTags = useCallback((text: string): string => {
    return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
  }, []);

  // === Thinking UI 模式相关 ===

  // 处理 Thinking UI 流式 token
  const handleThinkingUIToken = useCallback(
    (token: string) => {
      thinkingUIBufferRef.current += token;
      const buffer = thinkingUIBufferRef.current;

      // 尝试增量解析 JSON
      try {
        const partialData: Partial<ThinkingUIData> = {
          ui: { title: "Thinking…", mode: "thinking", model: "", language: "", time_ms: 0 },
          thought_summary: [],
          trace: [],
          final_answer: "",
        };

        // 检测 ui.mode
        const modeMatch = buffer.match(/"mode"\s*:\s*"(\w+)"/);
        if (modeMatch && partialData.ui) {
          partialData.ui.mode = modeMatch[1] as ThinkingUIData["ui"]["mode"];
          if (modeMatch[1] === "done") {
            partialData.ui.title = "Done";
          } else if (modeMatch[1] === "answering") {
            partialData.ui.title = "Answering…";
          }
        }

        // 检测 ui.model
        const modelMatch = buffer.match(/"model"\s*:\s*"([^"]+)"/);
        if (modelMatch && partialData.ui) {
          partialData.ui.model = modelMatch[1];
        }

        // 检测 thought_summary 数组
        const thoughtMatch = buffer.match(/"thought_summary"\s*:\s*\[([\s\S]*?)\]/);
        if (thoughtMatch) {
          try {
            partialData.thought_summary = JSON.parse(`[${thoughtMatch[1]}]`);
          } catch {}
        }

        // 检测 trace 数组
        const traceMatch = buffer.match(/"trace"\s*:\s*\[([\s\S]*?)\]/);
        if (traceMatch) {
          try {
            partialData.trace = JSON.parse(`[${traceMatch[1]}]`);
          } catch {}
        }

        // 检测 final_answer（可能不完整）
        const answerMatch = buffer.match(/"final_answer"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
        if (answerMatch) {
          partialData.final_answer = answerMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        }

        setThinkingUIData(partialData);
      } catch {
        /* 忽略解析错误 */
      }
    },
    [setThinkingUIData],
  );

  // 完成 Thinking UI 解析
  const finishThinkingUI = useCallback((): ThinkingUIData | null => {
    const buffer = thinkingUIBufferRef.current;
    const parsed = parseThinkingOutput(buffer);

    if (parsed) {
      // 设置耗时
      if (thinkingUIStartTime) {
        parsed.ui.time_ms = Date.now() - thinkingUIStartTime;
      }
      parsed.ui.mode = "done";
      setThinkingUIData(parsed);
      updateLastMessageThinkingUI(parsed);
      return parsed;
    }

    return null;
  }, [thinkingUIStartTime, setThinkingUIData, updateLastMessageThinkingUI]);

  // 重置 Thinking UI 状态
  const resetThinkingUI = useCallback(() => {
    thinkingUIBufferRef.current = "";
    setThinkingUIData(null);
    setThinkingUIStartTime(null);
  }, [setThinkingUIData, setThinkingUIStartTime]);

  // 路径解析
  const _resolvePath = useCallback(
    (p: string) => {
      if (p?.match(/^[a-zA-Z]:[/\\]/) || p?.startsWith("/")) return p;
      return workspaceRoot ? `${workspaceRoot}/${p}`.replace(/\\/g, "/") : p;
    },
    [workspaceRoot],
  );

  // 工具执行 - 使用 AgentToolService（安全检查 + 检查点 + 结果截断 + 审计日志）
  useEffect(() => {
    agentToolService.setContext({
      workspaceRoot,
      getActiveFile: () => {
        const f = getActiveFile();
        return f ? { path: f.path, content: f.content } : null;
      },
    });
  }, [workspaceRoot, getActiveFile]);

  const executeTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
      return await agentToolService.execute(name, args);
    },
    [],
  );

  // 工具确认 Promise
  const confirmTool = useCallback(
    (call: ToolCallStatus): Promise<boolean> => {
      return new Promise((resolve) => options.onPendingConfirm({ call, resolve }));
    },
    [options],
  );

  // 解析计划
  const parsePlan = useCallback((text: string): Plan | null => {
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/\{[\s\S]*"title"[\s\S]*"tasks"[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const json = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(json);
      return {
        id: Date.now().toString(),
        title: parsed.title || "开发计划",
        goal: parsed.goal || "",
        status: "draft",
        version: 1,
        assumptions: parsed.assumptions || [],
        risks: parsed.risks || [],
        milestones: (parsed.milestones || []).map((m: Record<string, string>, i: number) => ({
          id: m.id || `m${i}`,
          label: m.label || String(m),
          estimated: m.estimated || "",
          completed: false,
        })),
        tasks: (parsed.tasks || []).map((t: Record<string, string>, i: number) => ({
          id: t.id || `t${i}`,
          label: t.label || String(t),
          completed: false,
        })),
      };
    } catch {
      return null;
    }
  }, []);

  // 生成系统提示词 - 带可见推理协议
  const getSystemPrompt = useCallback(() => {
    const activeFile = getActiveFile();
    const modelInfo = MODELS.find((m) => m.id === model) || MODELS[0];

    // 获取实际模型名称
    const actualModelMap: Record<string, string> = {
      "codesuc-opus": "claude-opus-4-6",
      "codesuc-sonnet": "claude-sonnet-4-5-20250929",
      "codesuc-haiku": "claude-haiku-4-5-20251001",
    };
    const _actualModel = actualModelMap[model] || model;

    // 上下文信息
    const context = workspaceRoot
      ? `[工作区: ${workspaceRoot}${activeFile ? `, 当前文件: ${activeFile.path}` : ""}]`
      : "[未打开工作区]";

    // 身份信息
    const identityNote = `(你是 ${modelInfo.name}，由 ${modelInfo.provider} 开发。仅在被问到时才说明身份。)`;

    // 可见推理协议 - 让模型输出思考过程
    const thinkingProtocol = `
### 可见推理协议
回答前，用 <thinking> 标签展示分析过程。

**格式要求：**
- 使用短句和列表（不用 Markdown 标题）
- 内容：上下文分析、边界情况、方案规划
- 不要说"让我思考"，直接开始

**示例：**
<thinking>
- 用户需求：验证邮箱的正则表达式
- 边界情况：子域名、特殊字符、TLD长度
- 方案：提供标准版和严格版两种实现
</thinking>

[正式回答]
`;

    // 工具使用指南
    const toolGuide = workspaceRoot
      ? `
**工具使用策略：**
- 阅读项目时：先 listDir 了解结构，再递归读取关键目录（src/, core/, main/）
- 理解代码时：读取入口文件、配置文件、README、主要模块
- 搜索代码时：用 workspace_search 快速定位关键词
- 大文件：使用 startLine/endLine 参数分段读取
- 每次工具调用后分析结果，决定是否需要更多信息`
      : "";

    // 根据模式返回系统提示词
    switch (mode) {
      case "chat":
        return `编程助手。${context} ${identityNote}
${thinkingProtocol}
直接简洁回答，不自我介绍。${toolGuide}`;

      case "plan":
        return `项目架构师。${context} ${identityNote}
${thinkingProtocol}
分析需求，输出 JSON 计划：
\`\`\`json
{"title":"","goal":"","tasks":[{"id":"t1","label":"","files":[]}],"risks":[]}
\`\`\`
${toolGuide}`;

      case "agent": {
        // Agent 模式：自动生成项目结构摘要
        let projectContext = "";
        if (workspaceRoot) {
          const wsName = workspaceRoot.split(/[/\\]/).pop() || "";
          projectContext = `
**项目信息：**
- 工作区：${wsName} (${workspaceRoot})
${activeFile ? `- 当前文件：${activeFile.path}` : ""}

**执行策略（重要）：**
1. 先用 workspace_listDir 了解项目结构
2. 读取关键文件：package.json / README / 入口文件
3. 用 workspace_search 精确定位相关代码
4. 修改前先 readFile 确认当前内容
5. 写入后验证变更正确性
6. 每步操作都简要说明意图

**安全规则：**
- 修改前自动创建检查点（可回滚）
- 禁止修改 node_modules / .git / .env
- 大文件使用 startLine/endLine 分段读取`;
        }
        return `你是 MindCode 自主编程代理。${identityNote}
${thinkingProtocol}
${workspaceRoot ? `你可以读写文件、搜索代码、执行终端命令。${projectContext}${toolGuide}` : "请先打开一个工作区文件夹。"}`;
      }

      case "debug":
        return `调试专家。${context} ${identityNote}
${thinkingProtocol}
分析错误根因，给出修复方案。${workspaceRoot ? `可查看源码和 git diff。${toolGuide}` : ""}`;

      default:
        return `助手。${context} ${identityNote}
${thinkingProtocol}`;
    }
  }, [mode, model, workspaceRoot, getActiveFile]);

  // 获取 Thinking UI 模式的系统提示词（返回严格 JSON）
  const getThinkingUISystemPrompt = useCallback(() => {
    return THINKING_UI_SYSTEM_PROMPT;
  }, []);

  // 构建 Thinking UI 模式的用户消息
  const buildThinkingUIUserMessage = useCallback(
    (userRequest: string) => {
      const activeFile = getActiveFile();
      const modelInfo = MODELS.find((m) => m.id === model) || MODELS[0];

      return buildThinkingUserPrompt({
        model: modelInfo.name,
        language: activeFile?.path?.split(".").pop() || "unknown",
        userRequest,
        styleHints: "遵循项目代码风格",
        diagnostics: "",
        prefix: activeFile?.content?.slice(0, 2000) || "",
        suffix: "",
        relatedSnippets: "",
        toolResults: "",
      });
    },
    [model, getActiveFile],
  );

  // 获取工具定义 - 根据模式和工作区状态过滤可用工具
  const getTools = useCallback(() => {
    // 没有工作区时，不提供文件系统相关的工具
    if (!workspaceRoot) {
      log.info("无工作区，不提供工具");
      return [];
    }

    const allTools = [
      {
        name: "workspace_listDir",
        description: "列出目录内容，了解项目结构",
        parameters: {
          type: "object" as const,
          properties: { path: { type: "string", description: "目录路径" } },
          required: ["path"],
        },
      },
      {
        name: "workspace_readFile",
        description: "读取文件内容，支持指定行范围",
        parameters: {
          type: "object" as const,
          properties: {
            path: { type: "string", description: "文件路径" },
            startLine: { type: "number", description: "起始行" },
            endLine: { type: "number", description: "结束行" },
          },
          required: ["path"],
        },
      },
      {
        name: "workspace_writeFile",
        description: "写入文件（需用户确认）",
        parameters: {
          type: "object" as const,
          properties: {
            path: { type: "string", description: "文件路径" },
            content: { type: "string", description: "文件内容" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "workspace_search",
        description: "在项目中搜索代码（文本匹配）",
        parameters: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "搜索关键词" },
            maxResults: { type: "number", description: "最大结果数" },
          },
          required: ["query"],
        },
      },
      {
        name: "codebase_semantic",
        description: "语义搜索代码库（@codebase），使用向量嵌入找到语义相关的代码",
        parameters: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "自然语言查询" },
            topK: { type: "number", description: "返回结果数" },
          },
          required: ["query"],
        },
      },
      {
        name: "editor_getActiveFile",
        description: "获取当前编辑器打开的文件",
        parameters: { type: "object" as const, properties: {} },
      },
      {
        name: "terminal_execute",
        description: "执行终端命令（需用户确认）",
        parameters: {
          type: "object" as const,
          properties: {
            command: { type: "string", description: "要执行的命令" },
            cwd: { type: "string", description: "工作目录" },
          },
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
        description: "获取 Git 差异",
        parameters: {
          type: "object" as const,
          properties: {
            path: { type: "string", description: "文件路径" },
            staged: { type: "boolean", description: "是否暂存区" },
          },
          required: ["path"],
        },
      },
    ];
    // 根据当前模式过滤工具
    const allowedTools = MODE_TOOLS[mode] || [];
    return allTools.filter((t) => allowedTools.includes(t.name));
  }, [mode, workspaceRoot]);

  // 发送消息核心逻辑（支持图片）
  const handleSend = useCallback(
    async (input: string, images?: import("../../../stores").ImageAttachment[]) => {
      if (!input.trim() && (!images || images.length === 0)) return;
      const userContent = input.trim();

      // 检测是否是询问模型身份的问题
      const askingModelIdentity = isModelIdentityQuestion(userContent);

      // 如果正在加载中，将消息加入队列（暂不支持图片队列）
      if (isLoading) {
        enqueueMessage(userContent, [...contexts], mode);
        return true; // 返回 true 表示已入队
      }

      let finalContent = userContent;
      if (contexts.length > 0) {
        finalContent =
          contexts
            .map((c) => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`)
            .join("\n\n") + `\n\n用户: ${userContent}`;
      }

      // 添加用户消息（包含图片）
      addMessage({
        role: "user",
        content: userContent || "(图片)",
        mode,
        images: images && images.length > 0 ? images : undefined,
      });
      setLoading(true);
      setStreamingText("");
      abortRef.current = false;

      const conversation = getCurrentConversation();
      const messages = conversation?.messages || [];
      let systemPrompt = getSystemPrompt();
      const modelInfo = MODELS.find((m) => m.id === model) || MODELS[0];
      const tools = getTools();

      // @codebase 上下文注入 — 自动收集相关代码
      // 在 Agent 模式下始终注入；在 Chat 模式下当消息包含 @codebase 时注入
      const shouldInjectContext = mode === "agent" || /(@codebase|@代码库)/i.test(userContent);
      if (shouldInjectContext && workspaceRoot) {
        try {
          const codebaseCtx = await collectCodebaseContext(userContent, {
            maxSnippets: 8,
            maxTokens: 6000,
          });
          if (codebaseCtx.snippets.length > 0) {
            const contextText = formatCodebaseContext(codebaseCtx);
            systemPrompt += `\n\n## 代码库上下文（@codebase 自动收集，共 ${codebaseCtx.snippets.length} 个相关片段）\n${contextText}`;
            log.info(
              `@codebase 注入 ${codebaseCtx.snippets.length} 个代码片段, ~${codebaseCtx.estimatedTokens} tokens`,
            );
          }
        } catch (e) {
          log.warn("@codebase 上下文收集失败:", e);
        }
      }

      // 先检查是否会使用工具（基于用户选择的主模型）
      const willUseTools = tools.length > 0 && TOOL_CAPABLE_MODELS.includes(model);

      // 智能模型路由：根据任务类型自动选择最优模型
      // 关键：如果会使用工具，说明是复杂任务，应该用主模型
      let effectiveModel = model;
      if (useSmartRouting && routerRef.current) {
        routerRef.current.setEnabled(true);
        routerRef.current.setPrimaryModel(model);
        const routingResult = routerRef.current.route(userContent, {
          isFirstRound: true,
          messageCount: messages.length,
          useTools: willUseTools, // 传入工具使用信息
        });
        effectiveModel = routingResult.model;
        setLastRoutingDecision({
          model: routingResult.model,
          taskType: routingResult.taskType,
          reason: routingResult.reason,
        });
        if (effectiveModel !== model) {
          log.info(
            `智能路由: ${model} → ${effectiveModel} (任务: ${routingResult.taskType}, 使用工具: ${willUseTools})`,
          );
        }
      }

      // 调试日志
      log.debug(
        "发送消息, 主模型:",
        model,
        ", 实际模型:",
        effectiveModel,
        ", 身份问题:",
        askingModelIdentity,
        ", 使用工具:",
        willUseTools,
      );
      log.debug("系统提示词前200字:", systemPrompt.slice(0, 200));

      // 过滤对话历史中涉及模型身份的内容，防止身份混淆
      // 当用户询问身份问题时，过滤掉所有身份相关的问答对
      const chatHistory = messages
        .filter((m) => m.role !== "system")
        .filter((m) => {
          // 如果当前问题是身份问题，过滤掉历史中所有身份相关内容
          if (askingModelIdentity) {
            // 过滤用户的身份问题
            if (m.role === "user" && isModelIdentityQuestion(m.content)) {
              log.debug("过滤身份问题:", m.content.slice(0, 30) + "...");
              return false;
            }
            // 过滤 assistant 的身份声明
            if (m.role === "assistant" && containsModelIdentity(m.content)) {
              log.debug("过滤身份回答:", m.content.slice(0, 50) + "...");
              return false;
            }
          } else {
            // 非身份问题时，仍然过滤掉以身份声明开头的消息（防止污染）
            if (m.role === "assistant" && containsModelIdentity(m.content)) {
              log.debug("过滤身份消息:", m.content.slice(0, 50) + "...");
              return false;
            }
          }
          return true;
        })
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // 上下文窗口管理：自动压缩超长历史
      if (chatHistory.length > 0) {
        const systemTokens = messageCompressor.estimateTokens([
          { role: "system", content: systemPrompt },
        ]);
        const maxHistoryTokens = Math.floor(getContextWindow(effectiveModel) * 0.75) - systemTokens; // 留 25% 给输出
        const compressed = messageCompressor.compress(
          chatHistory.map((m) => ({ ...m, role: m.role as "user" | "assistant" | "system" })),
          maxHistoryTokens,
        );
        if (compressed.tokensSaved > 0) {
          log.info(
            `历史压缩: ${compressed.originalCount}→${compressed.compressedCount} 条, 节省 ~${compressed.tokensSaved} tokens`,
          );
          chatHistory.splice(
            0,
            chatHistory.length,
            ...compressed.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
      }

      // 构建 API 消息，支持图片（Claude Vision API 格式）
      type VisionBlock =
        | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
        | { type: "text"; content: string };
      let userMessageContent: string | VisionBlock[] = finalContent;
      const supportsVision = VISION_CAPABLE_MODELS.includes(effectiveModel);

      if (images && images.length > 0) {
        if (!supportsVision) {
          // 模型不支持图片，添加提示信息
          log.warn("当前模型不支持图片:", effectiveModel);
          userMessageContent = `[注意：当前模型 ${effectiveModel} 不支持图片识别，图片已忽略]\n\n${finalContent}`;
        } else {
          // 使用 Claude Vision API 格式: content 是数组
          userMessageContent = [
            ...images.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mimeType,
                data: img.data.replace(/^data:image\/\w+;base64,/, ""), // 移除 data URL 前缀
              },
            })),
            { type: "text" as const, content: finalContent || "请描述这张图片" },
          ];
        }
      }
      // Vision API 的 content 可以是 string | VisionBlock[]，但 IPC 层统一序列化，安全断言
      type APIMessage = {
        role: "system" | "user" | "assistant" | "tool";
        content: string;
        toolCalls?: ToolCallInfo[];
        toolCallId?: string;
      };
      const apiMessages: APIMessage[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: userMessageContent as string },
      ];

      // 所有模式都可以使用工具（工具已按 MODE_TOOLS 过滤），只要模型支持
      // 注意：这里用 effectiveModel 检查，因为路由后的模型也需要支持工具
      const useTools = willUseTools && TOOL_CAPABLE_MODELS.includes(effectiveModel);
      // 只有 Agent 和 Debug 模式下的危险操作需要确认
      const requiresConfirm =
        mode === "agent" || mode === "debug" ? ["workspace_writeFile", "terminal_execute"] : [];
      log.debug("模式:", mode, ", 可用工具数:", tools.length, ", 使用工具:", useTools);

      let usedFallbackModel: string | null = null;

      // 完成后处理队列的函数
      const processQueue = () => {
        const nextMsg = dequeueMessage();
        if (nextMsg) {
          setTimeout(() => {
            addMessage({ role: "user", content: nextMsg.content, mode: nextMsg.mode });
            setLoading(true);
            setStreamingText("");
            abortRef.current = false;

            const newSystemPrompt = getSystemPrompt();
            const currentConv = getCurrentConversation();
            // 队列消息也需要检测是否是身份问题
            const queueAskingIdentity = isModelIdentityQuestion(nextMsg.content);
            // 过滤对话历史中涉及模型身份的内容
            const newChatHistory =
              currentConv?.messages
                .filter((m) => m.role !== "system")
                .filter((m) => {
                  if (queueAskingIdentity) {
                    if (m.role === "user" && isModelIdentityQuestion(m.content)) return false;
                    if (m.role === "assistant" && containsModelIdentity(m.content)) return false;
                  } else {
                    if (m.role === "assistant" && containsModelIdentity(m.content)) return false;
                  }
                  return true;
                })
                .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) || [];
            let queueFinalContent = nextMsg.content;
            if (nextMsg.contexts.length > 0) {
              queueFinalContent =
                nextMsg.contexts
                  .map((c) => `[${c.type}: ${c.label}]\n${c.data.content || c.data.path}`)
                  .join("\n\n") + `\n\n用户: ${nextMsg.content}`;
            }
            const queueApiMessages: APIMessage[] = [
              { role: "system", content: newSystemPrompt },
              ...newChatHistory,
              { role: "user", content: queueFinalContent },
            ];

            addMessage({ role: "assistant", content: "", mode: nextMsg.mode });
            resetThinkingState();
            // 队列消息也使用智能路由后的模型
            const cleanup = window.mindcode?.ai?.chatStream?.(effectiveModel, queueApiMessages, {
              onToken: (token: string) => handleStreamToken(token),
              onComplete: (fullText: string) => {
                const savedThinking = useAIStore.getState().thinkingText; // 保存思考内容
                updateLastMessage(
                  stripThinkingTags(fullText),
                  savedThinking ? { thinkingContent: savedThinking } : undefined,
                );
                setStreamingText("");
                resetThinkingState();
                setLoading(false);
                processQueue();
              },
              onError: (error: string) => {
                updateLastMessage(error);
                setStreamingText("");
                resetThinkingState();
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
          updateLastMessage("错误: 当前环境不支持工具调用 API");
          setLoading(false);
          processQueue();
          return false;
        }
        addMessage({ role: "assistant", content: "", mode });
        let iterations = 0;
        const maxIterations = 50; // 增加工具循环上限

        while (iterations < maxIterations && !abortRef.current) {
          iterations++;
          log.debug(`工具循环 #${iterations}/${maxIterations}, 消息数: ${apiMessages.length}`);
          let responseText = "";
          let toolCalls: ToolCallInfo[] = [];
          try {
            await new Promise<void>((resolve, reject) => {
              if (!window.mindcode?.ai?.chatStreamWithTools) {
                reject(new Error("API 不可用"));
                return;
              }
              log.debug(
                "调用 chatStreamWithTools, 工具数:",
                tools.length,
                ", 工具名:",
                tools.map((t) => t.name).join(", "),
                ", 模型:",
                effectiveModel,
              );
              resetThinkingState();
              window.mindcode.ai.chatStreamWithTools(effectiveModel, apiMessages, tools, {
                onToken: (token) => {
                  responseText += token;
                  handleStreamToken(token);
                },
                onToolCall: (calls) => {
                  log.debug("收到工具调用:", calls);
                  toolCalls = calls;
                },
                onComplete: (_fullText, meta) => {
                  log.debug("chatStreamWithTools 完成");
                  if (meta?.usedFallback) usedFallbackModel = meta.model;
                  resolve();
                },
                onError: (err) => {
                  log.error("chatStreamWithTools 错误:", err);
                  reject(new Error(err));
                },
                onFallback: (from, to) => {
                  appendStreamingText(`\n\n> ⚠️ ${from} 服务繁忙，已自动切换到 ${to}\n\n`);
                  usedFallbackModel = to;
                },
              });
            });
          } catch (e: unknown) {
            log.error("工具调用错误:", e);
            updateLastMessage(`错误: ${e instanceof Error ? e.message : "请求失败"}`);
            break;
          }

          log.debug(
            `工具调用完成, 响应长度: ${responseText.length}, 工具调用数: ${toolCalls.length}`,
          );
          if (abortRef.current) break;
          if (toolCalls.length === 0) {
            let finalSuffix = usedFallbackModel ? `\n\n*已自动切换到 ${usedFallbackModel}*` : "";
            // 如果是询问模型身份的问题，追加实际模型信息
            if (askingModelIdentity) {
              finalSuffix += getModelInfoSuffix(model, modelInfo.name, modelInfo.provider);
            }
            // 清理 thinking 标签后保存，保留思考内容
            const savedThinking = useAIStore.getState().thinkingText;
            updateLastMessage(
              stripThinkingTags(responseText) + finalSuffix,
              savedThinking ? { thinkingContent: savedThinking } : undefined,
            );
            resetThinkingState();
            break;
          }

          const calls: ToolCallStatus[] = toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: tc.arguments,
            status: "pending" as const,
          }));
          // 清理 thinking 标签并保存思考内容
          const savedThinking = useAIStore.getState().thinkingText;
          const cleanedResponse = stripThinkingTags(responseText);
          updateLastMessage(cleanedResponse, {
            toolCalls: calls,
            ...(savedThinking ? { thinkingContent: savedThinking } : {}),
          });
          setStreamingText("");
          apiMessages.push({ role: "assistant", content: cleanedResponse, toolCalls });

          for (const call of calls) {
            if (abortRef.current) break;
            if (requiresConfirm.includes(call.name)) {
              const confirmed = await confirmTool(call);
              if (!confirmed) {
                updateLastMessageToolCall(call.id, { status: "failed", error: "用户取消" });
                apiMessages.push({
                  role: "tool",
                  toolCallId: call.id,
                  content: JSON.stringify({ error: "用户取消" }),
                });
                continue;
              }
            }
            updateLastMessageToolCall(call.id, { status: "running" });
            const result = await executeTool(call.name, call.args);
            updateLastMessageToolCall(call.id, {
              status: result.success ? "success" : "failed",
              result: result.data,
              error: result.error,
            });
            apiMessages.push({
              role: "tool",
              toolCallId: call.id,
              content: JSON.stringify(result.success ? result.data : { error: result.error }),
            });
          }
        }
        // 如果达到最大迭代次数，提示用户
        if (iterations >= maxIterations) {
          const limitWarning = `\n\n> ⚠️ 工具调用已达上限（${maxIterations}次），任务可能未完成。请继续对话让我完成剩余工作。`;
          appendStreamingText(limitWarning);
          const thinkingContent = useAIStore.getState().thinkingText;
          const currentContent = useAIStore.getState().streamingText || "";
          updateLastMessage(
            stripThinkingTags(currentContent),
            thinkingContent ? { thinkingContent } : undefined,
          );
        }
        setStreamingText("");
        setLoading(false);
        processQueue();
      } else if (useThinkingUIMode) {
        // === Thinking UI 模式：使用结构化 JSON 输出 ===
        addMessage({ role: "assistant", content: "", mode });
        resetThinkingUI();
        setThinkingUIStartTime(Date.now());

        // 使用 Thinking UI 专用提示词
        const thinkingUIMessages = [
          { role: "system" as const, content: getThinkingUISystemPrompt() },
          ...chatHistory,
          { role: "user" as const, content: buildThinkingUIUserMessage(finalContent) },
        ];

        const cleanup = window.mindcode?.ai?.chatStream?.(effectiveModel, thinkingUIMessages, {
          onToken: (token: string) => handleThinkingUIToken(token),
          onComplete: (_fullText: string, meta?: { model: string; usedFallback: boolean }) => {
            const parsed = finishThinkingUI();
            if (parsed) {
              // Thinking UI 模式下，final_answer 作为消息内容
              let suffix = meta?.usedFallback ? `\n\n*已自动切换到 ${meta.model}*` : "";
              if (askingModelIdentity) {
                suffix += getModelInfoSuffix(model, modelInfo.name, modelInfo.provider);
              }
              updateLastMessage(parsed.final_answer + suffix, { thinkingUI: parsed });
            } else {
              // 解析失败，使用原始文本
              updateLastMessage(thinkingUIBufferRef.current);
            }
            resetThinkingUI();
            setLoading(false);
            stopStreamRef.current = null;
            processQueue();
          },
          onError: (error: string) => {
            updateLastMessage(error);
            resetThinkingUI();
            setLoading(false);
            stopStreamRef.current = null;
            processQueue();
          },
          onFallback: (from: string, to: string) => {
            log.info(`Thinking UI fallback: ${from} -> ${to}`);
          },
        });
        stopStreamRef.current = cleanup || null;
      } else {
        // === 传统模式：使用 <thinking> 标签 ===
        addMessage({ role: "assistant", content: "", mode });
        resetThinkingState();
        const cleanup = window.mindcode?.ai?.chatStream?.(effectiveModel, apiMessages, {
          onToken: (token: string) => handleStreamToken(token),
          onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => {
            // 清理 thinking 标签后的文本
            const cleanedText = stripThinkingTags(fullText);
            const plan = mode === "plan" ? parsePlan(cleanedText) : null;
            let suffix = meta?.usedFallback ? `\n\n*已自动切换到 ${meta.model}*` : "";
            // 如果是询问模型身份的问题，追加实际模型信息
            if (askingModelIdentity) {
              suffix += getModelInfoSuffix(model, modelInfo.name, modelInfo.provider);
            }
            const savedThinking = useAIStore.getState().thinkingText; // 保存思考内容
            updateLastMessage(cleanedText + suffix, {
              ...(plan ? { plan } : {}),
              ...(savedThinking ? { thinkingContent: savedThinking } : {}),
            });
            if (plan) setPlan(plan);
            setStreamingText("");
            resetThinkingState();
            setLoading(false);
            stopStreamRef.current = null;
            processQueue();
          },
          onError: (error: string) => {
            updateLastMessage(error);
            setStreamingText("");
            resetThinkingState();
            setLoading(false);
            stopStreamRef.current = null;
            processQueue();
          },
          onFallback: (from: string, to: string) => {
            appendStreamingText(`\n\n> ⚠️ ${from} 服务繁忙，已自动切换到 ${to}\n\n`);
          },
        });
        stopStreamRef.current = cleanup || null;
      }
      return false;
    },
    [
      model,
      mode,
      isLoading,
      contexts,
      getSystemPrompt,
      getTools,
      addMessage,
      setLoading,
      setStreamingText,
      appendStreamingText,
      updateLastMessage,
      updateLastMessageToolCall,
      executeTool,
      confirmTool,
      parsePlan,
      setPlan,
      enqueueMessage,
      dequeueMessage,
      getCurrentConversation,
      // Thinking UI 相关依赖
      useThinkingUIMode,
      handleThinkingUIToken,
      finishThinkingUI,
      resetThinkingUI,
      getThinkingUISystemPrompt,
      buildThinkingUIUserMessage,
      setThinkingUIStartTime,
    ],
  );

  // 停止生成
  const handleStop = useCallback(() => {
    stopStreamRef.current?.();
    abortRef.current = true;
    if (streamingText) {
      updateLastMessage(streamingText + "\n\n[已停止]");
    }
    setStreamingText("");
    setLoading(false);
  }, [streamingText, updateLastMessage, setStreamingText, setLoading]);

  return {
    handleSend,
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
  };
}
