/**
 * Composer - 多文件重构引擎
 * 类似 Cursor Composer，支持项目级别的代码修改
 */

import type { Checkpoint, TaskStatus } from "./types";
import type { TaskPlanner } from "./planner";
import { createPlanner } from "./planner";
import type { CheckpointManager } from "./checkpointManager";
import { getCheckpointManager } from "./checkpointManager";

// ============ 类型定义 ============

export interface FileEdit {
  path: string;
  oldContent: string;
  newContent: string;
  description: string;
}
export interface ComposerPlan {
  id: string;
  title: string;
  goal: string;
  edits: FileEdit[];
  status: TaskStatus;
  checkpoint?: Checkpoint;
  createdAt: number;
}
export interface ComposerConfig {
  model: string;
  maxFiles: number;
  autoCheckpoint: boolean;
  validateBeforeApply: boolean;
}

const DEFAULT_CONFIG: ComposerConfig = {
  model: "claude-sonnet-4-5",
  maxFiles: 20,
  autoCheckpoint: true,
  validateBeforeApply: true,
};

// ============ Composer 引擎 ============

export class Composer {
  private config: ComposerConfig;
  private planner: TaskPlanner;
  private checkpointManager: CheckpointManager;
  private currentPlan: ComposerPlan | null = null;
  private onProgress?: (progress: { step: string; current: number; total: number }) => void;

  constructor(config: Partial<ComposerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.planner = createPlanner({ model: this.config.model });
    this.checkpointManager = getCheckpointManager();
  }

  /** 设置进度回调 */
  setProgressCallback(
    callback: (progress: { step: string; current: number; total: number }) => void,
  ): void {
    this.onProgress = callback;
  }

  /** 分析需求并生成重构计划 */
  async analyze(
    request: string,
    context?: {
      workspacePath?: string;
      files?: string[];
      relatedCode?: Array<{ filePath: string; code: string }>;
    },
  ): Promise<ComposerPlan> {
    this.reportProgress("分析需求", 0, 3);
    const plan: ComposerPlan = {
      id: `composer-${Date.now()}`,
      title: "",
      goal: request,
      edits: [],
      status: "analyzing",
      createdAt: Date.now(),
    };

    // 使用 AI 分析并生成计划
    if (window.mindcode?.ai?.chat) {
      try {
        const prompt = this.buildAnalysisPrompt(request, context);
        const result = await window.mindcode.ai.chat(this.config.model, [
          { role: "system", content: this.getSystemPrompt() },
          { role: "user", content: prompt },
        ]);
        this.reportProgress("解析计划", 1, 3);
        if (result.success && result.data) {
          const parsed = this.parseAIPlan(result.data);
          plan.title = parsed.title || "重构计划";
          plan.edits = parsed.edits || [];
        }
      } catch (err) {
        console.error("[Composer] AI 分析失败:", err);
      }
    }

    this.reportProgress("计划完成", 2, 3);
    plan.status = "pending";
    this.currentPlan = plan;
    return plan;
  }

  /** 执行重构计划 */
  async execute(
    plan?: ComposerPlan,
  ): Promise<{ success: boolean; applied: number; errors: string[] }> {
    const target = plan || this.currentPlan;
    if (!target || target.edits.length === 0)
      return { success: false, applied: 0, errors: ["无有效计划"] };

    const errors: string[] = [];
    let applied = 0;

    // 创建检查点（自动备份）
    if (this.config.autoCheckpoint) {
      const filePaths = target.edits.map((e) => e.path);
      target.checkpoint = await this.checkpointManager.create(target.id, "file", filePaths);
      this.reportProgress("创建检查点", 0, target.edits.length + 1);
    }

    target.status = "executing";

    // 逐个应用编辑
    for (let i = 0; i < target.edits.length; i++) {
      const edit = target.edits[i];
      this.reportProgress(`修改 ${edit.path}`, i + 1, target.edits.length + 1);
      try {
        if (window.mindcode?.fs?.writeFile) {
          const result = await window.mindcode.fs.writeFile(edit.path, edit.newContent);
          if (result.success) {
            applied++;
          } else {
            errors.push(`${edit.path}: ${result.error || "写入失败"}`);
          }
        }
      } catch (err: unknown) {
        errors.push(`${edit.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    target.status = errors.length === 0 ? "completed" : "failed";
    return { success: errors.length === 0, applied, errors };
  }

  /** 回滚到检查点 */
  async rollback(plan?: ComposerPlan): Promise<boolean> {
    const target = plan || this.currentPlan;
    if (!target?.checkpoint) {
      console.error("[Composer] 无可用检查点");
      return false;
    }
    const success = await this.checkpointManager.restore(target.checkpoint.id);
    if (success) {
      target.status = "cancelled";
    }
    return success;
  }

  /** 预览变更（Diff） */
  getPreview(): FileEdit[] {
    return this.currentPlan?.edits || [];
  }

  /** 获取当前计划 */
  getCurrentPlan(): ComposerPlan | null {
    return this.currentPlan;
  }

  /** 清除当前计划 */
  clear(): void {
    this.currentPlan = null;
  }

  // ============ 私有方法 ============

  private getSystemPrompt(): string {
    return `你是 Composer 重构引擎。分析用户需求，生成多文件修改计划。

输出严格 JSON：
{
  "title": "重构标题",
  "edits": [
    {"path": "文件路径", "description": "修改描述", "newContent": "完整的新文件内容"}
  ]
}

规则：
1. newContent 必须是完整的文件内容（不是 diff）
2. 保持代码风格一致
3. 每个文件的修改独立完整
4. 不要胡编 API，不确定就保守
5. 疑似密钥用占位符`;
  }

  private buildAnalysisPrompt(
    request: string,
    context?: {
      workspacePath?: string;
      files?: string[];
      relatedCode?: Array<{ filePath: string; code: string }>;
    },
  ): string {
    const parts: string[] = [`# 需求\n${request}`];
    if (context?.workspacePath) parts.push(`\n# 工作区: ${context.workspacePath}`);
    if (context?.relatedCode) {
      parts.push("\n# 相关文件");
      for (const { filePath, code } of context.relatedCode.slice(0, this.config.maxFiles)) {
        parts.push(`\n## ${filePath}\n\`\`\`\n${code}\n\`\`\``);
      }
    }
    parts.push("\n请生成修改计划（JSON）。");
    return parts.join("\n");
  }

  private parseAIPlan(response: string): { title: string; edits: FileEdit[] } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || "重构计划",
          edits: (parsed.edits || []).map((e: Record<string, unknown>) => ({
            path: (e.path as string) || "",
            oldContent: "",
            newContent: (e.newContent as string) || "",
            description: (e.description as string) || "",
          })),
        };
      }
    } catch (err) {
      console.error("[Composer] 解析失败:", err);
    }
    return { title: "重构计划", edits: [] };
  }

  private reportProgress(step: string, current: number, total: number): void {
    this.onProgress?.({ step, current, total });
    console.log(`[Composer] ${step} (${current}/${total})`);
  }
}

// ============ 工厂函数 ============

export function createComposer(config?: Partial<ComposerConfig>): Composer {
  return new Composer(config);
}

let _composerInstance: Composer | null = null;
export function getComposer(): Composer {
  if (!_composerInstance) _composerInstance = new Composer();
  return _composerInstance;
}
