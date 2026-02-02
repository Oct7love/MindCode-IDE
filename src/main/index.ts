import { app, BrowserWindow, ipcMain, dialog, Menu, shell, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeProvider } from '../core/ai/providers/claude';
import { OpenAIProvider } from '../core/ai/providers/openai';
import { DeepSeekProvider } from '../core/ai/providers/deepseek';
import { GeminiProvider } from '../core/ai/providers/gemini';
import { GLMProvider } from '../core/ai/providers/glm';
import { CodesucProvider } from '../core/ai/providers/codesuc';
import { defaultAIConfig } from '../core/ai/config';
import { LLMClient, classifyError, getUserFriendlyError } from '../core/ai/llm-client';
import { startupTracker, markStartup, logStartupReport } from '../core/performance';
import { warmupConnections, StreamBuffer } from '../core/ai/request-optimizer';

markStartup('main_start');

let mainWindow: BrowserWindow | null = null;

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// 懒加载 AI Providers - 延迟到首次使用时初始化
let _providers: Record<string, any> | null = null;
let _llmClient: LLMClient | null = null;

function getProviders() {
  if (!_providers) {
    markStartup('providers_init_start');
    _providers = {
      claude: new ClaudeProvider({ apiKey: defaultAIConfig.claude.apiKey, baseUrl: defaultAIConfig.claude.baseUrl, model: defaultAIConfig.claude.model }),
      openai: new OpenAIProvider({ apiKey: defaultAIConfig.openai.apiKey, baseUrl: defaultAIConfig.openai.baseUrl, model: defaultAIConfig.openai.model }),
      gpt4: new OpenAIProvider({ apiKey: defaultAIConfig.openai.apiKey, baseUrl: defaultAIConfig.openai.baseUrl, model: defaultAIConfig.openai.model }),
      gemini: new GeminiProvider({ apiKey: defaultAIConfig.gemini.apiKey, baseUrl: defaultAIConfig.gemini.baseUrl, model: defaultAIConfig.gemini.model }),
      deepseek: new DeepSeekProvider({ apiKey: defaultAIConfig.deepseek.apiKey, baseUrl: defaultAIConfig.deepseek.baseUrl, model: defaultAIConfig.deepseek.model }),
      glm: new GLMProvider({ apiKey: defaultAIConfig.glm.apiKey, baseUrl: defaultAIConfig.glm.baseUrl, model: defaultAIConfig.glm.model }),
      codesuc: new CodesucProvider({ apiKey: defaultAIConfig.codesuc.apiKey, baseUrl: defaultAIConfig.codesuc.baseUrl, model: defaultAIConfig.codesuc.model })
    };
    markStartup('providers_init_end');
    // 后台探测能力（不阻塞）
    (_providers.codesuc as CodesucProvider).probeCapabilities().then(cap => console.log(`[LLM] Codesuc: tools=${cap.tools}, stream=${cap.stream}`)).catch(() => {});
  }
  return _providers;
}

function getLLMClient(): LLMClient {
  if (!_llmClient) {
    const providers = getProviders();
    _llmClient = new LLMClient(new Map(Object.entries(providers)));
    _llmClient.on('fallback', (from, to) => console.log(`[LLM] 降级: ${from} -> ${to}`));
  }
  return _llmClient;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'MindCode',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    backgroundColor: '#1e1e1e'
  });

  if (isDev) {
    console.log('开发模式：加载 http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', () => {
    if (isDev) {
      console.log('页面加载失败，2秒后重试...');
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:5173');
      }, 2000);
    }
  });
}

app.whenReady().then(() => {
  markStartup('app_ready');
  createMenu();
  if (isDev) setTimeout(createWindow, 500); // 等待 Vite 启动
  else createWindow();
  // 后台预热 (不阻塞窗口创建)
  setTimeout(() => {
    getProviders();
    markStartup('providers_preloaded');
    warmupConnections().then(() => markStartup('connections_warmed'));
  }, 100);
});

