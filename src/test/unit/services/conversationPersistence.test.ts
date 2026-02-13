import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConversations, saveConversations } from "@services/conversationPersistence";
import type { Conversation } from "@stores/useAIStore";

const STORAGE_KEY = "mindcode-ai-conversations";

const makeFallback = (): Conversation[] => [
  {
    id: "fallback-1",
    title: "默认对话",
    messages: [{ id: "m1", role: "assistant", content: "hi", timestamp: new Date("2025-01-01") }],
    createdAt: "2025-01-01T00:00:00.000Z",
    model: "test-model",
  },
];

const makeConversations = (count: number): Conversation[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `conv-${i}`,
    title: `对话 ${i}`,
    messages: [
      {
        id: `m-${i}`,
        role: "assistant" as const,
        content: `msg ${i}`,
        timestamp: new Date("2025-06-01"),
      },
    ],
    createdAt: "2025-06-01T00:00:00.000Z",
    model: "test-model",
  }));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("conversationPersistence", () => {
  describe("loadConversations", () => {
    it("正常加载并转换 timestamp 为 Date", () => {
      const stored = [
        {
          id: "c1",
          title: "测试",
          messages: [
            { id: "m1", role: "user", content: "hello", timestamp: "2025-06-15T10:00:00.000Z" },
          ],
          createdAt: "2025-06-15T00:00:00.000Z",
          model: "claude",
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      const result = loadConversations(makeFallback());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
      expect(result[0].messages[0].timestamp).toBeInstanceOf(Date);
      expect(result[0].messages[0].timestamp.toISOString()).toBe("2025-06-15T10:00:00.000Z");
    });

    it("JSON 损坏返回 fallback", () => {
      localStorage.setItem(STORAGE_KEY, "{invalid json!!!");
      const fallback = makeFallback();

      const result = loadConversations(fallback);
      expect(result).toBe(fallback);
    });

    it("无数据返回 fallback", () => {
      const fallback = makeFallback();
      const result = loadConversations(fallback);
      expect(result).toBe(fallback);
    });
  });

  describe("saveConversations", () => {
    it("immediate=true 立即写入 localStorage", () => {
      const convs = makeConversations(3);
      saveConversations(convs, true);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].id).toBe("conv-0");
    });

    it("默认防抖不立即写入，300ms 后写入", () => {
      vi.useFakeTimers();
      const convs = makeConversations(2);

      saveConversations(convs);
      // 立即检查：不应写入
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

      // 前进 300ms
      vi.advanceTimersByTime(300);
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toHaveLength(2);

      vi.useRealTimers();
    });

    it("只保存前 50 个对话", () => {
      const convs = makeConversations(60);
      saveConversations(convs, true);

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(50);
      // 保留前 50 个
      expect(parsed[0].id).toBe("conv-0");
      expect(parsed[49].id).toBe("conv-49");
    });

    it("防抖合并多次调用", () => {
      vi.useFakeTimers();

      saveConversations(makeConversations(1));
      saveConversations(makeConversations(5));

      vi.advanceTimersByTime(300);
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      // 最后一次调用生效
      expect(parsed).toHaveLength(5);

      vi.useRealTimers();
    });
  });
});
