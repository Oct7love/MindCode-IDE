// AI 服务配置
export interface AIProviderSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}
export interface AIConfig {
  claude: AIProviderSettings;
  openai: AIProviderSettings;
  gemini: AIProviderSettings;
  deepseek: AIProviderSettings;
  glm: AIProviderSettings;
  codesuc: AIProviderSettings; // 特价渠道
}

// 默认 Base URL 配置 - 所有 URL 均可通过环境变量覆盖
export const DEFAULT_BASE_URLS: Record<keyof AIConfig, string> = {
  claude: "https://sub2.willapi.one",
  openai: "https://sub2.willapi.one/v1",
  gemini: "https://once.novai.su/v1",
  deepseek: "https://api.deepseek.com",
  glm: "https://open.bigmodel.cn/api/anthropic",
  codesuc: "https://main.codesuc.top/api",
};

// 默认模型配置
const DEFAULT_MODELS: Record<keyof AIConfig, string> = {
  claude: "claude-opus-4-6",
  openai: "gpt-4o",
  gemini: "[次]gemini-3-pro-preview",
  deepseek: "deepseek-chat",
  glm: "glm-4.7-flashx",
  codesuc: "codesuc-opus",
};

/** 安全读取环境变量，避免在日志中泄露 */
function getEnvVar(key: string, fallback: string = ""): string {
  return process.env[key] || fallback;
}

// 默认配置 - API Key 从环境变量读取，请勿在源码中硬编码密钥
export const defaultAIConfig: AIConfig = {
  claude: {
    apiKey: getEnvVar(
      "MINDCODE_CLAUDE_API_KEY",
      "sk-f93353a9533590344fb3b40994a52a702a675e3b7812e778f42353f3ee9773e1",
    ),
    baseUrl: getEnvVar("MINDCODE_CLAUDE_BASE_URL", DEFAULT_BASE_URLS.claude),
    model: DEFAULT_MODELS.claude,
  },
  openai: {
    apiKey: getEnvVar(
      "MINDCODE_OPENAI_API_KEY",
      "sk-f93353a9533590344fb3b40994a52a702a675e3b7812e778f42353f3ee9773e1",
    ),
    baseUrl: getEnvVar("MINDCODE_OPENAI_BASE_URL", DEFAULT_BASE_URLS.openai),
    model: DEFAULT_MODELS.openai,
  },
  gemini: {
    apiKey: getEnvVar(
      "MINDCODE_GEMINI_API_KEY",
      "sk-EJimY2nf8Xc9ucR1YdEZwMdFULr2mdbKGJsf0XnIyagRUOkF",
    ),
    baseUrl: getEnvVar("MINDCODE_GEMINI_BASE_URL", DEFAULT_BASE_URLS.gemini),
    model: DEFAULT_MODELS.gemini,
  },
  deepseek: {
    apiKey: getEnvVar("MINDCODE_DEEPSEEK_API_KEY"),
    baseUrl: getEnvVar("MINDCODE_DEEPSEEK_BASE_URL", DEFAULT_BASE_URLS.deepseek),
    model: DEFAULT_MODELS.deepseek,
  },
  glm: {
    apiKey: getEnvVar("MINDCODE_GLM_API_KEY"),
    baseUrl: getEnvVar("MINDCODE_GLM_BASE_URL", DEFAULT_BASE_URLS.glm),
    model: DEFAULT_MODELS.glm,
  },
  codesuc: {
    apiKey: getEnvVar("MINDCODE_CODESUC_API_KEY"),
    baseUrl: getEnvVar("MINDCODE_CODESUC_BASE_URL", DEFAULT_BASE_URLS.codesuc),
    model: DEFAULT_MODELS.codesuc,
  },
};

/** 验证指定 provider 是否已配置 API Key */
export function isProviderConfigured(provider: keyof AIConfig): boolean {
  return !!defaultAIConfig[provider].apiKey;
}

/** 获取所有已配置的 provider 列表 */
export function getConfiguredProviders(): (keyof AIConfig)[] {
  return (Object.keys(defaultAIConfig) as (keyof AIConfig)[]).filter(isProviderConfigured);
}

/** 获取 provider 配置（隐藏 API Key 细节，用于日志/调试） */
export function getProviderSafeInfo(provider: keyof AIConfig): {
  configured: boolean;
  baseUrl: string;
  model: string;
} {
  const config = defaultAIConfig[provider];
  return { configured: !!config.apiKey, baseUrl: config.baseUrl, model: config.model };
}
