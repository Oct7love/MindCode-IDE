/**
 * 日志脱敏（redaction）
 *
 * 在日志进入任何 Transport（控制台 / 文件 / 缓冲 / 导出）之前，统一掩码敏感信息，
 * 防止 API Key、Bearer Token、密码等明文落盘或被 "导出日志" 分享出去。
 */

const MASK = "***";

/**
 * 整段掩码模式：命中即整体替换为 MASK。
 * 这些正则【无捕获组】，故 replace 回调必须直接返回 MASK——若误用 (m,p1,p2) 形式，
 * 无捕获组时 p1 会是匹配偏移量(数字)，导致输出畸形的 "<offset>***"（历史 bug）。
 */
const FULL_MASK_PATTERNS: RegExp[] = [
  // OpenAI/Anthropic 风格：sk-xxxx、sk-ant-xxxx
  /\bsk-[A-Za-z0-9._-]{6,}\b/g,
  // Bearer / Authorization
  /\bBearer\s+[A-Za-z0-9._-]{6,}\b/gi,
  // GitHub token：ghp_/gho_/ghs_/ghr_ + 20+
  /\bgh[opsru]_[A-Za-z0-9]{20,}\b/g,
];

/**
 * 键值对模式：保留键名，仅掩码值。这些正则【有两个捕获组】(p1=键名前缀, p2=值)，
 * replace 回调返回 `${p1}${MASK}`。
 */
const KV_PATTERNS: RegExp[] = [
  /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|authorization|private[_-]?key|token)["']?\s*[:=]\s*["']?)([^"'\s,}]{4,})/gi,
];

/**
 * 非敏感的 token 计量字段（maxTokens/totalTokens/inputTokens/... 及 tokenCount 等），
 * 必须排除，避免误掩 AI 调试最关键的 token 计量。
 */
const TOKEN_METRIC_KEY =
  /(?:max|total|input|output|prompt|completion|num|used|remaining|left|count|budget|window|limit|avg|average)[_-]?tokens?$|^tokens?[_-]?(?:count|used|remaining|left|budget|limit|per|window|size)/i;

/** 明确的敏感键集合（token 类仅覆盖凭据语义）。 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^(?:x-)?api[_-]?key$/i,
  /secret/i,
  /^(?:password|passwd|pwd)$/i,
  /credential/i,
  /^authorization$/i,
  /private[_-]?key/i,
  /(?:access|refresh|id|session|auth|bearer)[_-]?token/i,
  /^token$/i,
];

/** 判断对象键名是否敏感（先排除 token 计量字段，再匹配敏感集合）。 */
export function isSensitiveKey(key: string): boolean {
  if (TOKEN_METRIC_KEY.test(key)) return false;
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

/** 对单个字符串做模式掩码 */
export function redactString(input: string): string {
  let out = input;
  // 整段掩码：无捕获组，直接替换为 MASK（不拼接偏移量）。
  for (const re of FULL_MASK_PATTERNS) out = out.replace(re, MASK);
  // 键值对：保留键名，仅掩码值。
  for (const re of KV_PATTERNS) out = out.replace(re, (_m, p1) => `${p1}${MASK}`);
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
    if (isSensitiveKey(key)) {
      out[key] = MASK;
    } else {
      out[key] = redact(v, depth + 1, seen);
    }
  }
  return out;
}
