import { BaseAIProvider } from './base';
import { ChatMessage, StreamCallbacks, ModelInfo, AIProviderConfig, ToolSchema, ToolCallbacks, ToolCallInfo } from '@shared/types/ai';
import * as http from 'http';
import * as https from 'https';

export class ClaudeProvider extends BaseAIProvider {
  name = 'claude' as const;
  displayName = 'Claude (Anthropic)';

  models: ModelInfo[] = [
    { id: 'claude-opus-4-5-thinking', name: 'Claude Opus 4.5', contextWindow: 200000, inputPrice: 15, outputPrice: 75 },
    { id: 'claude-sonnet-4-5-thinking', name: 'Claude Sonnet 4.5 (Thinking)', contextWindow: 200000, inputPrice: 3, outputPrice: 15 },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200000, inputPrice: 3, outputPrice: 15 },
  ];

  private apiKey: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
  }

  private request(body: string, stream: boolean): Promise<{ data?: any; stream?: http.IncomingMessage; error?: string }> {
    return new Promise((resolve) => {
      // Anthropic 原生 API 端点
      const url = new URL(`${this.baseUrl}/v1/messages`);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = lib.request(options, (res) => {
        if (stream) {
          if (res.statusCode !== 200) {
            let errorData = '';
            res.on('data', chunk => errorData += chunk);
            res.on('end', () => resolve({ error: `API Error ${res.statusCode}: ${errorData}` }));
          } else {
            resolve({ stream: res });
          }
        } else {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode !== 200) {
              resolve({ error: `API Error ${res.statusCode}: ${data}` });
            } else {
              try {
                resolve({ data: JSON.parse(data) });
              } catch (e) {
                resolve({ error: `Parse error: ${data}` });
              }
            }
          });
        }
      });

      req.on('error', (e) => resolve({ error: e.message }));
      req.write(body);
      req.end();
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = JSON.stringify({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content }))
    });

    const result = await this.request(body, false);
    if (result.error) throw new Error(result.error);

    const textBlock = result.data?.content?.find((block: any) => block.type === 'text');
    return textBlock?.text || '';
  }

  async chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = JSON.stringify({
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      stream: true,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content }))
    });

    let fullText = '';

    try {
      const result = await this.request(body, true);
      if (result.error) {
        callbacks.onError(new Error(result.error));
        return;
      }

      const res = result.stream!;
      let buffer = '';

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              // Anthropic 流式格式
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const token = parsed.delta.text;
                fullText += token;
                callbacks.onToken(token);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      res.on('end', () => {
        callbacks.onComplete(fullText);
      });

      res.on('error', (e: Error) => {
        callbacks.onError(e);
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  }

  async chatWithTools(messages: ChatMessage[], tools: ToolSchema[], callbacks: ToolCallbacks): Promise<void> { // 支持工具调用的流式聊天
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') return { role: 'user' as const, content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }] };
      if (m.toolCalls?.length) return { role: 'assistant' as const, content: m.toolCalls.map(tc => ({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments })) };
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });
    const claudeTools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    const body = JSON.stringify({ model: this.getModel(), max_tokens: this.getMaxTokens(), stream: true, system: systemMessage?.content, messages: chatMessages, tools: claudeTools });
    let fullText = '', toolCalls: ToolCallInfo[] = [], currentToolUse: { id: string; name: string; input: string } | null = null;
    try {
      const result = await this.request(body, true);
      if (result.error) { callbacks.onError(new Error(result.error)); return; }
      const res = result.stream!;
      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
              currentToolUse = { id: parsed.content_block.id, name: parsed.content_block.name, input: '' };
            } else if (parsed.type === 'content_block_delta') {
              if (parsed.delta?.type === 'text_delta') { fullText += parsed.delta.text; callbacks.onToken(parsed.delta.text); }
              else if (parsed.delta?.type === 'input_json_delta' && currentToolUse) { currentToolUse.input += parsed.delta.partial_json || ''; }
            } else if (parsed.type === 'content_block_stop' && currentToolUse) {
              try { toolCalls.push({ id: currentToolUse.id, name: currentToolUse.name, arguments: JSON.parse(currentToolUse.input || '{}') }); } catch {}
              currentToolUse = null;
            }
          } catch {}
        }
      });
      res.on('end', () => {
        if (toolCalls.length > 0 && callbacks.onToolCall) callbacks.onToolCall(toolCalls);
        callbacks.onComplete(fullText);
      });
      res.on('error', (e: Error) => callbacks.onError(e));
    } catch (error) { callbacks.onError(error as Error); }
  }
}