// 创建应用菜单
function createMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createWindow()
        },
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:newFile')
        },
        { type: 'separator' },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openFile'],
              filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'TypeScript', extensions: ['ts', 'tsx'] },
                { name: 'JavaScript', extensions: ['js', 'jsx'] },
                { name: 'JSON', extensions: ['json'] },
              ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('menu:openFile', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+K CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('menu:openFolder', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:saveAs')
        },
        { type: 'separator' },
        {
          label: 'Close Editor',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow?.webContents.send('menu:closeEditor')
        },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => mainWindow?.close()
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow?.webContents.send('menu:find')
        },
        {
          label: 'Find in Files',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow?.webContents.send('menu:findInFiles')
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.webContents.send('menu:replace')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette...',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow?.webContents.send('menu:commandPalette')
        },
        { type: 'separator' },
        {
          label: 'Explorer',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('menu:showExplorer')
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow?.webContents.send('menu:showSearch')
        },
        {
          label: 'Source Control',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => mainWindow?.webContents.send('menu:showGit')
        },
        { type: 'separator' },
        {
          label: 'Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => mainWindow?.webContents.send('menu:toggleTerminal')
        },
        {
          label: 'AI Chat',
          accelerator: 'CmdOrCtrl+L',
          click: () => mainWindow?.webContents.send('menu:toggleAI')
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: [
            {
              label: '🌙 Dark Themes',
              submenu: [
                { label: 'MindCode Dark', click: () => mainWindow?.webContents.send('theme:change', 'mindcode-dark') },
                { label: 'Dark+ (VS Code)', click: () => mainWindow?.webContents.send('theme:change', 'dark-plus') },
                { type: 'separator' },
                { label: 'Catppuccin Mocha', click: () => mainWindow?.webContents.send('theme:change', 'catppuccin-mocha') },
                { label: 'Catppuccin Macchiato', click: () => mainWindow?.webContents.send('theme:change', 'catppuccin-macchiato') },
                { label: 'Catppuccin Frappé', click: () => mainWindow?.webContents.send('theme:change', 'catppuccin-frappe') },
                { type: 'separator' },
                { label: 'Tokyo Night', click: () => mainWindow?.webContents.send('theme:change', 'tokyo-night') },
                { label: 'Tokyo Night Storm', click: () => mainWindow?.webContents.send('theme:change', 'tokyo-night-storm') },
                { type: 'separator' },
                { label: 'Kanagawa Wave', click: () => mainWindow?.webContents.send('theme:change', 'kanagawa-wave') },
                { label: 'Kanagawa Dragon', click: () => mainWindow?.webContents.send('theme:change', 'kanagawa-dragon') },
                { type: 'separator' },
                { label: 'Everforest Dark', click: () => mainWindow?.webContents.send('theme:change', 'everforest-dark') },
                { label: 'Everforest Dark Hard', click: () => mainWindow?.webContents.send('theme:change', 'everforest-dark-hard') },
                { type: 'separator' },
                { label: 'Material Ocean', click: () => mainWindow?.webContents.send('theme:change', 'material-ocean') },
                { label: 'Material Palenight', click: () => mainWindow?.webContents.send('theme:change', 'material-palenight') },
                { label: 'Material Darker', click: () => mainWindow?.webContents.send('theme:change', 'material-darker') },
                { type: 'separator' },
                { label: 'Dracula', click: () => mainWindow?.webContents.send('theme:change', 'dracula') },
                { label: 'One Dark Pro', click: () => mainWindow?.webContents.send('theme:change', 'one-dark-pro') },
                { label: 'Atom One Dark', click: () => mainWindow?.webContents.send('theme:change', 'atom-one-dark') },
                { label: 'Monokai', click: () => mainWindow?.webContents.send('theme:change', 'monokai') },
                { type: 'separator' },
                { label: 'GitHub Dark', click: () => mainWindow?.webContents.send('theme:change', 'github-dark') },
                { label: 'GitHub Dark Dimmed', click: () => mainWindow?.webContents.send('theme:change', 'github-dark-dimmed') },
                { type: 'separator' },
                { label: 'Nord', click: () => mainWindow?.webContents.send('theme:change', 'nord') },
                { label: 'Gruvbox Dark', click: () => mainWindow?.webContents.send('theme:change', 'gruvbox-dark') },
                { label: 'Solarized Dark', click: () => mainWindow?.webContents.send('theme:change', 'solarized-dark') },
                { type: 'separator' },
                { label: 'Rosé Pine', click: () => mainWindow?.webContents.send('theme:change', 'rose-pine') },
                { label: 'Rosé Pine Moon', click: () => mainWindow?.webContents.send('theme:change', 'rose-pine-moon') },
                { type: 'separator' },
                { label: 'Night Owl', click: () => mainWindow?.webContents.send('theme:change', 'night-owl') },
                { label: 'Cobalt2', click: () => mainWindow?.webContents.send('theme:change', 'cobalt2') },
                { label: 'Palenight', click: () => mainWindow?.webContents.send('theme:change', 'palenight') },
                { label: 'Panda Syntax', click: () => mainWindow?.webContents.send('theme:change', 'panda') },
                { type: 'separator' },
                { label: 'Ayu Dark', click: () => mainWindow?.webContents.send('theme:change', 'ayu-dark') },
                { label: 'Vitesse Dark', click: () => mainWindow?.webContents.send('theme:change', 'vitesse-dark') },
                { label: 'Andromeda', click: () => mainWindow?.webContents.send('theme:change', 'andromeda') },
                { label: 'Moonlight II', click: () => mainWindow?.webContents.send('theme:change', 'moonlight') },
                { type: 'separator' },
                { label: "Synthwave '84", click: () => mainWindow?.webContents.send('theme:change', 'synthwave-84') },
                { label: 'Horizon Dark', click: () => mainWindow?.webContents.send('theme:change', 'horizon-dark') },
                { label: 'Shades of Purple', click: () => mainWindow?.webContents.send('theme:change', 'shades-of-purple') },
                { label: 'Laserwave', click: () => mainWindow?.webContents.send('theme:change', 'laserwave') },
                { label: 'Aura Dark', click: () => mainWindow?.webContents.send('theme:change', 'aura-dark') },
                { type: 'separator' },
                { label: 'Bluloco Dark', click: () => mainWindow?.webContents.send('theme:change', 'bluloco-dark') },
                { label: 'Bearded Arc', click: () => mainWindow?.webContents.send('theme:change', 'bearded-arc') },
                { label: 'Slack Dark', click: () => mainWindow?.webContents.send('theme:change', 'slack-dark') },
                { label: 'Min Dark', click: () => mainWindow?.webContents.send('theme:change', 'min-dark') }
              ]
            },
            {
              label: '☀️ Light Themes',
              submenu: [
                { label: 'Light+ (default light)', click: () => mainWindow?.webContents.send('theme:change', 'light-plus') },
                { label: 'GitHub Light', click: () => mainWindow?.webContents.send('theme:change', 'github-light') },
                { label: 'Quiet Light', click: () => mainWindow?.webContents.send('theme:change', 'quiet-light') },
                { type: 'separator' },
                { label: 'Catppuccin Latte', click: () => mainWindow?.webContents.send('theme:change', 'catppuccin-latte') },
                { label: 'Tokyo Night Day', click: () => mainWindow?.webContents.send('theme:change', 'tokyo-night-day') },
                { type: 'separator' },
                { label: 'Everforest Light', click: () => mainWindow?.webContents.send('theme:change', 'everforest-light') },
                { label: 'Kanagawa Lotus', click: () => mainWindow?.webContents.send('theme:change', 'kanagawa-lotus') },
                { type: 'separator' },
                { label: 'Solarized Light', click: () => mainWindow?.webContents.send('theme:change', 'solarized-light') },
                { label: 'Ayu Light', click: () => mainWindow?.webContents.send('theme:change', 'ayu-light') },
                { label: 'One Light', click: () => mainWindow?.webContents.send('theme:change', 'one-light') },
                { type: 'separator' },
                { label: 'Rosé Pine Dawn', click: () => mainWindow?.webContents.send('theme:change', 'rose-pine-dawn') },
                { label: 'Vitesse Light', click: () => mainWindow?.webContents.send('theme:change', 'vitesse-light') },
                { label: 'Night Owl Light', click: () => mainWindow?.webContents.send('theme:change', 'night-owl-light') },
                { label: 'Material Light', click: () => mainWindow?.webContents.send('theme:change', 'material-light') },
                { type: 'separator' },
                { label: 'Material Lighter', click: () => mainWindow?.webContents.send('theme:change', 'material-lighter') },
                { label: 'Bluloco Light', click: () => mainWindow?.webContents.send('theme:change', 'bluloco-light') },
                { label: 'Min Light', click: () => mainWindow?.webContents.send('theme:change', 'min-light') },
                { label: 'Horizon Light', click: () => mainWindow?.webContents.send('theme:change', 'horizon-light') },
                { label: 'Bearded Antique', click: () => mainWindow?.webContents.send('theme:change', 'bearded-antique') },
                { label: 'Slack Ochin', click: () => mainWindow?.webContents.send('theme:change', 'slack-ochin') }
              ]
            },
            {
              label: '🔲 High Contrast',
              submenu: [
                { label: 'Dark High Contrast', click: () => mainWindow?.webContents.send('theme:change', 'hc-black') },
                { label: 'Light High Contrast', click: () => mainWindow?.webContents.send('theme:change', 'hc-light') }
              ]
            },
            { type: 'separator' },
            { label: 'Follow System', click: () => mainWindow?.webContents.send('theme:change', 'system') }
          ]
        },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle Full Screen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Go',
      submenu: [
        {
          label: 'Go to File...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.send('menu:goToFile')
        },
        {
          label: 'Go to Line...',
          accelerator: 'CmdOrCtrl+G',
          click: () => mainWindow?.webContents.send('menu:goToLine')
        }
      ]
    },
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+Shift+`',
          click: () => mainWindow?.webContents.send('menu:newTerminal')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        {
          label: 'About MindCode',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About MindCode',
              message: 'MindCode',
              detail: 'AI-Native Code Editor\nVersion 0.1.0\n\nBuilt with Electron + React + TypeScript'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ==================== IPC 处理器 ====================

ipcMain.handle('get-app-version', () => app.getVersion());

// 根据模型名选择 Provider (保留兼容)
function getProviderForModel(model: string) {
  const providers = getProviders();
  if (model.startsWith('codesuc-')) return providers.codesuc;
  if (model.startsWith('claude-')) return providers.claude;
  if (model.startsWith('gemini-')) return providers.gemini;
  if (model.startsWith('deepseek-')) return providers.deepseek;
  if (model.startsWith('glm-')) return providers.glm;
  if (model.startsWith('gpt-')) return providers.openai;
  return providers.codesuc;
}

// AI 聊天（非流式）- 使用 LLM 客户端
ipcMain.handle('ai-chat', async (_event, { model, messages }) => {
  console.log(`[AI] chat request: model=${model}, messages=${messages.length}`);
  const result = await getLLMClient().chat({ model, messages });
  console.log(`[AI] chat result: success=${result.success}, model=${result.model}, fallback=${result.usedFallback}`);
  if (result.success) return { success: true, data: result.data, model: result.model, usedFallback: result.usedFallback };
  return { success: false, error: getUserFriendlyError(result.error!), errorType: result.error?.type };
});

// AI 聊天（流式）- 使用 LLM 客户端 + StreamBuffer 优化
ipcMain.on('ai-chat-stream', async (event, { model, messages, requestId }) => {
  console.log(`[AI] stream request: id=${requestId}, model=${model}, mode=chat`);
  const buffer = new StreamBuffer((text) => event.sender.send('ai-stream-token', { requestId, token: text }), 16);
  try {
    await getLLMClient().chatStream({ model, messages }, {
      onToken: (token) => buffer.push(token),
      onComplete: (fullText, meta) => { buffer.destroy(); console.log(`[AI] stream complete: id=${requestId}, model=${meta.model}`); event.sender.send('ai-stream-complete', { requestId, fullText, model: meta.model, usedFallback: meta.usedFallback }); },
      onError: (error) => { buffer.destroy(); console.error(`[AI] stream error: id=${requestId}`, error); event.sender.send('ai-stream-error', { requestId, error: getUserFriendlyError(error), errorType: error.type }); },
      onFallback: (from, to) => { console.log(`[AI] fallback: ${from} -> ${to}`); event.sender.send('ai-stream-fallback', { requestId, from, to }); }
    });
  } catch (e: any) { buffer.destroy(); console.error(`[AI] stream exception: id=${requestId}`, e); event.sender.send('ai-stream-error', { requestId, error: e?.message || '请求失败', errorType: 'unknown' }); }
});

// AI 聊天（流式 + 工具调用）- 使用 LLM 客户端 + StreamBuffer 优化
ipcMain.on('ai-chat-stream-with-tools', async (event, { model, messages, tools, requestId }) => {
  console.log(`[AI] stream+tools request: id=${requestId}, model=${model}, mode=agent, tools=${tools?.length || 0}`);
  const buffer = new StreamBuffer((text) => event.sender.send('ai-stream-token', { requestId, token: text }), 16);
  try {
    await getLLMClient().chatStream({ model, messages, tools }, {
      onToken: (token) => buffer.push(token),
      onToolCall: (calls) => { console.log(`[AI] tool calls: id=${requestId}`, calls.map((c: any) => c.name)); event.sender.send('ai-stream-tool-call', { requestId, toolCalls: calls }); },
      onComplete: (fullText, meta) => { buffer.destroy(); console.log(`[AI] stream+tools complete: id=${requestId}, model=${meta.model}`); event.sender.send('ai-stream-complete', { requestId, fullText, model: meta.model, usedFallback: meta.usedFallback }); },
      onError: (error) => { buffer.destroy(); console.error(`[AI] stream+tools error: id=${requestId}`, error); event.sender.send('ai-stream-error', { requestId, error: getUserFriendlyError(error), errorType: error.type }); },
      onFallback: (from, to) => { console.log(`[AI] fallback: ${from} -> ${to}`); event.sender.send('ai-stream-fallback', { requestId, from, to }); }
    });
  } catch (e: any) { buffer.destroy(); console.error(`[AI] stream+tools exception: id=${requestId}`, e); event.sender.send('ai-stream-error', { requestId, error: e?.message || '请求失败', errorType: 'unknown' }); }
});

// LLM 状态查询
ipcMain.handle('ai-stats', () => getLLMClient().getStats());

// ==================== 文件系统操作 ====================

// 打开文件夹对话框
ipcMain.handle('fs:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 读取目录结构
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = items
      .filter(item => !item.name.startsWith('.') && item.name !== 'node_modules')
      .map(item => ({
        name: item.name,
        path: path.join(dirPath, item.name),
        type: item.isDirectory() ? 'folder' : 'file'
      }))
      .sort((a, b) => {
        // 文件夹优先
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 读取文件内容
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 写入文件
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    // 通知渲染进程文件系统已变更
    mainWindow?.webContents.send('fs:fileChanged', { filePath, type: 'write' });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取文件信息
ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath);
    return {
      success: true,
      data: {
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        size: stat.size,
        mtime: stat.mtime.toISOString()
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ==================== 文件搜索（Command Palette） ====================

// 递归获取所有文件
function getAllFilesRecursive(
  dirPath: string,
  baseDir: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Array<{ name: string; path: string; relativePath: string }> {
  if (currentDepth >= maxDepth) return [];

  const results: Array<{ name: string; path: string; relativePath: string }> = [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      // 跳过隐藏文件和常见忽略目录
      if (item.name.startsWith('.')) continue;
      if (['node_modules', 'dist', 'build', '.git', '__pycache__', '.vscode'].includes(item.name)) continue;

      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (item.isDirectory()) {
        results.push(...getAllFilesRecursive(fullPath, baseDir, maxDepth, currentDepth + 1));
      } else {
        results.push({
          name: item.name,
          path: fullPath,
          relativePath: relativePath.replace(/\\/g, '/')
        });
      }
    }
  } catch (error) {
    // 忽略权限错误等
  }

  return results;
}

// 获取工作区所有文件（用于 Command Palette）
ipcMain.handle('fs:getAllFiles', async (_event, workspacePath: string) => {
  try {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return { success: false, error: '工作区路径无效' };
    }

    const files = getAllFilesRecursive(workspacePath, workspacePath);
    return { success: true, data: files };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 搜索文件内容（用于全局搜索 Ctrl+Shift+F）
ipcMain.handle('fs:searchInFiles', async (_event, { workspacePath, query, maxResults = 100 }: {
  workspacePath: string;
  query: string;
  maxResults?: number;
}) => {
  try {
    if (!workspacePath || !query) {
      return { success: false, error: '参数无效' };
    }

    const files = getAllFilesRecursive(workspacePath, workspacePath);
    const results: Array<{
      file: string;
      relativePath: string;
      line: number;
      column: number;
      text: string;
      matchStart: number;
      matchEnd: number;
    }> = [];

    const queryLower = query.toLowerCase();

    for (const file of files) {
      if (results.length >= maxResults) break;

      // 只搜索文本文件
      const ext = path.extname(file.name).toLowerCase();
      const textExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.md', '.txt', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.vue', '.svelte'];
      if (!textExts.includes(ext)) continue;

      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          const line = lines[i];
          const lineLower = line.toLowerCase();
          let searchStart = 0;

          while (searchStart < lineLower.length) {
            const idx = lineLower.indexOf(queryLower, searchStart);
            if (idx === -1) break;

            results.push({
              file: file.path,
              relativePath: file.relativePath,
              line: i + 1,
              column: idx + 1,
              text: line.trim().slice(0, 200),
              matchStart: idx,
              matchEnd: idx + query.length
            });

            searchStart = idx + 1;
            if (results.length >= maxResults) break;
          }
        }
      } catch {
        // 忽略读取错误
      }
    }

    return { success: true, data: results };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ==================== 文件管理操作 ====================

// 创建文件夹
ipcMain.handle('fs:createFolder', async (_event, folderPath: string) => {
  try {
    if (fs.existsSync(folderPath)) {
      return { success: false, error: '文件夹已存在' };
    }
    fs.mkdirSync(folderPath, { recursive: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 创建文件
ipcMain.handle('fs:createFile', async (_event, filePath: string, content: string = '') => {
  try {
    if (fs.existsSync(filePath)) {
      return { success: false, error: '文件已存在' };
    }
    // 确保父目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 删除文件或文件夹
ipcMain.handle('fs:delete', async (_event, targetPath: string) => {
  try {
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: '目标不存在' };
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 重命名文件或文件夹
ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
  try {
    if (!fs.existsSync(oldPath)) {
      return { success: false, error: '源文件不存在' };
    }
    if (fs.existsSync(newPath)) {
      return { success: false, error: '目标名称已存在' };
    }
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 复制文件或文件夹
ipcMain.handle('fs:copy', async (_event, srcPath: string, destPath: string) => {
  try {
    if (!fs.existsSync(srcPath)) {
      return { success: false, error: '源文件不存在' };
    }
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 检查路径是否存在
ipcMain.handle('fs:exists', async (_event, targetPath: string) => {
  try {
    return { success: true, data: fs.existsSync(targetPath) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ==================== 终端操作 ====================

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 执行命令
ipcMain.handle('terminal:execute', async (_event, command: string, cwd?: string) => {
  try {
    // 设置执行选项
    const options: { cwd?: string; shell?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {
      timeout: 60000, // 60秒超时
      env: { ...process.env },
    };

    if (cwd && fs.existsSync(cwd)) {
      options.cwd = cwd;
    }

    // Windows 使用 cmd，其他平台使用 bash
    if (process.platform === 'win32') {
      options.shell = 'cmd.exe';
    } else {
      options.shell = '/bin/bash';
    }

    const { stdout, stderr } = await execAsync(command, options);
    return {
      success: true,
      data: { stdout, stderr }
    };
  } catch (error: any) {
    // exec 错误可能包含 stdout 和 stderr
    return {
      success: false,
      error: error.message,
      data: {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message
      }
    };
  }
});

// 切换目录
ipcMain.handle('terminal:cd', async (_event, currentDir: string, newDir: string) => {
  try {
    let targetPath: string;

    // 处理绝对路径和相对路径
    if (path.isAbsolute(newDir)) {
      targetPath = newDir;
    } else if (newDir === '~' || newDir === '%USERPROFILE%') {
      targetPath = process.env.HOME || process.env.USERPROFILE || '';
    } else if (newDir === '-') {
      // 返回上一个目录（简化处理，直接返回当前目录）
      targetPath = currentDir;
    } else {
      targetPath = path.resolve(currentDir, newDir);
    }

    // 检查目录是否存在
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: `目录不存在: ${newDir}` };
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return { success: false, error: `不是目录: ${newDir}` };
    }

    return { success: true, data: targetPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取当前工作目录
ipcMain.handle('terminal:pwd', async () => {
  return { success: true, data: process.cwd() };
});

// ==================== Git 操作 ====================

// 执行 Git 命令的辅助函数
async function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  const command = `git ${args.join(' ')}`;
  const options = {
    cwd,
    timeout: 30000,
    env: { ...process.env },
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
  };
  return execAsync(command, options);
}

// 检查是否是 Git 仓库
ipcMain.handle('git:isRepo', async (_event, workspacePath: string) => {
  try {
    await execGit(['rev-parse', '--git-dir'], workspacePath);
    return { success: true, data: true };
  } catch {
    return { success: true, data: false };
  }
});

// 获取 Git 状态（文件变更列表）
ipcMain.handle('git:status', async (_event, workspacePath: string) => {
  try {
    const { stdout } = await execGit(['status', '--porcelain', '-u'], workspacePath);
    const files = stdout.trim().split('\n').filter(Boolean).map(line => {
      const status = line.substring(0, 2);
      const filePath = line.substring(3);
      // 解析状态码
      let state: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted' = 'modified';
      if (status.includes('?')) state = 'untracked';
      else if (status.includes('A')) state = 'added';
      else if (status.includes('D')) state = 'deleted';
      else if (status.includes('R')) state = 'renamed';
      else if (status.includes('U')) state = 'conflicted';
      else if (status.includes('M')) state = 'modified';
      
      return { path: filePath, status: state, staged: status[0] !== ' ' && status[0] !== '?' };
    });
    return { success: true, data: files };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取当前分支
ipcMain.handle('git:currentBranch', async (_event, workspacePath: string) => {
  try {
    const { stdout } = await execGit(['branch', '--show-current'], workspacePath);
    return { success: true, data: stdout.trim() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取所有分支
ipcMain.handle('git:branches', async (_event, workspacePath: string) => {
  try {
    const { stdout } = await execGit(['branch', '-a'], workspacePath);
    const branches = stdout.trim().split('\n').map(b => {
      const isCurrent = b.startsWith('*');
      const name = b.replace(/^\*?\s+/, '').trim();
      return { name, current: isCurrent };
    });
    return { success: true, data: branches };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 暂存文件
ipcMain.handle('git:stage', async (_event, workspacePath: string, filePaths: string[]) => {
  try {
    await execGit(['add', ...filePaths], workspacePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 取消暂存
ipcMain.handle('git:unstage', async (_event, workspacePath: string, filePaths: string[]) => {
  try {
    await execGit(['reset', 'HEAD', ...filePaths], workspacePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 提交
ipcMain.handle('git:commit', async (_event, workspacePath: string, message: string) => {
  try {
    await execGit(['commit', '-m', `"${message.replace(/"/g, '\\"')}"`], workspacePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取文件 Diff
