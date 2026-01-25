/**
 * 主题系统 - 统一 VS Code + Design Tokens
 */

import { getVSCodeTokens } from './theme-presets';

export type ThemeType = 'dark' | 'light' | 'hc';

export interface Theme {
  id: string;
  name: string;
  type: ThemeType;
  uiTokens: Record<string, string>; // --vscode-* 和 --bg-* 等
  designTokens: Record<string, string>; // --color-* 统一变量
  editorThemeRef: string; // Monaco theme name
}

// 根据主题类型生成 design tokens
const createDesignTokens = (base: { bg0: string; bg1: string; bg2: string; textPrimary: string; textSecondary: string; textTertiary: string; border: string; accent: string; type: ThemeType }): Record<string, string> => ({
  '--color-bg-base': base.bg0,
  '--color-bg-surface': base.bg1,
  '--color-bg-elevated': base.bg2,
  '--color-bg-hover': base.type === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
  '--color-bg-active': base.type === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
  '--color-bg-selected': base.type === 'light' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.15)',
  '--color-bg-input': base.bg0,
  '--color-bg-overlay': base.type === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
  '--color-text-primary': base.textPrimary,
  '--color-text-secondary': base.textSecondary,
  '--color-text-tertiary': base.textTertiary,
  '--color-text-muted': base.type === 'light' ? '#71717a' : '#52525b',
  '--color-text-disabled': base.type === 'light' ? '#a1a1aa' : '#3f3f46',
  '--color-border': base.border,
  '--color-border-subtle': base.type === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)',
  '--color-border-default': base.border,
  '--color-border-strong': base.type === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.12)',
  '--color-border-focus': base.accent,
  '--color-accent-primary': base.accent,
  '--color-accent-blue': base.accent,
  '--color-scrollbar': base.type === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)',
  '--color-scrollbar-hover': base.type === 'light' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.18)',
});

