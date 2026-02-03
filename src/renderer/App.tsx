import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './styles/main.css'; // 主布局样式
import './styles/animations.css'; // GPU加速动画系统
import './styles/chat-tokens.css'; // Chat CSS 变量
import './styles/ai-panel.css'; // AI 面板样式
import './styles/components.css'; // 组件样式
import './styles/markdown.css'; // Markdown 样式
import './styles/editor.css'; // 编辑器样式
import { MarkdownRenderer } from './components/MarkdownRenderer';
import CodeEditor from './components/CodeEditor';
import { CommandPalette } from './components/CommandPalette';
import { ContextPicker, ContextItem } from './components/ContextPicker';
import { FileContextMenu, InputDialog, ConfirmDialog } from './components/FileContextMenu';
import { Terminal } from './components/Terminal';
import { GitPanel } from './components/GitPanel';
import { AIPanel } from './components/AIPanel';
import { DiffEditorPanel } from './components/DiffEditorPanel';
import { ComposerPanel } from './components/ComposerPanel';
import { applyTheme, loadTheme, saveTheme } from './utils/themes';
import { useFileStore, SUPPORTED_LANGUAGES, EditorFile } from './stores';
import { MindCodeLogo } from './components/MindCodeLogo';
import { useZoom } from './hooks/useZoom';
import { StatusBar } from './components/StatusBar';
import { ErrorBoundary, AIPanelErrorBoundary, EditorErrorBoundary } from './components/ErrorBoundary';
import { ExtensionMarketplace } from './components/ExtensionMarketplace';
import { marketplaceService, type ExtensionInfo } from '../core/plugins/marketplace';

// ==================== VSCode 风格 Codicon 图标 ====================
const Icons = {
  // 文件资源管理器 - VSCode codicon-files
  Files: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v7.5L2.5 16h6l1.5-1.5V14h4.5L16 12.5v-9zm-1 12h-4.5l-1.5 1.5v-1.75L10.75 12H5.5l-.75.75V8h6V3.5l-.75.75V4l1.75-1.75L13.5 4.5v7.5zM3.5 15l-.5-.5v-6l.5-.5H9l.5.5v6l-.5.5z"/>
    </svg>
  ),
  // 搜索 - VSCode codicon-search
  Search: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M15.25 14.19l-4.06-4.06a5.5 5.5 0 1 0-1.06 1.06l4.06 4.06 1.06-1.06zM6.5 10.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
    </svg>
  ),
  // 源代码管理 - VSCode codicon-source-control
  Git: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm-.5 4h-1V7a2 2 0 0 0-2-2h-2v-.5a.5.5 0 0 0-1 0V5h-2V4.5h1v1h2a1 1 0 0 1 1 1v3h1.5a.5.5 0 0 0 0 1h-1.5v.5a.5.5 0 0 0 1 0V11h1a.5.5 0 0 0 0-1z"/>
    </svg>
  ),
  // 扩展 - VSCode codicon-extensions
  Extensions: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.5 4H9.5V2a1.5 1.5 0 0 0-3 0v2H2.5L1 5.5v3L2.5 10v3.5L4 15h3.5v-2a1.5 1.5 0 1 1 3 0v2H14l1.5-1.5V10L14 8.5V5.5zm0 9h-2v-1a2.5 2.5 0 0 0-5 0v1H4l-.5-.5V9.66l1-.75V5.5l.5-.5h2.5V2a.5.5 0 0 1 1 0v3H11l.5.5v3.41l1 .75v2.84z"/>
    </svg>
  ),
  // 设置 - VSCode codicon-settings-gear
  Settings: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.7-1.3 2 .8.8 2-1.3.7.3.5 2.4h1.2l.5-2.4.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V7.4l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3zM9.4 1l.5 2.4L12 2.1l2 2-1.3 2.1 2.4.5v2.8l-2.4.5L14 12l-2 2-2.1-1.3-.5 2.4H6.6l-.5-2.4L4 14l-2-2 1.3-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.3.5-2.4zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
    </svg>
  ),
  // 账户 - VSCode codicon-account
  Account: () => (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M16 7.5a1.5 1.5 0 0 1-1.5 1.5H14v1.5a1.5 1.5 0 0 1-1.5 1.5H11v1.5a1.5 1.5 0 0 1-1.5 1.5H2v-4.5a1.5 1.5 0 0 1 1.5-1.5h1V7.5A1.5 1.5 0 0 1 6 6h1.5V4.5A1.5 1.5 0 0 1 9 3h5.5A1.5 1.5 0 0 1 16 4.5zm-9.5 7V13H3.9a.5.5 0 0 0-.4.5v1h3zm4-3.5V9.5H8v1.5h-.5a.5.5 0 0 0-.5.5v2h3.5a.5.5 0 0 0 .5-.5V11zm4-3V6.5H12V8h-.5a.5.5 0 0 0-.5.5v2.5h3a.5.5 0 0 0 .5-.5V8zm0-3.5A.5.5 0 0 0 14 4H9.5a.5.5 0 0 0-.5.5V6h3.5a1.5 1.5 0 0 1 1.5 1.5V9h.5a.5.5 0 0 0 .5-.5z"/>
    </svg>
  ),
  // 箭头
  ChevronRight: () => <svg viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z"/></svg>,
  ChevronDown: () => <svg viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/></svg>,
  // 文件夹
  Folder: () => <svg viewBox="0 0 16 16" fill="#C09553"><path d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13h-12V3h4.29l.85.85.36.15H14v7.49z"/></svg>,
  FolderOpen: () => <svg viewBox="0 0 16 16" fill="#C09553"><path d="M1.5 14h11l.48-.37 2.63-7-.48-.63H14V3.5l-.5-.5H7.71l-.86-.85L6.5 2h-5l-.5.5v11l.5.5zM2 3h4.29l.86.85.35.15H13v2H8.5l-.35.15-.86.85H3.5l-.47.34-1 3.08L2 3zm10.13 10H2.19l1.67-5H7.5l.35-.15.86-.85h5.79l-2.37 6z"/></svg>,
  // 关闭
  Close: () => <svg viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>,
  // 发送
  Send: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l.5-.5L15 8l-13.5 7-.5-.5V9l9-1-9-1V1.5z"/></svg>,
  // AI 星星
  Sparkle: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 .5L9.13 5.03 13.5 6 9.13 6.97 8 11.5 6.87 6.97 2.5 6l4.37-.97L8 .5zm4 8l.67 2.33L15 11.5l-2.33.67L12 14.5l-.67-2.33L9 11.5l2.33-.67L12 8.5zm-8 1l.5 1.5L6 11.5l-1.5.5L4 13.5l-.5-1.5L2 11.5l1.5-.5L4 9.5z"/></svg>,
  // 加号
  Plus: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg>,
  // 聊天
  Chat: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14.5 2h-13l-.5.5v9l.5.5H4v2.5l.854.354L7.707 12H14.5l.5-.5v-9l-.5-.5zm-.5 9H7.5l-.354.146L5 13.293V11.5l-.5-.5H2V3h12v8z"/></svg>,
  // 历史
  History: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM8 2.5A5.5 5.5 0 0 0 2.5 8a.5.5 0 0 1-1 0 6.5 6.5 0 1 1 6.5 6.5.5.5 0 0 1 0-1A5.5 5.5 0 0 0 8 2.5z"/><path d="M8 5v3.5l2.5 1.5.5-.866L8.5 7.5V5H8z"/><path d="M1 8a7 7 0 0 1 7-7v1A6 6 0 0 0 2 8H1z"/><path d="M1.5 4.5l1 2h-2l1-2z"/></svg>,
  // 停止
  Stop: () => <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>,
  // 复制
  Copy: () => <svg viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M4 4l1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3l-3-3H5v10h8V7zM3 1L2 2v10l1 1V2h6.414l-1-1H3z"/></svg>,
  // 检查
  Check: () => <svg viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z"/></svg>,
  // 调试
  Debug: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.94 13.5l-1.32 1.32a3.73 3.73 0 0 0-7.24 0L1.06 13.5 0 14.56l1.72 1.72-.22.22V18H0v1.5h1.5v.08c.077.489.214.966.41 1.42L0 22.94 1.06 24l1.65-1.65A4.308 4.308 0 0 0 6 24a4.31 4.31 0 0 0 3.29-1.65L10.94 24 12 22.94 10.09 21c.198-.464.336-.951.41-1.45v-.05H12V18h-1.5v-1.5l-.22-.22L12 14.56l-1.06-1.06zM6 13.5a2.25 2.25 0 0 1 2.25 2.25h-4.5A2.25 2.25 0 0 1 6 13.5zm3 6a3 3 0 1 1-6 0v-2.25h6v2.25z"/></svg>,
  // 终端
  Terminal: () => <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V3h12v10z"/><path d="M4 5l4 3-4 3v-6z"/><path d="M8 11h4v1H8z"/></svg>,
};

