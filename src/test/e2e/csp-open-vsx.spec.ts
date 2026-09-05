/**
 * 生产 CSP：渲染进程不得直连 Open VSX；市场走主进程 IPC。
 */
import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { launchApp, closeApp } from "./helpers";

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await closeApp(app);
});

test.describe("CSP / Open VSX 主进程代理", () => {
  test("生产 connect-src 不含 open-vsx.org，渲染层 fetch 被拦截", async () => {
    const result = await page.evaluate(async () => {
      const violations: Array<{ directive: string; blocked: string }> = [];
      const onViolation = (event: SecurityPolicyViolationEvent): void => {
        violations.push({ directive: event.violatedDirective, blocked: event.blockedURI });
      };
      document.addEventListener("securitypolicyviolation", onViolation);
      let fetchBlocked = false;
      let fetchMessage = "";
      try {
        await fetch("https://open-vsx.org/api/-/search?query=prettier&size=1");
      } catch (err) {
        fetchBlocked = true;
        fetchMessage = err instanceof Error ? err.message : String(err);
      }
      document.removeEventListener("securitypolicyviolation", onViolation);
      return { fetchBlocked, fetchMessage, violations };
    });

    expect(result.fetchBlocked).toBe(true);
    const blockedByCsp = result.violations.some(
      (item) => item.blocked.includes("open-vsx.org") || item.directive.includes("connect-src"),
    );
    expect(blockedByCsp || /failed|csp|content security|refused/i.test(result.fetchMessage)).toBe(
      true,
    );
  });

  test("marketplace IPC 已暴露；成功时不含远程 icon/download URL", async () => {
    const ipc = await page.evaluate(async () => {
      const api = window.mindcode?.marketplace;
      if (!api?.search || !api?.getExtension) {
        return { exposed: false as const };
      }
      const res = await api.search({ query: "prettier", size: 5 });
      const first = Array.isArray(res.data)
        ? (res.data[0] as Record<string, unknown> | undefined)
        : undefined;
      return {
        exposed: true as const,
        success: res.success,
        errorCode: res.errorCode,
        hasArray: Array.isArray(res.data),
        keys: first ? Object.keys(first) : [],
        hasIconUrl: Boolean(first && ("iconUrl" in first || first.files)),
        hasDownloadUrl: Boolean(
          first &&
          ("downloadUrl" in first || (first.files as { download?: string } | undefined)?.download),
        ),
      };
    });

    expect(ipc.exposed).toBe(true);
    expect(typeof ipc.success).toBe("boolean");
    if (ipc.success) {
      expect(ipc.hasArray).toBe(true);
      expect(ipc.hasIconUrl).toBe(false);
      expect(ipc.hasDownloadUrl).toBe(false);
    } else {
      expect(ipc.errorCode).toBeTruthy();
    }
  });
});
