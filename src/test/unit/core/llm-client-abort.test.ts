/**
 * 用户取消不得重试/降级；mock provider 必须真正收到 abort。
 */
import { describe, expect, it } from "vitest";
import { LLMClient, classifyError } from "../../../core/ai/llm-client";
import type { AIProvider, ChatMessage, StreamCallbacks } from "../../../shared/types/ai";

function mockProvider(onStream: (cb: StreamCallbacks) => Promise<void>): AIProvider {
  return {
    name: "openai",
    displayName: "mock",
    models: [{ id: "gpt-4o", name: "gpt", contextWindow: 1, inputPrice: 0, outputPrice: 0 }],
    chat: async () => "",
    chatStream: async (_messages: ChatMessage[], callbacks: StreamCallbacks) => {
      await onStream(callbacks);
    },
    countTokens: () => 1,
    setModel: function setModel() {
      return this;
    },
  };
}

describe("classifyError cancelled", () => {
  it("AbortError 归为 cancelled 且不可重试", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    const classified = classifyError(err);
    expect(classified.type).toBe("cancelled");
    expect(classified.retryable).toBe(false);
  });
});

describe("LLMClient.chatStream abort", () => {
  it("signal abort 传到 provider，且不走 fallback/retry", async () => {
    const controller = new AbortController();
    let sawAbort = false;
    let streamStarts = 0;
    const provider = mockProvider(async (cb) => {
      streamStarts += 1;
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          sawAbort = true;
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        };
        if (cb.signal?.aborted) {
          onAbort();
          return;
        }
        cb.signal?.addEventListener("abort", onAbort, { once: true });
      });
    });
    const client = new LLMClient(new Map([["openai", provider]]));
    const errors: string[] = [];
    const fallbacks: string[] = [];
    const done = client.chatStream(
      { model: "gpt-4o", messages: [{ role: "user", content: "hi" }], signal: controller.signal },
      {
        onToken: () => undefined,
        onComplete: () => undefined,
        onError: (e) => errors.push(e.type),
        onFallback: (from, to) => fallbacks.push(`${from}->${to}`),
      },
    );
    controller.abort();
    await done.catch(() => undefined);
    expect(sawAbort).toBe(true);
    expect(streamStarts).toBe(1);
    expect(errors).toEqual(["cancelled"]);
    expect(fallbacks).toEqual([]);
  });
});
