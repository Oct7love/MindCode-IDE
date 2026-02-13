import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAIStore } from "@stores/useAIStore";
import type { AIMode, ContextItem } from "@stores/useAIStore";

// mock 持久化，避免副作用
vi.mock("@services/conversationPersistence", () => ({
  loadConversations: (fallback: unknown[]) => fallback,
  saveConversations: vi.fn(),
}));

const act = <T>(fn: () => T): T => fn();

beforeEach(() => {
  // 重置 store 到初始状态
  useAIStore.setState(useAIStore.getInitialState());
});

describe("useAIStore", () => {
  describe("初始状态", () => {
    it("mode 默认为 chat", () => {
      expect(useAIStore.getState().mode).toBe("chat");
    });

    it("model 默认值存在", () => {
      expect(useAIStore.getState().model).toBeTruthy();
    });

    it("conversations 非空", () => {
      expect(useAIStore.getState().conversations.length).toBeGreaterThan(0);
    });

    it("activeConversationId 指向第一个对话", () => {
      const { activeConversationId, conversations } = useAIStore.getState();
      expect(activeConversationId).toBe(conversations[0].id);
    });
  });

  describe("setMode", () => {
    it("切换模式并同步 model", () => {
      const { setMode, setModel } = useAIStore.getState();

      // 先给 plan 模式设定一个不同的模型
      act(() => setMode("plan"));
      act(() => setModel("plan-model"));

      // 切回 chat
      act(() => setMode("chat"));
      const state1 = useAIStore.getState();
      expect(state1.mode).toBe("chat");
      expect(state1.model).toBe(state1.modelByMode.chat);

      // 切到 plan，应恢复之前设定的模型
      act(() => setMode("plan"));
      expect(useAIStore.getState().model).toBe("plan-model");
    });

    it("支持所有模式类型", () => {
      const modes: AIMode[] = ["chat", "plan", "agent", "debug"];
      modes.forEach((m) => {
        act(() => useAIStore.getState().setMode(m));
        expect(useAIStore.getState().mode).toBe(m);
      });
    });
  });

  describe("createConversation", () => {
    it("创建新对话并切换到它", () => {
      const prevLen = useAIStore.getState().conversations.length;
      const id = act(() => useAIStore.getState().createConversation());

      const state = useAIStore.getState();
      expect(state.conversations.length).toBe(prevLen + 1);
      expect(state.activeConversationId).toBe(id);
      expect(state.conversations.find((c) => c.id === id)).toBeDefined();
    });

    it('新对话标题为"新对话"', () => {
      const id = act(() => useAIStore.getState().createConversation());
      const conv = useAIStore.getState().conversations.find((c) => c.id === id);
      expect(conv?.title).toBe("新对话");
    });
  });

  describe("deleteConversation", () => {
    it("正常删除一个对话", () => {
      // 初始状态只有 1 个默认对话
      const initialId = useAIStore.getState().conversations[0].id;
      const newId = act(() => useAIStore.getState().createConversation());
      // 确保新 ID 与初始 ID 不同
      expect(newId).not.toBe(initialId);

      act(() => useAIStore.getState().deleteConversation(newId));
      const state = useAIStore.getState();
      expect(state.conversations.length).toBe(1);
      expect(state.conversations.find((c) => c.id === newId)).toBeUndefined();
      expect(state.conversations[0].id).toBe(initialId);
    });

    it("删除最后一个对话时自动创建新对话", () => {
      // 清到只剩一个
      const state0 = useAIStore.getState();
      const ids = state0.conversations.map((c) => c.id);
      // 只保留第一个，删其他
      ids.slice(1).forEach((id) => act(() => useAIStore.getState().deleteConversation(id)));
      const lastId = useAIStore.getState().conversations[0].id;

      act(() => useAIStore.getState().deleteConversation(lastId));
      const state = useAIStore.getState();
      expect(state.conversations.length).toBe(1);
      expect(state.activeConversationId).toBeTruthy();
    });
  });

  describe("addMessage", () => {
    it("添加消息到当前对话", () => {
      const before = useAIStore.getState().getCurrentConversation();
      const msgCount = before?.messages.length ?? 0;

      act(() => useAIStore.getState().addMessage({ role: "user", content: "测试消息" }));

      const after = useAIStore.getState().getCurrentConversation();
      expect(after?.messages.length).toBe(msgCount + 1);
      const last = after?.messages[after.messages.length - 1];
      expect(last?.role).toBe("user");
      expect(last?.content).toBe("测试消息");
      expect(last?.timestamp).toBeInstanceOf(Date);
    });

    it("第一条用户消息自动更新对话标题", () => {
      const id = act(() => useAIStore.getState().createConversation());
      act(() =>
        useAIStore
          .getState()
          .addMessage({ role: "user", content: "这是一条很长的消息内容用来验证截断" }),
      );

      const conv = useAIStore.getState().conversations.find((c) => c.id === id);
      expect(conv?.title).toContain("这是一条很长的消息内容用来验证截断".slice(0, 20));
    });
  });

  describe("上下文管理", () => {
    const ctx: ContextItem = {
      id: "ctx-1",
      type: "file",
      label: "test.ts",
      data: { path: "/test.ts", content: "hello" },
    };

    it("addContext 添加上下文", () => {
      act(() => useAIStore.getState().addContext(ctx));
      expect(useAIStore.getState().contexts).toHaveLength(1);
      expect(useAIStore.getState().contexts[0].id).toBe("ctx-1");
    });

    it("removeContext 移除非锁定的上下文", () => {
      act(() => useAIStore.getState().addContext(ctx));
      act(() => useAIStore.getState().removeContext("ctx-1"));
      expect(useAIStore.getState().contexts).toHaveLength(0);
    });

    it("clearContexts 清空所有上下文", () => {
      act(() => useAIStore.getState().addContext(ctx));
      act(() => useAIStore.getState().addContext({ ...ctx, id: "ctx-2", label: "b.ts" }));
      act(() => useAIStore.getState().clearContexts());
      expect(useAIStore.getState().contexts).toHaveLength(0);
    });
  });

  describe("消息队列", () => {
    it("enqueueMessage / dequeueMessage 遵循 FIFO", () => {
      const { enqueueMessage, dequeueMessage } = useAIStore.getState();

      act(() => enqueueMessage("msg-1", [], "chat"));
      act(() => enqueueMessage("msg-2", [], "plan"));

      expect(useAIStore.getState().messageQueue).toHaveLength(2);

      const first = act(() => useAIStore.getState().dequeueMessage());
      expect(first?.content).toBe("msg-1");
      expect(first?.mode).toBe("chat");

      const second = act(() => useAIStore.getState().dequeueMessage());
      expect(second?.content).toBe("msg-2");
    });

    it("dequeueMessage 空队列返回 undefined", () => {
      const result = act(() => useAIStore.getState().dequeueMessage());
      expect(result).toBeUndefined();
    });

    it("clearMessageQueue 清空队列", () => {
      act(() => useAIStore.getState().enqueueMessage("m", [], "chat"));
      act(() => useAIStore.getState().clearMessageQueue());
      expect(useAIStore.getState().messageQueue).toHaveLength(0);
    });
  });
});
