/**
 * 调试适配器注册表
 * 管理不同语言的调试适配器启动方式和配置
 */
import { execFileSync } from "child_process";

export interface AdapterConfig {
  /** 适配器命令 */
  command: string;
  /** 命令参数 */
  args: string[];
  /** 启动类型的 launch 参数模板 */
  launchArgs: (config: LaunchParams) => Record<string, unknown>;
  /** 附加类型的 attach 参数模板 */
  attachArgs?: (config: AttachParams) => Record<string, unknown>;
  /** 是否可用的检测命令 */
  detectCommand: string;
  /** 安装提示 */
  installHint: string;
}

export interface LaunchParams {
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
}

export interface AttachParams {
  port?: number;
  host?: string;
  processId?: number;
}

/** 内置适配器配置 */
const builtinAdapters: Record<string, AdapterConfig> = {
  python: {
    command: "python",
    args: ["-m", "debugpy.adapter"],
    launchArgs: (cfg) => ({
      type: "python",
      request: "launch",
      program: cfg.program,
      args: cfg.args || [],
      cwd: cfg.cwd || ".",
      env: cfg.env || {},
      stopOnEntry: cfg.stopOnEntry ?? false,
      console: "integratedTerminal",
      justMyCode: true,
    }),
    attachArgs: (cfg) => ({
      type: "python",
      request: "attach",
      connect: { host: cfg.host || "127.0.0.1", port: cfg.port || 5678 },
    }),
    detectCommand: "python -m debugpy --version",
    installHint: "pip install debugpy",
  },

  go: {
    command: "dlv",
    args: ["dap"],
    launchArgs: (cfg) => ({
      type: "go",
      request: "launch",
      mode: "debug",
      program: cfg.program,
      args: cfg.args || [],
      cwd: cfg.cwd || ".",
      env: cfg.env || {},
      stopOnEntry: cfg.stopOnEntry ?? false,
    }),
    attachArgs: (cfg) => ({
      type: "go",
      request: "attach",
      mode: "remote",
      host: cfg.host || "127.0.0.1",
      port: cfg.port || 2345,
    }),
    detectCommand: "dlv version",
    installHint: "go install github.com/go-delve/delve/cmd/dlv@latest",
  },

  node: {
    command: "node",
    args: ["--inspect-brk=0"],
    launchArgs: (cfg) => ({
      type: "node",
      request: "launch",
      program: cfg.program,
      args: cfg.args || [],
      cwd: cfg.cwd || ".",
      env: cfg.env || {},
      stopOnEntry: cfg.stopOnEntry ?? true,
      console: "integratedTerminal",
    }),
    attachArgs: (cfg) => ({
      type: "node",
      request: "attach",
      port: cfg.port || 9229,
      host: cfg.host || "127.0.0.1",
    }),
    detectCommand: "node --version",
    installHint: "请安装 Node.js: https://nodejs.org/",
  },

  rust: {
    command: "lldb-vscode",
    args: [],
    launchArgs: (cfg) => ({
      type: "lldb",
      request: "launch",
      program: cfg.program,
      args: cfg.args || [],
      cwd: cfg.cwd || ".",
      env: cfg.env || {},
      stopOnEntry: cfg.stopOnEntry ?? false,
    }),
    detectCommand: "lldb-vscode --version",
    installHint: "请安装 LLDB (通过 LLVM 或 Xcode Command Line Tools)",
  },
};

/** 用户自定义适配器 */
const customAdapters = new Map<string, AdapterConfig>();

/** 获取适配器配置 */
export function getAdapter(language: string): AdapterConfig | null {
  return customAdapters.get(language) || builtinAdapters[language] || null;
}

/** 允许的适配器命令白名单（可执行文件名） */
const ALLOWED_ADAPTER_COMMANDS = new Set([
  "python",
  "python3",
  "node",
  "dlv",
  "lldb-vscode",
  "lldb-dap",
  "codelldb",
  "java",
  "dotnet",
  "gdb",
  "cppdbg",
]);

/** 验证适配器命令是否安全 */
function isAdapterCommandAllowed(command: string): boolean {
  // 提取基础命令名（去掉路径）
  const baseName = command.replace(/\\/g, "/").split("/").pop() || "";
  // 去掉 .exe 后缀
  const normalized = baseName.replace(/\.exe$/i, "");
  return ALLOWED_ADAPTER_COMMANDS.has(normalized);
}

/** 注册自定义适配器 */
export function registerAdapter(language: string, config: AdapterConfig): void {
  // 验证语言名称格式
  if (!/^[a-zA-Z0-9_-]+$/.test(language)) {
    throw new Error(`无效的语言标识: ${language}`);
  }
  // 验证命令是否在白名单中
  if (!isAdapterCommandAllowed(config.command)) {
    throw new Error(`不允许的适配器命令: ${config.command}`);
  }
  customAdapters.set(language, config);
}

/** 获取所有支持的语言 */
export function getSupportedLanguages(): string[] {
  const languages = new Set([...Object.keys(builtinAdapters), ...customAdapters.keys()]);
  return Array.from(languages);
}

/** 检测适配器是否可用 */
export function detectAdapter(language: string): { available: boolean; error?: string } {
  const adapter = getAdapter(language);
  if (!adapter) return { available: false, error: `不支持的语言: ${language}` };

  try {
    // 使用 execFileSync 避免 shell 注入，将 detectCommand 拆分为命令和参数
    const parts = adapter.detectCommand.split(/\s+/);
    const cmd = parts[0];
    const cmdArgs = parts.slice(1);
    execFileSync(cmd, cmdArgs, { timeout: 5000, stdio: "pipe" });
    return { available: true };
  } catch {
    return { available: false, error: adapter.installHint };
  }
}
