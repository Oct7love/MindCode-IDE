/**
 * File System IPC Handlers
 *
 * 处理文件读写、目录操作、文件搜索等文件系统相关的 IPC 请求。
 * 包含路径安全验证，防止路径遍历攻击。
 */
import { ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import {
  readFileWithEncoding,
  writeFileWithEncoding,
  detectEncoding,
  SUPPORTED_ENCODINGS,
  type EncodingId,
} from "../../core/encoding";
import { type IPCContext, validateSender } from "./types";

/** @deprecated 使用 ctx.getWorkspacePath() 替代 */
let currentWorkspacePath: string | null = null;

/** 文件搜索的最大递归深度 */
const MAX_SEARCH_DEPTH = 10;

/** 默认搜索结果上限 */
const DEFAULT_MAX_SEARCH_RESULTS = 100;

/** 文本文件扩展名（用于内容搜索） */
const TEXT_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".scss",
  ".html",
  ".md",
  ".txt",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".vue",
  ".svelte",
]);

/** 需要跳过的目录名 */
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "__pycache__",
  ".vscode",
]);

/**
 * 解析路径的真实位置（跟随符号链接）
 * 如果路径不存在则回退到 path.resolve
 */
function resolveRealPath(targetPath: string): string {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    // 路径不存在时回退（新建文件场景），校验父目录
    const parent = path.dirname(targetPath);
    try {
      return path.join(fs.realpathSync(parent), path.basename(targetPath));
    } catch {
      return path.resolve(targetPath);
    }
  }
}

/**
 * 验证路径是否在允许的范围内（防止路径遍历 + 符号链接穿越）
 */
function isPathAllowed(targetPath: string, basePath?: string): boolean {
  try {
    const normalizedTarget = resolveRealPath(targetPath);

    if (basePath) {
      const normalizedBase = resolveRealPath(basePath);
      return (
        normalizedTarget.startsWith(normalizedBase + path.sep) ||
        normalizedTarget === normalizedBase
      );
    }

    if (currentWorkspacePath) {
      const normalizedWorkspace = resolveRealPath(currentWorkspacePath);
      return (
        normalizedTarget.startsWith(normalizedWorkspace + path.sep) ||
        normalizedTarget === normalizedWorkspace
      );
    }

    // 检查是否尝试访问系统关键目录
    const dangerousPaths =
      process.platform === "win32"
        ? ["C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData"]
        : ["/etc", "/usr", "/bin", "/sbin", "/var", "/root", "/boot", "/sys", "/proc"];

    return !dangerousPaths.some((dangerous) =>
      normalizedTarget.toLowerCase().startsWith(dangerous.toLowerCase()),
    );
  } catch {
    return false;
  }
}

/**
 * 递归获取所有文件
 */
function getAllFilesRecursive(
  dirPath: string,
  baseDir: string,
  maxDepth: number = MAX_SEARCH_DEPTH,
  currentDepth: number = 0,
): Array<{ name: string; path: string; relativePath: string }> {
  if (currentDepth >= maxDepth) return [];

  const results: Array<{ name: string; path: string; relativePath: string }> = [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith(".")) continue;
      if (SKIP_DIRECTORIES.has(item.name)) continue;

      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (item.isDirectory()) {
        results.push(...getAllFilesRecursive(fullPath, baseDir, maxDepth, currentDepth + 1));
      } else {
        results.push({
          name: item.name,
          path: fullPath,
          relativePath: relativePath.replace(/\\/g, "/"),
        });
      }
    }
  } catch {
    // 忽略权限错误等
  }

  return results;
}

