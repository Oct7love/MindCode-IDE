import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeProvider } from '../core/ai/providers/claude';
import { OpenAIProvider } from '../core/ai/providers/openai';
import { DeepSeekProvider } from '../core/ai/providers/deepseek';
import { GeminiProvider } from '../core/ai/providers/gemini';
import { defaultAIConfig } from '../core/ai/config';

let mainWindow: BrowserWindow | null = null;

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// 初始化 AI Providers
const providers = {
  claude: new ClaudeProvider({
    apiKey: defaultAIConfig.claude.apiKey,
    baseUrl: defaultAIConfig.claude.baseUrl,
    model: defaultAIConfig.claude.model
  }),
  openai: new OpenAIProvider({
    apiKey: defaultAIConfig.openai.apiKey,
    baseUrl: defaultAIConfig.openai.baseUrl,
    model: defaultAIConfig.openai.model
  }),
  gpt4: new OpenAIProvider({
    apiKey: defaultAIConfig.openai.apiKey,
    baseUrl: defaultAIConfig.openai.baseUrl,
    model: defaultAIConfig.openai.model
  }),
  gemini: new GeminiProvider({
    apiKey: defaultAIConfig.gemini.apiKey,
    baseUrl: defaultAIConfig.gemini.baseUrl,
    model: defaultAIConfig.gemini.model
  }),
  deepseek: new DeepSeekProvider({
    apiKey: defaultAIConfig.deepseek.apiKey,
    baseUrl: defaultAIConfig.deepseek.baseUrl,
    model: defaultAIConfig.deepseek.model
  })
};

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
  if (isDev) {
    setTimeout(createWindow, 2000);
  } else {
    createWindow();
  }
});

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

// 根据模型名选择 Provider
function getProviderForModel(model: string) {
  if (model.startsWith('claude-')) {
    return providers.claude;
  } else if (model.startsWith('gemini-')) {
    return providers.gemini;
  } else if (model.startsWith('deepseek-')) {
    return providers.deepseek;
  } else if (model.startsWith('gpt-')) {
    return providers.openai;
  }
  // 默认使用 claude
  return providers.claude;
}

// AI 聊天（非流式）
ipcMain.handle('ai-chat', async (_event, { model, messages }) => {
  try {
    const provider = getProviderForModel(model);
    const response = await provider.setModel(model).chat(messages);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// AI 聊天（流式）
ipcMain.on('ai-chat-stream', async (event, { model, messages, requestId }) => {
  try {
    const provider = getProviderForModel(model);
    await provider.setModel(model).chatStream(messages, {
      onToken: (token) => {
        event.sender.send('ai-stream-token', { requestId, token });
      },
      onComplete: (fullText) => {
        event.sender.send('ai-stream-complete', { requestId, fullText });
      },
      onError: (error) => {
        event.sender.send('ai-stream-error', { requestId, error: error.message });
      }
    });
  } catch (error: any) {
    event.sender.send('ai-stream-error', { requestId, error: error.message });
  }
});

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
