/**
 * Token 计算 Web Worker
 * 异步计算 token 数量，避免阻塞 UI
 */

// Worker 消息类型
interface TokenRequest { id: number; text: string; model?: string; }
interface TokenResponse { id: number; count: number; error?: string; }

// 简单的 token 估算（用于 Worker 环境）
function estimateTokens(text: string, model?: string): number {
  // 根据模型调整估算系数
  const isChineseModel = model?.includes('glm') || model?.includes('deepseek');
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  if (isChineseModel) return Math.ceil(chineseChars * 0.7 + otherChars / 4); // 中文模型对中文更高效
  return Math.ceil(chineseChars / 1.5 + otherChars / 4); // 英文模型标准估算
}

// Worker 消息处理
self.onmessage = (e: MessageEvent<TokenRequest>) => {
  const { id, text, model } = e.data;
  try {
    const count = estimateTokens(text, model);
    self.postMessage({ id, count } as TokenResponse);
  } catch (error: any) {
    self.postMessage({ id, count: 0, error: error.message } as TokenResponse);
  }
};

export {}; // 标记为模块
