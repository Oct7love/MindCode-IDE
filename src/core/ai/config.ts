// AI 服务配置
export interface AIProviderSettings { apiKey: string; baseUrl: string; model: string; }
export interface AIConfig {
  claude: AIProviderSettings;
  openai: AIProviderSettings;
  gemini: AIProviderSettings;
  deepseek: AIProviderSettings;
  glm: AIProviderSettings;
  codesuc: AIProviderSettings; // 特价渠道
}

// 默认配置
export const defaultAIConfig: AIConfig = {
  claude: { apiKey: 'sk-3uX6t2wUjwQDsn3k4Q8Gsl5RLON2A4cPQPskuLYIVhL4My36', baseUrl: 'https://willapi.one', model: 'claude-opus-4-5-20251101' }, // willapi.one
  openai: { apiKey: 'sk-2193ee6b1da84eeaa112fbbcf2e81632', baseUrl: 'http://127.0.0.1:8045/v1', model: 'gpt-4o' },
  gemini: { apiKey: 'sk-EJimY2nf8Xc9ucR1YdEZwMdFULr2mdbKGJsf0XnIyagRUOkF', baseUrl: 'https://once.novai.su/v1', model: '[次]gemini-3-pro-preview' },
  deepseek: { apiKey: 'sk-cdbe9cd807884f3fb0adaea29c4ac05b', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  glm: { apiKey: '942f209dc0c64ed58d54ac72b5ccf1f6.aHL4DBjxxAihYBY8', baseUrl: 'https://open.bigmodel.cn/api/anthropic', model: 'glm-4.7-flashx' },
  codesuc: { apiKey: 'cr_6f79c401fd9c7be877aad36527af6da1405258e8ae60b29cd9d5d3c90ecd6e51', baseUrl: 'https://main.codesuc.top/api', model: 'codesuc-opus' }, // 特价渠道
};
