/**
 * F3 回归测试：git IPC handlers 的发送者校验（validateSender）。
 *
 * 目标：
 * - 非法 sender（被注入的 iframe/webview）不能触发任何 git handler，尤其是破坏性的
 *   git:discard / git:checkout / git:reset(unstage) 等；且底层 git 进程绝不被 spawn。
 * - 合法 sender（主窗口 webContents）能通过校验，进入真实 git 逻辑。
 *
 * 通过 mock electron 的 ipcMain 捕获注册的 handler，并 mock child_process.spawn
 * 确保测试不真正执行 git。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as ChildProcessModule from "child_process";

// vi.hoisted 确保这些在被 hoist 的 vi.mock factory 中可用（否则触发 TDZ）。
const { handlers, spawnSpy } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  // spawn 被 mock：返回一个立即以 error 结束的假进程，确保不真正跑 git。
  const spawnSpy = vi.fn(() => ({
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: (ev: string, cb: (arg: unknown) => void) => {
      if (ev === "error") setTimeout(() => cb(new Error("mocked-spawn")), 0);
    },
  }));
  return { handlers, spawnSpy };
});

// 捕获所有经 ipcMain.handle 注册的 handler。
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    },
  },
}));
vi.mock("child_process", async (importActual) => {
  const actual = await importActual<typeof ChildProcessModule>();
  return { ...actual, default: actual, spawn: spawnSpy };
});

import { registerGitHandlers } from "../../../main/ipc/git-handlers";
import type { IPCContext } from "../../../main/ipc/types";

// 稳定的主窗口 webContents 引用，validateSender 以引用相等判定。
const mainWebContents = { id: "main" };
const ctx: IPCContext = {
  getMainWindow: () => ({ webContents: mainWebContents }) as never,
  isDev: false,
  getWorkspacePath: () => null,
  setWorkspacePath: () => {},
};

const legalEvent = { sender: mainWebContents } as never;
const illegalEvent = { sender: { id: "injected-iframe" } } as never;

const UNAUTHORIZED = "ERR_UNAUTHORIZED";

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  spawnSpy.mockClear();
  registerGitHandlers(ctx);
});

describe("git handlers validateSender (F3)", () => {
  it("注册了全部 git handler", () => {
    for (const ch of [
      "git:isRepo",
      "git:status",
      "git:currentBranch",
      "git:branches",
      "git:stage",
      "git:unstage",
      "git:commit",
      "git:diff",
      "git:checkout",
      "git:createBranch",
      "git:log",
      "git:discard",
    ]) {
      expect(typeof handlers[ch]).toBe("function");
    }
  });

  it("非法 sender 触发任何 handler 都被拒且不 spawn git", async () => {
    for (const ch of Object.keys(handlers)) {
      const res = (await handlers[ch](illegalEvent, "/tmp/x", "arg2")) as {
        success: boolean;
        errorCode?: string;
      };
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe(UNAUTHORIZED);
    }
    // 破坏性/所有 git 命令均未真正执行
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it("非法 sender 特别拦截破坏性 git:discard / git:checkout", async () => {
    const discard = (await handlers["git:discard"](illegalEvent, "/repo", "a.ts")) as {
      errorCode?: string;
    };
    const checkout = (await handlers["git:checkout"](illegalEvent, "/repo", "main")) as {
      errorCode?: string;
    };
    expect(discard.errorCode).toBe(UNAUTHORIZED);
    expect(checkout.errorCode).toBe(UNAUTHORIZED);
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it("合法 sender 通过校验并进入真实 git 逻辑（非 UNAUTHORIZED）", async () => {
    const res = (await handlers["git:isRepo"](legalEvent, "/nonexistent-repo-xyz")) as {
      success: boolean;
      data?: boolean;
      errorCode?: string;
    };
    // 通过 validateSender 后进入 git:isRepo 逻辑（execGit 失败被捕获 → success:true/data:false），
    // 结果非 UNAUTHORIZED，证明合法 sender 未被误拒、功能保持可用。
    expect(res.errorCode).not.toBe(UNAUTHORIZED);
    expect(res.success).toBe(true);
    expect(res.data).toBe(false);
  });
});
