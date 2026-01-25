// AI 服务管理器 - 统一管理所有 AI Provider
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { DeepSeekProvider } from './providers/deepseek';
import { defaultAIConfig } from './config';
import { ChatMessage, StreamCallbacks, AIProvider } from '@shared/types/ai';

export type ModelType = 'claude' | 'openai' | 'gemini' | 'deepseek';

class AIService {
  private providers: Map<ModelType, AIProvider> = new Map();
  private currentModel: ModelType = 'claude';

  constructor() {
    this.initProviders();
  }

  private initProviders() {
    this.providers.set('claude', new ClaudeProvider({
      apiKey: defaultAIConfig.claude.apiKey,
      baseUrl: defaultAIConfig.claude.baseUrl,
      model: defaultAIConfig.claude.model
    }));

    this.providers.set('openai', new OpenAIProvider({
      apiKey: defaultAIConfig.openai.apiKey,
      baseUrl: defaultAIConfig.openai.baseUrl,
      model: defaultAIConfig.openai.model
    }));

    this.providers.set('gemini', new GeminiProvider({
      apiKey: defaultAIConfig.gemini.apiKey,
      baseUrl: defaultAIConfig.gemini.baseUrl,
      model: defaultAIConfig.gemini.model
    }));

    this.providers.set('deepseek', new DeepSeekProvider({
      apiKey: defaultAIConfig.deepseek.apiKey,
      baseUrl: defaultAIConfig.deepseek.baseUrl,
      model: defaultAIConfig.deepseek.model
    }));
  }

  setModel(model: ModelType) {
    this.currentModel = model;
  }

  getModel(): ModelType {
    return this.currentModel;
  }

  getProvider(model?: ModelType): AIProvider {
    const m = model || this.currentModel;
    const provider = this.providers.get(m);
    if (!provider) {
      throw new Error(`Provider not found: ${m}`);
    }
    return provider;
  }

  async chat(messages: ChatMessage[], model?: ModelType): Promise<string> {
    return this.getProvider(model).chat(messages);
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks, model?: ModelType): Promise<void> {
    return this.getProvider(model).chatStream(messages, callbacks);
  }
}

export const aiService = new AIService();
export default aiService;
