// AI 服务配置
export interface AIConfig {
  claude: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  gemini: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  deepseek: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

// 默认配置 - 使用 Antigravity 本地代理
export const defaultAIConfig: AIConfig = {
  claude: { // Anthropic 协议: http://127.0.0.1:8045/v1/messages
    apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632',
    baseUrl: 'http://127.0.0.1:8045',
    model: 'claude-opus-4-5-thinking'
  },
  openai: { // OpenAI 协议: http://127.0.0.1:8045/v1
    apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632',
    baseUrl: 'http://127.0.0.1:8045/v1',
    model: 'gpt-4o'
  },
  gemini: { // OpenAI 兼容协议
    apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632',
    baseUrl: 'http://127.0.0.1:8045/v1',
    model: 'gemini-2.5-flash'
  },
  deepseek: {
    apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632',
    baseUrl: 'http://127.0.0.1:8045/v1',
    model: 'deepseek-chat'
  }
};
