/**
 * 市场 IPC：validateSender + 参数校验，且渲染进程路径不直连 Open VSX。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { handlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return { handlers };
});

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    },
  },
}));

vi.mock("../../../core/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) },
}));

import { registerMarketplaceHandlers } from "../../../main/ipc/marketplace-handlers";
import type { IPCContext } from "../../../main/ipc/types";

const mainWebContents = { id: "main" };
const ctx: IPCContext = {
  getMainWindow: () => ({ webContents: mainWebContents }) as never,
  isDev: false,
  getWorkspacePath: () => null,
  setWorkspacePath: () => {},
};

const legalEvent = { sender: mainWebContents } as never;
const illegalEvent = { sender: { id: "injected-iframe" } } as never;

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  registerMarketplaceHandlers(ctx);
});

describe("marketplace handlers", () => {
  it("注册 search / getExtension", () => {
    expect(typeof handlers["marketplace:search"]).toBe("function");
    expect(typeof handlers["marketplace:getExtension"]).toBe("function");
  });

  it("非法 sender 被拒且不发起 fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const search = (await handlers["marketplace:search"](illegalEvent, { query: "x" })) as {
      success: boolean;
      errorCode?: string;
    };
    const getExt = (await handlers["marketplace:getExtension"](illegalEvent, {
      namespace: "esbenp",
      name: "prettier-vscode",
    })) as { success: boolean; errorCode?: string };
    expect(search).toMatchObject({ success: false, errorCode: "ERR_UNAUTHORIZED" });
    expect(getExt).toMatchObject({ success: false, errorCode: "ERR_UNAUTHORIZED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("非法查询参数被拒且不发起 fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = (await handlers["marketplace:search"](legalEvent, {
      query: "<script>alert(1)</script>",
    })) as { success: boolean; errorCode?: string };
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("ERR_INVALID_PARAM");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("非法扩展 id 被拒", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = (await handlers["marketplace:getExtension"](legalEvent, {
      namespace: "../etc",
      name: "passwd",
    })) as { success: boolean; errorCode?: string };
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("ERR_INVALID_PARAM");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("合法 search 返回裁剪后的元数据", async () => {
    const payload = {
      extensions: [
        {
          namespace: "esbenp",
          name: "prettier-vscode",
          displayName: "Prettier",
          version: "10.1.0",
          files: { icon: "https://open-vsx.org/icon.png", download: "https://open-vsx.org/x.vsix" },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(payload)).buffer,
      }),
    );
    const res = (await handlers["marketplace:search"](legalEvent, {
      query: "prettier",
      size: 5,
    })) as {
      success: boolean;
      data?: Array<Record<string, unknown>>;
    };
    expect(res.success).toBe(true);
    expect(res.data?.[0]).toMatchObject({ id: "esbenp.prettier-vscode", name: "prettier-vscode" });
    expect(res.data?.[0]).not.toHaveProperty("files");
    expect(res.data?.[0]).not.toHaveProperty("iconUrl");
    expect(res.data?.[0]).not.toHaveProperty("downloadUrl");
    vi.unstubAllGlobals();
  });
});
