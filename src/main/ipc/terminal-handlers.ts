/**
 * Terminal IPC Handlers
 *
 * 基于 node-pty 的真实 PTY 会话管理器
 * 包含命令安全验证（白名单 + 黑名单 + Shell 元字符过滤）用于回退模式
 */
import { ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { type IPCContext, validateSender } from "./types";
import { logger } from "../../core/logger";

const log = logger.child("Terminal");

// node-pty 动态导入（原生模块可能不可用）
let pty: typeof import("node-pty") | null = null;
try {
  pty = require("node-pty");
  log.info("node-pty 已加载");
} catch (err) {
  log.warn("node-pty 不可用，回退到 exec 模式", err);
}

/** PTY 会话接口 */
interface PtySession {
  id: string;
  pty: import("node-pty").IPty | null;
  cwd: string;
}

/** 会话存储 */
const sessions = new Map<string, PtySession>();

/** 命令执行超时（ms） */
const COMMAND_TIMEOUT_MS = 60000;

/** PTY 环境变量白名单（仅传递安全变量，阻止 API Key 泄露） */
const SAFE_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "USERPROFILE",
  "USER",
  "USERNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TERM_PROGRAM",
  "COLORTERM",
  "EDITOR",
  "VISUAL",
  "TMPDIR",
  "TEMP",
  "TMP",
  "HOMEDRIVE",
  "HOMEPATH",
  "SystemRoot",
  "SYSTEMROOT",
  "ComSpec",
  "COMSPEC",
  "windir",
  "WINDIR",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "PWD",
  "OLDPWD",
  "SHLVL",
  "LOGNAME",
  "XDG_RUNTIME_DIR",
  "XDG_DATA_HOME",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "SSH_AUTH_SOCK",
  "GPG_AGENT_INFO",
  "GOPATH",
  "GOROOT",
  "CARGO_HOME",
  "RUSTUP_HOME",
  "NVM_DIR",
  "JAVA_HOME",
  "DOTNET_ROOT",
  "VIRTUAL_ENV",
  "CONDA_PREFIX",
  "PYENV_ROOT",
]);

/** 过滤环境变量，仅保留白名单中的安全变量 */
function getSafeEnv(): Record<string, string> {
  const safeEnv: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    if (SAFE_ENV_KEYS.has(key)) {
      const val = process.env[key];
      if (val !== undefined) safeEnv[key] = val;
    }
  }
  return safeEnv;
}

