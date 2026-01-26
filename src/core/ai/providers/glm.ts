import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig } from '@shared/types/ai';

export class GLMProvider extends BaseAIProvider { // 智谱 GLM - 使用 Anthropic 兼容协议
  name = 'glm' as const;
  displayName = '智谱 GLM';
  models: ModelInfo[] = [
    { id: 'glm-4.7', name: 'GLM-4.7', contextWindow: 200000, inputPrice: 0.05, outputPrice: 0.05 },
    { id: 'glm-4.7-flashx', name: 'GLM-4.7 FlashX', contextWindow: 200000, inputPrice: 0, outputPrice: 0 },
  ];
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl || 'https://open.bigmodel.cn/api/anthropic' });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const chatMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const response = await this.client.messages.create({ model: this.getModel(), max_tokens: this.getMaxTokens(), system: systemMsg, messages: chatMsgs });
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    let fullText = '';
    try {
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const chatMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const stream = this.client.messages.stream({ model: this.getModel(), max_tokens: this.getMaxTokens(), system: systemMsg, messages: chatMsgs });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          callbacks.onToken(event.delta.text);
        }
      }
      callbacks.onComplete(fullText);
    } catch (error) { callbacks.onError(error as Error); }
  }
}
