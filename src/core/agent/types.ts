/**
 * Agent 增强系统类型定义
 */

// ============ 任务规划 ============

/** 任务优先级 */
export type TaskPriority = "critical" | "high" | "medium" | "low";

/** 任务状态 */
export type TaskStatus =
  | "pending"
  | "analyzing"
  | "executing"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

/** 任务类型 */
export type TaskType =
  | "code_generation"
  | "code_modification"
  | "code_review"
  | "bug_fix"
  | "refactoring"
  | "documentation"
  | "testing"
  | "file_operation"
  | "terminal_command"
  | "search"
  | "analysis";

/** 子任务 */
export interface SubTask {
  id: string;
  parentId: string;
  name: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dependsOn: string[];
  estimatedTokens?: number;
  estimatedTimeMs?: number;
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

/** 任务计划 */
export interface TaskPlan {
  id: string;
  name: string;
  description: string;
  subtasks: SubTask[];
  totalEstimatedTokens: number;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// ============ 检查点系统 ============

/** 检查点类型 */
export type CheckpointType = "file" | "state" | "full";

/** 检查点 */
export interface Checkpoint {
  id: string;
  taskId: string;
  type: CheckpointType;
  createdAt: number;
  data: {
    files?: Array<{
      path: string;
      content: string | null;
      existed: boolean;
    }>;
    state?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

// ============ 验证系统 ============

/** 验证类型 */
export type ValidationType = "syntax" | "type_check" | "lint" | "test" | "build" | "custom";

/** 验证结果 */
export interface ValidationResult {
  type: ValidationType;
  passed: boolean;
  errors: Array<{
    file?: string;
    line?: number;
    message: string;
    severity: "error" | "warning" | "info";
  }>;
  executionTimeMs: number;
}

// ============ 工具系统 ============

/** 工具参数 */
export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  default?: unknown;
}

/** 工具定义 */
export interface ToolDefinition {
  name: string;
  description: string;
  category: "file" | "terminal" | "search" | "browser" | "ai" | "custom";
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  rollback?: (params: Record<string, unknown>, result: unknown) => Promise<void>;
}

/** 工具调用 */
export interface ToolCall {
  id: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  canRollback: boolean;
}

// ============ Agent 状态 ============

/** Agent 模式 */
export type AgentMode = "autonomous" | "interactive" | "supervised";

/** Agent 状态 */
export interface AgentState {
  mode: AgentMode;
  isRunning: boolean;
  isPaused: boolean;
  currentTask?: SubTask;
  currentPlan?: TaskPlan;
  checkpoints: Checkpoint[];
  toolCalls: ToolCall[];
  validationResults: ValidationResult[];
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  startTime?: number;
}

// ============ 安全策略 ============

/** 操作风险等级 */
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

/** 安全策略 */
export interface SecurityPolicy {
  maxRiskLevel: RiskLevel;
  confirmationRequired: RiskLevel;
  blockedOperations: string[];
  protectedPaths: string[];
  blockedCommands: string[];
  allowNetworkAccess: boolean;
  maxFileOperations: number;
  maxExecutionTimeMs: number;
}

/** 默认安全策略 */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxRiskLevel: "medium",
  confirmationRequired: "high",
  blockedOperations: ["format_disk", "delete_all", "system_shutdown"],
  protectedPaths: ["/etc", "/usr", "/bin", "C:\\Windows", "C:\\Program Files"],
  blockedCommands: ["rm -rf /", "format", "shutdown", "reboot"],
  allowNetworkAccess: true,
  maxFileOperations: 100,
  maxExecutionTimeMs: 300000,
};
