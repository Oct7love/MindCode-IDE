import { create } from "zustand";
import {
  loadConversations,
  loadConversationsAsync,
  saveConversations,
} from "@services/conversationPersistence";

export type AIMode = "chat" | "plan" | "agent" | "debug";
export type ContextType =
  | "file"
  | "selection"
  | "folder"
  | "symbol"
  | "error"
  | "terminal"
  | "diff";

export interface ContextItem {
  id: string;
  type: ContextType;
  label: string;
  data: { path?: string; content?: string; range?: { start: number; end: number } };
  locked?: boolean;
}

export interface ToolCallStatus {
  id: string;
  name: string;
  args: any;
  status: "pending" | "running" | "success" | "failed";
  result?: any;
  error?: string;
}

// Thinking UI 相关类型
export interface ThinkingUIData {
  ui: {
    title: string;
    mode: "thinking" | "answering" | "done";
    model: string;
    language: string;
    time_ms: number;
  };
  thought_summary: string[];
  trace: TraceEvent[];
  final_answer: string;
}

export interface TraceEvent {
  stage: "read" | "analyze" | "search" | "plan" | "edit" | "test" | "answer";
  label: string;
  status: "running" | "ok" | "warn" | "fail";
}

// 图片附件
export interface ImageAttachment {
  id: string;
  data: string; // base64 数据 (用于 API 请求)
  blobUrl?: string; // Blob URL (用于显示，更可靠)
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | string;
  name?: string;
  size?: number; // 字节数
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  mode?: AIMode; // 发送时的模式
  contexts?: ContextItem[]; // 消息关联的上下文
  images?: ImageAttachment[]; // 图片附件
  toolCalls?: ToolCallStatus[]; // 工具调用及状态
  toolCallId?: string; // tool 消息的调用 ID
  plan?: Plan; // Plan 模式生成的计划
  thinkingUI?: ThinkingUIData; // Thinking UI 结构化数据
  thinkingContent?: string; // 思考过程内容（完成后保留用于折叠显示）
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  model: string;
}

export interface Plan {
  id: string;
  title: string;
  goal: string;
  assumptions: string[];
  milestones: { id: string; label: string; estimated: string; completed: boolean }[];
  tasks: { id: string; label: string; completed: boolean }[];
  risks: string[];
  status: "draft" | "locked" | "executing" | "completed";
  version: number;
}

export interface AgentStep {
  id: string;
  label: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  output?: string;
}

export interface QueuedMessage {
  id: string;
  content: string;
  contexts: ContextItem[];
  mode: AIMode;
  timestamp: Date;
}

// Phase 4: 待处理的代码变更
export interface PendingChange {
  id: string;
  path: string;
  oldContent: string;
  newContent: string;
  status: "pending" | "applied" | "rejected";
  messageId?: string; // 关联的消息 ID
  timestamp: Date;
}

interface AIState {
  mode: AIMode; // 当前模式
  model: string; // 当前模型（effectiveModel）
  modelByMode: Record<AIMode, string>; // 每模式独立存储模型选择
  conversations: Conversation[]; // 对话列表
  activeConversationId: string | null; // 当前对话 ID
  contexts: ContextItem[]; // 当前上下文
  isLoading: boolean; // 是否正在加载
  streamingText: string; // 流式输出文本
  thinkingText: string; // 思考过程文本
  isThinking: boolean; // 是否正在思考
  isPinned: boolean; // 面板是否固定
  currentPlan: Plan | null; // 当前 Plan
  agentSteps: AgentStep[]; // Agent 执行步骤
  debugInfo: { title: string; description: string; observations: string[] } | null; // 调试信息
  messageQueue: QueuedMessage[]; // 消息队列（AI 输出时用户发送的消息）
  isProcessingQueue: boolean; // 是否正在处理队列
  pendingChanges: PendingChange[]; // Phase 4: 待处理的代码变更
  // Thinking UI 相关
  thinkingUIData: Partial<ThinkingUIData> | null; // 当前流式 Thinking UI 数据
  thinkingUIStartTime: number | null; // Thinking UI 开始时间
  useThinkingUIMode: boolean; // 是否启用 Thinking UI 模式
  // 智能模型路由
  useSmartRouting: boolean; // 是否启用智能路由（自动选择 Haiku/Sonnet/Opus）
  lastRoutingDecision: { model: string; taskType: string; reason: string } | null; // 上次路由决策
}

