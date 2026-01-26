import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';

export class GeminiProvider extends BaseAIProvider {
  name = 'gemini' as const;
  displayName = 'Gemini (Google)';

  models: ModelInfo[] = [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, inputPrice: 1.25, outputPrice: 5 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPrice: 0.075, outputPrice: 0.3 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPrice: 0.1, outputPrice: 0.4 },
  ];

  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    // 使用 OpenAI 兼容接口（中转站）
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      temperature: this.getTemperature(),
      messages: messages.filter(m => m.role !== 'tool').map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
    });
    return response.choices[0]?.message?.content || '';
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    let fullText = '';
    try {
      const stream = await this.client.chat.completions.create({
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        temperature: this.getTemperature(),
        stream: true,
        messages: messages.filter(m => m.role !== 'tool').map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullText += token;
          callbacks.onToken(token);
        }
      }

      callbacks.onComplete(fullText);
    } catch (error) {
      callbacks.onError(error as Error);
    }
  }
}
