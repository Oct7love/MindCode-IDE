import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';

export class OpenAIProvider extends BaseAIProvider {
  name = 'openai' as const;
  displayName = 'OpenAI';

  models: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPrice: 2.5, outputPrice: 10 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPrice: 0.15, outputPrice: 0.6 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, inputPrice: 10, outputPrice: 30 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385, inputPrice: 0.5, outputPrice: 1.5 },
  ];

  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
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
