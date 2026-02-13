/**
 * Git IPC Handlers
 *
 * 处理 Git 状态查询、暂存、提交、分支管理等操作。
 * 使用 spawn 直接执行 git 命令，避免 shell 注入。
 */
import { ipcMain } from "electron";
import { spawn } from "child_process";
import type { IPCContext } from "./types";

/** Git 命令超时时间（ms） */
const GIT_COMMAND_TIMEOUT_MS = 30000;

/**
 * 执行 Git 命令的辅助函数 - 使用 spawn 避免 shell 注入
 */
async function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, {
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      timeout: GIT_COMMAND_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`git exited with code ${code}: ${stderr}`);
        (error as Error & { stdout: string; stderr: string }).stdout = stdout;
        (error as Error & { stdout: string; stderr: string }).stderr = stderr;
        reject(error);
      }
    });
  });
}

export function registerGitHandlers(_ctx: IPCContext): void {
  ipcMain.handle("git:isRepo", async (_event, workspacePath: string) => {
    try {
      await execGit(["rev-parse", "--git-dir"], workspacePath);
      return { success: true, data: true };
    } catch {
      return { success: true, data: false };
    }
  });

  ipcMain.handle("git:status", async (_event, workspacePath: string) => {
    try {
      const { stdout } = await execGit(["status", "--porcelain", "-u"], workspacePath);
      const files = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          let state: "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted" =
            "modified";
          if (status.includes("?")) state = "untracked";
          else if (status.includes("A")) state = "added";
          else if (status.includes("D")) state = "deleted";
          else if (status.includes("R")) state = "renamed";
          else if (status.includes("U")) state = "conflicted";
          else if (status.includes("M")) state = "modified";
          return { path: filePath, status: state, staged: status[0] !== " " && status[0] !== "?" };
        });
      return { success: true, data: files };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:currentBranch", async (_event, workspacePath: string) => {
    try {
      const { stdout } = await execGit(["branch", "--show-current"], workspacePath);
      return { success: true, data: stdout.trim() };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:branches", async (_event, workspacePath: string) => {
    try {
      const { stdout } = await execGit(["branch", "-a"], workspacePath);
      const branches = stdout
        .trim()
        .split("\n")
        .map((b) => {
          const isCurrent = b.startsWith("*");
          const name = b.replace(/^\*?\s+/, "").trim();
          return { name, current: isCurrent };
        });
      return { success: true, data: branches };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:stage", async (_event, workspacePath: string, filePaths: string[]) => {
    try {
      await execGit(["add", ...filePaths], workspacePath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:unstage", async (_event, workspacePath: string, filePaths: string[]) => {
    try {
      await execGit(["reset", "HEAD", ...filePaths], workspacePath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:commit", async (_event, workspacePath: string, message: string) => {
    try {
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return { success: false, error: "Commit message cannot be empty" };
      }
      await execGit(["commit", "-m", message], workspacePath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    "git:diff",
    async (_event, workspacePath: string, filePath: string, staged: boolean) => {
      try {
        const args = staged ? ["diff", "--cached", filePath] : ["diff", filePath];
        const { stdout } = await execGit(args, workspacePath);
        return { success: true, data: stdout };
      } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle("git:checkout", async (_event, workspacePath: string, branchName: string) => {
    try {
      await execGit(["checkout", branchName], workspacePath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:createBranch", async (_event, workspacePath: string, branchName: string) => {
    try {
      await execGit(["checkout", "-b", branchName], workspacePath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:log", async (_event, workspacePath: string, limit: number = 50) => {
    try {
      const { stdout } = await execGit(
        ["log", `--max-count=${limit}`, "--pretty=format:%H|%h|%an|%ae|%at|%s"],
        workspacePath,
      );
      const commits = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, shortHash, author, email, timestamp, message] = line.split("|");
          return {
            hash,
            shortHash,
            author,
            email,
            date: new Date(parseInt(timestamp) * 1000).toISOString(),
            message,
          };
        });
      return { success: true, data: commits };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("git:discard", async (_event, workspacePath: string, filePath: string) => {
    try {
      await execGit(["checkout", "--", filePath], workspacePath);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });
}
