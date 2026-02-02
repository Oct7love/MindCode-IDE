/**
 * Embeddings Service - 向量嵌入服务
 * 支持 OpenAI text-embedding-3-small/large
 */
import OpenAI from 'openai';
import { defaultAIConfig } from '../../ai/config';

export interface EmbeddingResult { text: string; embedding: number[]; model: string; tokenCount: number; }
export interface EmbeddingsConfig { apiKey?: string; baseUrl?: string; model?: string; batchSize?: number; maxRetries?: number; }

const DEFAULT_MODEL = 'text-embedding-3-small'; // 1536 维度，性价比高
const DEFAULT_BATCH_SIZE = 100; // OpenAI 最大支持 2048，但 100 更稳定

export class EmbeddingsService {
  private client: OpenAI;
  private model: string;
  private batchSize: number;
  private maxRetries: number;
  private cache = new Map<string, number[]>(); // 简单缓存

  constructor(config: EmbeddingsConfig = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey || defaultAIConfig.openai.apiKey,
      baseURL: config.baseUrl || defaultAIConfig.openai.baseUrl,
    });
    this.model = config.model || DEFAULT_MODEL;
    this.batchSize = config.batchSize || DEFAULT_BATCH_SIZE;
    this.maxRetries = config.maxRetries || 3;
  }

  /** 生成单个文本的嵌入向量 */
  async embed(text: string): Promise<EmbeddingResult> {
    const cached = this.cache.get(text);
    if (cached) return { text, embedding: cached, model: this.model, tokenCount: 0 };
    const result = await this.embedBatch([text]);
    return result[0];
  }

  /** 批量生成嵌入向量 */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];
    const results: EmbeddingResult[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchResults = await this.embedBatchInternal(batch);
      results.push(...batchResults);
    }
    return results;
  }

  private async embedBatchInternal(texts: string[], attempt = 0): Promise<EmbeddingResult[]> {
    try {
      const response = await this.client.embeddings.create({ model: this.model, input: texts, encoding_format: 'float' });
      return response.data.map((item, idx) => {
        const embedding = item.embedding;
        this.cache.set(texts[idx], embedding); // 缓存结果
        return { text: texts[idx], embedding, model: this.model, tokenCount: response.usage?.total_tokens || 0 };
      });
    } catch (error: any) {
      if (attempt < this.maxRetries && (error.status === 429 || error.status >= 500)) {
        const delay = Math.pow(2, attempt) * 1000; // 指数退避
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.embedBatchInternal(texts, attempt + 1);
      }
      throw error;
    }
  }

  /** 计算两个向量的余弦相似度 */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dotProduct += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /** 查找最相似的向量 */
  static findMostSimilar(query: number[], candidates: { id: string; embedding: number[] }[], topK: number = 10): { id: string; score: number }[] {
    const scored = candidates.map(c => ({ id: c.id, score: this.cosineSimilarity(query, c.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  clearCache(): void { this.cache.clear(); }
  getCacheSize(): number { return this.cache.size; }
}

// 单例
let _instance: EmbeddingsService | null = null;
export function getEmbeddingsService(config?: EmbeddingsConfig): EmbeddingsService {
  if (!_instance) _instance = new EmbeddingsService(config);
  return _instance;
}

export default EmbeddingsService;
