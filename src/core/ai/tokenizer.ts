/**
 * Token 计算服务 - 使用 tiktoken 进行准确计算
 */

import type { Tiktoken, TiktokenEncoding } from "tiktoken";
import { get_encoding, encoding_for_model } from "tiktoken";

// 缓存编码器实例
const encoderCache = new Map<string, Tiktoken>();

// 模型到编码器的映射
const modelEncodingMap: Record<string, TiktokenEncoding> = {
  // GPT-4 系列
  "gpt-4": "cl100k_base",
  "gpt-4-turbo": "cl100k_base",
  "gpt-4o": "o200k_base",
  "gpt-4o-mini": "o200k_base",
  // GPT-3.5 系列
  "gpt-3.5-turbo": "cl100k_base",
  // Claude 系列 (使用 cl100k_base 作为近似)
  claude: "cl100k_base",
  "claude-opus": "cl100k_base",
  "claude-sonnet": "cl100k_base",
  // 其他模型默认使用 cl100k_base
  default: "cl100k_base",
};

/**
 * 获取指定模型的编码器
 */
function getEncoder(model?: string): Tiktoken {
  const key = model || "default";

  // 检查缓存
  if (encoderCache.has(key)) {
    return encoderCache.get(key)!;
  }

  let encoder: Tiktoken;

  try {
    // 尝试使用模型名获取编码器
    if (model) {
      try {
        encoder = encoding_for_model(model as any);
        encoderCache.set(key, encoder);
        return encoder;
      } catch {
        // 如果模型名不支持，使用映射
      }
    }

    // 使用映射表查找编码
    const encodingName = modelEncodingMap[model || "default"] || modelEncodingMap["default"];
    encoder = get_encoding(encodingName);
    encoderCache.set(key, encoder);
    return encoder;
  } catch (error) {
    // 回退到默认编码器
    if (!encoderCache.has("default")) {
      encoderCache.set("default", get_encoding("cl100k_base"));
    }
    return encoderCache.get("default")!;
  }
}

/**
 * 使用 tiktoken 准确计算 token 数量
 * @param text 要计算的文本
 * @param model 模型名称（可选，用于选择正确的编码器）
 * @returns token 数量
 */
export function countTokens(text: string, model?: string): number {
  try {
    const encoder = getEncoder(model);
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    // 如果 tiktoken 失败，回退到估算
    return estimateTokens(text);
  }
}

/**
 * 估算 token 数量（用于回退）
 * @param text 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  // 中文字符约 1.5 个字符一个 token
  // 英文约 4 个字符一个 token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 批量计算多个文本的 token 数量
 * @param texts 文本数组
 * @param model 模型名称
 * @returns token 数量数组
 */
export function countTokensBatch(texts: string[], model?: string): number[] {
  const encoder = getEncoder(model);
  return texts.map((text) => {
    try {
      return encoder.encode(text).length;
    } catch {
      return estimateTokens(text);
    }
  });
}

/**
 * 计算聊天消息的 token 数量
 * 考虑消息格式的额外开销
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: string }>,
  model?: string,
): number {
  const encoder = getEncoder(model);

  // 每条消息有固定开销（role、分隔符等）
  const tokensPerMessage = 4;
  // 回复有额外开销
  const tokensPerReply = 3;

  let totalTokens = 0;

  for (const message of messages) {
    totalTokens += tokensPerMessage;
    try {
      totalTokens += encoder.encode(message.role).length;
      totalTokens += encoder.encode(message.content).length;
    } catch {
      totalTokens += estimateTokens(message.role);
      totalTokens += estimateTokens(message.content);
    }
  }

  totalTokens += tokensPerReply;

  return totalTokens;
}

/**
 * 截断文本到指定的 token 数量
 * @param text 原始文本
 * @param maxTokens 最大 token 数量
 * @param model 模型名称
 * @returns 截断后的文本
 */
export function truncateToTokens(text: string, maxTokens: number, model?: string): string {
  try {
    const encoder = getEncoder(model);
    const tokens = encoder.encode(text);

    if (tokens.length <= maxTokens) {
      return text;
    }

    const truncatedTokens = tokens.slice(0, maxTokens);
    const decoded = encoder.decode(truncatedTokens);
    // tiktoken decode 返回 Uint8Array，需要转换为字符串
    return new TextDecoder().decode(decoded);
  } catch {
    // 回退到字符估算
    const estimatedCharsPerToken = 4;
    const maxChars = maxTokens * estimatedCharsPerToken;
    return text.slice(0, maxChars);
  }
}

/**
 * 清理编码器缓存（释放内存）
 */
export function clearEncoderCache(): void {
  for (const encoder of encoderCache.values()) {
    encoder.free();
  }
  encoderCache.clear();
}
