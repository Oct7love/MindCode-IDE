/**
 * Bug修复模块
 * 集中处理已知bug的修复
 */

import * as monaco from "monaco-editor";

/**
 * 修复Tab切换焦点问题
 * 确保切换Tab后编辑器获得焦点
 */
export function fixTabSwitchFocus(editor: monaco.editor.IStandaloneCodeEditor | null) {
  if (!editor) return;

  // 延迟聚焦,确保DOM更新完成
  requestAnimationFrame(() => {
    try {
      editor.focus();
    } catch (error) {
      console.warn("[BugFix] 编辑器聚焦失败:", error);
    }
  });
}

/**
 * Agent死循环检测
 * 检测Agent是否陷入重复模式
 */
export class AgentLoopDetector {
  private actionHistory: Array<{ action: string; timestamp: number }> = [];
  private maxHistorySize = 20;
  private loopThreshold = 5; // 连续5次相同操作视为死循环

  recordAction(action: string) {
    this.actionHistory.push({
      action,
      timestamp: Date.now(),
    });

    // 保持历史记录在限制内
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }
  }

  detectLoop(): boolean {
    if (this.actionHistory.length < this.loopThreshold) {
      return false;
    }

    // 检查最近N次操作是否相同
    const recent = this.actionHistory.slice(-this.loopThreshold);
    const firstAction = recent[0].action;
    const allSame = recent.every((item) => item.action === firstAction);

    if (allSame) {
      console.warn("[BugFix] 检测到Agent死循环:", firstAction);
      return true;
    }

    // 检查是否在两个操作之间来回切换
    const pattern = recent.map((item) => item.action).join(",");
    const repeatingPattern = /^(.+?),\1,\1/.test(pattern);

    if (repeatingPattern) {
      console.warn("[BugFix] 检测到Agent重复模式:", pattern);
      return true;
    }

    return false;
  }

  reset() {
    this.actionHistory = [];
  }

  getHistory() {
    return [...this.actionHistory];
  }
}

/**
 * 工具调用超时处理
 * 为工具调用添加超时保护
 */
export async function callToolWithTimeout<T>(
  toolFn: () => Promise<T>,
  timeoutMs = 30000,
  toolName = "unknown",
): Promise<{ success: boolean; data?: T; error?: string; timedOut?: boolean }> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`工具调用超时: ${toolName} (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([toolFn(), timeoutPromise]);

    clearTimeout(timeoutId!);
    return { success: true, data: result };
  } catch (error: any) {
    clearTimeout(timeoutId!);

    const isTimeout = error.message?.includes("超时");
    console.error(`[BugFix] 工具调用失败: ${toolName}`, error);

    return {
      success: false,
      error: error.message || "工具调用失败",
      timedOut: isTimeout,
    };
  }
}

/**
 * 补全触发优化
 * 智能判断是否应该触发补全
 */
export class CompletionTriggerOptimizer {
  private lastTriggerTime = 0;
  private minInterval = 50; // 最小触发间隔(ms)
  private triggerChars = new Set([".", "(", "[", "{", ":", ">", " ", ",", "="]);

  /**
   * 判断是否应该触发补全
   */
  shouldTrigger(text: string, cursorPosition: number, lastChar: string): boolean {
    const now = Date.now();

    // 防抖: 太频繁不触发
    if (now - this.lastTriggerTime < this.minInterval) {
      return false;
    }

    // 触发字符立即触发
    if (this.triggerChars.has(lastChar)) {
      this.lastTriggerTime = now;
      return true;
    }

    // 获取当前行内容
    const lines = text.substring(0, cursorPosition).split("\n");
    const currentLine = lines[lines.length - 1] || "";

    // 空行不触发
    if (currentLine.trim().length === 0) {
      return false;
    }

    // 注释不触发
    if (
      currentLine.trim().startsWith("//") ||
      currentLine.trim().startsWith("/*") ||
      currentLine.trim().startsWith("#")
    ) {
      return false;
    }

    // 字符串中不触发(除非在路径)
    const inString = this.isInString(currentLine, currentLine.length);
    if (inString && !currentLine.includes("/")) {
      return false;
    }

    // 已经输入了至少2个字符才触发
    const wordMatch = currentLine.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    if (wordMatch && wordMatch[0].length >= 2) {
      this.lastTriggerTime = now;
      return true;
    }

    return false;
  }

  /**
   * 检查是否在字符串中
   */
  private isInString(line: string, position: number): boolean {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;

    for (let i = 0; i < position; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : "";

      // 跳过转义字符
      if (prevChar === "\\") continue;

      if (char === '"' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
      } else if (char === "`" && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
      }
    }

    return inSingleQuote || inDoubleQuote || inBacktick;
  }

  /**
   * 重置状态
   */
  reset() {
    this.lastTriggerTime = 0;
  }
}

/**
 * 内存泄漏修复
 * 清理Monaco Editor的Model缓存
 */
export function cleanupMonacoModels() {
  const models = monaco.editor.getModels();
  console.log(`[BugFix] 当前Monaco Models: ${models.length}`);

  // 如果超过100个model,清理不再使用的
  if (models.length > 100) {
    console.warn("[BugFix] Monaco Models过多,开始清理...");

    let cleaned = 0;
    models.forEach((model, index) => {
      // 保留最近的50个model
      if (index < models.length - 50) {
        model.dispose();
        cleaned++;
      }
    });

    console.log(`[BugFix] 已清理 ${cleaned} 个Monaco Models`);
  }
}

/**
 * 定期清理任务（防重复启动，提供 stop 方法）
 */
let _cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export function startPeriodicCleanup() {
  if (_cleanupIntervalId) return; // 防重复
  _cleanupIntervalId = setInterval(
    () => {
      cleanupMonacoModels();
    },
    5 * 60 * 1000,
  );
  console.log("[BugFix] 定期清理任务已启动");
}

export function stopPeriodicCleanup() {
  if (_cleanupIntervalId) {
    clearInterval(_cleanupIntervalId);
    _cleanupIntervalId = null;
  }
}

// 导出单例
export const agentLoopDetector = new AgentLoopDetector();
export const completionTriggerOptimizer = new CompletionTriggerOptimizer();