interface AIActions {
  setMode: (mode: AIMode) => void;
  setModel: (model: string) => void;
  addContext: (item: ContextItem) => void;
  removeContext: (id: string) => void;
  clearContexts: () => void;
  setLoading: (loading: boolean) => void;
  setStreamingText: (text: string) => void;
  appendStreamingText: (text: string) => void;
  setThinkingText: (text: string) => void;
  appendThinkingText: (text: string) => void;
  setIsThinking: (thinking: boolean) => void;
  setPinned: (pinned: boolean) => void;
  createConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearConversation: (id: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  updateLastMessage: (content: string, extra?: Partial<Message>) => void;
  updateLastMessageToolCall: (toolCallId: string, update: Partial<ToolCallStatus>) => void;
  deleteLastMessage: () => void;
  getCurrentConversation: () => Conversation | undefined;
  setPlan: (plan: Plan | null) => void;
  updatePlanTask: (taskId: string, completed: boolean) => void;
  setAgentSteps: (steps: AgentStep[]) => void;
  updateAgentStep: (stepId: string, status: AgentStep["status"]) => void;
  setDebugInfo: (info: AIState["debugInfo"]) => void;
  // 消息队列相关
  enqueueMessage: (content: string, contexts: ContextItem[], mode: AIMode) => void;
  dequeueMessage: () => QueuedMessage | undefined;
  clearMessageQueue: () => void;
  setProcessingQueue: (processing: boolean) => void;
  getNextQueuedMessage: () => QueuedMessage | undefined;
  // Phase 4: 待处理变更相关
  addPendingChange: (change: Omit<PendingChange, "id" | "timestamp" | "status">) => string;
  updatePendingChangeStatus: (id: string, status: PendingChange["status"]) => void;
  removePendingChange: (id: string) => void;
  clearPendingChanges: () => void;
  getPendingChangeByPath: (path: string) => PendingChange | undefined;
  // Thinking UI 相关
  setThinkingUIData: (data: Partial<ThinkingUIData> | null) => void;
  setThinkingUIStartTime: (time: number | null) => void;
  setUseThinkingUIMode: (use: boolean) => void;
  updateLastMessageThinkingUI: (data: ThinkingUIData) => void;
  // 智能模型路由
  setUseSmartRouting: (use: boolean) => void;
  setLastRoutingDecision: (
    decision: { model: string; taskType: string; reason: string } | null,
  ) => void;
}

const DEFAULT_MODEL = "claude-opus-4-6";

// 流式文本缓冲区：批量刷入 zustand state（16ms ≈ 60fps），避免逐 token 触发 React 重渲染
let _streamBuf = "";
let _thinkBuf = "";
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function cancelFlush(): void {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
}

function scheduleFlush(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    const state = useAIStore.getState();
    const updates: Partial<AIState> = {};
    if (_streamBuf) {
      updates.streamingText = state.streamingText + _streamBuf;
      _streamBuf = "";
    }
    if (_thinkBuf) {
      updates.thinkingText = state.thinkingText + _thinkBuf;
      _thinkBuf = "";
    }
    if (Object.keys(updates).length > 0) {
      useAIStore.setState(updates);
    }
  }, 16);
}

const defaultConversation: Conversation = {
  id: "1",
  title: "新对话",
  messages: [
    { id: "1", role: "assistant", content: "有什么我可以帮你的吗？", timestamp: new Date() },
  ],
  createdAt: new Date().toISOString(),
  model: DEFAULT_MODEL,
};