// 主题定义
export const themes: Theme[] = [
  // Dark Themes
  {
    id: 'dark-plus',
    name: 'Dark+ (default dark)',
    type: 'dark',
    uiTokens: {
      '--bg-0': '#1e1e1e', '--bg-1': '#252526', '--bg-2': '#2d2d30',
      '--text-primary': '#cccccc', '--text-secondary': '#858585', '--border-default': 'rgba(255, 255, 255, 0.1)',
      '--vscode-editor-background': '#1e1e1e', '--vscode-editor-foreground': '#d4d4d4',
      '--vscode-sideBar-background': '#252526', '--vscode-sideBar-foreground': '#cccccc',
      '--vscode-sideBarSectionHeader-background': '#2d2d30',
      '--vscode-activityBar-background': '#333337', '--vscode-activityBar-foreground': '#cccccc',
      '--vscode-activityBar-inactiveForeground': '#858585', '--vscode-activityBarBadge-background': '#007acc',
      '--vscode-titleBar-activeBackground': '#3c3c3c', '--vscode-titleBar-activeForeground': '#cccccc',
      '--vscode-tab-activeBackground': '#1e1e1e', '--vscode-tab-inactiveBackground': '#2d2d30',
      '--vscode-tab-border': 'rgba(128, 128, 128, 0.2)', '--vscode-tab-activeBorderTop': 'transparent',
      '--vscode-statusBar-background': '#007acc', '--vscode-statusBar-foreground': '#ffffff',
      '--vscode-input-background': '#3c3c3c', '--vscode-input-foreground': '#cccccc',
      '--vscode-input-border': 'rgba(128, 128, 128, 0.35)', '--vscode-focusBorder': '#007acc',
      '--vscode-list-hoverBackground': 'rgba(128, 128, 128, 0.1)',
      '--vscode-list-activeSelectionBackground': '#094771', '--vscode-list-activeSelectionForeground': '#ffffff',
      '--vscode-scrollbarSlider-background': 'rgba(121, 121, 121, 0.4)',
      '--vscode-scrollbarSlider-hoverBackground': 'rgba(100, 100, 100, 0.7)',
      '--vscode-panelTitle-activeBorder': '#007acc', '--vscode-panel-border': 'rgba(128, 128, 128, 0.2)',
      '--vscode-icon-foreground': '#c5c5c5',
    },
    designTokens: createDesignTokens({ bg0: '#1e1e1e', bg1: '#252526', bg2: '#2d2d30', textPrimary: '#d4d4d4', textSecondary: '#cccccc', textTertiary: '#858585', border: 'rgba(255, 255, 255, 0.1)', accent: '#007acc', type: 'dark' }),
    editorThemeRef: 'vs-dark'
  },
  {
    id: 'monokai',
    name: 'Monokai',
    type: 'dark',
    uiTokens: {
      '--bg-0': '#272822', '--bg-1': '#2d2d28', '--bg-2': '#353530',
      '--text-primary': '#f8f8f2', '--text-secondary': '#75715e', '--border-default': 'rgba(255, 255, 255, 0.1)',
      ...getVSCodeTokens({ editorBg: '#272822', editorFg: '#f8f8f2', sidebarBg: '#2d2d28', sidebarFg: '#f8f8f2', activityBarBg: '#272822', activityBarFg: '#f8f8f2', tabActiveBg: '#272822', tabInactiveBg: '#2d2d28', statusBarBg: '#272822', statusBarFg: '#f8f8f2', inputBg: '#3c3c3c', inputFg: '#f8f8f2', focusBorder: '#66d9ef', selectionBg: 'rgba(174, 129, 255, 0.2)', hoverBg: 'rgba(255, 255, 255, 0.05)' }),
    },
    designTokens: createDesignTokens({ bg0: '#272822', bg1: '#2d2d28', bg2: '#353530', textPrimary: '#f8f8f2', textSecondary: '#a6e22e', textTertiary: '#75715e', border: 'rgba(255, 255, 255, 0.1)', accent: '#66d9ef', type: 'dark' }),
    editorThemeRef: 'vs-dark'
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    uiTokens: {
      '--bg-0': '#0d1117', '--bg-1': '#161b22', '--bg-2': '#21262d',
      '--text-primary': '#c9d1d9', '--text-secondary': '#8b949e', '--border-default': 'rgba(255, 255, 255, 0.1)',
      ...getVSCodeTokens({ editorBg: '#0d1117', editorFg: '#c9d1d9', sidebarBg: '#161b22', sidebarFg: '#c9d1d9', activityBarBg: '#161b22', activityBarFg: '#c9d1d9', tabActiveBg: '#0d1117', tabInactiveBg: '#161b22', statusBarBg: '#161b22', statusBarFg: '#8b949e', inputBg: '#0d1117', inputFg: '#c9d1d9', focusBorder: '#58a6ff', selectionBg: 'rgba(56, 139, 253, 0.2)', hoverBg: 'rgba(110, 118, 129, 0.1)' }),
    },
    designTokens: createDesignTokens({ bg0: '#0d1117', bg1: '#161b22', bg2: '#21262d', textPrimary: '#c9d1d9', textSecondary: '#8b949e', textTertiary: '#6e7681', border: 'rgba(255, 255, 255, 0.1)', accent: '#58a6ff', type: 'dark' }),
    editorThemeRef: 'vs-dark'
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    uiTokens: {
      '--bg-0': '#282a36', '--bg-1': '#343746', '--bg-2': '#44475a',
      '--text-primary': '#f8f8f2', '--text-secondary': '#6272a4', '--border-default': 'rgba(255, 255, 255, 0.1)',
      ...getVSCodeTokens({ editorBg: '#282a36', editorFg: '#f8f8f2', sidebarBg: '#343746', sidebarFg: '#f8f8f2', activityBarBg: '#282a36', activityBarFg: '#bd93f9', tabActiveBg: '#282a36', tabInactiveBg: '#343746', statusBarBg: '#282a36', statusBarFg: '#f8f8f2', inputBg: '#44475a', inputFg: '#f8f8f2', focusBorder: '#bd93f9', selectionBg: 'rgba(189, 147, 249, 0.2)', hoverBg: 'rgba(255, 255, 255, 0.05)' }),
    },
    designTokens: createDesignTokens({ bg0: '#282a36', bg1: '#343746', bg2: '#44475a', textPrimary: '#f8f8f2', textSecondary: '#bd93f9', textTertiary: '#6272a4', border: 'rgba(255, 255, 255, 0.1)', accent: '#bd93f9', type: 'dark' }),
    editorThemeRef: 'vs-dark'
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    type: 'dark',
    uiTokens: {
      '--bg-0': '#282c34', '--bg-1': '#2c313c', '--bg-2': '#353b45',
      '--text-primary': '#abb2bf', '--text-secondary': '#5c6370', '--border-default': 'rgba(255, 255, 255, 0.1)',
      ...getVSCodeTokens({ editorBg: '#282c34', editorFg: '#abb2bf', sidebarBg: '#2c313c', sidebarFg: '#abb2bf', activityBarBg: '#21252b', activityBarFg: '#61afef', tabActiveBg: '#282c34', tabInactiveBg: '#2c313c', statusBarBg: '#21252b', statusBarFg: '#abb2bf', inputBg: '#3c4043', inputFg: '#abb2bf', focusBorder: '#61afef', selectionBg: 'rgba(97, 175, 239, 0.2)', hoverBg: 'rgba(255, 255, 255, 0.05)' }),
    },
    designTokens: createDesignTokens({ bg0: '#282c34', bg1: '#2c313c', bg2: '#353b45', textPrimary: '#abb2bf', textSecondary: '#828997', textTertiary: '#5c6370', border: 'rgba(255, 255, 255, 0.1)', accent: '#61afef', type: 'dark' }),
    editorThemeRef: 'vs-dark'
  },
  // Light Themes
  {
    id: 'light-plus',
    name: 'Light+ (default light)',
    type: 'light',
    uiTokens: {
      '--bg-0': '#ffffff', '--bg-1': '#f3f3f3', '--bg-2': '#e8e8e8',
      '--text-primary': '#333333', '--text-secondary': '#666666', '--border-default': 'rgba(0, 0, 0, 0.1)',
      ...getVSCodeTokens({ editorBg: '#ffffff', editorFg: '#333333', sidebarBg: '#f3f3f3', sidebarFg: '#616161', activityBarBg: '#2c2c2c', activityBarFg: '#ffffff', tabActiveBg: '#ffffff', tabInactiveBg: '#ececec', statusBarBg: '#007acc', statusBarFg: '#ffffff', inputBg: '#ffffff', inputFg: '#616161', focusBorder: '#007acc', selectionBg: '#add6ff', hoverBg: 'rgba(0, 0, 0, 0.05)' }),
    },
    designTokens: createDesignTokens({ bg0: '#ffffff', bg1: '#f3f3f3', bg2: '#e8e8e8', textPrimary: '#333333', textSecondary: '#616161', textTertiary: '#888888', border: 'rgba(0, 0, 0, 0.1)', accent: '#007acc', type: 'light' }),
    editorThemeRef: 'vs'
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    type: 'light',
    uiTokens: {
      '--bg-0': '#ffffff', '--bg-1': '#f6f8fa', '--bg-2': '#e1e4e8',
      '--text-primary': '#24292e', '--text-secondary': '#586069', '--border-default': 'rgba(0, 0, 0, 0.1)',
      ...getVSCodeTokens({ editorBg: '#ffffff', editorFg: '#24292e', sidebarBg: '#f6f8fa', sidebarFg: '#24292e', activityBarBg: '#f6f8fa', activityBarFg: '#24292e', tabActiveBg: '#ffffff', tabInactiveBg: '#f6f8fa', statusBarBg: '#f6f8fa', statusBarFg: '#586069', inputBg: '#ffffff', inputFg: '#24292e', focusBorder: '#0366d6', selectionBg: 'rgba(3, 102, 214, 0.15)', hoverBg: 'rgba(0, 0, 0, 0.05)' }),
    },
    designTokens: createDesignTokens({ bg0: '#ffffff', bg1: '#f6f8fa', bg2: '#e1e4e8', textPrimary: '#24292e', textSecondary: '#586069', textTertiary: '#6a737d', border: 'rgba(0, 0, 0, 0.1)', accent: '#0366d6', type: 'light' }),
    editorThemeRef: 'vs'
  },
  {
    id: 'quiet-light',
    name: 'Quiet Light',
    type: 'light',
    uiTokens: {
      '--bg-0': '#f5f5f5', '--bg-1': '#ffffff', '--bg-2': '#e8e8e8',
      '--text-primary': '#333333', '--text-secondary': '#666666', '--border-default': 'rgba(0, 0, 0, 0.1)',
      ...getVSCodeTokens({ editorBg: '#f5f5f5', editorFg: '#333333', sidebarBg: '#ffffff', sidebarFg: '#616161', activityBarBg: '#2c2c2c', activityBarFg: '#ffffff', tabActiveBg: '#f5f5f5', tabInactiveBg: '#ececec', statusBarBg: '#007acc', statusBarFg: '#ffffff', inputBg: '#ffffff', inputFg: '#616161', focusBorder: '#007acc', selectionBg: '#add6ff', hoverBg: 'rgba(0, 0, 0, 0.05)' }),
    },
    designTokens: createDesignTokens({ bg0: '#f5f5f5', bg1: '#ffffff', bg2: '#e8e8e8', textPrimary: '#333333', textSecondary: '#616161', textTertiary: '#888888', border: 'rgba(0, 0, 0, 0.1)', accent: '#007acc', type: 'light' }),
    editorThemeRef: 'vs'
  },
  // High Contrast
  {
    id: 'hc-black',
    name: 'Dark High Contrast',
    type: 'hc',
    uiTokens: {
      '--bg-0': '#000000', '--bg-1': '#1e1e1e', '--bg-2': '#2d2d2d',
      '--text-primary': '#ffffff', '--text-secondary': '#cccccc', '--border-default': '#ffffff',
      ...getVSCodeTokens({ editorBg: '#000000', editorFg: '#ffffff', sidebarBg: '#1e1e1e', sidebarFg: '#ffffff', activityBarBg: '#000000', activityBarFg: '#ffffff', tabActiveBg: '#000000', tabInactiveBg: '#1e1e1e', statusBarBg: '#007acc', statusBarFg: '#ffffff', inputBg: '#000000', inputFg: '#ffffff', focusBorder: '#007acc', selectionBg: '#007acc', hoverBg: 'rgba(255, 255, 255, 0.1)' }),
    },
    designTokens: createDesignTokens({ bg0: '#000000', bg1: '#1e1e1e', bg2: '#2d2d2d', textPrimary: '#ffffff', textSecondary: '#cccccc', textTertiary: '#aaaaaa', border: '#ffffff', accent: '#007acc', type: 'hc' }),
    editorThemeRef: 'hc-black'
  },
  {
    id: 'hc-light',
    name: 'Light High Contrast',
    type: 'hc',
    uiTokens: {
      '--bg-0': '#ffffff', '--bg-1': '#ffffff', '--bg-2': '#f0f0f0',
      '--text-primary': '#000000', '--text-secondary': '#000000', '--border-default': '#000000',
      ...getVSCodeTokens({ editorBg: '#ffffff', editorFg: '#000000', sidebarBg: '#ffffff', sidebarFg: '#000000', activityBarBg: '#ffffff', activityBarFg: '#000000', tabActiveBg: '#ffffff', tabInactiveBg: '#f0f0f0', statusBarBg: '#007acc', statusBarFg: '#ffffff', inputBg: '#ffffff', inputFg: '#000000', focusBorder: '#007acc', selectionBg: '#316ac5', hoverBg: 'rgba(0, 0, 0, 0.1)' }),
    },
    designTokens: createDesignTokens({ bg0: '#ffffff', bg1: '#ffffff', bg2: '#f0f0f0', textPrimary: '#000000', textSecondary: '#000000', textTertiary: '#333333', border: '#000000', accent: '#007acc', type: 'light' }),
    editorThemeRef: 'hc-light'
  }
];

