import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';

export class DeepSeekProvider extends BaseAIProvider {
  name = 'deepseek' as const;
  displayName = 'DeepSeek';

  models: ModelInfo[] = [
    { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 128000, inputPrice: 0.14, outputPrice: 0.28 },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 128000, inputPrice: 0.14, outputPrice: 0.28 },
  ];

  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    // DeepSeek 使用 OpenAI 兼容接口
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.deepseek.com/v1'
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      temperature: this.getTemperature(),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
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
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
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
