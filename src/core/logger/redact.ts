/**
 * 日志脱敏（redaction）
 *
 * 在日志进入任何 Transport（控制台 / 文件 / 缓冲 / 导出）之前，统一掩码敏感信息，
 * 防止 API Key、Bearer Token、密码等明文落盘或被 "导出日志" 分享出去。
 */

const MASK = "***";

/** 匹配值形态的密钥（sk-...、Bearer xxx、api key 片段等） */
const VALUE_PATTERNS: RegExp[] = [
  // OpenAI/Anthropic 风格：sk-xxxx、sk-ant-xxxx
  /\bsk-[A-Za-z0-9._-]{6,}\b/g,
  // Bearer / Authorization
  /\bBearer\s+[A-Za-z0-9._-]{6,}\b/gi,
  // GitHub token：ghp_/gho_/ghs_/ghr_ + 36
  /\bgh[opsru]_[A-Za-z0-9]{20,}\b/g,
  // 通用 key=value / "apiKey":"value"（保留键名，掩码值）
  /((?:api[_-]?key|access[_-]?token|secret|password|passwd|token)["']?\s*[:=]\s*["']?)([^"'\s,}]{4,})/gi,
];

/** 敏感字段名（对象键匹配时整值掩码） */
const SENSITIVE_KEY =
  /(api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|secret|password|passwd|credential|token)/i;

/** 对单个字符串做模式掩码 */
export function redactString(input: string): string {
  let out = input;
  for (const re of VALUE_PATTERNS) {
    out = out.replace(re, (m, p1, p2) => (p2 !== undefined ? `${p1}${MASK}` : MASK));
  }
  return out;
}

/**
 * 递归脱敏任意日志数据：字符串走模式掩码；对象/数组逐层处理；
 * 命中敏感字段名的键整值掩码。带循环引用保护与深度上限。
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6) return value;
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = MASK;
    } else {
      out[key] = redact(v, depth + 1, seen);
    }
  }
  return out;
}