// 默认主题
export const defaultThemeId = 'dark-plus';

// 获取主题
export function getTheme(themeId: string): Theme | undefined {
  return themes.find(t => t.id === themeId);
}

// 应用主题 - 统一更新所有 CSS 变量
export function applyTheme(themeId: string): void {
  const theme = getTheme(themeId);
  if (!theme) { console.warn(`Theme not found: ${themeId}`); return; }

  const root = document.documentElement;
  
  // 添加过渡类（200ms 过渡）
  root.classList.add('theme-transitioning');
  
  // 应用 UI CSS variables (--vscode-*, --bg-*)
  Object.entries(theme.uiTokens).forEach(([key, value]) => root.style.setProperty(key, value));
  
  // 应用 Design Tokens (--color-*) - 关键：这让所有组件同步更新
  Object.entries(theme.designTokens).forEach(([key, value]) => root.style.setProperty(key, value));
  
  // 设置主题类型属性（用于 CSS 选择器）
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-theme-type', theme.type);
  
  // 应用 Monaco 编辑器主题
  const applyMonacoTheme = () => {
    try {
      if ((window as any).monaco?.editor) { (window as any).monaco.editor.setTheme(theme.editorThemeRef); return; }
      import('monaco-editor').then(monaco => monaco.editor.setTheme(theme.editorThemeRef)).catch(() => {});
    } catch (e) { /* ignore */ }
  };
  applyMonacoTheme();
  
  // 触发事件通知组件（Monaco CodeEditor 监听此事件）
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { themeId, editorTheme: theme.editorThemeRef, type: theme.type } }));
  
  // 移除过渡类
  setTimeout(() => root.classList.remove('theme-transitioning'), 200);
}

// 保存主题选择
export async function saveTheme(themeId: string): Promise<void> {
  if (window.mindcode?.settings) {
    await window.mindcode.settings.set('theme', themeId);
  } else {
    localStorage.setItem('mindcode-theme', themeId);
  }
}

// 加载保存的主题
export async function loadTheme(): Promise<string> {
  if (window.mindcode?.settings) {
    const saved = await window.mindcode.settings.get('theme');
    return saved || defaultThemeId;
  } else {
    return localStorage.getItem('mindcode-theme') || defaultThemeId;
  }
}