const getFileColor = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f1e05a', jsx: '#f1e05a',
    json: '#cbcb41', css: '#563d7c', scss: '#c6538c', html: '#e34c26',
    md: '#083fa1', py: '#3572a5', go: '#00add8', rs: '#dea584',
  };
  return colors[ext] || '#8b8b8b';
};

const getLanguageDisplayName = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const names: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
    json: 'JSON', css: 'CSS', scss: 'SCSS', less: 'Less', html: 'HTML', htm: 'HTML',
    md: 'Markdown', py: 'Python', go: 'Go', rs: 'Rust', java: 'Java',
    c: 'C', cpp: 'C++', h: 'C Header', hpp: 'C++ Header', cs: 'C#',
    rb: 'Ruby', php: 'PHP', sql: 'SQL', sh: 'Shell', bash: 'Bash',
    yml: 'YAML', yaml: 'YAML', xml: 'XML', svg: 'SVG', vue: 'Vue',
    swift: 'Swift', kt: 'Kotlin', scala: 'Scala', dart: 'Dart', lua: 'Lua',
  };
  return names[ext] || 'Plain Text';
};

interface TreeNode { name: string; type: 'file' | 'folder'; path?: string; children?: TreeNode[]; }


// 模拟文件内容
const mockFileContents: Record<string, string> = {
  'src/main/index.ts': `/**
 * MindCode - Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`,
  'src/main/preload.ts': `/**
 * MindCode - 预加载脚本
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mindcode', {
  ai: {
    chat: (model: string, messages: any[]) =>
      ipcRenderer.invoke('ai:chat', model, messages),
    chatStream: (model: string, messages: any[], callbacks: any) => {
      const channel = \`ai:stream:\${Date.now()}\`;
      ipcRenderer.on(channel, (_, data) => {
        if (data.type === 'token') callbacks.onToken?.(data.token);
        if (data.type === 'complete') callbacks.onComplete?.(data.text);
        if (data.type === 'error') callbacks.onError?.(data.error);
      });
      ipcRenderer.send('ai:chat-stream', { model, messages, channel });
    },
  },
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', path, content),
  },
});
`,
  'src/renderer/App.tsx': `// 当前正在编辑的文件
import React from 'react';
// ... 这是你正在查看的文件
`,
  'src/renderer/main.tsx': `/**
 * MindCode - React 渲染进程入口
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design-tokens.css';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  'src/core/ai/providers/claude.ts': `/**
 * Claude AI Provider
 */
export interface ClaudeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class ClaudeProvider {
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = config;
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(\`\${this.config.baseUrl}/v1/messages\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    return data.content[0].text;
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string> {
    // 流式响应实现
    const response = await fetch(\`\${this.config.baseUrl}/v1/messages\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: 4096,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}
`,
  'src/core/ai/providers/openai.ts': `/**
 * OpenAI Compatible Provider
 */
export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class OpenAIProvider {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(\`\${this.config.baseUrl}/chat/completions\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.config.apiKey}\`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
`,
  'package.json': `{
  "name": "mindcode",
  "version": "0.1.0",
  "description": "AI-Native Code Editor",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "npm run build:main && concurrently -k \\"npm run dev:main\\" \\"npm run dev:renderer\\" \\"npm run dev:electron\\"",
    "dev:main": "tsc -p tsconfig.main.json --watch",
    "dev:renderer": "vite",
    "dev:electron": "wait-on http://localhost:5173 && cross-env NODE_ENV=development electron .",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "tsc -p tsconfig.main.json",
    "build:renderer": "vite build"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "monaco-editor": "^0.45.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"],
  "exclude": ["node_modules"]
}
`,
  'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/renderer/components')
    }
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  optimizeDeps: {
    include: ['monaco-editor']
  }
});
`,
};

const mockTree: TreeNode[] = [
  { name: 'src', type: 'folder', path: 'src', children: [
    { name: 'main', type: 'folder', path: 'src/main', children: [
      { name: 'index.ts', type: 'file', path: 'src/main/index.ts' },
      { name: 'preload.ts', type: 'file', path: 'src/main/preload.ts' },
    ]},
    { name: 'renderer', type: 'folder', path: 'src/renderer', children: [
      { name: 'App.tsx', type: 'file', path: 'src/renderer/App.tsx' },
      { name: 'main.tsx', type: 'file', path: 'src/renderer/main.tsx' },
    ]},
    { name: 'core', type: 'folder', path: 'src/core', children: [
      { name: 'ai', type: 'folder', path: 'src/core/ai', children: [
        { name: 'providers', type: 'folder', path: 'src/core/ai/providers', children: [
          { name: 'claude.ts', type: 'file', path: 'src/core/ai/providers/claude.ts' },
          { name: 'openai.ts', type: 'file', path: 'src/core/ai/providers/openai.ts' },
        ]}
      ]}
    ]},
  ]},
  { name: 'package.json', type: 'file', path: 'package.json' },
  { name: 'tsconfig.json', type: 'file', path: 'tsconfig.json' },
  { name: 'vite.config.ts', type: 'file', path: 'vite.config.ts' },
];

// 文件树行组件属性
interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selected: string;
  contextMenuPath: string | null;
  onSelect: (path: string, name: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isFolder: boolean) => void;
  onLoadChildren: (path: string) => Promise<TreeNode[]>;
}

const TreeRow: React.FC<TreeRowProps> = ({
  node, depth, selected, contextMenuPath, onSelect, onContextMenu, onLoadChildren
}) => {
  const [open, setOpen] = useState(depth < 1);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | undefined>(node.children);
  const isFolder = node.type === 'folder';
  const hasLoadedChildren = children !== undefined && children.length > 0;
  const needsLoad = isFolder && !hasLoadedChildren && open;

  // 懒加载子节点
  useEffect(() => {
    if (needsLoad && !loading) {
      setLoading(true);
      onLoadChildren(node.path || '').then(loadedChildren => {
        setChildren(loadedChildren);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [needsLoad, loading, node.path, onLoadChildren]);

  const handleClick = useCallback(() => {
    if (isFolder) {
      setOpen(!open);
    } else {
      onSelect(node.path || node.name, node.name);
    }
  }, [isFolder, open, node.path, node.name, onSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.path || '', node.name, isFolder);
  }, [node.path, node.name, isFolder, onContextMenu]);

  return (
    <>
      <div
        className={`tree-row${selected === node.path ? ' selected' : ''}${contextMenuPath === node.path ? ' context-active' : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="tree-toggle">{isFolder && (open ? <Icons.ChevronDown /> : <Icons.ChevronRight />)}</span>
        <span className="tree-icon">
          {isFolder ? (open ? <Icons.FolderOpen /> : <Icons.Folder />) : (
            <svg viewBox="0 0 16 16" fill={getFileColor(node.name)} width="16" height="16">
              <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1zm2.5 12.5c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5H10v3h3v8.5z"/>
            </svg>
          )}
        </span>
        <span className="tree-label">{node.name}</span>
      </div>
      {isFolder && open && loading && (
        <div className="tree-row-loading" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
          <div className="tree-row-loading-spinner" />
          <span>加载中...</span>
        </div>
      )}
      {isFolder && open && !loading && children?.map((c, i) => (
        <TreeRow
          key={(c.path || c.name) + i}
          node={c}
          depth={depth + 1}
          selected={selected}
          contextMenuPath={contextMenuPath}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onLoadChildren={onLoadChildren}
        />
      ))}
    </>
  );
};

