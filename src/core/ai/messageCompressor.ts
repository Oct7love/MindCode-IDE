/**
 * Message Compressor - 消息历史压缩
 */

export interface Message { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: number; tokens?: number; }
export interface CompressedHistory { messages: Message[]; summary?: string; originalCount: number; compressedCount: number; tokensSaved: number; }

class MessageCompressor {
  private tokenEstimator: (text: string) => number = text => Math.ceil(text.length / 4);
  private maxTokens = 50000;
  private summarizer?: (messages: Message[]) => Promise<string>;

  setTokenEstimator(fn: (text: string) => number): void { this.tokenEstimator = fn; }
  setMaxTokens(max: number): void { this.maxTokens = max; }
  setSummarizer(fn: (messages: Message[]) => Promise<string>): void { this.summarizer = fn; }

  estimateTokens(messages: Message[]): number { return messages.reduce((sum, m) => sum + (m.tokens || this.tokenEstimator(m.content)), 0); }

  compress(messages: Message[], targetTokens?: number): CompressedHistory {
    const target = targetTokens || this.maxTokens;
    const originalTokens = this.estimateTokens(messages);
    if (originalTokens <= target) return { messages, originalCount: messages.length, compressedCount: messages.length, tokensSaved: 0 };

    // 策略1: 保留最近消息，截断早期消息
    const result: Message[] = [];
    let currentTokens = 0;

    // 始终保留系统消息
    const systemMsgs = messages.filter(m => m.role === 'system');
    systemMsgs.forEach(m => { result.push(m); currentTokens += m.tokens || this.tokenEstimator(m.content); });

    // 从最近的消息开始添加
    const nonSystemMsgs = messages.filter(m => m.role !== 'system').reverse();
    for (const msg of nonSystemMsgs) {
      const tokens = msg.tokens || this.tokenEstimator(msg.content);
      if (currentTokens + tokens <= target * 0.9) { result.unshift(msg); currentTokens += tokens; } // 留10%余量
      else break;
    }

    // 策略2: 截断长消息
    const compressedMessages = result.map(m => {
      const tokens = m.tokens || this.tokenEstimator(m.content);
      if (tokens > 2000 && m.role === 'assistant') { // 截断长回复
        const truncated = m.content.slice(0, 4000) + '\n\n[... 内容已截断 ...]';
        return { ...m, content: truncated, tokens: this.tokenEstimator(truncated) };
      }
      return m;
    });

    return {
      messages: compressedMessages,
      originalCount: messages.length,
      compressedCount: compressedMessages.length,
      tokensSaved: originalTokens - this.estimateTokens(compressedMessages),
    };
  }

  async compressWithSummary(messages: Message[], targetTokens?: number): Promise<CompressedHistory> {
    if (!this.summarizer) return this.compress(messages, targetTokens);

    const target = targetTokens || this.maxTokens;
    const originalTokens = this.estimateTokens(messages);
    if (originalTokens <= target) return { messages, originalCount: messages.length, compressedCount: messages.length, tokensSaved: 0 };

    // 将早期消息总结成摘要
    const midpoint = Math.floor(messages.length / 2);
    const earlyMessages = messages.slice(0, midpoint);
    const recentMessages = messages.slice(midpoint);

    const summary = await this.summarizer(earlyMessages);
    const summaryMessage: Message = { role: 'system', content: `[对话历史摘要]\n${summary}`, tokens: this.tokenEstimator(summary) };

    const result = [summaryMessage, ...recentMessages];
    return {
      messages: result,
      summary,
      originalCount: messages.length,
      compressedCount: result.length,
      tokensSaved: originalTokens - this.estimateTokens(result),
    };
  }

  // 提取关键信息
  extractKeyInfo(messages: Message[]): string[] {
    const keywords: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    const filePathRegex = /[\/\\][\w\-\.\/\\]+\.\w+/g;

    messages.forEach(m => {
      const codeBlocks = m.content.match(codeBlockRegex) || [];
      codeBlocks.forEach(block => { if (block.length < 500) keywords.push(block); });
      const filePaths = m.content.match(filePathRegex) || [];
      keywords.push(...filePaths);
    });

    return [...new Set(keywords)];
  }
}

export const messageCompressor = new MessageCompressor();
export default messageCompressor;
