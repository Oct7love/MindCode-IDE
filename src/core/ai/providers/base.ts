import type {
  AIProvider,
  ChatMessage,
  StreamCallbacks,
  ModelInfo,
  AIProviderConfig,
} from "@shared/types/ai";
import { countTokens as tiktokenCount } from "../tokenizer";

export abstract class BaseAIProvider implements AIProvider {
  abstract name: "claude" | "openai" | "gemini" | "deepseek" | "glm" | "codesuc";
  abstract displayName: string;
  abstract models: ModelInfo[];
  supportsTools: boolean = true; // 默认支持 tools，子类可覆盖

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

  // 使用 tiktoken 进行准确的 token 计算
  countTokens(text: string): number {
    return tiktokenCount(text, this.getModel());
  }

  // 前端模型 ID 到 API 模型名的映射
  private static modelMapping: Record<string, string> = {
    // Claude 系列 - Antigravity Anthropic 协议
    "claude-opus-4-5-thinking": "claude-opus-4-5-thinking",
    "claude-sonnet-4-5-thinking": "claude-sonnet-4-5-thinking",
    "claude-sonnet-4-5": "claude-sonnet-4-5",
    // Gemini 系列 - Antigravity Gemini 协议
    "gemini-3-flash": "gemini-3-flash",
    "gemini-3-pro-high": "gemini-3-pro-high",
    "gemini-3-pro-low": "gemini-3-pro-low",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-thinking": "gemini-2.5-flash-thinking",
    // DeepSeek 系列 - OpenAI 兼容协议
    "deepseek-chat": "deepseek-chat",
    "deepseek-reasoner": "deepseek-reasoner",
    // GLM 系列 - OpenAI 兼容协议
    "glm-4.7": "glm-4.7",
    "glm-4.7-flashx": "glm-4.7-flashx",
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