/** Shell 元字符黑名单（防止命令注入） */
const SHELL_METACHAR_PATTERN = /[;&|`$()<>!{}\\"\n\r]/;

/** 安全的命令白名单（仅用于 spawn 回退模式） */
const ALLOWED_COMMAND_PREFIXES = [
  "npm",
  "npx",
  "node",
  "yarn",
  "pnpm",
  "git",
  "python",
  "python3",
  "pip",
  "pip3",
  "cargo",
  "rustc",
  "go",
  "java",
  "javac",
  "mvn",
  "gradle",
  "dotnet",
  "make",
  "cmake",
  "ls",
  "dir",
  "cd",
  "pwd",
  "echo",
  "cat",
  "type",
  "mkdir",
  "tsc",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "mocha",
  "docker",
  "docker-compose",
  "code",
  "cursor",
];

/** 危险命令黑名单（仅用于 exec 回退模式） */
const DANGEROUS_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "del /f /s /q c:\\",
  "format",
  "fdisk",
  "mkfs",
  ":(){:|:&};:", // fork bomb
  "dd if=/dev/zero",
  "dd if=/dev/random",
  "> /dev/sda",
  "> /dev/hda",
  "chmod -R 777 /",
  "chmod -R 000 /",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "wget -O- | sh",
  "curl | sh",
  "curl | bash",
];

/**
 * 验证命令安全性（仅用于 spawn 回退模式）
 *
 * 三层防护：
 * 1. Shell 元字符检测（阻止注入）
 * 2. 危险命令黑名单
 * 3. 命令前缀白名单
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmedCmd = command.trim();

  // 第一层：Shell 元字符检测
  if (SHELL_METACHAR_PATTERN.test(trimmedCmd)) {
    return { safe: false, reason: "Shell metacharacters are not allowed in commands" };
  }

  const lowerCmd = trimmedCmd.toLowerCase();

  // 第二层：危险命令黑名单
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (lowerCmd.includes(dangerous.toLowerCase())) {
      return { safe: false, reason: `Dangerous command blocked: ${dangerous}` };
    }
  }

  // 第三层：命令前缀白名单
  const cmdParts = trimmedCmd.split(/\s+/);
  const cmdName = cmdParts[0]
    .replace(/^\.\//, "")
    .replace(/\.exe$/i, "")
    .toLowerCase();

  const isAllowed = ALLOWED_COMMAND_PREFIXES.some(
    (prefix) =>
      cmdName === prefix || cmdName.endsWith("/" + prefix) || cmdName.endsWith("\\" + prefix),
  );

  if (!isAllowed) {
    return { safe: false, reason: `Command not in whitelist: ${cmdName}` };
  }

  return { safe: true };
}

/**
 * 将命令字符串解析为可执行文件和参数数组（用于 spawn）
 */
function parseCommand(command: string): { cmd: string; args: string[] } {
  const parts = command.trim().split(/\s+/);
  return { cmd: parts[0], args: parts.slice(1) };
}

/**
 * 获取默认 Shell
 */
function getDefaultShell(): string {
  if (process.platform === "win32") {
    return "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

export function registerTerminalHandlers(ctx: IPCContext): void {
  // 创建 PTY 会话
  ipcMain.handle("terminal:create", async (event, options?: { cwd?: string }) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    // Workspace Trust：必须先打开工作区才能创建终端
    if (!ctx.getWorkspacePath()) {
      return { success: false, error: "请先打开工作区后再使用终端", errorCode: "ERR_NO_WORKSPACE" };
    }
    try {
      if (!pty) {
        return { success: false, error: "node-pty 不可用，请使用 terminal:execute 回退模式" };
      }

      const id = `pty-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const cwd = options?.cwd || process.cwd();
      const shell = getDefaultShell();

      // 验证工作目录
      if (!fs.existsSync(cwd)) {
        return { success: false, error: `工作目录不存在: ${cwd}` };
      }

      // 创建 PTY 实例（仅传递安全环境变量）
      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 30,
        cwd,
        env: getSafeEnv(),
      });

      // 存储会话
      sessions.set(id, { id, pty: ptyProcess, cwd });

      // 监听 PTY 输出
      ptyProcess.onData((data) => {
        const mainWindow = ctx.getMainWindow();
        mainWindow?.webContents.send("terminal:data", { id, data });
      });

      // 监听 PTY 退出
      ptyProcess.onExit(({ exitCode }) => {
        const mainWindow = ctx.getMainWindow();
        mainWindow?.webContents.send("terminal:exit", { id, exitCode });
        sessions.delete(id);
      });

      log.info(`PTY 会话已创建: ${id}`, { shell, cwd });
      return { success: true, id };
    } catch (error: unknown) {
      log.error("PTY 创建失败", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 写入数据到 PTY
  ipcMain.handle("terminal:write", async (_event, id: string, data: string) => {
    try {
      const session = sessions.get(id);
      if (!session || !session.pty) {
        return { success: false, error: `会话不存在: ${id}` };
      }

      session.pty.write(data);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 调整 PTY 大小
  ipcMain.handle("terminal:resize", async (_event, id: string, cols: number, rows: number) => {
    try {
      const session = sessions.get(id);
      if (!session || !session.pty) {
        return { success: false, error: `会话不存在: ${id}` };
      }

      session.pty.resize(cols, rows);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 关闭 PTY 会话
  ipcMain.handle("terminal:close", async (_event, id: string) => {
    try {
      const session = sessions.get(id);
      if (!session) {
        return { success: false, error: `会话不存在: ${id}` };
      }

      if (session.pty) {
        session.pty.kill();
      }
      sessions.delete(id);
      log.info(`PTY 会话已关闭: ${id}`);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ========== 以下是原有的回退模式（node-pty 不可用时使用） ==========

  // 执行命令（带安全检查，使用 spawn + shell:false 防注入）
  ipcMain.handle("terminal:execute", async (event, command: string, cwd?: string) => {
    if (!validateSender(event, ctx)) {
      return { success: false, error: "Unauthorized sender", errorCode: "ERR_UNAUTHORIZED" };
    }
    // Workspace Trust：必须先打开工作区
    if (!ctx.getWorkspacePath()) {
      return { success: false, error: "请先打开工作区后再执行命令", errorCode: "ERR_NO_WORKSPACE" };
    }
    try {
      const safetyCheck = isCommandSafe(command);
      if (!safetyCheck.safe) {
        return {
          success: false,
          error: safetyCheck.reason,
          data: { stdout: "", stderr: safetyCheck.reason || "Command blocked" },
        };
      }

      const { cmd, args } = parseCommand(command);
      const spawnCwd = cwd && fs.existsSync(cwd) ? cwd : undefined;

      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(cmd, args, {
          cwd: spawnCwd,
          env: getSafeEnv(),
          shell: false,
          timeout: COMMAND_TIMEOUT_MS,
          windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
          if (stdout.length > 10 * 1024 * 1024) {
            child.kill();
            reject(new Error("Output exceeded 10MB limit"));
          }
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
          if (stderr.length > 10 * 1024 * 1024) {
            child.kill();
            reject(new Error("Stderr exceeded 10MB limit"));
          }
        });

        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
          if (code === 0) resolve({ stdout, stderr });
          else
            reject(
              Object.assign(new Error(`Process exited with code ${code}`), { stdout, stderr }),
            );
        });
      });

      return { success: true, data: result };
    } catch (error: unknown) {
      const err = error as Error & { stdout?: string; stderr?: string };
      return {
        success: false,
        error: err.message,
        data: { stdout: err.stdout || "", stderr: err.stderr || err.message },
      };
    }
  });

  // 切换目录
  ipcMain.handle("terminal:cd", async (_event, currentDir: string, newDir: string) => {
    try {
      let targetPath: string;

      if (path.isAbsolute(newDir)) {
        targetPath = newDir;
      } else if (newDir === "~" || newDir === "%USERPROFILE%") {
        targetPath = process.env.HOME || process.env.USERPROFILE || "";
      } else if (newDir === "-") {
        targetPath = currentDir;
      } else {
        targetPath = path.resolve(currentDir, newDir);
      }

      if (!fs.existsSync(targetPath)) {
        return { success: false, error: `Directory not found: ${newDir}` };
      }

      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        return { success: false, error: `Not a directory: ${newDir}` };
      }

      return { success: true, data: targetPath };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取当前工作目录
  ipcMain.handle("terminal:pwd", async () => {
    return { success: true, data: process.cwd() };
  });
}
