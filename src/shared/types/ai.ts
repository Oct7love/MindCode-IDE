// AI 服务相关类型定义

export type AIProviderType = 'claude' | 'openai' | 'gemini' | 'deepseek' | 'glm' | 'codesuc';

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallInfo[];
  toolCallId?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, any>; required?: string[] };
}

export interface ToolCallInfo { id: string; name: string; arguments: Record<string, any>; }

export interface ToolCallbacks extends StreamCallbacks {
  onToolCall: (calls: ToolCallInfo[]) => void;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onThinking?: (token: string) => void;  // 思考过程回调
  onThinkingComplete?: () => void;       // 思考完成回调
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface AIProvider {
  name: AIProviderType;
  displayName: string;
  models: ModelInfo[];
  supportsTools?: boolean; // 是否支持 Anthropic/OpenAI tools API
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
