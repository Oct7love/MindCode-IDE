import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AIMode = 'chat' | 'plan' | 'agent' | 'debug';
export type ContextType = 'file' | 'selection' | 'folder' | 'symbol' | 'error' | 'terminal' | 'diff';

export interface ContextItem {
  id: string;
  type: ContextType;
  label: string;
  data: { path?: string; content?: string; range?: { start: number; end: number } };
  locked?: boolean;
}

export interface ToolCallStatus { id: string; name: string; args: any; status: 'pending' | 'running' | 'success' | 'failed'; result?: any; error?: string; }

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  mode?: AIMode; // 发送时的模式
  contexts?: ContextItem[]; // 消息关联的上下文
  toolCalls?: ToolCallStatus[]; // 工具调用及状态
  toolCallId?: string; // tool 消息的调用 ID
  plan?: Plan; // Plan 模式生成的计划
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
  status: 'draft' | 'locked' | 'executing' | 'completed';
  version: number;
}

export interface AgentStep {
  id: string;
  label: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  output?: string;
}

export interface QueuedMessage {
  id: string;
  content: string;
  contexts: ContextItem[];
  mode: AIMode;
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
  isPinned: boolean; // 面板是否固定
  currentPlan: Plan | null; // 当前 Plan
  agentSteps: AgentStep[]; // Agent 执行步骤
  debugInfo: { title: string; description: string; observations: string[] } | null; // 调试信息
  messageQueue: QueuedMessage[]; // 消息队列（AI 输出时用户发送的消息）
  isProcessingQueue: boolean; // 是否正在处理队列
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
  setPinned: (pinned: boolean) => void;
  createConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearConversation: (id: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (content: string, extra?: Partial<Message>) => void;
  updateLastMessageToolCall: (toolCallId: string, update: Partial<ToolCallStatus>) => void;
  deleteLastMessage: () => void;
  getCurrentConversation: () => Conversation | undefined;
  setPlan: (plan: Plan | null) => void;
  updatePlanTask: (taskId: string, completed: boolean) => void;
  setAgentSteps: (steps: AgentStep[]) => void;
  updateAgentStep: (stepId: string, status: AgentStep['status']) => void;
  setDebugInfo: (info: AIState['debugInfo']) => void;
  // 消息队列相关
  enqueueMessage: (content: string, contexts: ContextItem[], mode: AIMode) => void;
  dequeueMessage: () => QueuedMessage | undefined;
  clearMessageQueue: () => void;
  setProcessingQueue: (processing: boolean) => void;
  getNextQueuedMessage: () => QueuedMessage | undefined;
}

const DEFAULT_MODEL = 'claude-opus-4-5-thinking';
const STORAGE_KEY = 'mindcode-ai-conversations';

const defaultConversation: Conversation = {
  id: '1',
  title: '新对话',
  messages: [{ id: '1', role: 'assistant', content: '有什么我可以帮你的吗？', timestamp: new Date() }],
  createdAt: new Date().toISOString(),
  model: DEFAULT_MODEL
};

// 从 localStorage 加载对话
const loadConversations = (): Conversation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 恢复 Date 对象
      return parsed.map((c: any) => ({
        ...c,
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      }));
    }
  } catch (e) { console.error('[AI Store] Load conversations failed:', e); }
  return [defaultConversation];
};

// 保存对话到 localStorage
const saveConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) { console.error('[AI Store] Save conversations failed:', e); }
};

