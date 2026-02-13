import type {
  AIProvider,
  AIProviderType,
  AIProviderConfig,
  ChatMessage,
  StreamCallbacks,
} from "@shared/types/ai";
import {
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  DeepSeekProvider,
  GLMProvider,
} from "./providers";

export interface ProviderRegistry {
  claude?: AIProviderConfig;
  openai?: AIProviderConfig;
  gemini?: AIProviderConfig;
  deepseek?: AIProviderConfig;
  glm?: AIProviderConfig;
}

export class AIRouter {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private defaultProvider: AIProviderType = "claude";

  constructor(registry: ProviderRegistry) {
    this.initializeProviders(registry);
  }

  private initializeProviders(registry: ProviderRegistry): void {
    if (registry.claude) this.providers.set("claude", new ClaudeProvider(registry.claude));
    if (registry.openai) this.providers.set("openai", new OpenAIProvider(registry.openai));
    if (registry.gemini) this.providers.set("gemini", new GeminiProvider(registry.gemini));
    if (registry.deepseek) this.providers.set("deepseek", new DeepSeekProvider(registry.deepseek));
    if (registry.glm) this.providers.set("glm", new GLMProvider(registry.glm));
  }

  setDefaultProvider(provider: AIProviderType): void {
    if (this.providers.has(provider)) {
      this.defaultProvider = provider;
    }
  }

  getProvider(type?: AIProviderType): AIProvider | undefined {
    return this.providers.get(type || this.defaultProvider);
  }

  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  async chat(messages: ChatMessage[], provider?: AIProviderType): Promise<string> {
    const p = this.getProvider(provider);
    if (!p) throw new Error(`Provider ${provider || this.defaultProvider} not configured`);
    return p.chat(messages);
  }

  async chatStream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    provider?: AIProviderType,
  ): Promise<void> {
    const p = this.getProvider(provider);
    if (!p) throw new Error(`Provider ${provider || this.defaultProvider} not configured`);
    return p.chatStream(messages, callbacks);
  }
}
