/**
 * Agent 任务规划器
 * 负责分析用户需求，生成分步执行计划
 */

import type { TaskPlan, SubTask, TaskType, TaskPriority, TaskStatus } from "./types";

/** 规划器配置 */
export interface PlannerConfig {
  /** 最大子任务数 */
  maxSubtasks: number;
  /** 是否自动检测依赖 */
  autoDetectDependencies: boolean;
  /** AI 模型 */
  model: string;
  /** 最大 Token 限制 */
  maxTokens: number;
}

const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxSubtasks: 20,
  autoDetectDependencies: true,
  model: "claude-sonnet-4-5",
  maxTokens: 100000,
};

/**
 * 任务规划器
 */
export class TaskPlanner {
  private config: PlannerConfig;

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
  }

  /**
   * 分析用户请求，生成执行计划
   */
  async plan(
    userRequest: string,
    context?: {
      workspacePath?: string;
      currentFile?: string;
      selectedCode?: string;
      projectRules?: string;
      relatedCode?: Array<{ filePath: string; code: string }>;
    },
  ): Promise<TaskPlan> {
    // 构建提示词
    const prompt = this.buildPlanningPrompt(userRequest, context);

    // 调用 AI 生成计划
    let planData: Record<string, unknown> | null = null;

    if (window.mindcode?.ai?.chat) {
      try {
        const result = await window.mindcode.ai.chat(this.config.model, [
          {
            role: "system",
            content: this.getSystemPrompt(),
          },
          {
            role: "user",
            content: prompt,
          },
        ]);

        if (result.success && result.data) {
          // 提取 JSON
          const jsonMatch = result.data.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            planData = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (err) {
        console.error("[TaskPlanner] AI 规划失败:", err);
      }
    }

    // 如果 AI 失败，使用简单规划
    if (!planData) {
      planData = this.generateSimplePlan(userRequest);
    }

    // 构建计划对象
    const plan = this.buildPlan(planData, userRequest);

    // 检测依赖关系
    if (this.config.autoDetectDependencies) {
      this.detectDependencies(plan);
    }

    // 估算资源
    this.estimateResources(plan);

    return plan;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一个智能任务规划器。根据用户需求，分解成可执行的子任务。

输出 JSON 格式：
{
  "name": "任务名称",
  "description": "任务描述",
  "subtasks": [
    {
      "name": "子任务名称",
      "description": "子任务描述",
      "type": "code_generation|code_modification|bug_fix|refactoring|testing|file_operation|terminal_command|search|analysis",
      "priority": "critical|high|medium|low",
      "dependsOn": ["依赖的子任务索引"]
    }
  ]
}

规则：
1. 每个子任务应该是原子的、可独立执行的
2. 按照逻辑顺序排列子任务
3. 正确标注依赖关系
4. 高风险操作放在后面
5. 先分析再执行`;
  }

  /**
   * 构建规划提示词
   */
  private buildPlanningPrompt(
    userRequest: string,
    context?: {
      workspacePath?: string;
      currentFile?: string;
      selectedCode?: string;
      projectRules?: string;
      relatedCode?: Array<{ filePath: string; code: string }>;
    },
  ): string {
    const parts: string[] = [];

    parts.push(`# 用户需求\n${userRequest}`);

    if (context?.workspacePath) {
      parts.push(`\n# 工作区\n${context.workspacePath}`);
    }

    if (context?.currentFile) {
      parts.push(`\n# 当前文件\n${context.currentFile}`);
    }

    if (context?.selectedCode) {
      parts.push(`\n# 选中代码\n\`\`\`\n${context.selectedCode}\n\`\`\``);
    }

    if (context?.projectRules) {
      parts.push(`\n# 项目规则\n${context.projectRules}`);
    }

    if (context?.relatedCode && context.relatedCode.length > 0) {
      parts.push("\n# 相关代码");
      for (const { filePath, code } of context.relatedCode.slice(0, 3)) {
        parts.push(`\n## ${filePath}\n\`\`\`\n${code.slice(0, 500)}\n\`\`\``);
      }
    }

    parts.push("\n请生成执行计划（JSON 格式）。");

    return parts.join("\n");
  }

  /**
   * 生成简单计划（AI 失败时的后备）
   */
  private generateSimplePlan(userRequest: string): Record<string, unknown> {
    // 分析请求类型
    const type = this.inferTaskType(userRequest);

    return {
      name: "执行任务",
      description: userRequest,
      subtasks: [
        {
          name: "分析需求",
          description: "分析用户需求，确定执行策略",
          type: "analysis",
          priority: "high",
          dependsOn: [],
        },
        {
          name: "执行操作",
          description: "根据分析结果执行相应操作",
          type,
          priority: "high",
          dependsOn: ["0"],
        },
        {
          name: "验证结果",
          description: "验证执行结果是否正确",
          type: "analysis",
          priority: "medium",
          dependsOn: ["1"],
        },
      ],
    };
  }

  /**
   * 推断任务类型
   */
  private inferTaskType(request: string): TaskType {
    const lower = request.toLowerCase();

    if (lower.includes("fix") || lower.includes("修复") || lower.includes("bug")) {
      return "bug_fix";
    }
    if (lower.includes("refactor") || lower.includes("重构")) {
      return "refactoring";
    }
    if (lower.includes("test") || lower.includes("测试")) {
      return "testing";
    }
    if (lower.includes("document") || lower.includes("文档")) {
      return "documentation";
    }
    if (lower.includes("create") || lower.includes("生成") || lower.includes("write")) {
      return "code_generation";
    }
    if (lower.includes("modify") || lower.includes("修改") || lower.includes("update")) {
      return "code_modification";
    }
    if (lower.includes("search") || lower.includes("find") || lower.includes("查找")) {
      return "search";
    }
    if (lower.includes("run") || lower.includes("execute") || lower.includes("运行")) {
      return "terminal_command";
    }

    return "code_modification";
  }

  /**
   * 构建计划对象
   */
  private buildPlan(planData: Record<string, unknown>, userRequest: string): TaskPlan {
    const planId = `plan-${Date.now()}`;
    const rawSubtasks = Array.isArray(planData.subtasks) ? planData.subtasks : [];
    const subtasks: SubTask[] = rawSubtasks.map((st: Record<string, unknown>, index: number) => ({
      id: `${planId}-task-${index}`,
      parentId: planId,
      name: (st.name as string) || `子任务 ${index + 1}`,
      description: (st.description as string) || "",
      type: (st.type as TaskType) || "code_modification",
      priority: (st.priority as TaskPriority) || "medium",
      status: "pending" as TaskStatus,
      dependsOn: (Array.isArray(st.dependsOn) ? st.dependsOn : []).map(
        (d: unknown) => `${planId}-task-${d}`,
      ),
    }));

    return {
      id: planId,
      name: (planData.name as string) || "执行计划",
      description: (planData.description as string) || userRequest,
      subtasks,
      totalEstimatedTokens: 0,
      status: "pending",
      createdAt: Date.now(),
    };
  }

  /**
   * 检测依赖关系
   */
  private detectDependencies(plan: TaskPlan): void {
    // 基于任务类型推断依赖
    for (let i = 1; i < plan.subtasks.length; i++) {
      const task = plan.subtasks[i];

      // 如果没有显式依赖，添加对前一个任务的依赖
      if (task.dependsOn.length === 0) {
        task.dependsOn = [plan.subtasks[i - 1].id];
      }

      // 验证任务应该依赖执行任务
      if (task.type === "testing" || task.name.includes("验证")) {
        const execTasks = plan.subtasks.filter(
          (t) =>
            t.type === "code_generation" || t.type === "code_modification" || t.type === "bug_fix",
        );

        for (const execTask of execTasks) {
          if (!task.dependsOn.includes(execTask.id)) {
            task.dependsOn.push(execTask.id);
          }
        }
      }
    }
  }

  /**
   * 估算资源
   */
  private estimateResources(plan: TaskPlan): void {
    let totalTokens = 0;

    for (const task of plan.subtasks) {
      // 基于任务类型估算 Token
      const tokenEstimates: Record<TaskType, number> = {
        code_generation: 5000,
        code_modification: 3000,
        code_review: 2000,
        bug_fix: 4000,
        refactoring: 6000,
        documentation: 2000,
        testing: 3000,
        file_operation: 500,
        terminal_command: 500,
        search: 1000,
        analysis: 2000,
      };

      task.estimatedTokens = tokenEstimates[task.type] || 2000;
      task.estimatedTimeMs = task.estimatedTokens * 2; // 粗略估算

      totalTokens += task.estimatedTokens;
    }

    plan.totalEstimatedTokens = totalTokens;
  }

  /**
   * 优化计划（重新排序以优化执行效率）
   */
  optimizePlan(plan: TaskPlan): TaskPlan {
    // 拓扑排序，确保依赖顺序正确
    const sorted = this.topologicalSort(plan.subtasks);

    return {
      ...plan,
      subtasks: sorted,
    };
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(tasks: SubTask[]): SubTask[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const result: SubTask[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      for (const depId of task.dependsOn) {
        visit(depId);
      }

      result.push(task);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }
}

/**
 * 创建规划器
 */
export function createPlanner(config?: Partial<PlannerConfig>): TaskPlanner {
  return new TaskPlanner(config);
}
