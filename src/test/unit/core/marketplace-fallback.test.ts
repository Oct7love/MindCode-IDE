/**
 * 渲染进程市场服务：只走 IPC，失败时降级到离线目录，且自身不 fetch 外网。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketplaceService } from "../../../core/plugins/marketplace";
import { mindcodeMock } from "../../setup";

describe("marketplaceService IPC fallback", () => {
  beforeEach(() => {
    mindcodeMock.marketplace.search.mockReset();
    mindcodeMock.marketplace.getExtension.mockReset();
    mindcodeMock.marketplace.search.mockResolvedValue({
      success: false,
      error: "not mocked",
      errorCode: "ERR_NETWORK",
    });
    mindcodeMock.marketplace.getExtension.mockResolvedValue({
      success: false,
      error: "not mocked",
      errorCode: "ERR_NETWORK",
    });
  });

  it("渲染层 searchOnline 不直接 fetch Open VSX", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mindcodeMock.marketplace.search.mockResolvedValue({
      success: true,
      data: [
        {
          id: "esbenp.prettier-vscode",
          name: "prettier-vscode",
          displayName: "Prettier",
          description: "",
          version: "10.1.0",
          author: "Prettier",
          category: "tool",
          tags: [],
          downloads: 1,
          rating: 5,
        },
      ],
    });
    const results = await marketplaceService.searchOnline(`prettier-${Date.now()}`);
    expect(results[0]?.id).toBe("esbenp.prettier-vscode");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("IPC 失败时降级到离线目录", async () => {
    const results = await marketplaceService.searchOnline("dracula");
    expect(results.some((ext) => ext.id === "dracula-theme.theme-dracula")).toBe(true);
    expect(results.every((ext) => !ext.downloadUrl && !ext.iconUrl)).toBe(true);
  });

  it("IPC 不可用时同样降级", async () => {
    const original = mindcodeMock.marketplace;
    (mindcodeMock as { marketplace?: typeof original }).marketplace = undefined;
    try {
      const results = await marketplaceService.searchOnline("nord");
      expect(results.some((ext) => ext.id.includes("nord"))).toBe(true);
    } finally {
      mindcodeMock.marketplace = original;
    }
  });
});