interface Msg { id: string; role: 'user' | 'assistant'; text: string; time: string; }

// ==================== 扩展面板组件 ====================
const ExtensionsPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [installed, setInstalled] = useState<ExtensionInfo[]>([]);
  const [featured, setFeatured] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);

  useEffect(() => { setInstalled(marketplaceService.getInstalled()); setFeatured(marketplaceService.getFeatured().slice(0, 6)); }, []);

  const handleInstall = async (ext: ExtensionInfo) => { setLoading(ext.id); await marketplaceService.install(ext.id); setInstalled(marketplaceService.getInstalled()); setFeatured(marketplaceService.getFeatured().slice(0, 6)); setLoading(null); };
  const handleUninstall = async (ext: ExtensionInfo) => { setLoading(ext.id); await marketplaceService.uninstall(ext.id); setInstalled(marketplaceService.getInstalled()); setFeatured(marketplaceService.getFeatured().slice(0, 6)); setLoading(null); };
  const filteredFeatured = search ? marketplaceService.search(search).slice(0, 8) : featured;

  return (
    <div className="extensions-panel">
      <div className="ext-search-box"><input type="text" placeholder="🔍 搜索扩展..." value={search} onChange={e => setSearch(e.target.value)} className="ext-search-input" /></div>
      {installed.length > 0 && (
        <div className="ext-section">
          <div className="ext-section-title">已安装 ({installed.length})</div>
          {installed.map(ext => (
            <div key={ext.id} className="ext-item">
              <span className="ext-item-icon">{ext.icon || '📦'}</span>
              <div className="ext-item-info"><div className="ext-item-name">{ext.displayName}</div><div className="ext-item-author">{ext.author}</div></div>
              <button className="ext-item-btn uninstall" onClick={() => handleUninstall(ext)} disabled={loading === ext.id}>{loading === ext.id ? '...' : '×'}</button>
            </div>
          ))}
        </div>
      )}
      <div className="ext-section">
        <div className="ext-section-title">{search ? '搜索结果' : '推荐'}</div>
        {filteredFeatured.map(ext => (
          <div key={ext.id} className="ext-item">
            <span className="ext-item-icon">{ext.icon || '📦'}</span>
            <div className="ext-item-info"><div className="ext-item-name">{ext.displayName}</div><div className="ext-item-meta">⬇️{(ext.downloads/1000).toFixed(0)}k ⭐{ext.rating}</div></div>
            {ext.installed ? <span className="ext-item-installed">✓</span> : <button className="ext-item-btn install" onClick={() => handleInstall(ext)} disabled={loading === ext.id}>{loading === ext.id ? '...' : '安装'}</button>}
          </div>
        ))}
      </div>
      <button className="ext-open-marketplace" onClick={() => setShowMarketplace(true)}>🏪 打开扩展市场</button>
      <ExtensionMarketplace isOpen={showMarketplace} onClose={() => { setShowMarketplace(false); setInstalled(marketplaceService.getInstalled()); setFeatured(marketplaceService.getFeatured().slice(0, 6)); }} />
    </div>
  );
};

// 对话接口
interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: string;
  model: string;
}

