/**
 * App Config - 应用全局配置
 */

export const APP_CONFIG = {
  name: "MindCode",
  version: "1.0.0",
  description: "AI-Powered Code Editor",
  homepage: "https://github.com/Oct7love/MindCode-IDE",
  author: "MindCode Team",

  // 编辑器默认配置
  editor: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "off" as const,
    lineNumbers: "on" as const,
    minimap: { enabled: true, maxColumn: 80 },
    scrollBeyondLastLine: false,
    renderWhitespace: "selection" as const,
    cursorBlinking: "smooth" as const,
    cursorStyle: "line" as const,
    smoothScrolling: true,
    formatOnPaste: true,
    formatOnType: false,
    autoIndent: "full" as const,
    bracketPairColorization: { enabled: true },
  },

  // AI 默认配置
  ai: {
    defaultModel: "claude-sonnet-4-5-20250929",
    defaultProvider: "claude",
    maxTokens: 4096,
    temperature: 0.3,
    streamingEnabled: true,
    completionEnabled: true,
    completionDebounce: 30,
  },

  // 主题配置
  theme: {
    default: "mindcode-dark",
    followSystem: true,
  },

  // 文件配置
  files: {
    autoSave: true,
    autoSaveDelay: 1000,
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    encoding: "utf-8",
    eol: "lf" as const,
  },

  // 搜索配置
  search: {
    maxResults: 1000,
    defaultExclude: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**"],
  },

  // 终端配置
  terminal: {
    shell: process.platform === "win32" ? "powershell.exe" : "/bin/zsh",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    cursorBlink: true,
  },

  // Git 配置
  git: {
    enabled: true,
    autofetch: true,
    autofetchInterval: 180000, // 3分钟
    confirmSync: true,
  },

  // 性能配置
  performance: {
    lazyLoadThreshold: 1000,
    virtualListItemHeight: 22,
    debounceDelay: 100,
    throttleDelay: 50,
  },

  // 存储 Key
  storageKeys: {
    settings: "mindcode-settings",
    theme: "mindcode-theme",
    recentFiles: "mindcode-recent-files",
    recentWorkspaces: "mindcode-recent-workspaces",
    layout: "mindcode-layout",
    session: "mindcode-session",
  },
} as const;

// ============ 动态配置管理 ============

type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

class ConfigManager {
  private config: typeof APP_CONFIG;
  private listeners: ((config: typeof APP_CONFIG) => void)[] = [];

  constructor() {
    this.config = { ...APP_CONFIG };
    this.loadFromStorage();
  }

  get<K extends keyof typeof APP_CONFIG>(key: K): (typeof APP_CONFIG)[K] {
    return this.config[key];
  }

  set<K extends keyof typeof APP_CONFIG>(key: K, value: DeepPartial<(typeof APP_CONFIG)[K]>): void {
    this.config[key] = {
      ...(this.config[key] as object),
      ...(value as object),
    } as (typeof APP_CONFIG)[K];
    this.saveToStorage();
    this.notify();
  }

  getAll(): typeof APP_CONFIG {
    return { ...this.config };
  }

  reset(): void {
    this.config = { ...APP_CONFIG };
    this.saveToStorage();
    this.notify();
  }

  onChange(listener: (config: typeof APP_CONFIG) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.config));
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(APP_CONFIG.storageKeys.settings);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.keys(parsed).forEach((key) => {
          if (key in this.config)
            (this.config as Record<string, unknown>)[key] = {
              ...((this.config as Record<string, unknown>)[key] as object),
              ...parsed[key],
            };
        });
      }
    } catch {}
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(APP_CONFIG.storageKeys.settings, JSON.stringify(this.config));
    } catch {}
  }
}

export const configManager = new ConfigManager();
export default APP_CONFIG;
