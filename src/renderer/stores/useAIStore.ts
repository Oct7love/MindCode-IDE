import { create } from 'zustand';

export type AIMode = 'chat' | 'plan' | 'agent' | 'debug';
export type ContextType = 'file' | 'selection' | 'folder' | 'symbol' | 'error' | 'terminal' | 'diff';

export interface ContextItem {
  id: string;
  type: ContextType;
  label: string;
  data: { path?: string; content?: string; range?: { start: number; end: number } };
  locked?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  contexts?: ContextItem[]; // 消息关联的上下文
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

interface AIState {
  mode: AIMode; // 当前模式
  model: string; // 当前模型
  conversations: Conversation[]; // 对话列表
  activeConversationId: string | null; // 当前对话 ID
  contexts: ContextItem[]; // 当前上下文
  isLoading: boolean; // 是否正在加载
  streamingText: string; // 流式输出文本
  isPinned: boolean; // 面板是否固定
  currentPlan: Plan | null; // 当前 Plan
  agentSteps: AgentStep[]; // Agent 执行步骤
  debugInfo: { title: string; description: string; observations: string[] } | null; // 调试信息
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
  createConversation: () => string; // 返回新对话 ID
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (content: string) => void;
  getCurrentConversation: () => Conversation | undefined;
  setPlan: (plan: Plan | null) => void;
  updatePlanTask: (taskId: string, completed: boolean) => void;
  setAgentSteps: (steps: AgentStep[]) => void;
  updateAgentStep: (stepId: string, status: AgentStep['status']) => void;
  setDebugInfo: (info: AIState['debugInfo']) => void;
}

const defaultConversation: Conversation = {
  id: '1',
  title: '新对话',
  messages: [{ id: '1', role: 'assistant', content: '有什么我可以帮你的吗？', timestamp: new Date() }],
  createdAt: new Date().toISOString(),
  model: 'claude-opus-4-5-thinking'
};

export const useAIStore = create<AIState & AIActions>((set, get) => ({
  mode: 'chat',
  model: 'claude-opus-4-5-thinking',
  conversations: [defaultConversation],
  activeConversationId: '1',
  contexts: [],
  isLoading: false,
  streamingText: '',
  isPinned: false,
  currentPlan: null,
  agentSteps: [],
  debugInfo: null,

  setMode: (mode) => set({ mode }),
  setModel: (model) => set({ model }),
  
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
    set((state) => ({ conversations: [newConv, ...state.conversations], activeConversationId: id, streamingText: '', isLoading: false }));
    return id;
  },

  switchConversation: (id) => set({ activeConversationId: id, streamingText: '', isLoading: false }),
  
  deleteConversation: (id) => set((state) => {
    const filtered = state.conversations.filter(c => c.id !== id);
    if (filtered.length === 0) {
      const newConv: Conversation = { ...defaultConversation, id: Date.now().toString(), createdAt: new Date().toISOString() };
      return { conversations: [newConv], activeConversationId: newConv.id };
    }
    const newActiveId = state.activeConversationId === id ? filtered[0].id : state.activeConversationId;
    return { conversations: filtered, activeConversationId: newActiveId };
  }),

  addMessage: (message) => set((state) => {
    const msg: Message = { ...message, id: Date.now().toString(), timestamp: new Date() };
    return {
      conversations: state.conversations.map(c => {
        if (c.id !== state.activeConversationId) return c;
        const title = message.role === 'user' && c.messages.length <= 1 
          ? message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '') 
          : c.title;
        return { ...c, messages: [...c.messages, msg], title };
      })
    };
  }),

  updateLastMessage: (content) => set((state) => ({
    conversations: state.conversations.map(c => {
      if (c.id !== state.activeConversationId) return c;
      const msgs = [...c.messages];
      if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
      return { ...c, messages: msgs };
    })
  })),

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
}));
