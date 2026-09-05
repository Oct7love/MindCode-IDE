/**
 * 流式取消必须让 AbortSignal 进入 aborted，且可重复调用。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  abortAllStreamSessions,
  cancelStreamSession,
  finishStreamSession,
  getActiveStreamCount,
  startStreamSession,
} from "../../../main/ipc/ai-stream-sessions";

afterEach(() => {
  abortAllStreamSessions();
});

describe("ai-stream-sessions", () => {
  it("cancel 将底层 AbortSignal 置为 aborted", () => {
    const session = startStreamSession("req-1");
    let aborted = false;
    session.abort.signal.addEventListener("abort", () => {
      aborted = true;
    });
    expect(cancelStreamSession("req-1")).toBe(true);
    expect(aborted).toBe(true);
    expect(session.abort.signal.aborted).toBe(true);
    expect(getActiveStreamCount()).toBe(0);
  });

  it("重复 cancel 幂等", () => {
    startStreamSession("req-2");
    expect(cancelStreamSession("req-2")).toBe(true);
    expect(cancelStreamSession("req-2")).toBe(false);
  });

  it("未知 requestId 不抛错", () => {
    expect(cancelStreamSession("missing")).toBe(false);
  });

  it("finish 后 cancel 无效，abortAll 清空剩余会话", () => {
    const a = startStreamSession("a");
    startStreamSession("b");
    finishStreamSession("a");
    expect(a.abort.signal.aborted).toBe(false);
    abortAllStreamSessions();
    expect(getActiveStreamCount()).toBe(0);
  });
});
