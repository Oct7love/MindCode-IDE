import { AIProvider, ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';

export abstract class BaseAIProvider implements AIProvider {
  abstract name: 'claude' | 'openai' | 'gemini' | 'deepseek';
  abstract displayName: string;
  abstract models: ModelInfo[];

  protected config: AIProviderConfig;
  private runtimeModel: string | null = null;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  // 运行时设置模型（用于动态切换）
  setModel(model: string): this {
    this.runtimeModel = model;
    return this;
  }

  abstract chat(messages: ChatMessage[]): Promise<string>;
  abstract chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void>;

  countTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  // 前端模型 ID 到 API 模型名的映射（直接使用 Antigravity 代理格式）
  private static modelMapping: Record<string, string> = {
    // Claude 系列 - Anthropic 协议: http://127.0.0.1:8045/v1/messages
    'claude-opus-4-5-thinking': 'claude-opus-4-5-thinking',
    'claude-sonnet-4-5-thinking': 'claude-sonnet-4-5-thinking',
    'claude-sonnet-4-5': 'claude-sonnet-4-5',
    // Gemini 系列 - Gemini 协议: http://127.0.0.1:8045/v1beta/models
    'gemini-3-flash': 'gemini-3-flash',
    'gemini-3-pro-high': 'gemini-3-pro-high',
    'gemini-3-pro-low': 'gemini-3-pro-low',
    'gemini-3-pro-image': 'gemini-3-pro-image',
    'gemini-2.5-flash': 'gemini-2.5-flash',
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    'gemini-2.5-flash-thinking': 'gemini-2.5-flash-thinking',
  };

  protected getModel(): string {
    const requestedModel = this.runtimeModel || this.config.model || this.models[0].id;
    // 使用映射转换模型名，如果没有映射则直接使用原始名称
    return BaseAIProvider.modelMapping[requestedModel] || requestedModel;
  }

  protected getMaxTokens(): number {
    return this.config.maxTokens || 4096;
  }

  protected getTemperature(): number {
    return this.config.temperature ?? 0.7;
  }
}
