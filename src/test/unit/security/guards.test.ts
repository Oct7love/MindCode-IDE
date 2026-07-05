/**
 * M1 安全守卫回归测试
 *
 * 覆盖 src/main/security/guards.ts：
 * - sanitizeSecretEnv：剔除 MINDCODE_* 与形似凭据的环境变量（P2-5 / P1-2）
 * - isWithinWorkspace：工作区包含校验，防路径遍历（P1-1 / P1-2 支撑）
 * 以及 src/core/logger/redact.ts 的脱敏（P2-2）。
 */
import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import { sanitizeSecretEnv, isWithinWorkspace } from "../../../main/security/guards";
import { redact, redactString } from "../../../core/logger/redact";

describe("sanitizeSecretEnv", () => {
  it("剔除 MINDCODE_* 注入的密钥", () => {
    const out = sanitizeSecretEnv({
      MINDCODE_CLAUDE_API_KEY: "sk-secret",
      MINDCODE_OPENAI_BASE_URL: "https://api.openai.com",
      PATH: "/usr/bin",
    });
    expect(out.MINDCODE_CLAUDE_API_KEY).toBeUndefined();
    expect(out.MINDCODE_OPENAI_BASE_URL).toBeUndefined();
    expect(out.PATH).toBe("/usr/bin");
  });

  it("剔除任意形似凭据的变量名", () => {
    const out = sanitizeSecretEnv({
      AWS_SECRET_ACCESS_KEY: "x",
      GITHUB_TOKEN: "y",
      DB_PASSWORD: "z",
      HOME: "/home/user",
      LANG: "en_US.UTF-8",
    });
    expect(out.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(out.GITHUB_TOKEN).toBeUndefined();
    expect(out.DB_PASSWORD).toBeUndefined();
    expect(out.HOME).toBe("/home/user");
    expect(out.LANG).toBe("en_US.UTF-8");
  });
});

describe("isWithinWorkspace", () => {
  const root = os.tmpdir();

  it("工作区内路径通过", () => {
    expect(isWithinWorkspace(path.join(root, "a", "b.ts"), root)).toBe(true);
    expect(isWithinWorkspace(root, root)).toBe(true);
  });

  it("工作区外路径被拒", () => {
    expect(isWithinWorkspace("/etc/passwd", root)).toBe(false);
    expect(isWithinWorkspace(path.join(os.homedir(), ".ssh", "id_rsa"), root)).toBe(false);
  });

  it("路径遍历被拒", () => {
    expect(isWithinWorkspace(path.join(root, "..", "..", "etc", "passwd"), root)).toBe(false);
  });

  it("未打开工作区（root 为 null）一律拒绝", () => {
    expect(isWithinWorkspace(path.join(root, "a.ts"), null)).toBe(false);
  });

  it("前缀相似但非子目录不被误判", () => {
    // root = /tmp/ws，攻击路径 /tmp/ws-evil 不应通过
    const ws = path.join(root, "ws");
    expect(isWithinWorkspace(root + path.sep + "ws-evil", ws)).toBe(false);
  });
});

describe("日志脱敏 redact", () => {
  it("掩码 sk- 密钥与 Bearer token", () => {
    // 从片段拼接的假凭据（非真实密钥，且不以字面量形式出现，避免被 secret 扫描误报）。
    const fakeKey = "sk-" + "f".repeat(8) + "TEST00";
    const fakeToken = "t0ken" + "PLACEHOLDER" + "00";
    expect(redactString(`key=${fakeKey} done`)).not.toContain(fakeKey);
    expect(redactString(`Authorization: Bearer ${fakeToken}`)).not.toContain(fakeToken);
  });

  it("对象中的敏感字段名整值掩码", () => {
    const out = redact({ apiKey: "sk-xyz", nested: { token: "t-123", ok: "keep" } }) as Record<
      string,
      unknown
    >;
    expect(out.apiKey).toBe("***");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.token).toBe("***");
    expect(nested.ok).toBe("keep");
  });

  it("循环引用不崩溃", () => {
    const a: Record<string, unknown> = { name: "x" };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });
});
