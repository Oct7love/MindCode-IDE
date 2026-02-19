/**
 * 插件完整性验证
 * SHA256 校验和生成与验证，防止插件被篡改
 */

import { logger } from "../logger";

const log = logger.child("PluginIntegrity");

/** 完整性校验结果 */
export interface IntegrityResult {
  valid: boolean;
  expected?: string;
  actual?: string;
  error?: string;
}

/** 使用 Web Crypto API 计算 SHA256 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  // Node 环境
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const hash = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // 降级：Node crypto
  try {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(data).digest("hex");
  } catch {
    log.warn("SHA256 不可用，跳过完整性校验");
    return "";
  }
}

/** 为 manifest 生成校验和（基于关键字段） */
export async function generateManifestChecksum(manifest: Record<string, unknown>): Promise<string> {
  const critical = JSON.stringify({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    permissions: manifest.permissions,
  });
  return sha256(critical);
}

/** 验证 manifest 完整性 */
export async function verifyManifestIntegrity(
  manifest: Record<string, unknown>,
  expectedChecksum: string,
): Promise<IntegrityResult> {
  if (!expectedChecksum) {
    return { valid: true }; // 无校验和则跳过
  }
  try {
    const actual = await generateManifestChecksum(manifest);
    if (!actual) return { valid: true }; // crypto 不可用时放行
    const valid = actual === expectedChecksum;
    if (!valid) {
      log.warn(`完整性校验失败: ${manifest.id} (expected=${expectedChecksum}, actual=${actual})`);
    }
    return { valid, expected: expectedChecksum, actual };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: msg };
  }
}

/**
 * 验证插件入口文件是否包含危险模式
 * 简单的静态分析，阻止明显的恶意代码
 */
export function detectDangerousPatterns(source: string): string[] {
  const warnings: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/\bchild_process\b/, "引用 child_process 模块"],
    [/\beval\s*\(/, "使用 eval()"],
    [/\bnew\s+Function\s*\(/, "使用 new Function()"],
    [/\brequire\s*\(\s*['"]fs['"]/, "直接引用 fs 模块"],
    [/\brequire\s*\(\s*['"]net['"]/, "直接引用 net 模块"],
    [/\brequire\s*\(\s*['"]http['"]/, "直接引用 http 模块"],
    [/process\.env/, "访问 process.env"],
  ];
  for (const [regex, desc] of patterns) {
    if (regex.test(source)) warnings.push(desc);
  }
  return warnings;
}