export const useAIStore = create<AIState & AIActions>((set, get) => {
  const initialConversations = loadConversations();

  return {
    mode: 'chat',
    model: DEFAULT_MODEL,
    modelByMode: { chat: DEFAULT_MODEL, plan: DEFAULT_MODEL, agent: DEFAULT_MODEL, debug: DEFAULT_MODEL },
    conversations: initialConversations,
    activeConversationId: initialConversations[0]?.id || '1',
    contexts: [],
    isLoading: false,
    streamingText: '',
    isPinned: false,
    currentPlan: null,
    agentSteps: [],
    debugInfo: null,
    messageQueue: [],
    isProcessingQueue: false,

    setMode: (mode) => set((state) => ({ mode, model: state.modelByMode[mode] })),
    setModel: (model) => set((state) => ({ model, modelByMode: { ...state.modelByMode, [state.mode]: model } })),

    addContext: (item) => set((state) => ({ contexts: [...state.contexts, item] })),
    removeContext: (id) => set((state) => ({ contexts: state.contexts.filter(c => c.id !== id && !c.locked) })),
    clearContexts: () => set({ contexts: [] }),

    setLoading: (isLoading) => set({ isLoading }),
    setStreamingText: (streamingText) => set({ streamingText }),
    appendStreamingText: (text) => set((state) => ({ streamingText: state.streamingText + text })),
    setPinned: (isPinned) => set({ isPinned }),

    createConversation: () => {
      const id = Date.now().toString();
      const newConv: Conversation = {
        id,
        title: '新对话',
        messages: [{ id: '1', role: 'assistant', content: '有什么我可以帮你的吗？', timestamp: new Date() }],
        createdAt: new Date().toISOString(),
        model: get().model
      };
      set((state) => {
        const newConversations = [newConv, ...state.conversations];
        saveConversations(newConversations);
        return { conversations: newConversations, activeConversationId: id, streamingText: '', isLoading: false };
      });
      return id;
    },

    switchConversation: (id) => set({ activeConversationId: id, streamingText: '', isLoading: false }),

    deleteConversation: (id) => set((state) => {
      const filtered = state.conversations.filter(c => c.id !== id);
      if (filtered.length === 0) {
        const newConv: Conversation = { ...defaultConversation, id: Date.now().toString(), createdAt: new Date().toISOString() };
        saveConversations([newConv]);
        return { conversations: [newConv], activeConversationId: newConv.id };
      }
      const newActiveId = state.activeConversationId === id ? filtered[0].id : state.activeConversationId;
      saveConversations(filtered);
      return { conversations: filtered, activeConversationId: newActiveId };
    }),

    renameConversation: (id, title) => set((state) => {
      const newConversations = state.conversations.map(c => c.id === id ? { ...c, title } : c);
      saveConversations(newConversations);
      return { conversations: newConversations };
    }),

    clearConversation: (id) => set((state) => {
      const newConversations = state.conversations.map(c =>
        c.id === id
          ? { ...c, messages: [{ id: '1', role: 'assistant' as const, content: '有什么我可以帮你的吗？', timestamp: new Date() }], title: '新对话' }
          : c
      );
      saveConversations(newConversations);
      return { conversations: newConversations };
    }),

    addMessage: (message) => set((state) => {
      const msg: Message = { ...message, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: new Date(), mode: message.mode || state.mode };
      const newConversations = state.conversations.map(c => {
        if (c.id !== state.activeConversationId) return c;
        const title = message.role === 'user' && c.messages.length <= 1 ? message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '') : c.title;
        return { ...c, messages: [...c.messages, msg], title };
      });
      saveConversations(newConversations);
      return { conversations: newConversations };
    }),

    updateLastMessage: (content, extra) => set((state) => {
      const newConversations = state.conversations.map(c => {
        if (c.id !== state.activeConversationId) return c;
        const msgs = [...c.messages];
        if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, ...extra };
        return { ...c, messages: msgs };
      });
      saveConversations(newConversations);
      return { conversations: newConversations };
    }),

    updateLastMessageToolCall: (toolCallId, update) => set((state) => {
      const newConversations = state.conversations.map(c => {
        if (c.id !== state.activeConversationId) return c;
        const msgs = [...c.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].toolCalls) {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], toolCalls: msgs[msgs.length - 1].toolCalls!.map(tc => tc.id === toolCallId ? { ...tc, ...update } : tc) };
        }
        return { ...c, messages: msgs };
      });
      saveConversations(newConversations);
      return { conversations: newConversations };
    }),

    deleteLastMessage: () => set((state) => {
      const newConversations = state.conversations.map(c => {
        if (c.id !== state.activeConversationId) return c;
        return { ...c, messages: c.messages.slice(0, -1) };
      });
      saveConversations(newConversations);
      return { conversations: newConversations };
    }),

    getCurrentConversation: () => {
      const state = get();
      return state.conversations.find(c => c.id === state.activeConversationId);
    },

    setPlan: (currentPlan) => set({ currentPlan }),
    updatePlanTask: (taskId, completed) => set((state) => {
      if (!state.currentPlan) return {};
      return {
        currentPlan: {
          ...state.currentPlan,
          tasks: state.currentPlan.tasks.map(t => t.id === taskId ? { ...t, completed } : t)
        }
      };
    }),

    setAgentSteps: (agentSteps) => set({ agentSteps }),
    updateAgentStep: (stepId, status) => set((state) => ({
      agentSteps: state.agentSteps.map(s => s.id === stepId ? { ...s, status } : s)
    })),

    setDebugInfo: (debugInfo) => set({ debugInfo }),

    // 消息队列相关
    enqueueMessage: (content, contexts, mode) => set((state) => ({
      messageQueue: [...state.messageQueue, {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content,
        contexts: [...contexts],
        mode,
        timestamp: new Date()
      }]
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
  };
});