ipcMain.handle('git:diff', async (_event, workspacePath: string, filePath: string, staged: boolean) => {
  try {
    const args = staged ? ['diff', '--cached', filePath] : ['diff', filePath];
    const { stdout } = await execGit(args, workspacePath);
    return { success: true, data: stdout };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 切换分支
ipcMain.handle('git:checkout', async (_event, workspacePath: string, branchName: string) => {
  try {
    await execGit(['checkout', branchName], workspacePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 创建分支
ipcMain.handle('git:createBranch', async (_event, workspacePath: string, branchName: string) => {
  try {
    await execGit(['checkout', '-b', branchName], workspacePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取提交历史
ipcMain.handle('git:log', async (_event, workspacePath: string, limit: number = 50) => {
  try {
    const { stdout } = await execGit([
      'log',
      `--max-count=${limit}`,
      '--pretty=format:%H|%h|%an|%ae|%at|%s'
    ], workspacePath);
    const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, author, email, timestamp, message] = line.split('|');
      return { hash, shortHash, author, email, date: new Date(parseInt(timestamp) * 1000).toISOString(), message };
    });
    return { success: true, data: commits };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 放弃文件修改
ipcMain.handle('git:discard', async (_event, workspacePath: string, filePath: string) => {
  try {
    await execGit(['checkout', '--', filePath], workspacePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ==================== Settings ====================
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings(): Record<string, any> {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return {};
}

function saveSettings(settings: Record<string, any>): void {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

let settingsCache = loadSettings();

ipcMain.handle('settings:get', (_event, key: string) => {
  return settingsCache[key];
});

ipcMain.handle('settings:set', (_event, key: string, value: any) => {
  settingsCache[key] = value;
  saveSettings(settingsCache);
});

// ==================== Dialog ====================
ipcMain.handle('dialog:showSaveDialog', async (_event, options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  return { canceled: result.canceled, filePath: result.filePath };
});

ipcMain.handle('dialog:showOpenDialog', async (_event, options: { filters?: { name: string; extensions: string[] }[]; properties?: any[] }) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: options.properties as any || ['openFile'],
  });
  return { canceled: result.canceled, filePaths: result.filePaths };
});

ipcMain.handle('dialog:showMessageBox', async (_event, options: { type?: string; title?: string; message: string; buttons?: string[] }) => {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: (options.type as any) || 'info',
    title: options.title || 'MindCode',
    message: options.message,
    buttons: options.buttons || ['OK'],
  });
  return { response: result.response };
});

// ==================== Theme ====================
ipcMain.on('theme:change', (_event, themeId: string) => {
  mainWindow?.webContents.send('theme:change', themeId);
});

// ==================== AI Code Completion ====================
import {
  generateCompletionMessages,
  cleanCompletionOutput,
  truncateCompletion,
} from '../core/ai/completion-prompt';
import {
  buildCompletionContext,
  CompletionContext,
} from '../core/ai/completion-context';
import {
  DEFAULT_COMPLETION_REQUEST_CONFIG,
} from '../core/ai/completion-config';

// 补全请求缓存 - 增强版
import { completionCache as perfCompletionCache } from '../core/performance';

const COMPLETION_CACHE_TTL = 30000; // 30秒缓存 (增加缓存时间)

// 补全请求处理 - 使用增强缓存
ipcMain.handle('ai:completion', async (_event, request: {
  filePath: string;
  code: string;
  cursorLine: number;
  cursorColumn: number;
  model?: string;
}) => {
  const { filePath, code, cursorLine, cursorColumn, model = 'codesuc-sonnet' } = request;
  const start = Date.now();
  
  // 生成缓存 key (包含代码上下文)
  const prefix = code.split('\n').slice(Math.max(0, cursorLine - 5), cursorLine).join('\n');
  const cacheKey = `${filePath}:${cursorLine}:${prefix.slice(-200)}`;
  
  // 检查缓存
  const cached = perfCompletionCache.get(cacheKey);
  if (cached) {
    console.log(`[AI] completion cache hit: ${Date.now() - start}ms`);
    return { success: true, data: cached, cached: true };
  }
  
  try {
    const context = await buildCompletionContext(filePath, code, cursorLine, cursorColumn, {
      maxPrefixLines: DEFAULT_COMPLETION_REQUEST_CONFIG.maxPrefixLines,
      maxSuffixLines: DEFAULT_COMPLETION_REQUEST_CONFIG.maxSuffixLines,
    });
    
    const messages = generateCompletionMessages(context, {
      useFIM: true, includeSymbols: true, includeDiagnostics: false, includeRelatedSnippets: false, includeStyleHints: true,
    });
    
    const provider = getProviderForModel(model);
    const response = await provider.setModel(model).chat(messages);
    const cleaned = cleanCompletionOutput(response);
    const result = truncateCompletion(cleaned, 20, 2000);
    
    // 缓存结果
    perfCompletionCache.set(cacheKey, result);
    
    console.log(`[AI] completion: ${Date.now() - start}ms, ${result.length} chars`);
    return { success: true, data: result, cached: false };
  } catch (error: any) {
    console.error('[AI] completion error:', error);
    return { success: false, error: error?.message || 'Completion failed' };
  }
});

// 获取补全设置
ipcMain.handle('ai:completion-settings', async () => {
  const enabled = settingsCache['completion.enabled'] ?? true;
  const model = settingsCache['completion.model'] ?? 'codesuc-sonnet';
  const debounceMs = settingsCache['completion.debounceMs'] ?? 150;
  return { enabled, model, debounceMs };
});

// 更新补全设置
ipcMain.handle('ai:completion-settings-set', async (_event, settings: {
  enabled?: boolean;
  model?: string;
  debounceMs?: number;
}) => {
  if (settings.enabled !== undefined) {
    settingsCache['completion.enabled'] = settings.enabled;
  }
  if (settings.model !== undefined) {
    settingsCache['completion.model'] = settings.model;
  }
  if (settings.debounceMs !== undefined) {
    settingsCache['completion.debounceMs'] = settings.debounceMs;
  }
  saveSettings(settingsCache);
  return { success: true };
});

// ==================== 代码索引服务 ====================
import { IndexService, createIndexService } from '../core/indexing';

let indexService: IndexService | null = null;

// 初始化索引服务
async function getOrCreateIndexService(): Promise<IndexService> {
  if (!indexService) {
    indexService = createIndexService();
    await indexService.initialize();
  }
  return indexService;
}

// 索引整个工作区
ipcMain.handle('index:indexWorkspace', async (_event, workspacePath: string) => {
  try {
    const service = await getOrCreateIndexService();
    
    // 发送进度更新到渲染进程
    service.on('onProgress', (progress) => {
      mainWindow?.webContents.send('index:progress', progress);
    });
    
    service.on('onFileIndexed', (filePath, symbolCount) => {
      mainWindow?.webContents.send('index:fileIndexed', { filePath, symbolCount });
    });
    
    service.on('onError', (error, filePath) => {
      console.error('[Index] Error:', filePath, error.message);
    });
    
    service.on('onComplete', (stats) => {
      mainWindow?.webContents.send('index:complete', stats);
    });
    
    // 开始索引（异步）
    service.indexDirectory(workspacePath).catch(err => {
      console.error('[Index] Indexing failed:', err);
    });
    
    return { success: true, message: 'Indexing started' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 获取索引进度
ipcMain.handle('index:getProgress', async () => {
  if (!indexService) {
    return { status: 'idle', totalFiles: 0, indexedFiles: 0 };
  }
  return indexService.getProgress();
});

// 获取索引统计
ipcMain.handle('index:getStats', async () => {
  if (!indexService) {
    return { totalFiles: 0, totalSymbols: 0, totalCallRelations: 0, totalDependencies: 0, totalChunks: 0 };
  }
  return indexService.getStats();
});

// 搜索代码
ipcMain.handle('index:search', async (_event, query: {
  query: string;
  type?: 'symbol' | 'semantic' | 'hybrid';
  limit?: number;
  fileFilter?: string[];
  kindFilter?: string[];
}) => {
  try {
    const service = await getOrCreateIndexService();
    const results = await service.searchCode({
      query: query.query,
      type: query.type || 'hybrid',
      limit: query.limit || 20,
      fileFilter: query.fileFilter,
      kindFilter: query.kindFilter as any,
    });
    return { success: true, data: results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 搜索符号
ipcMain.handle('index:searchSymbols', async (_event, name: string, limit?: number) => {
  try {
    const service = await getOrCreateIndexService();
    const symbols = await service.searchSymbols(name, limit || 20);
    return { success: true, data: symbols };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 获取文件符号（文件大纲）
ipcMain.handle('index:getFileSymbols', async (_event, filePath: string) => {
  try {
    const service = await getOrCreateIndexService();
    const symbols = await service.getFileSymbols(filePath);
    return { success: true, data: symbols };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 查找定义
ipcMain.handle('index:findDefinition', async (_event, symbolName: string) => {
  try {
    const service = await getOrCreateIndexService();
    const definition = await service.findDefinition(symbolName);
    return { success: true, data: definition };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 查找引用
ipcMain.handle('index:findReferences', async (_event, symbolId: string) => {
  try {
    const service = await getOrCreateIndexService();
    const references = await service.findReferences(symbolId);
    return { success: true, data: references };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 获取相关代码（用于 @codebase）
ipcMain.handle('index:getRelatedCode', async (_event, query: string, limit?: number) => {
  try {
    const service = await getOrCreateIndexService();
    const related = await service.getRelatedCode(query, limit || 10);
    return { success: true, data: related };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 取消索引
ipcMain.handle('index:cancel', async () => {
  if (indexService) {
    indexService.cancelIndexing();
    return { success: true };
  }
  return { success: false, error: 'No indexing in progress' };
});

// 清空索引
ipcMain.handle('index:clear', async () => {
  if (indexService) {
    indexService.clearIndex();
    return { success: true };
  }
  return { success: false, error: 'Index service not initialized' };
});
