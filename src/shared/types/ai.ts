// AI 服务相关类型定义

export type AIProviderType = 'claude' | 'openai' | 'gemini' | 'deepseek';

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface AIProvider {
  name: AIProviderType;
  displayName: string;
  models: ModelInfo[];
  chat(messages: ChatMessage[]): Promise<string>;
  chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void>;
  countTokens(text: string): number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  inputPrice: number;  // 每百万 token 价格（美元）
  outputPrice: number;
}

export interface AIRequestOptions {
  provider: AIProviderType;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