export function registerFSHandlers(ctx: IPCContext): void {
  const mainWindow = ctx.getMainWindow;

  // 设置工作区路径
  ipcMain.handle("fs:setWorkspace", async (event, workspacePath: string) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    try {
      await fsp.access(workspacePath);
    } catch {
      return { success: false, error: "Invalid workspace path" };
    }
    if (workspacePath) {
      const resolved = path.resolve(workspacePath);
      currentWorkspacePath = resolved;
      ctx.setWorkspacePath(resolved);
      return { success: true };
    }
    return { success: false, error: "Invalid workspace path" };
  });

  // 打开文件夹对话框
  ipcMain.handle("fs:openFolder", async () => {
    const win = mainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // 读取目录结构
  ipcMain.handle("fs:readDir", async (_event, dirPath: string) => {
    try {
      if (!isPathAllowed(dirPath)) {
        return { success: false, error: "Access denied: path is not in the allowed scope" };
      }
      const items = await fsp.readdir(dirPath, { withFileTypes: true });
      const result = items
        .filter((item) => !item.name.startsWith(".") && item.name !== "node_modules")
        .map((item) => ({
          name: item.name,
          path: path.join(dirPath, item.name),
          type: item.isDirectory() ? "folder" : "file",
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      return { success: true, data: result };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 读取文件内容（支持多编码）
  ipcMain.handle("fs:readFile", async (_event, filePath: string, encoding?: EncodingId) => {
    try {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: "Access denied: path is not in the allowed scope" };
      }
      const result = readFileWithEncoding(filePath, encoding);
      return { success: true, data: result.content, encoding: result.encoding };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 大文件分片读取
  ipcMain.handle(
    "fs:readFileChunk",
    async (_event, filePath: string, startLine: number, endLine: number) => {
      try {
        if (!isPathAllowed(filePath)) {
          return { success: false, error: "Access denied: path is not in the allowed scope" };
        }
        const readline = require("readline");
        const lines: string[] = [];
        const stream = fs.createReadStream(filePath, { encoding: "utf8" });
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let lineNum = 0;
        for await (const line of rl) {
          lineNum++;
          if (lineNum >= startLine && lineNum <= endLine) lines.push(line);
          if (lineNum > endLine) break;
        }
        stream.destroy();
        return { success: true, data: { lines, startLine, endLine, totalRead: lines.length } };
      } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  // 获取文件行数
  ipcMain.handle("fs:getLineCount", async (_event, filePath: string) => {
    try {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: "Access denied: path is not in the allowed scope" };
      }
      const readline = require("readline");
      const stream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      let count = 0;
      for await (const _ of rl) count++;
      stream.destroy();
      return { success: true, data: count };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 写入文件（支持多编码）
  ipcMain.handle(
    "fs:writeFile",
    async (event, filePath: string, content: string, encoding: EncodingId = "utf8") => {
      if (!validateSender(event, ctx)) {
        return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
      }
      try {
        if (!currentWorkspacePath || !isPathAllowed(filePath, currentWorkspacePath)) {
          return { success: false, error: "Access denied: can only write files within workspace" };
        }
        writeFileWithEncoding(filePath, content, encoding);
        mainWindow()?.webContents.send("fs:fileChanged", { filePath, type: "write" });
        return { success: true };
      } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  // 获取支持的编码列表
  ipcMain.handle("fs:getEncodings", async () => {
    return SUPPORTED_ENCODINGS.map((e) => ({ id: e.id, label: e.label }));
  });

  // 检测文件编码
  ipcMain.handle("fs:detectEncoding", async (_event, filePath: string) => {
    try {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: "Access denied: path is not in the allowed scope" };
      }
      const buffer = await fsp.readFile(filePath);
      return { success: true, encoding: detectEncoding(buffer) };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取文件信息
  ipcMain.handle("fs:stat", async (_event, filePath: string) => {
    try {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: "Access denied: path is not in the allowed scope" };
      }
      const fileStat = await fsp.stat(filePath);
      return {
        success: true,
        data: {
          isFile: fileStat.isFile(),
          isDirectory: fileStat.isDirectory(),
          size: fileStat.size,
          mtime: fileStat.mtime.toISOString(),
        },
      };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取工作区所有文件
  ipcMain.handle("fs:getAllFiles", async (_event, workspacePath: string) => {
    try {
      if (!workspacePath || !fs.existsSync(workspacePath)) {
        return { success: false, error: "Invalid workspace path" };
      }
      const files = getAllFilesRecursive(workspacePath, workspacePath);
      return { success: true, data: files };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 搜索文件内容
  ipcMain.handle(
    "fs:searchInFiles",
    async (
      _event,
      {
        workspacePath,
        query,
        maxResults = DEFAULT_MAX_SEARCH_RESULTS,
      }: {
        workspacePath: string;
        query: string;
        maxResults?: number;
      },
    ) => {
      try {
        if (!workspacePath || !query) {
          return { success: false, error: "Invalid parameters" };
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

          const ext = path.extname(file.name).toLowerCase();
          if (!TEXT_FILE_EXTENSIONS.has(ext)) continue;

          try {
            const content = fs.readFileSync(file.path, "utf-8");
            const lines = content.split("\n");

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
                  matchEnd: idx + query.length,
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
      } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  // 创建文件夹
  ipcMain.handle("fs:createFolder", async (event, folderPath: string) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    try {
      if (!currentWorkspacePath || !isPathAllowed(folderPath, currentWorkspacePath)) {
        return { success: false, error: "Access denied: can only create folders within workspace" };
      }
      try {
        await fsp.access(folderPath);
        return { success: false, error: "Folder already exists" };
      } catch {
        /* 不存在则继续 */
      }
      await fsp.mkdir(folderPath, { recursive: true });
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 创建文件
  ipcMain.handle("fs:createFile", async (event, filePath: string, content: string = "") => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    try {
      if (!currentWorkspacePath || !isPathAllowed(filePath, currentWorkspacePath)) {
        return { success: false, error: "Access denied: can only create files within workspace" };
      }
      try {
        await fsp.access(filePath);
        return { success: false, error: "File already exists" };
      } catch {
        /* 不存在则继续 */
      }
      const dir = path.dirname(filePath);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(filePath, content, "utf-8");
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 删除文件或文件夹
  ipcMain.handle("fs:delete", async (event, targetPath: string) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    try {
      if (!currentWorkspacePath || !isPathAllowed(targetPath, currentWorkspacePath)) {
        return { success: false, error: "Access denied: can only delete files within workspace" };
      }
      try {
        await fsp.access(targetPath);
      } catch {
        return { success: false, error: "Target does not exist" };
      }
      const targetStat = await fsp.stat(targetPath);
      if (targetStat.isDirectory()) {
        await fsp.rm(targetPath, { recursive: true, force: true });
      } else {
        await fsp.unlink(targetPath);
      }
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 重命名文件或文件夹
  ipcMain.handle("fs:rename", async (event, oldPath: string, newPath: string) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    try {
      if (
        !currentWorkspacePath ||
        !isPathAllowed(oldPath, currentWorkspacePath) ||
        !isPathAllowed(newPath, currentWorkspacePath)
      ) {
        return { success: false, error: "Access denied: can only rename within workspace" };
      }
      try {
        await fsp.access(oldPath);
      } catch {
        return { success: false, error: "Source does not exist" };
      }
      try {
        await fsp.access(newPath);
        return { success: false, error: "Target name already exists" };
      } catch {
        /* 不存在则继续 */
      }
      await fsp.rename(oldPath, newPath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 复制文件或文件夹
  ipcMain.handle("fs:copy", async (event, srcPath: string, destPath: string) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    try {
      if (
        !currentWorkspacePath ||
        !isPathAllowed(srcPath, currentWorkspacePath) ||
        !isPathAllowed(destPath, currentWorkspacePath)
      ) {
        return { success: false, error: "Access denied: can only copy within workspace" };
      }
      try {
        await fsp.access(srcPath);
      } catch {
        return { success: false, error: "Source does not exist" };
      }
      const srcStat = await fsp.stat(srcPath);
      if (srcStat.isDirectory()) {
        await fsp.cp(srcPath, destPath, { recursive: true });
      } else {
        await fsp.copyFile(srcPath, destPath);
      }
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 检查路径是否存在
  ipcMain.handle("fs:exists", async (_event, targetPath: string) => {
    try {
      if (!isPathAllowed(targetPath)) {
        return { success: false, error: "Access denied: path is not in the allowed scope" };
      }
      try {
        await fsp.access(targetPath);
        return { success: true, data: true };
      } catch {
        return { success: true, data: false };
      }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });
}