const App: React.FC = () => {
  const [tab, setTab] = useState<'files'|'search'|'git'|'ext'>('files');
  const [showAI, setShowAI] = useState(true);
  const [showComposer, setShowComposer] = useState(false); // Composer 面板
  const [selected, setSelected] = useState('');
  const [model, setModel] = useState('claude-opus-4-5-thinking'); // 默认使用 Claude 4.5 Opus Thinking
  const [aiPanelWidth, setAiPanelWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  
  // 全局缩放 (Ctrl+Shift++ / Ctrl+Shift+-)
  const { zoomPercent } = useZoom();
  
  // 光标位置
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Command Palette 状态
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'files' | 'commands' | 'search'>('files');

  // 工作区状态 - 从 localStorage 恢复
  const WORKSPACE_KEY = 'mindcode.workspace';
  const [workspaceRoot, setWorkspaceRootState] = useState<string | null>(() => {
    try { return localStorage.getItem(WORKSPACE_KEY); } catch { return null; }
  });
  const [fileTree, setFileTree] = useState<TreeNode[]>(mockTree);
  const [workspaceName, setWorkspaceName] = useState(() => {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    return saved ? saved.split(/[/\\]/).pop() || 'Workspace' : 'MindCode';
  });
  // 包装 setWorkspaceRoot 以同步 localStorage
  const setWorkspaceRoot = useCallback((path: string | null) => {
    setWorkspaceRootState(path);
    if (path) localStorage.setItem(WORKSPACE_KEY, path);
    else localStorage.removeItem(WORKSPACE_KEY);
  }, []);

  // 同步到 Store（供 AI 面板使用）+ 订阅预览文件
  const {
    setWorkspace: setStoreWorkspace,
    setFileTree: setStoreFileTree,
    openFiles: storeOpenFiles,
    createNewFile: storeCreateNewFile,
    saveFile: storeSaveFile,
    setFileLanguage,
  } = useFileStore();

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetPath: string;
    targetName: string;
    isFolder: boolean;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetPath: '',
    targetName: '',
    isFolder: false
  });

  // 文件操作对话框状态
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    confirmText: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    defaultValue: '',
    confirmText: '确认',
    onConfirm: () => {}
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // 复制路径状态
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);

  // 终端状态
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  // 侧边栏宽度状态 - 紧凑默认值
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarMinWidth = 120;  // 最小可拖到 120px
  const sidebarMaxWidth = 480;  // 最大可拖到 480px

  // Phase 3: Diff Editor 面板状态
  const [showDiffPanel, setShowDiffPanel] = useState(false);
  const [diffPanelHeight, setDiffPanelHeight] = useState(300);
  const [diffData, setDiffData] = useState<{
    path: string;
    originalContent: string;
    modifiedContent: string;
    language?: string;
  } | null>(null);

  // 编辑器文件状态
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const editorRef = useRef<{ getValue: () => string; setValue: (v: string) => void } | null>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const untitledCounterRef = useRef(0); // 新建文件计数器

  // 语言选择器状态
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [languageSelectorTarget, setLanguageSelectorTarget] = useState<string | null>(null); // 目标文件 ID

  // 标签栏滚轮事件处理：垂直滚动转水平滚动
  const handleTabsWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (tabsScrollRef.current && e.deltaY !== 0) {
      e.preventDefault();
      tabsScrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // 侧边栏拖动调整宽度
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    // 拖动时禁止文本选中并设置鼠标样式
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      // 计算新宽度：鼠标位置 - activity bar 宽度 (48px)
      const newWidth = e.clientX - 48;
      setSidebarWidth(Math.max(sidebarMinWidth, Math.min(sidebarMaxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  // Phase 2: 同步 Store 中的预览文件到本地状态
  useEffect(() => {
    const previewFiles = storeOpenFiles.filter(f => f.isPreview);
    if (previewFiles.length === 0) return;

    setOpenFiles(prev => {
      // 找出新的预览文件（本地没有的）
      const existingIds = new Set(prev.map(f => f.id));
      const newPreviewFiles = previewFiles.filter(f => !existingIds.has(f.id));

      if (newPreviewFiles.length === 0) return prev;

      // 合并新的预览文件
      const merged = [...prev, ...newPreviewFiles];

      // 激活最新的预览文件
      const latestPreview = newPreviewFiles[newPreviewFiles.length - 1];
      setTimeout(() => setActiveFileId(latestPreview.id), 0);

      return merged;
    });
  }, [storeOpenFiles]);

  // 加载目录树
  const loadDirectory = useCallback(async (dirPath: string, isRoot = false): Promise<TreeNode[]> => {
    if (!window.mindcode?.fs) return [];
    const result = await window.mindcode.fs.readDir(dirPath);
    if (!result.success || !result.data) return [];

    const nodes: TreeNode[] = [];
    for (const item of result.data) {
      const node: TreeNode = {
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'folder',
      };
      // 递归加载子目录（仅第一层）
      if (item.type === 'folder' && isRoot) {
        node.children = await loadDirectory(item.path, false);
      } else if (item.type === 'folder') {
        node.children = []; // 延迟加载
      }
      nodes.push(node);
    }
    return nodes;
  }, []);

  // 打开文件夹
  const handleOpenFolder = useCallback(async () => {
    if (!window.mindcode?.fs) {
      alert('文件系统 API 不可用，请在 Electron 中运行');
      return;
    }
    const folderPath = await window.mindcode.fs.openFolder();
    if (folderPath) {
      setWorkspaceRoot(folderPath);
      setWorkspaceName(folderPath.split(/[/\\]/).pop() || 'Workspace');
      const tree = await loadDirectory(folderPath, true);
      setFileTree(tree);
      // 同步到 Store（供 AI 面板使用）
      setStoreWorkspace(folderPath, folderPath.split(/[/\\]/).pop() || 'Workspace');
      setStoreFileTree(tree);
      // 清空已打开的文件
      setOpenFiles([]);
      setActiveFileId(null);
      setSelected('');
    }
  }, [loadDirectory, setStoreWorkspace, setStoreFileTree]);

  // 刷新文件树
  const refreshFileTree = useCallback(async () => {
    if (workspaceRoot) {
      const tree = await loadDirectory(workspaceRoot, true);
      setFileTree(tree);
    }
  }, [workspaceRoot, loadDirectory]);

  // 打开文件（提前定义，供后续回调使用）
  const openFile = useCallback(async (path: string, name: string) => {
    // 检查文件是否已打开
    const existing = openFiles.find(f => f.path === path);
    if (existing) {
      setActiveFileId(existing.id);
      setSelected(path);
      return;
    }

    // 读取真实文件内容
    let content = `// ${name}\n// 文件内容加载中...`;
    if (window.mindcode?.fs) {
      const result = await window.mindcode.fs.readFile(path);
      if (result.success && result.data !== undefined) {
        content = result.data;
      } else {
        content = `// 无法读取文件: ${result.error || '未知错误'}`;
      }
    } else {
      // 回退到模拟数据
      content = mockFileContents[path] || content;
    }

    const newFile: EditorFile = {
      id: Date.now().toString(),
      path,
      name,
      content,
      isDirty: false,
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setSelected(path);
  }, [openFiles]);

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, name: string, isFolder: boolean) => {
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      targetPath: path,
      targetName: name,
      isFolder
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 新建文件
  const handleNewFile = useCallback((parentPath: string) => {
    setInputDialog({
      isOpen: true,
      title: '新建文件',
      placeholder: '输入文件名',
      defaultValue: '',
      confirmText: '创建',
      onConfirm: async (fileName) => {
        if (!window.mindcode?.fs) return;
        const targetPath = parentPath ? `${parentPath}/${fileName}` : fileName;
        const result = await window.mindcode.fs.createFile(targetPath);
        if (result.success) {
          await refreshFileTree();
          // 自动打开新文件
          openFile(targetPath, fileName);
        } else {
          alert(`创建失败: ${result.error}`);
        }
        setInputDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [refreshFileTree, openFile]);

  // 新建文件夹
  const handleNewFolder = useCallback((parentPath: string) => {
    setInputDialog({
      isOpen: true,
      title: '新建文件夹',
      placeholder: '输入文件夹名',
      defaultValue: '',
      confirmText: '创建',
      onConfirm: async (folderName) => {
        if (!window.mindcode?.fs) return;
        const targetPath = parentPath ? `${parentPath}/${folderName}` : folderName;
        const result = await window.mindcode.fs.createFolder(targetPath);
        if (result.success) {
          await refreshFileTree();
        } else {
          alert(`创建失败: ${result.error}`);
        }
        setInputDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [refreshFileTree]);

  // 重命名
  const handleRename = useCallback((path: string, name: string) => {
    setInputDialog({
      isOpen: true,
      title: '重命名',
      placeholder: '输入新名称',
      defaultValue: name,
      confirmText: '确定',
      onConfirm: async (newName) => {
        if (!window.mindcode?.fs || newName === name) {
          setInputDialog(prev => ({ ...prev, isOpen: false }));
          return;
        }
        const parentPath = path.replace(/[/\\][^/\\]+$/, '');
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        const result = await window.mindcode.fs.rename(path, newPath);
        if (result.success) {
          await refreshFileTree();
          // 更新已打开文件的路径
          setOpenFiles(prev => prev.map(f => {
            if (f.path === path) {
              return { ...f, path: newPath, name: newName };
            }
            return f;
          }));
        } else {
          alert(`重命名失败: ${result.error}`);
        }
        setInputDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [refreshFileTree]);

  // 删除
  const handleDelete = useCallback((path: string, name: string, isFolder: boolean) => {
    setConfirmDialog({
      isOpen: true,
      title: '确认删除',
      message: `确定要删除${isFolder ? '文件夹' : '文件'} "${name}" 吗？此操作不可撤销。`,
      onConfirm: async () => {
        if (!window.mindcode?.fs) return;
        const result = await window.mindcode.fs.delete(path);
        if (result.success) {
          await refreshFileTree();
          // 关闭已删除的文件
          setOpenFiles(prev => prev.filter(f => !f.path.startsWith(path)));
        } else {
          alert(`删除失败: ${result.error}`);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [refreshFileTree]);

  // 复制
  const handleCopy = useCallback((path: string) => {
    setCopiedPath(path);
  }, []);

  // 粘贴
  const handlePaste = useCallback(async (targetPath: string) => {
    if (!copiedPath || !window.mindcode?.fs) return;
    const fileName = copiedPath.split(/[/\\]/).pop() || '';
    const newPath = `${targetPath}/${fileName}`;
    const result = await window.mindcode.fs.copy(copiedPath, newPath);
    if (result.success) {
      await refreshFileTree();
    } else {
      alert(`粘贴失败: ${result.error}`);
    }
  }, [copiedPath, refreshFileTree]);

  // 拖拽处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了容器
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // 获取拖拽的文件/文件夹
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    // 检查是否有文件夹
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // 获取文件夹路径（Electron 环境下可用）
          const file = item.getAsFile();
          if (file && (file as any).path) {
            const folderPath = (file as any).path;
            setWorkspaceRoot(folderPath);
            setWorkspaceName(folderPath.split(/[/\\]/).pop() || 'Workspace');
            const tree = await loadDirectory(folderPath, true);
            setFileTree(tree);
            setOpenFiles([]);
            setActiveFileId(null);
            setSelected('');
            return;
          }
        }
      }
    }

    // 如果不是文件夹，尝试读取文件
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if ((file as any).path) {
        // Electron 环境下，可以打开拖入的文件
        const filePath = (file as any).path;
        const fileName = file.name;
        openFile(filePath, fileName);
      }
    }
  }, [loadDirectory, openFile]);

  // 关闭文件
  const closeFile = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      // 如果关闭的是当前活动文件，切换到前一个或后一个
      if (activeFileId === id && newFiles.length > 0) {
        const closedIndex = prev.findIndex(f => f.id === id);
        const newActiveIndex = Math.min(closedIndex, newFiles.length - 1);
        setActiveFileId(newFiles[newActiveIndex]?.id || null);
        setSelected(newFiles[newActiveIndex]?.path || '');
      } else if (newFiles.length === 0) {
        setActiveFileId(null);
        setSelected('');
      }
      return newFiles;
    });
  }, [activeFileId]);

  // 切换活动文件
  const switchFile = useCallback((id: string) => {
    setActiveFileId(id);
    const file = openFiles.find(f => f.id === id);
    if (file) setSelected(file.path);
  }, [openFiles]);

  // 更新文件内容
  const updateFileContent = useCallback((content: string) => {
    if (!activeFileId) return;
    setOpenFiles(prev => prev.map(f =>
      f.id === activeFileId ? { ...f, content, isDirty: true } : f
    ));
  }, [activeFileId]);

  // 保存文件
  const saveFile = useCallback(async (content: string) => {
    if (!activeFileId) return;
    const file = openFiles.find(f => f.id === activeFileId);
    if (!file) return;

    // 保存到真实文件系统
    if (window.mindcode?.fs) {
      const result = await window.mindcode.fs.writeFile(file.path, content);
      if (result.success) {
        setOpenFiles(prev => prev.map(f =>
          f.id === activeFileId ? { ...f, content, isDirty: false } : f
        ));
        console.log('文件已保存:', file.path);
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } else {
      // 开发模式：仅更新状态
      setOpenFiles(prev => prev.map(f =>
        f.id === activeFileId ? { ...f, content, isDirty: false } : f
      ));
      console.log('开发模式 - 文件已更新:', file.path);
    }
  }, [activeFileId, openFiles]);

  // 获取当前活动文件
  const activeFile = openFiles.find(f => f.id === activeFileId);

  // ==================== AI 对话管理 ====================
  const defaultWelcomeMsg: Msg = {
    id: '1',
    role: 'assistant',
    text: '有什么我可以帮你的吗？',
    time: new Date().toLocaleTimeString()
  };

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: '新对话',
      messages: [defaultWelcomeMsg],
      createdAt: new Date().toISOString(),
      model: 'claude-4-5-opus'
    }
  ]);
  const [activeConversationId, setActiveConversationId] = useState('1');
  const [showHistory, setShowHistory] = useState(false);

  // 获取当前对话
  const currentConversation = conversations.find(c => c.id === activeConversationId);
  const msgs = currentConversation?.messages || [defaultWelcomeMsg];

  // 更新当前对话消息
  const setMsgs = useCallback((updater: Msg[] | ((prev: Msg[]) => Msg[])) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        const newMessages = typeof updater === 'function' ? updater(c.messages) : updater;
        // 自动更新对话标题（取第一条用户消息的前20个字符）
        const firstUserMsg = newMessages.find(m => m.role === 'user');
        const title = firstUserMsg ? firstUserMsg.text.slice(0, 20) + (firstUserMsg.text.length > 20 ? '...' : '') : c.title;
        return { ...c, messages: newMessages, title };
      }
      return c;
    }));
  }, [activeConversationId]);

  // 新建对话
  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [defaultWelcomeMsg],
      createdAt: new Date().toISOString(),
      model: model
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setStreamingText('');
    setLoading(false);
    cancelStreamRef.current?.();
  }, [model]);

  // 切换对话
  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setStreamingText('');
    setLoading(false);
    cancelStreamRef.current?.();
    setShowHistory(false);
  }, []);

  // 删除对话
  const deleteConversation = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      // 如果删除的是当前对话，切换到第一个
      if (id === activeConversationId && filtered.length > 0) {
        setActiveConversationId(filtered[0].id);
      }
      // 如果没有对话了，创建一个新的
      if (filtered.length === 0) {
        const newConv: Conversation = {
          id: Date.now().toString(),
          title: '新对话',
          messages: [defaultWelcomeMsg],
          createdAt: new Date().toISOString(),
          model: model
        };
        setActiveConversationId(newConv.id);
        return [newConv];
      }
      return filtered;
    });
  }, [activeConversationId, model]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 上下文选择器状态
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [contextQuery, setContextQuery] = useState('');
  const [contextPickerPosition, setContextPickerPosition] = useState({ top: 0, left: 0 });
  const [attachedContexts, setAttachedContexts] = useState<ContextItem[]>([]);

  // 停止生成
  const stopGeneration = useCallback(() => {
    cancelStreamRef.current?.();
    if (streamingText) {
      // 保存已生成的内容
      setMsgs(p => [...p, {
        id: Date.now().toString(),
        role: 'assistant',
        text: streamingText + '\n\n[已停止生成]',
        time: new Date().toLocaleTimeString()
      }]);
    }
    setStreamingText('');
    setLoading(false);
  }, [streamingText, setMsgs]);
  const applyCodeToEditor = useCallback((code: string, language?: string) => {
    if (activeFile) {
      // 追加或替换当前文件内容
      const newContent = activeFile.content + '\n\n' + code;
      setOpenFiles(prev => prev.map(f =>
        f.id === activeFileId ? { ...f, content: newContent, isDirty: true } : f
      ));
    } else {
      // 没有打开的文件，创建新文件
      const ext = language === 'typescript' || language === 'tsx' ? 'tsx' :
                  language === 'javascript' || language === 'jsx' ? 'js' :
                  language === 'python' ? 'py' :
                  language === 'css' ? 'css' :
                  language === 'html' ? 'html' :
                  language === 'json' ? 'json' : 'txt';
      const newFile: EditorFile = {
        id: Date.now().toString(),
        path: `untitled-${Date.now()}.${ext}`,
        name: `untitled.${ext}`,
        content: code,
        isDirty: true,
      };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
    }
  }, [activeFile, activeFileId]);

  // AI 面板拖动调整大小
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setAiPanelWidth(Math.max(280, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // ==================== 全局键盘快捷键 ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P - 快速打开文件
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteMode('files');
        setShowCommandPalette(true);
        return;
      }

      // Ctrl+Shift+P - 命令面板
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteMode('commands');
        setShowCommandPalette(true);
        return;
      }

      // Ctrl+Shift+F - 全局搜索
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setCommandPaletteMode('search');
        setShowCommandPalette(true);
        return;
      }

      // Ctrl+Shift+I - 打开 Composer（多文件重构）
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setShowComposer(true);
        return;
      }

      // Ctrl+L - 打开/关闭 AI 面板
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setShowAI(prev => !prev);
        return;
      }

      // Ctrl+B - 打开/关闭侧边栏
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        // TODO: 实现侧边栏折叠
        return;
      }

      // Ctrl+` - 打开/关闭终端
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setShowTerminal(prev => !prev);
        return;
      }

      // Ctrl+J - 打开/关闭终端（备选快捷键）
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setShowTerminal(prev => !prev);
        return;
      }

      // Ctrl+W - 关闭当前文件
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFileId) {
          closeFile(activeFileId);
        }
        return;
      }

      // Ctrl+S - 保存当前文件
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && editorRef.current) {
          saveFile(editorRef.current.getValue());
        }
        return;
      }

      // Ctrl+N - 新建对话
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewConversation();
        return;
      }

      // Phase 4: Ctrl+Shift+D - 打开/关闭 Diff 面板
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDiffPanel(prev => !prev);
        return;
      }

      // Escape - 关闭命令面板 / Diff 面板
      if (e.key === 'Escape') {
        if (showDiffPanel) {
          e.preventDefault();
          setShowDiffPanel(false);
          setDiffData(null);
          return;
        }
        if (showCommandPalette) {
          e.preventDefault();
          setShowCommandPalette(false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, activeFile, showCommandPalette, showDiffPanel, closeFile, saveFile, createNewConversation]);

  // ==================== 命令列表 ====================
  const commands = useMemo(() => [
    {
      id: 'file.open',
      label: '打开文件夹',
      shortcut: 'Ctrl+O',
      action: handleOpenFolder
    },
    {
      id: 'file.save',
      label: '保存文件',
      shortcut: 'Ctrl+S',
      action: () => activeFile && editorRef.current && saveFile(editorRef.current.getValue())
    },
    {
      id: 'file.close',
      label: '关闭文件',
      shortcut: 'Ctrl+W',
      action: () => activeFileId && closeFile(activeFileId)
    },
    {
      id: 'ai.toggle',
      label: '打开/关闭 AI 面板',
      shortcut: 'Ctrl+L',
      action: () => setShowAI(prev => !prev)
    },
    {
      id: 'ai.newChat',
      label: '新建 AI 对话',
      shortcut: 'Ctrl+N',
      action: createNewConversation
    },
    {
      id: 'search.files',
      label: '搜索文件',
      shortcut: 'Ctrl+P',
      action: () => {
        setCommandPaletteMode('files');
        setShowCommandPalette(true);
      }
    },
    {
      id: 'search.content',
      label: '在文件中搜索',
      shortcut: 'Ctrl+Shift+F',
      action: () => {
        setCommandPaletteMode('search');
        setShowCommandPalette(true);
      }
    },
    {
      id: 'view.explorer',
      label: '显示资源管理器',
      action: () => setTab('files')
    },
    {
      id: 'view.search',
      label: '显示搜索',
      action: () => setTab('search')
    },
    {
      id: 'view.git',
      label: '显示源代码管理',
      action: () => setTab('git')
    },
    {
      id: 'view.extensions',
      label: '显示扩展',
      action: () => setTab('ext')
    },
    {
      id: 'terminal.toggle',
      label: '打开/关闭终端',
      shortcut: 'Ctrl+`',
      action: () => setShowTerminal(prev => !prev)
    },
    {
      id: 'terminal.new',
      label: '新建终端',
      action: () => setShowTerminal(true)
    },
  ], [handleOpenFolder, activeFile, activeFileId, closeFile, saveFile, createNewConversation]);

  // 使用 ref 存储最新的回调函数，避免 useEffect 依赖变化导致重复注册监听器
  const openFileRef = useRef(openFile);
  const loadDirectoryRef = useRef(loadDirectory);
  const saveFileRef = useRef(saveFile);
  const closeFileRef = useRef(closeFile);
  const activeFileRef = useRef(activeFile);
  const activeFileIdRef = useRef(activeFileId);
  const editorRefCurrent = useRef(editorRef);

  useEffect(() => {
    openFileRef.current = openFile;
    loadDirectoryRef.current = loadDirectory;
    saveFileRef.current = saveFile;
    closeFileRef.current = closeFile;
    activeFileRef.current = activeFile;
    activeFileIdRef.current = activeFileId;
    editorRefCurrent.current = editorRef;
  });

  // 监听菜单事件
  useEffect(() => {
    if (!window.mindcode?.onMenuEvent) return;
    
    const cleanup = window.mindcode.onMenuEvent(async (event, data) => {
      switch (event) {
        case 'menu:newFile':
          // 创建新的未保存文件
          untitledCounterRef.current++;
          const newFileId = `untitled_${Date.now()}`;
          const newFileName = `Untitled-${untitledCounterRef.current}.txt`;
          const newFile: EditorFile = {
            id: newFileId,
            path: newFileName,
            name: newFileName,
            content: '',
            language: 'plaintext',
            isDirty: false,
            isUntitled: true,
          };
          setOpenFiles(prev => [...prev, newFile]);
          setActiveFileId(newFile.id);
          // 自动打开语言选择器
          setLanguageSelectorTarget(newFileId);
          setShowLanguageSelector(true);
          break;
        case 'menu:openFile':
          if (data) {
            const fileName = data.split(/[/\\]/).pop() || 'file';
            openFileRef.current(data, fileName);
          }
          break;
        case 'menu:openFolder':
          if (data) {
            setWorkspaceRoot(data);
            setWorkspaceName(data.split(/[/\\]/).pop() || 'Workspace');
            const tree = await loadDirectoryRef.current(data, true);
            setFileTree(tree);
            // 同步到 Store（供 AI 面板使用）
            setStoreWorkspace(data, data.split(/[/\\]/).pop() || 'Workspace');
            setStoreFileTree(tree);
            setOpenFiles([]);
            setActiveFileId(null);
            setSelected('');
          }
          break;
        case 'menu:save':
          if (activeFileRef.current && editorRefCurrent.current?.current) {
            const content = editorRefCurrent.current.current.getValue();
            const currentFile = activeFileRef.current;

            // 如果是未命名文件，需要弹出保存对话框
            if (currentFile.isUntitled) {
              const result = await window.mindcode?.dialog?.showSaveDialog?.({
                defaultPath: currentFile.name,
                filters: [{ name: 'All Files', extensions: ['*'] }],
              });
              if (result?.filePath) {
                // 写入文件
                const writeResult = await window.mindcode?.fs?.writeFile?.(result.filePath, content);
                if (writeResult?.success) {
                  const newName = result.filePath.split(/[/\\]/).pop() || currentFile.name;
                  setOpenFiles(prev => prev.map(f =>
                    f.id === currentFile.id
                      ? { ...f, path: result.filePath!, name: newName, isDirty: false, isUntitled: false }
                      : f
                  ));
                  // 刷新文件树
                  if (workspaceRoot) {
                    const tree = await loadDirectoryRef.current(workspaceRoot, true);
                    setFileTree(tree);
                    setStoreFileTree(tree);
                  }
                }
              }
            } else {
              // 普通保存
              saveFileRef.current(content);
            }
          }
          break;
        case 'menu:closeEditor':
          if (activeFileIdRef.current) closeFileRef.current(activeFileIdRef.current);
          break;
        case 'menu:commandPalette':
          setCommandPaletteMode('commands');
          setShowCommandPalette(true);
          break;
        case 'menu:goToFile':
          setCommandPaletteMode('files');
          setShowCommandPalette(true);
          break;
        case 'menu:showExplorer':
          setTab('files');
          break;
        case 'menu:showSearch':
          setTab('search');
          break;
        case 'menu:showGit':
          setTab('git');
          break;
        case 'menu:toggleTerminal':
          setShowTerminal(prev => !prev);
          break;
        case 'menu:toggleAI':
          setShowAI(prev => !prev);
          break;
        case 'menu:findInFiles':
          setCommandPaletteMode('search');
          setShowCommandPalette(true);
          break;
      }
    });

    return cleanup;
  }, []); // 依赖数组为空，只在组件挂载时注册一次

  // 全局键盘快捷键 (Ctrl+N 新建, Ctrl+S 保存)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+N - 新建文件
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        untitledCounterRef.current++;
        const newFileId = `untitled_${Date.now()}`;
        const newFileName = `Untitled-${untitledCounterRef.current}.txt`;
        const newFile: EditorFile = {
          id: newFileId,
          path: newFileName,
          name: newFileName,
          content: '',
          language: 'plaintext',
          isDirty: false,
          isUntitled: true,
        };
        setOpenFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        // 自动打开语言选择器
        setLanguageSelectorTarget(newFileId);
        setShowLanguageSelector(true);
      }

      // Ctrl+S - 保存文件
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const currentFile = activeFileRef.current;
        if (!currentFile) return;

        const content = editorRefCurrent.current?.current?.getValue() || currentFile.content;

        if (currentFile.isUntitled) {
          // 未命名文件，弹出保存对话框
          const result = await window.mindcode?.dialog?.showSaveDialog?.({
            defaultPath: currentFile.name,
            filters: [{ name: 'All Files', extensions: ['*'] }],
          });
          if (result?.filePath) {
            const writeResult = await window.mindcode?.fs?.writeFile?.(result.filePath, content);
            if (writeResult?.success) {
              const newName = result.filePath.split(/[/\\]/).pop() || currentFile.name;
              setOpenFiles(prev => prev.map(f =>
                f.id === currentFile.id
                  ? { ...f, path: result.filePath!, name: newName, isDirty: false, isUntitled: false }
                  : f
              ));
              // 刷新文件树
              if (workspaceRoot) {
                const tree = await loadDirectoryRef.current(workspaceRoot, true);
                setFileTree(tree);
                setStoreFileTree(tree);
              }
            }
          }
        } else {
          // 普通保存
          saveFileRef.current(content);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceRoot]);

  // 主题初始化 - 优化: 移除不必要延迟
  useEffect(() => {
    const initTheme = async () => {
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }
      // 移除 100ms 延迟 - CSS 已在 HTML head 中同步加载
      const themeId = await loadTheme();
      applyTheme(themeId);
    };
    initTheme();

    // 监听 IPC 主题切换（菜单触发）
    const ipcHandler = (themeId: string) => {
      if (themeId === 'system') {
        // TODO: 实现跟随系统主题
        return;
      }
      applyTheme(themeId);
      saveTheme(themeId);
    };

    let cleanupIpc: (() => void) | undefined;
    if (window.mindcode?.onThemeChange) {
      cleanupIpc = window.mindcode.onThemeChange(ipcHandler);
    }

    return () => { if (cleanupIpc) cleanupIpc(); };
  }, []);

  // 监听文件系统变更（如 Agent 工具创建/修改文件后自动刷新）
  useEffect(() => {
    if (!window.mindcode?.onFileSystemChange) return;

    const cleanup = window.mindcode.onFileSystemChange((data) => {
      console.log(`[FS] 文件系统变更: ${data.type} - ${data.filePath}`);
      // 刷新文件树
      refreshFileTree();
      // 同步到 Store
      if (workspaceRoot) {
        loadDirectory(workspaceRoot, true).then(tree => {
          setStoreFileTree(tree);
        });
      }
    });

    return cleanup;
  }, [refreshFileTree, workspaceRoot, loadDirectory, setStoreFileTree]);

  // 启动时恢复工作区
  const workspaceRestoredRef = useRef(false);
  useEffect(() => {
    if (workspaceRestoredRef.current) return;
    const restoreWorkspace = async () => {
      const saved = localStorage.getItem('mindcode.workspace');
      if (saved) {
        workspaceRestoredRef.current = true;
        try {
          const tree = await loadDirectory(saved, true);
          if (tree.length > 0) {
            const name = saved.split(/[/\\]/).pop() || 'Workspace';
            setWorkspaceRootState(saved); // 恢复 workspaceRoot 状态
            setFileTree(tree);
            setStoreFileTree(tree);
            setWorkspaceName(name);
            setStoreWorkspace(saved, name); // 同步到 Store（AI 面板需要）
            console.log('[App] 工作区已恢复:', saved);
          } else { localStorage.removeItem('mindcode.workspace'); }
        } catch (e) { console.warn('[App] 恢复工作区失败:', e); localStorage.removeItem('mindcode.workspace'); }
      }
    };
    restoreWorkspace();
  }, [loadDirectory, setStoreFileTree, setStoreWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const send = () => {
    if (!input.trim() || loading) return;

    const userMsg: Msg = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      time: new Date().toLocaleTimeString()
    };

    setMsgs(p => [...p, userMsg]);
    setInput('');
    setLoading(true);
    setStreamingText('');

    // 构建消息历史
    const modelDisplayNames: Record<string, string> = {
      'claude-4-5-opus': 'Claude 4.5 Opus',
      'claude-4-5-sonnet-thinking': 'Claude 4.5 Sonnet (Thinking)',
      'claude-4-5-sonnet': 'Claude 4.5 Sonnet',
      'gemini-2-5-flash-thinking': 'Gemini 2.5 Flash (Thinking)',
      'gemini-2-5-flash-lite': 'Gemini 2.5 Flash Lite',
      'gemini-2-5-flash': 'Gemini 2.5 Flash',
      'gemini-3-pro-image': 'Gemini 3 Pro (Image)',
      'gemini-3-pro-low': 'Gemini 3 Pro Low',
      'gemini-3-pro-high': 'Gemini 3 Pro High',
      'gemini-3-flash': 'Gemini 3 Flash',
    };
    const modelDisplayName = modelDisplayNames[model] || model;

    const chatMessages = [
      { role: 'system' as const, content: `你是 MindCode AI 助手，当前模型是 ${modelDisplayName}。

你的性格：
- 友好热情但不过度，像一个靠谱的程序员朋友
- 适当使用语气词让回复更自然（比如"好的"、"没问题"、"这个问题很好"）
- 可以偶尔用一点幽默，但要适度

回复风格：
- 简洁专业，避免过度使用 Markdown 标题（#、##）
- 代码块使用 \`\`\` 包裹并标注语言
- 列表用 - 或数字，少用 emoji
- 回答要有内容、有深度，不要敷衍
- 中文回复

当被问到模型时，回答：${modelDisplayName}` },
      ...msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.text })),
      { role: 'user' as const, content: userMsg.text }
    ];

    // 调用 AI API（流式）
    if (window.mindcode?.ai?.chatStream) {
      const cancelFn = window.mindcode.ai.chatStream(model, chatMessages, {
        onToken: (token) => {
          setStreamingText(prev => prev + token);
        },
        onComplete: (fullText) => {
          setMsgs(p => [...p, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: fullText,
            time: new Date().toLocaleTimeString()
          }]);
          setStreamingText('');
          setLoading(false);
          cancelStreamRef.current = null;
        },
        onError: (error) => {
          setMsgs(p => [...p, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: `错误: ${error}`,
            time: new Date().toLocaleTimeString()
          }]);
          setStreamingText('');
          setLoading(false);
          cancelStreamRef.current = null;
        }
      });
      // 保存取消函数
      cancelStreamRef.current = cancelFn;
    } else {
      // 开发模式回退
      setTimeout(() => {
        setMsgs(p => [...p, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `[开发模式] 请在 Electron 中运行。\n\n您的消息: "${userMsg.text}"`,
          time: new Date().toLocaleTimeString()
        }]);
        setLoading(false);
      }, 300);
    }
  };

  return (
    <div className="workbench">
      <div className="titlebar"><span className="titlebar-title">MindCode</span></div>

      <div className="main-layout">
        {/* Activity Bar */}
        <div className="activitybar">
          <div className="activitybar-top">
            <button className={`activity-action${tab === 'files' ? ' active' : ''}`} onClick={() => setTab('files')} title="Explorer"><Icons.Files /></button>
            <button className={`activity-action${tab === 'search' ? ' active' : ''}`} onClick={() => setTab('search')} title="Search"><Icons.Search /></button>
            <button className={`activity-action${tab === 'git' ? ' active' : ''}`} onClick={() => setTab('git')} title="Source Control"><Icons.Git /></button>
            <button className={`activity-action${tab === 'ext' ? ' active' : ''}`} onClick={() => setTab('ext')} title="Extensions"><Icons.Extensions /></button>
          </div>
          <div className="activitybar-bottom">
            <button className="activity-action" title="Account"><Icons.Account /></button>
            <button className="activity-action" title="Settings"><Icons.Settings /></button>
          </div>
        </div>

        {/* Sidebar */}
        <div
          className="sidebar"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ position: 'relative', width: sidebarWidth }}
        >
          <div className="sidebar-title">
            {tab === 'files' && 'Explorer'}
            {tab === 'search' && 'Search'}
            {tab === 'git' && 'Source Control'}
            {tab === 'ext' && 'Extensions'}
          </div>
          <div className="sidebar-body">
            {/* 文件浏览器 */}
            {tab === 'files' && (
              <>
                <div
                  className="tree-header"
                  style={{ cursor: 'pointer' }}
                  onClick={handleOpenFolder}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (workspaceRoot) {
                      handleContextMenu(e, workspaceRoot, workspaceName, true);
                    }
                  }}
                  title="点击打开文件夹"
                >
                  <span className="tree-header-icon"><Icons.ChevronDown /></span>
                  <span className="tree-header-label">{workspaceName}</span>
                  <button className="tree-header-action" onClick={(e) => { e.stopPropagation(); handleOpenFolder(); }} title="打开文件夹">
                    <Icons.Folder />
                  </button>
                </div>
                {fileTree.map((n, i) => (
                  <TreeRow
                    key={(n.path || n.name) + i}
                    node={n}
                    depth={0}
                    selected={selected}
                    contextMenuPath={contextMenu.isOpen ? contextMenu.targetPath : null}
                    onSelect={openFile}
                    onContextMenu={handleContextMenu}
                    onLoadChildren={loadDirectory}
                  />
                ))}
              </>
            )}
            {/* Git 面板 */}
            {tab === 'git' && (
              <GitPanel workspacePath={workspaceRoot} />
            )}
            {/* 搜索面板 */}
            {tab === 'search' && (
              <div className="git-empty">
                <p>使用 Ctrl+Shift+F 进行全局搜索</p>
              </div>
            )}
            {/* 扩展面板 */}
            {tab === 'ext' && <ExtensionsPanel />}
          </div>
          {/* 拖拽上传指示器 */}
          {isDragging && (
            <div className="drop-zone-overlay">
              <div className="drop-zone-icon">
                <Icons.Folder />
              </div>
              <div className="drop-zone-text">拖拽文件夹到此处打开</div>
            </div>
          )}
        </div>

        {/* Sidebar Resizer */}
        <div
          className={`sidebar-resizer${isResizingSidebar ? ' resizing' : ''}`}
          onMouseDown={handleSidebarResizeStart}
        />

        {/* Editor */}
        <div className="editor-area">
          <div className="tabs-wrapper">
            <div className="tabs-scroll" ref={tabsScrollRef} onWheel={handleTabsWheel}>
              {openFiles.length === 0 ? (
                <div className="tab active">
                  <span className="tab-icon" style={{ color: '#b48ead' }}><Icons.Sparkle /></span>
                  <span className="tab-label">Welcome</span>
                </div>
              ) : (
                openFiles.map(file => (
                  <div
                    key={file.id}
                    className={`tab${file.id === activeFileId ? ' active' : ''}${file.isDirty ? ' modified' : ''}${file.isPreview ? ' preview' : ''}`}
                    onClick={() => switchFile(file.id)}
                    title={file.isPreview ? `预览: ${file.originalPath || file.path}` : file.path}
                  >
                    <span className="tab-icon">
                      {file.isPreview ? (
                        <svg viewBox="0 0 16 16" fill="#9966cc" width="14" height="14">
                          <path d="M8 3.5c-4 0-7 4-7 4.5s3 4.5 7 4.5 7-4 7-4.5-3-4.5-7-4.5zm0 7a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" fill={getFileColor(file.name)} width="14" height="14">
                          <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1zm2.5 12.5c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5v-11c0-.28.22-.5.5-.5H10v3h3v8.5z"/>
                        </svg>
                      )}
                    </span>
                    <span className="tab-label">{file.name}</span>
                    <button className="tab-close" onClick={(e) => closeFile(file.id, e)}>
                      <Icons.Close />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="editor-content" style={{ flex: showTerminal ? `1 1 calc(100% - ${terminalHeight}px)` : '1 1 100%' }}>
            {activeFile ? (
              <EditorErrorBoundary>
                <CodeEditor file={{ path: activeFile.path, content: activeFile.content }} onContentChange={updateFileContent} onSave={saveFile} onCursorPositionChange={(line, column) => setCursorPosition({ line, column })} />
              </EditorErrorBoundary>
            ) : (
              <div className="editor-scroll">
                <div className="welcome">
                  {/* MindCode 钻石 M Logo - 主题自适应 */}
                  <div className="welcome-logo-container">
                    <MindCodeLogo size={80} />
                  </div>
                  
                  <h1>MindCode</h1>
                  <p className="welcome-subtitle">AI-NATIVE CODE EDITOR</p>
                  
                  {/* Shortcuts in a modern card grid */}
                  <div className="welcome-shortcuts">
                    <div className="shortcut" onClick={() => setShowAI(true)} role="button" tabIndex={0}>
                      <span className="shortcut-text">打开 AI 对话</span>
                      <div className="shortcut-keys"><kbd>Ctrl</kbd><kbd>L</kbd></div>
                    </div>
                    <div className="shortcut" role="button" tabIndex={0}>
                      <span className="shortcut-text">内联编辑</span>
                      <div className="shortcut-keys"><kbd>Ctrl</kbd><kbd>K</kbd></div>
                    </div>
                    <div className="shortcut" onClick={() => setShowCommandPalette(true)} role="button" tabIndex={0}>
                      <span className="shortcut-text">快速打开</span>
                      <div className="shortcut-keys"><kbd>Ctrl</kbd><kbd>P</kbd></div>
                    </div>
                    <div className="shortcut" onClick={() => setShowTerminal(v => !v)} role="button" tabIndex={0}>
                      <span className="shortcut-text">打开终端</span>
                      <div className="shortcut-keys"><kbd>Ctrl</kbd><kbd>`</kbd></div>
                    </div>
                  </div>
                  
                  {/* Version tag */}
                  <div className="welcome-version">
                    <span>v0.2.0</span>
                    <span className="welcome-dot">•</span>
                    <span>Powered by Claude</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 终端面板 */}
          {showTerminal && (
            <div className="bottom-panel" style={{ height: terminalHeight }}>
              <div
                className="bottom-panel-resizer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizingTerminal(true);
                  const startY = e.clientY;
                  const startHeight = terminalHeight;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const delta = startY - moveEvent.clientY;
                    const newHeight = Math.max(100, Math.min(500, startHeight + delta));
                    setTerminalHeight(newHeight);
                  };

                  const handleMouseUp = () => {
                    setIsResizingTerminal(false);
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = 'ns-resize';
                  document.body.style.userSelect = 'none';
                }}
              />
              <div className="bottom-panel-content">
                <Terminal
                  workspacePath={workspaceRoot}
                  isVisible={showTerminal}
                  onClose={() => setShowTerminal(false)}
                />
              </div>
            </div>
          )}

          {/* Phase 3: Diff Editor 面板 */}
          {showDiffPanel && diffData && (
            <div className="bottom-panel diff-panel" style={{ height: diffPanelHeight }}>
              <DiffEditorPanel
                originalPath={diffData.path}
                originalContent={diffData.originalContent}
                modifiedContent={diffData.modifiedContent}
                language={diffData.language}
                isVisible={showDiffPanel}
                onApply={async (content) => {
                  // 写入文件
                  const result = await window.mindcode?.fs?.writeFile?.(diffData.path, content);
                  if (result?.success) {
                    // 更新编辑器中的文件内容
                    const file = openFiles.find(f => f.path === diffData.path);
                    if (file) {
                      setOpenFiles(prev => prev.map(f =>
                        f.path === diffData.path ? { ...f, content, isDirty: false } : f
                      ));
                    }
                    setShowDiffPanel(false);
                    setDiffData(null);
                  }
                }}
                onReject={() => {
                  setShowDiffPanel(false);
                  setDiffData(null);
                }}
                onClose={() => {
                  setShowDiffPanel(false);
                  setDiffData(null);
                }}
              />
            </div>
          )}
        </div>

        {/* AI Panel - 新设计系统 */}
        {showAI && (
          <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
            {/* 拖动条 */}
            <div
              className="ai-panel-resizer"
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                left: -2,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                background: 'transparent',
                zIndex: 1000
              }}
            />
            <AIPanelErrorBoundary>
              <AIPanel model={model} onModelChange={setModel} onClose={() => setShowAI(false)} width={aiPanelWidth} isResizing={isResizing} />
            </AIPanelErrorBoundary>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        workspaceRoot={workspaceRoot}
        activeFile={activeFile}
        zoomPercent={zoomPercent}
        cursorPosition={cursorPosition}
        onLanguageChange={(id, lang) => setFileLanguage(id, lang)}
      />

      {!showAI && <button className="chat-fab" onClick={() => setShowAI(true)}><Icons.Chat /></button>}

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        workspacePath={workspaceRoot}
        onOpenFile={openFile}
        commands={commands}
        initialMode={commandPaletteMode}
      />

      {/* 文件右键菜单 */}
      <FileContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        targetPath={contextMenu.targetPath}
        targetName={contextMenu.targetName}
        isFolder={contextMenu.isFolder}
        isWorkspaceRoot={contextMenu.targetPath === workspaceRoot}
        onClose={closeContextMenu}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onPaste={handlePaste}
        hasCopiedPath={!!copiedPath}
      />

      {/* 输入对话框 */}
      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        placeholder={inputDialog.placeholder}
        defaultValue={inputDialog.defaultValue}
        confirmText={inputDialog.confirmText}
        onConfirm={inputDialog.onConfirm}
        onCancel={() => setInputDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="删除"
        danger={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* 语言选择器对话框 */}
      {showLanguageSelector && (
        <div className="language-selector-overlay" onClick={() => setShowLanguageSelector(false)}>
          <div className="language-selector-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="language-selector-header">
              <span>选择语言类型</span>
              <button
                className="language-selector-close"
                onClick={() => setShowLanguageSelector(false)}
              >
                ×
              </button>
            </div>
            <div className="language-selector-list">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  className="language-selector-item"
                  onClick={() => {
                    if (languageSelectorTarget) {
                      // 更新文件语言和扩展名
                      setOpenFiles(prev => prev.map(f => {
                        if (f.id !== languageSelectorTarget) return f;
                        const baseName = f.name.replace(/\.[^.]+$/, '');
                        return {
                          ...f,
                          language: lang.id,
                          name: `${baseName}${lang.ext}`,
                          path: `${baseName}${lang.ext}`,
                        };
                      }));
                    }
                    setShowLanguageSelector(false);
                    setLanguageSelectorTarget(null);
                  }}
                >
                  <span className="lang-name">{lang.name}</span>
                  <span className="lang-ext">{lang.ext}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Composer 多文件重构面板 */}
      <ComposerPanel isOpen={showComposer} onClose={() => setShowComposer(false)} workspacePath={workspaceRoot || undefined} />
    </div>
  );
};

export default App;
