/**
 * Constants - 全局常量配置
 */

// 应用信息
export const APP_NAME = 'MindCode';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'AI-Powered Code Editor';
export const APP_AUTHOR = 'MindCode Team';

// 存储键
export const STORAGE_KEYS = {
  THEME: 'mindcode_theme',
  LOCALE: 'mindcode_locale',
  LAYOUT: 'mindcode_layout',
  SETTINGS: 'mindcode_settings',
  KEYBINDINGS: 'mindcode_keybindings',
  RECENT_PROJECTS: 'mindcode_recent_projects',
  RECENT_FILES: 'mindcode_recent_files',
  BOOKMARKS: 'mindcode_bookmarks',
  SNIPPETS: 'mindcode_snippets',
  AI_CONFIG: 'mindcode_ai_config',
  AI_CONVERSATIONS: 'mindcode_conversations',
  SESSION: 'mindcode_session',
} as const;

// 文件类型
export const FILE_EXTENSIONS = {
  CODE: ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.rb', '.php', '.cs', '.swift', '.kt'],
  CONFIG: ['.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.env'],
  MARKUP: ['.html', '.htm', '.xml', '.svg'],
  STYLE: ['.css', '.scss', '.sass', '.less', '.styl'],
  DOCUMENT: ['.md', '.markdown', '.txt', '.rst'],
  IMAGE: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'],
  BINARY: ['.exe', '.dll', '.so', '.dylib', '.bin', '.dat'],
} as const;

// 语言映射
export const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
  py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp', h: 'c',
  rb: 'ruby', php: 'php', cs: 'csharp', swift: 'swift', kt: 'kotlin',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  json: 'json', jsonc: 'jsonc', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
  md: 'markdown', markdown: 'markdown', txt: 'plaintext',
  sql: 'sql', sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript',
  dockerfile: 'dockerfile', makefile: 'makefile',
};

// 文件图标
export const FILE_ICONS: Record<string, string> = {
  ts: '🔷', tsx: '⚛️', js: '📜', jsx: '⚛️', json: '📋', md: '📝',
  css: '🎨', html: '🌐', py: '🐍', rs: '🦀', go: '🐹', c: '©️', cpp: '©️',
  java: '☕', rb: '💎', php: '🐘', sql: '🗃️', sh: '📟', yml: '⚙️',
  default: '📄', folder: '📁',
};

// 编辑器默认配置
export const EDITOR_DEFAULTS = {
  fontSize: 14,
  fontFamily: "'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace",
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off' as const,
  lineNumbers: 'on' as const,
  minimap: { enabled: true, maxColumn: 120 },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  formatOnSave: false,
  formatOnPaste: false,
  cursorBlinking: 'smooth' as const,
  cursorStyle: 'line' as const,
  renderWhitespace: 'selection' as const,
  bracketPairColorization: { enabled: true },
};

// AI 默认配置
export const AI_DEFAULTS = {
  provider: 'local',
  model: 'codesuc-sonnet',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  stream: true,
};

// 补全配置
export const COMPLETION_DEFAULTS = {
  debounceMs: 30,
  cacheSize: 500,
  maxSuggestions: 10,
  minTriggerLength: 1,
};

// 布局默认配置
export const LAYOUT_DEFAULTS = {
  sidebar: { id: 'sidebar', visible: true, size: 250, minSize: 150, maxSize: 500 },
  aiPanel: { id: 'aiPanel', visible: true, size: 400, minSize: 300, maxSize: 800 },
  terminal: { id: 'terminal', visible: false, size: 200, minSize: 100, maxSize: 500 },
  bottomPanel: { id: 'bottomPanel', visible: false, size: 200, minSize: 100, maxSize: 400 },
};

// 快捷键
export const DEFAULT_KEYBINDINGS = {
  'file.new': 'Ctrl+N',
  'file.open': 'Ctrl+O',
  'file.save': 'Ctrl+S',
  'file.saveAll': 'Ctrl+Shift+S',
  'file.close': 'Ctrl+W',
  'edit.undo': 'Ctrl+Z',
  'edit.redo': 'Ctrl+Y',
  'edit.find': 'Ctrl+F',
  'edit.replace': 'Ctrl+H',
  'edit.comment': 'Ctrl+/',
  'edit.format': 'Shift+Alt+F',
  'view.sidebar': 'Ctrl+B',
  'view.terminal': 'Ctrl+`',
  'view.commandPalette': 'Ctrl+Shift+P',
  'view.quickOpen': 'Ctrl+P',
  'view.symbol': 'Ctrl+Shift+O',
  'view.line': 'Ctrl+G',
  'ai.chat': 'Ctrl+L',
  'ai.inline': 'Ctrl+I',
  'ai.composer': 'Ctrl+Shift+I',
};

// 限制
export const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_RECENT_PROJECTS: 20,
  MAX_RECENT_FILES: 50,
  MAX_BOOKMARKS: 500,
  MAX_SNIPPETS: 200,
  MAX_CONVERSATIONS: 100,
  MAX_UNDO_STACK: 1000,
};

// 时间间隔
export const INTERVALS = {
  AUTO_SAVE: 30000, // 30s
  INDEX_DEBOUNCE: 1000, // 1s
  COMPLETION_DEBOUNCE: 30, // 30ms
  SEARCH_DEBOUNCE: 200, // 200ms
};

// API 端点
export const API_ENDPOINTS = {
  ANTHROPIC: 'https://api.anthropic.com/v1',
  OPENAI: 'https://api.openai.com/v1',
  GOOGLE: 'https://generativelanguage.googleapis.com/v1beta',
  LOCAL: 'http://localhost:3000',
};

// 正则表达式
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/[^\s]+$/,
  FILE_PATH: /^(?:[a-zA-Z]:)?[/\\]?(?:[^/\\:*?"<>|\r\n]+[/\\])*[^/\\:*?"<>|\r\n]*$/,
  SEMVER: /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?(?:\+[a-zA-Z0-9.]+)?$/,
};

export default {
  APP_NAME, APP_VERSION, STORAGE_KEYS, FILE_EXTENSIONS, LANGUAGE_MAP, FILE_ICONS,
  EDITOR_DEFAULTS, AI_DEFAULTS, COMPLETION_DEFAULTS, LAYOUT_DEFAULTS, DEFAULT_KEYBINDINGS,
  LIMITS, INTERVALS, API_ENDPOINTS, PATTERNS,
};
