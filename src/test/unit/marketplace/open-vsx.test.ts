/**
 * Open VSX 主进程代理纯函数：白名单、查询校验、超时、体积上限、响应裁剪。
 */
import { describe, it, expect, vi } from "vitest";
import {
  MARKETPLACE_ERROR,
  OPEN_VSX_ORIGIN,
  assertAllowedVsxUrl,
  buildExtensionUrl,
  buildSearchUrl,
  fetchAllowedJson,
  sanitizeExtension,
  sanitizeSearchResult,
  validateSearchParams,
} from "../../../main/marketplace/open-vsx";

function jsonFetch(
  body: unknown,
  init?: { status?: number; oversized?: boolean },
): ReturnType<typeof vi.fn> {
  const payload = init?.oversized ? "x".repeat(512 * 1024 + 8) : JSON.stringify(body);
  return vi.fn().mockResolvedValue({
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    arrayBuffer: async () => new TextEncoder().encode(payload).buffer,
  });
}

describe("validateSearchParams", () => {
  it("接受空查询并钳制 size", () => {
    const parsed = validateSearchParams({ query: "", size: 999 });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.query).toBe("");
      expect(parsed.value.size).toBe(30);
      expect(parsed.value.category).toBe("all");
    }
  });

  it("拒绝过长或非法查询", () => {
    expect(validateSearchParams({ query: "a".repeat(81) }).ok).toBe(false);
    const bad = validateSearchParams({ query: "foo;curl http://evil" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errorCode).toBe(MARKETPLACE_ERROR.INVALID_PARAM);
  });

  it("拒绝非法 category", () => {
    const bad = validateSearchParams({ query: "theme", category: "../etc" });
    expect(bad.ok).toBe(false);
  });
});

describe("URL allowlist", () => {
  it("只允许 https://open-vsx.org/api/", () => {
    const search = buildSearchUrl({ query: "prettier", category: "all", size: 5 });
    expect(search.origin).toBe(OPEN_VSX_ORIGIN);
    expect(search.pathname).toBe("/api/-/search");
    expect(assertAllowedVsxUrl(search)).toBe(true);

    const ext = buildExtensionUrl("esbenp", "prettier-vscode");
    expect(ext).not.toBeNull();
    expect(assertAllowedVsxUrl(ext!)).toBe(true);

    expect(buildExtensionUrl("../etc", "passwd")).toBeNull();
    expect(assertAllowedVsxUrl(new URL("https://evil.example/api/-/search"))).toBe(false);
    expect(assertAllowedVsxUrl(new URL("http://open-vsx.org/api/-/search"))).toBe(false);
    expect(assertAllowedVsxUrl(new URL("https://open-vsx.org/not-api"))).toBe(false);
    expect(assertAllowedVsxUrl(new URL("https://open-vsx.org/api/../secret"))).toBe(false);
  });
});

describe("sanitizeExtension", () => {
  it("去掉 icon / download URL，只保留 https 仓库", () => {
    const ext = sanitizeExtension({
      namespace: "esbenp",
      name: "prettier-vscode",
      displayName: "Prettier",
      description: "formatter",
      version: "10.1.0",
      publishedBy: { loginName: "Prettier" },
      files: {
        icon: "https://open-vsx.org/api/esbenp/prettier-vscode/latest/file/icon.png",
        download: "https://open-vsx.org/api/esbenp/prettier-vscode/latest/file/prettier.vsix",
      },
      downloadCount: 10,
      averageRating: 4.7,
      categories: ["Formatters"],
      tags: ["formatter"],
      repository: "http://insecure.example/repo",
    });
    expect(ext).toMatchObject({
      id: "esbenp.prettier-vscode",
      name: "prettier-vscode",
      namespace: "esbenp",
      displayName: "Prettier",
    });
    expect(ext).not.toHaveProperty("iconUrl");
    expect(ext).not.toHaveProperty("downloadUrl");
    expect(ext).not.toHaveProperty("files");
    expect(ext?.repository).toBeUndefined();
  });

  it("拒绝非法扩展 id", () => {
    expect(sanitizeExtension({ namespace: "../x", name: "y" })).toBeNull();
    expect(sanitizeExtension(null)).toBeNull();
  });

  it("搜索结果只保留合法项并截断", () => {
    const list = sanitizeSearchResult({
      extensions: [
        { namespace: "a", name: "ok", version: "1" },
        { namespace: "bad id", name: "x" },
        null,
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("a.ok");
  });
});

describe("fetchAllowedJson", () => {
  const allowed = new URL("https://open-vsx.org/api/-/search");

  it("拒绝非白名单 URL 且不发请求", async () => {
    const fetchImpl = vi.fn();
    const res = await fetchAllowedJson(
      new URL("https://evil.example/api"),
      fetchImpl as typeof fetch,
    );
    expect(res).toEqual({
      ok: false,
      error: "URL not allowlisted",
      errorCode: MARKETPLACE_ERROR.INVALID_PARAM,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("超时返回 ERR_TIMEOUT", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    const res = await fetchAllowedJson(allowed, fetchImpl as typeof fetch, 20);
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe(MARKETPLACE_ERROR.TIMEOUT);
  });

  it("响应过大返回 ERR_TOO_LARGE", async () => {
    const res = await fetchAllowedJson(allowed, jsonFetch({}, { oversized: true }) as typeof fetch);
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe(MARKETPLACE_ERROR.TOO_LARGE);
  });

  it("非 2xx 与坏 JSON 分别编码", async () => {
    const badStatus = await fetchAllowedJson(
      allowed,
      jsonFetch({ error: "no" }, { status: 502 }) as typeof fetch,
    );
    expect(badStatus.errorCode).toBe(MARKETPLACE_ERROR.BAD_STATUS);

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("not-json").buffer,
    });
    const badJson = await fetchAllowedJson(allowed, fetchImpl as typeof fetch);
    expect(badJson.errorCode).toBe(MARKETPLACE_ERROR.BAD_JSON);
  });

  it("成功解析 JSON", async () => {
    const res = await fetchAllowedJson(allowed, jsonFetch({ extensions: [] }) as typeof fetch);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ extensions: [] });
  });
});
