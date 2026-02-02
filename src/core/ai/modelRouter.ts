/**
 * Model Router - 智能模型路由
 */

export interface ModelConfig { id: string; provider: 'anthropic' | 'openai' | 'google' | 'codesuc' | 'local'; name: string; contextWindow: number; maxOutput: number; costPer1kInput: number; costPer1kOutput: number; strengths: string[]; speed: 'fast' | 'medium' | 'slow'; }
export interface TaskProfile { type: 'completion' | 'chat' | 'review' | 'refactor' | 'explain' | 'generate' | 'debug'; complexity: 'low' | 'medium' | 'high'; inputTokens: number; urgency: 'low' | 'medium' | 'high'; }

const MODELS: ModelConfig[] = [
  { id: 'claude-sonnet-4-5', provider: 'anthropic', name: 'Claude Sonnet 4.5', contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.003, costPer1kOutput: 0.015, strengths: ['coding', 'reasoning', 'long-context'], speed: 'medium' },
  { id: 'claude-haiku-3-5', provider: 'anthropic', name: 'Claude Haiku 3.5', contextWindow: 200000, maxOutput: 4096, costPer1kInput: 0.00025, costPer1kOutput: 0.00125, strengths: ['speed', 'simple-tasks'], speed: 'fast' },
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.005, costPer1kOutput: 0.015, strengths: ['general', 'creative'], speed: 'medium' },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', contextWindow: 128000, maxOutput: 4096, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, strengths: ['speed', 'cost'], speed: 'fast' },
  { id: 'gemini-2.0-flash', provider: 'google', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxOutput: 8192, costPer1kInput: 0.0001, costPer1kOutput: 0.0004, strengths: ['speed', 'long-context', 'cost'], speed: 'fast' },
  { id: 'deepseek-chat', provider: 'codesuc', name: 'DeepSeek Chat', contextWindow: 64000, maxOutput: 4096, costPer1kInput: 0.0001, costPer1kOutput: 0.0002, strengths: ['coding', 'cost'], speed: 'medium' },
  { id: 'codesuc-sonnet', provider: 'codesuc', name: 'Codesuc Sonnet', contextWindow: 200000, maxOutput: 8192, costPer1kInput: 0.001, costPer1kOutput: 0.005, strengths: ['coding', 'reasoning'], speed: 'medium' },
];

class ModelRouter {
  private models: ModelConfig[] = MODELS;
  private preferredProvider?: string;
  private costLimit?: number;

  setPreferredProvider(provider: string): void { this.preferredProvider = provider; }
  setCostLimit(limit: number): void { this.costLimit = limit; }
  addModel(model: ModelConfig): void { this.models.push(model); }
  getModels(): ModelConfig[] { return this.models; }
  getModel(id: string): ModelConfig | undefined { return this.models.find(m => m.id === id); }

  selectModel(task: TaskProfile): ModelConfig {
    const candidates = this.models.filter(m => {
      if (m.contextWindow < task.inputTokens * 1.5) return false; // 上下文窗口检查
      if (this.preferredProvider && m.provider !== this.preferredProvider) return false; // 提供商偏好
      return true;
    });

    if (candidates.length === 0) return this.models[0]; // 回退到默认

    // 评分逻辑
    const scored = candidates.map(m => {
      let score = 0;

      // 速度评分
      if (task.urgency === 'high') score += m.speed === 'fast' ? 30 : m.speed === 'medium' ? 15 : 0;
      else if (task.urgency === 'low') score += m.speed === 'slow' ? 10 : 5;

      // 复杂度匹配
      if (task.complexity === 'high') score += m.strengths.includes('reasoning') ? 25 : 10;
      else if (task.complexity === 'low') score += m.speed === 'fast' ? 20 : 10;

      // 任务类型匹配
      if (['completion', 'generate', 'refactor'].includes(task.type) && m.strengths.includes('coding')) score += 20;
      if (task.inputTokens > 50000 && m.strengths.includes('long-context')) score += 15;

      // 成本考虑
      const estimatedCost = (task.inputTokens / 1000) * m.costPer1kInput + (m.maxOutput / 1000) * m.costPer1kOutput;
      if (this.costLimit && estimatedCost > this.costLimit) score -= 50;
      score -= estimatedCost * 10; // 成本惩罚

      return { model: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].model;
  }

  selectForCompletion(inputTokens: number): ModelConfig {
    return this.selectModel({ type: 'completion', complexity: 'low', inputTokens, urgency: 'high' });
  }

  selectForChat(inputTokens: number, complexity: 'low' | 'medium' | 'high' = 'medium'): ModelConfig {
    return this.selectModel({ type: 'chat', complexity, inputTokens, urgency: 'medium' });
  }

  selectForReview(inputTokens: number): ModelConfig {
    return this.selectModel({ type: 'review', complexity: 'high', inputTokens, urgency: 'low' });
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModel(modelId);
    if (!model) return 0;
    return (inputTokens / 1000) * model.costPer1kInput + (outputTokens / 1000) * model.costPer1kOutput;
  }
}

export const modelRouter = new ModelRouter();
export default modelRouter;
