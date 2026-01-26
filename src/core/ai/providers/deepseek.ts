import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';

export class DeepSeekProvider extends BaseAIProvider {
  name = 'deepseek' as const;
  displayName = 'DeepSeek';

  models: ModelInfo[] = [
    { id: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 128000, inputPrice: 0.14, outputPrice: 0.28 },
    { id: 'deepseek-reasoner', name: 'DeepSeek R2', contextWindow: 128000, inputPrice: 0.55, outputPrice: 2.19 },
  ];

  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl || 'https://api.deepseek.com' }); // DeepSeek OpenAI 兼容
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
