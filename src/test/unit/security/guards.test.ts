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
import {
  sanitizeSecretEnv,
  isWithinWorkspace,
  isDeniedSystemPath,
} from "../../../main/security/guards";
import { redact, redactString, isSensitiveKey } from "../../../core/logger/redact";

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

// F2：未打开工作区时的兜底 denylist，需抵御 macOS realpath 绕过（/etc→/private/etc）。
// 说明：跨平台断言用 /etc、/usr（posix 通用）；/private/* 直连路径仅在 macOS 存在，
// 故对其单独断言只在 darwin 运行，避免在 Linux CI 上误判。
describe.skipIf(process.platform === "win32")("isDeniedSystemPath (F2)", () => {
  it("系统关键目录被拒（/etc、/usr 在所有 posix 平台）", () => {
    // 关键回归点：即便 macOS 上 realpath('/etc/hosts')='/private/etc/hosts'，
    // isDeniedSystemPath 仍应拒绝（denylist 已同步 realpath 规范化）。
    expect(isDeniedSystemPath("/etc/hosts")).toBe(true);
    expect(isDeniedSystemPath("/etc/passwd")).toBe(true);
    expect(isDeniedSystemPath("/usr/bin/env")).toBe(true);
  });

  it.runIf(process.platform === "darwin")("macOS /private 直连映射路径被拒", () => {
    expect(isDeniedSystemPath("/private/etc/hosts")).toBe(true);
    expect(isDeniedSystemPath("/private/var")).toBe(true);
  });

  it("主目录敏感凭据位置被拒", () => {
    const home = os.homedir();
    expect(isDeniedSystemPath(path.join(home, ".ssh", "id_rsa"))).toBe(true);
    expect(isDeniedSystemPath(path.join(home, ".aws", "credentials"))).toBe(true);
  });

  it("空路径按拒绝处理", () => {
    expect(isDeniedSystemPath("")).toBe(true);
  });

  it("普通工作区文件不被误伤", () => {
    // os.tmpdir() 在 macOS 解析到 /var/folders/...（/var 是 denylist 项且软链到 /private/var）。
    // 为避免与系统 denylist 交叠，这里用一个明确不在敏感目录下的临时子目录做正例。
    const safe = path.join(os.homedir(), "mindcode-workspace-sample", "src", "index.ts");
    expect(isDeniedSystemPath(safe)).toBe(false);
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

  // F1：整段掩码必须是干净的 "***"，不得出现 "<偏移>***"（如 "10***"）这类畸形输出。
  it("F1: sk-/Bearer/gh token 掩码为干净的 *** 而非 <偏移>***", () => {
    const skKey = "sk-" + "A".repeat(12);
    const bearer = "b".repeat(16);
    const ghTok = "ghp_" + "C".repeat(24);
    const outSk = redactString(`my key is ${skKey} end`);
    const outBearer = redactString(`Authorization: Bearer ${bearer} x`);
    const outGh = redactString(`token ${ghTok} y`);
    // 完整密钥不得残留
    expect(outSk).not.toContain(skKey);
    expect(outBearer).not.toContain(bearer);
    expect(outGh).not.toContain(ghTok);
    // 输出含 MASK
    expect(outSk).toContain("***");
    // 不得出现 "<数字>***" 这类偏移量拼接畸形结果
    expect(outSk).not.toMatch(/\d+\*\*\*/);
    expect(outBearer).not.toMatch(/\d+\*\*\*/);
    expect(outGh).not.toMatch(/\d+\*\*\*/);
    // 具体形态：sk- 段被替换为 ***
    expect(outSk).toBe("my key is *** end");
  });

  // F4：敏感键必须掩码，token 计量字段必须保留。
  it("F4: 掩码凭据键、保留 token 计量键", () => {
    const out = redact({
      // 计量字段——必须原样保留
      maxTokens: 4096,
      totalTokens: 1234,
      inputTokens: 800,
      outputTokens: 434,
      tokenCount: 42,
      // 凭据字段——必须掩码
      accessToken: "a-secret",
      refreshToken: "r-secret",
      idToken: "i-secret",
      apiKey: "sk-secret",
      secret: "s",
      password: "p",
      authorization: "Bearer z",
      privateKey: "pk",
    }) as Record<string, unknown>;
    // 计量字段保留
    expect(out.maxTokens).toBe(4096);
    expect(out.totalTokens).toBe(1234);
    expect(out.inputTokens).toBe(800);
    expect(out.outputTokens).toBe(434);
    expect(out.tokenCount).toBe(42);
    // 凭据字段掩码
    for (const k of [
      "accessToken",
      "refreshToken",
      "idToken",
      "apiKey",
      "secret",
      "password",
      "authorization",
      "privateKey",
    ]) {
      expect(out[k]).toBe("***");
    }
  });

  it("F4: isSensitiveKey 分类正确", () => {
    for (const k of ["maxTokens", "totalTokens", "inputTokens", "outputTokens", "tokenCount"]) {
      expect(isSensitiveKey(k)).toBe(false);
    }
    for (const k of [
      "accessToken",
      "refreshToken",
      "idToken",
      "apiKey",
      "api_key",
      "secret",
      "password",
      "authorization",
      "privateKey",
      "token",
    ]) {
      expect(isSensitiveKey(k)).toBe(true);
    }
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
