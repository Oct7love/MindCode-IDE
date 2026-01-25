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

// 默认配置 - 使用本地反代
export const defaultAIConfig: AIConfig = {
  claude: {
    apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632',
    baseUrl: 'http://127.0.0.1:8045',
    model: 'claude-opus-4-5-20251101'
  },
  openai: {
    apiKey: 'sk-492679a659b0931182841bf9a2864c95cac63cc48a9b55696ae307175d0f4e1c',
    baseUrl: 'https://sub.openclaudecode.cn/v1',
    model: 'gpt-4o'
  },
  gemini: {
    apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632',
    baseUrl: 'http://127.0.0.1:8045/v1',
    model: 'gemini-2.0-flash'
  },
  deepseek: {
    apiKey: 'sk-492679a659b0931182841bf9a2864c95cac63cc48a9b55696ae307175d0f4e1c',
    baseUrl: 'https://sub.openclaudecode.cn/v1',
    model: 'deepseek-chat'
  }
};
