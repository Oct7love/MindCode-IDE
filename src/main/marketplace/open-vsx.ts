/**
 * Open VSX 主进程代理的纯函数：URL 白名单、查询校验、响应裁剪。
 * 渲染进程不得直连 open-vsx.org。
 */

export const OPEN_VSX_ORIGIN = "https://open-vsx.org";
export const OPEN_VSX_API_PREFIX = "/api/";
export const OPEN_VSX_TIMEOUT_MS = 8000;
export const OPEN_VSX_MAX_BYTES = 512 * 1024;
export const OPEN_VSX_MAX_QUERY_LEN = 80;
export const OPEN_VSX_MAX_SIZE = 30;

export const MARKETPLACE_ERROR = {
  INVALID_PARAM: "ERR_INVALID_PARAM",
  TIMEOUT: "ERR_TIMEOUT",
  NETWORK: "ERR_NETWORK",
  TOO_LARGE: "ERR_TOO_LARGE",
  BAD_STATUS: "ERR_BAD_STATUS",
  BAD_JSON: "ERR_BAD_JSON",
  UNAUTHORIZED: "ERR_UNAUTHORIZED",
} as const;

export interface SanitizedExtension {
  id: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  category: "theme" | "language" | "snippet" | "tool" | "ai" | "other";
  tags: string[];
  downloads: number;
  rating: number;
  repository?: string;
}

export interface SearchParams {
  query: string;
  category?: string;
  size?: number;
}

export function isSafeIdPart(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
}

export function validateSearchParams(
  raw: SearchParams,
): { ok: true; value: Required<SearchParams> } | { ok: false; error: string; errorCode: string } {
  const query = typeof raw.query === "string" ? raw.query : "";
  if (query.length > OPEN_VSX_MAX_QUERY_LEN) {
    return { ok: false, error: "query too long", errorCode: MARKETPLACE_ERROR.INVALID_PARAM };
  }
  if (!/^[\w\s.+#@/-]*$/.test(query)) {
    return {
      ok: false,
      error: "query has invalid characters",
      errorCode: MARKETPLACE_ERROR.INVALID_PARAM,
    };
  }
  const category =
    typeof raw.category === "string" && raw.category.length > 0 ? raw.category : "all";
  if (category !== "all" && !/^[A-Za-z][A-Za-z0-9\s-]{0,31}$/.test(category)) {
    return { ok: false, error: "invalid category", errorCode: MARKETPLACE_ERROR.INVALID_PARAM };
  }
  const size = Math.min(OPEN_VSX_MAX_SIZE, Math.max(1, Math.floor(Number(raw.size) || 20)));
  return { ok: true, value: { query, category, size } };
}

export function buildSearchUrl(params: Required<SearchParams>): URL {
  const url = new URL("/api/-/search", OPEN_VSX_ORIGIN);
  url.searchParams.set("query", params.query);
  url.searchParams.set("size", String(params.size));
  url.searchParams.set("sortBy", "downloadCount");
  url.searchParams.set("sortOrder", "desc");
  if (params.category !== "all") url.searchParams.set("category", params.category);
  return url;
}

export function buildExtensionUrl(namespace: string, name: string): URL | null {
  if (!isSafeIdPart(namespace) || !isSafeIdPart(name)) return null;
  return new URL(`/api/${namespace}/${name}`, OPEN_VSX_ORIGIN);
}

export function assertAllowedVsxUrl(url: URL): boolean {
  return url.origin === OPEN_VSX_ORIGIN && url.pathname.startsWith(OPEN_VSX_API_PREFIX);
}

function detectCategory(categories: string[], tags: string[]): SanitizedExtension["category"] {
  const all = [...categories, ...tags].map((s) => s.toLowerCase());
  if (all.some((t) => t.includes("theme"))) return "theme";
  if (all.some((t) => t.includes("snippet"))) return "snippet";
  if (all.some((t) => t.includes("language") || t.includes("linter") || t.includes("formatter"))) {
    return "language";
  }
  if (all.some((t) => t.includes("ai") || t.includes("copilot"))) return "ai";
  return "tool";
}

function asString(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** 只保留元数据；去掉 icon/download URL，避免渲染进程再去拉远程资源。 */
export function sanitizeExtension(raw: unknown): SanitizedExtension | null {
  if (!raw || typeof raw !== "object") return null;
  const ext = raw as Record<string, unknown>;
  const namespace = asString(ext.namespace, 64);
  const name = asString(ext.name, 64);
  if (!isSafeIdPart(namespace) || !isSafeIdPart(name)) return null;
  const publishedBy = ext.publishedBy as { loginName?: unknown } | undefined;
  const categories = Array.isArray(ext.categories)
    ? ext.categories.map((c) => asString(c, 40))
    : [];
  const tags = Array.isArray(ext.tags) ? ext.tags.map((t) => asString(t, 40)).slice(0, 20) : [];
  const repo = asString(ext.repository, 200);
  return {
    id: `${namespace}.${name}`,
    name,
    namespace,
    displayName: asString(ext.displayName, 120) || name,
    description: asString(ext.description, 400),
    version: asString(ext.version, 40),
    author: asString(publishedBy?.loginName, 80) || namespace,
    category: detectCategory(categories, tags),
    tags,
    downloads: asNumber(ext.downloadCount),
    rating: asNumber(ext.averageRating),
    repository: repo.startsWith("https://") ? repo : undefined,
  };
}

export function sanitizeSearchResult(raw: unknown): SanitizedExtension[] {
  if (!raw || typeof raw !== "object") return [];
  const extensions = (raw as { extensions?: unknown }).extensions;
  if (!Array.isArray(extensions)) return [];
  return extensions
    .slice(0, OPEN_VSX_MAX_SIZE)
    .map(sanitizeExtension)
    .filter((e): e is SanitizedExtension => e !== null);
}

export interface VsxFetchResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  errorCode?: string;
}

export async function fetchAllowedJson(
  url: URL,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = OPEN_VSX_TIMEOUT_MS,
  maxBytes = OPEN_VSX_MAX_BYTES,
): Promise<VsxFetchResult> {
  if (!assertAllowedVsxUrl(url)) {
    return { ok: false, error: "URL not allowlisted", errorCode: MARKETPLACE_ERROR.INVALID_PARAM };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, errorCode: MARKETPLACE_ERROR.BAD_STATUS };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      return { ok: false, error: "response too large", errorCode: MARKETPLACE_ERROR.TOO_LARGE };
    }
    try {
      return { ok: true, data: JSON.parse(buf.toString("utf8")) };
    } catch {
      return { ok: false, error: "invalid JSON", errorCode: MARKETPLACE_ERROR.BAD_JSON };
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      return { ok: false, error: "request timed out", errorCode: MARKETPLACE_ERROR.TIMEOUT };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
      errorCode: MARKETPLACE_ERROR.NETWORK,
    };
  } finally {
    clearTimeout(timer);
  }
}