export const useAIStore = create<AIState & AIActions>((set, get) => {
  const initialConversations = loadConversations([defaultConversation]);

  return {
    mode: "chat",
    model: DEFAULT_MODEL,
    modelByMode: {
      chat: DEFAULT_MODEL,
      plan: DEFAULT_MODEL,
      agent: DEFAULT_MODEL,
      debug: DEFAULT_MODEL,
    },
    conversations: initialConversations,
    activeConversationId: initialConversations[0]?.id || "1",
    contexts: [],
    isLoading: false,
    streamingText: "",
    thinkingText: "",
    isThinking: false,
    isPinned: false,
    currentPlan: null,
    agentSteps: [],
    debugInfo: null,
    messageQueue: [],
    isProcessingQueue: false,
    pendingChanges: [],
    thinkingUIData: null,
    thinkingUIStartTime: null,
    useThinkingUIMode: false, // 默认关闭，可通过设置开启
    // 智能模型路由
    useSmartRouting: false, // 默认关闭，选什么模型就用什么模型
    lastRoutingDecision: null,

    setMode: (mode) => set((state) => ({ mode, model: state.modelByMode[mode] })),
    setModel: (model) =>
      set((state) => ({ model, modelByMode: { ...state.modelByMode, [state.mode]: model } })),

    addContext: (item) => set((state) => ({ contexts: [...state.contexts, item] })),
    removeContext: (id) =>
      set((state) => ({ contexts: state.contexts.filter((c) => c.id !== id && !c.locked) })),
    clearContexts: () => set({ contexts: [] }),

    setLoading: (isLoading) => set({ isLoading }),
    setStreamingText: (streamingText) => {
      _streamBuf = "";
      cancelFlush();
      set({ streamingText });
    },
    appendStreamingText: (text) => {
      _streamBuf += text;
      scheduleFlush();
    },
    setThinkingText: (thinkingText) => {
      _thinkBuf = "";
      cancelFlush();
      set({ thinkingText });
    },
    appendThinkingText: (text) => {
      _thinkBuf += text;
      scheduleFlush();
    },
    setIsThinking: (isThinking) => set({ isThinking }),
    setPinned: (isPinned) => set({ isPinned }),

    createConversation: () => {
      const id = Date.now().toString();
      const newConv: Conversation = {
        id,
        title: "新对话",
        messages: [
          { id: "1", role: "assistant", content: "有什么我可以帮你的吗？", timestamp: new Date() },
        ],
        createdAt: new Date().toISOString(),
        model: get().model,
      };
      set((state) => {
        const newConversations = [newConv, ...state.conversations];
        saveConversations(newConversations);
        return {
          conversations: newConversations,
          activeConversationId: id,
          // 清理所有流式状态，防止渲染污染
          streamingText: "",
          thinkingText: "",
          isThinking: false,
          isLoading: false,
          thinkingUIData: null,
          thinkingUIStartTime: null,
        };
      });
      return id;
    },

    switchConversation: (id) =>
      set({
        activeConversationId: id,
        // 清理所有流式状态，防止渲染污染
        streamingText: "",
        thinkingText: "",
        isThinking: false,
        isLoading: false,
        thinkingUIData: null,
        thinkingUIStartTime: null,
      }),

    deleteConversation: (id) =>
      set((state) => {
        const filtered = state.conversations.filter((c) => c.id !== id);
        if (filtered.length === 0) {
          const newConv: Conversation = {
            ...defaultConversation,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
          };
          saveConversations([newConv]);
          return { conversations: [newConv], activeConversationId: newConv.id };
        }
        const newActiveId =
          state.activeConversationId === id ? filtered[0].id : state.activeConversationId;
        saveConversations(filtered);
        return { conversations: filtered, activeConversationId: newActiveId };
      }),

    renameConversation: (id, title) =>
      set((state) => {
        const newConversations = state.conversations.map((c) =>
          c.id === id ? { ...c, title } : c,
        );
        saveConversations(newConversations);
        return { conversations: newConversations };
      }),

    clearConversation: (id) =>
      set((state) => {
        const newConversations = state.conversations.map((c) =>
          c.id === id
            ? {
                ...c,
                messages: [
                  {
                    id: "1",
                    role: "assistant" as const,
                    content: "有什么我可以帮你的吗？",
                    timestamp: new Date(),
                  },
                ],
                title: "新对话",
              }
            : c,
        );
        saveConversations(newConversations);
        return { conversations: newConversations };
      }),

    addMessage: (message) =>
      set((state) => {
        const msg: Message = {
          ...message,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date(),
          mode: message.mode || state.mode,
        };
        const activeId = state.activeConversationId;
        const idx = state.conversations.findIndex((c) => c.id === activeId);
        if (idx === -1) return {};
        const conv = state.conversations[idx];
        const title =
          message.role === "user" && conv.messages.length <= 1
            ? message.content.slice(0, 20) + (message.content.length > 20 ? "..." : "")
            : conv.title;
        const updatedConv = { ...conv, messages: [...conv.messages, msg], title };
        const newConversations = [...state.conversations];
        newConversations[idx] = updatedConv;
        saveConversations(newConversations);
        return { conversations: newConversations };
      }),

    updateLastMessage: (content, extra) =>
      set((state) => {
        const activeId = state.activeConversationId;
        const idx = state.conversations.findIndex((c) => c.id === activeId);
        if (idx === -1) return {};
        const conv = state.conversations[idx];
        const msgs = [...conv.messages];
        if (msgs.length > 0)
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, ...extra };
        const newConversations = [...state.conversations];
        newConversations[idx] = { ...conv, messages: msgs };
        saveConversations(newConversations);
        return { conversations: newConversations };
      }),

    updateLastMessageToolCall: (toolCallId, update) =>
      set((state) => {
        const activeId = state.activeConversationId;
        const idx = state.conversations.findIndex((c) => c.id === activeId);
        if (idx === -1) return {};
        const conv = state.conversations[idx];
        const msgs = [...conv.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].toolCalls) {
          msgs[msgs.length - 1] = {
            ...msgs[msgs.length - 1],
            toolCalls: msgs[msgs.length - 1].toolCalls!.map((tc) =>
              tc.id === toolCallId ? { ...tc, ...update } : tc,
            ),
          };
        }
        const newConversations = [...state.conversations];
        newConversations[idx] = { ...conv, messages: msgs };
        saveConversations(newConversations);
        return { conversations: newConversations };
      }),

    deleteLastMessage: () =>
      set((state) => {
        const activeId = state.activeConversationId;
        const idx = state.conversations.findIndex((c) => c.id === activeId);
        if (idx === -1) return {};
        const conv = state.conversations[idx];
        const newConversations = [...state.conversations];
        newConversations[idx] = { ...conv, messages: conv.messages.slice(0, -1) };
        saveConversations(newConversations);
        return { conversations: newConversations };
      }),

    getCurrentConversation: () => {
      const state = get();
      return state.conversations.find((c) => c.id === state.activeConversationId);
    },

    setPlan: (currentPlan) => set({ currentPlan }),
    updatePlanTask: (taskId, completed) =>
      set((state) => {
        if (!state.currentPlan) return {};
        return {
          currentPlan: {
            ...state.currentPlan,
            tasks: state.currentPlan.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
          },
        };
      }),

    setAgentSteps: (agentSteps) => set({ agentSteps }),
    updateAgentStep: (stepId, status) =>
      set((state) => ({
        agentSteps: state.agentSteps.map((s) => (s.id === stepId ? { ...s, status } : s)),
      })),

    setDebugInfo: (debugInfo) => set({ debugInfo }),

    // 消息队列相关
    enqueueMessage: (content, contexts, mode) =>
      set((state) => ({
        messageQueue: [
          ...state.messageQueue,
          {
            id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            content,
            contexts: [...contexts],
            mode,
            timestamp: new Date(),
          },
        ],
      })),

    dequeueMessage: () => {
      const state = get();
      if (state.messageQueue.length === 0) return undefined;
      const [first, ...rest] = state.messageQueue;
      set({ messageQueue: rest });
      return first;
    },

    clearMessageQueue: () => set({ messageQueue: [] }),

    setProcessingQueue: (isProcessingQueue) => set({ isProcessingQueue }),

    getNextQueuedMessage: () => {
      const state = get();
      return state.messageQueue[0];
    },

    // Phase 4: 待处理变更相关
    addPendingChange: (change) => {
      const id = `pc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      set((state) => ({
        pendingChanges: [
          ...state.pendingChanges,
          {
            ...change,
            id,
            status: "pending",
            timestamp: new Date(),
          },
        ],
      }));
      return id;
    },

    updatePendingChangeStatus: (id, status) =>
      set((state) => ({
        pendingChanges: state.pendingChanges.map((pc) => (pc.id === id ? { ...pc, status } : pc)),
      })),

    removePendingChange: (id) =>
      set((state) => ({
        pendingChanges: state.pendingChanges.filter((pc) => pc.id !== id),
      })),

    clearPendingChanges: () => set({ pendingChanges: [] }),

    getPendingChangeByPath: (path) => {
      const state = get();
      return state.pendingChanges.find((pc) => pc.path === path && pc.status === "pending");
    },

    // Thinking UI 相关
    setThinkingUIData: (thinkingUIData) => set({ thinkingUIData }),

    setThinkingUIStartTime: (thinkingUIStartTime) => set({ thinkingUIStartTime }),

    setUseThinkingUIMode: (useThinkingUIMode) => set({ useThinkingUIMode }),

    updateLastMessageThinkingUI: (data) =>
      set((state) => {
        const convId = state.activeConversationId;
        if (!convId) return state;
        const updatedConversations = state.conversations.map((c) => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
            msgs[lastIdx] = { ...msgs[lastIdx], thinkingUI: data, content: data.final_answer };
          }
          return { ...c, messages: msgs };
        });
        saveConversations(updatedConversations);
        return { conversations: updatedConversations };
      }),

    // 智能模型路由
    setUseSmartRouting: (useSmartRouting) => set({ useSmartRouting }),

    setLastRoutingDecision: (lastRoutingDecision) => set({ lastRoutingDecision }),
  };
});

// 启动后异步从 IndexedDB 升级对话数据（如有更新版本）
loadConversationsAsync()
  .then((idbConversations) => {
    if (!idbConversations?.length) return;
    const current = useAIStore.getState().conversations;
    // IndexedDB 数据比 localStorage 更完整时才替换
    if (idbConversations.length >= current.length) {
      useAIStore.setState({ conversations: idbConversations });
      console.log("[AIStore] 对话已从 IndexedDB 升级");
    }
  })
  .catch(() => {
    /* IndexedDB 不可用，静默降级 */
  });
