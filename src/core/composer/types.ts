/**
 * Composer 类型定义
 * 项目级多文件重构系统
 */

// ============ 需求分析 ============

/** 重构需求 */
export interface RefactorRequest {
  /** 需求 ID */
  id: string;
  /** 需求描述 */
  description: string;
  /** 上下文信息 */
  context?: {
    /** 当前选中的文件 */
    selectedFiles?: string[];
    /** 相关代码片段 */
    codeSnippets?: Array<{ filePath: string; code: string }>;
    /** 项目规则 */
    projectRules?: string;
  };
  /** 创建时间 */
  createdAt: number;
}

/** 影响分析结果 */
export interface ImpactAnalysis {
  /** 受影响的文件列表 */
  affectedFiles: Array<{
    filePath: string;
    changeType: 'modify' | 'create' | 'delete';
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  /** 依赖关系 */
  dependencies: Array<{
    from: string;
    to: string;
    type: 'import' | 'call' | 'inherit';
  }>;
  /** 风险评估 */
  riskSummary: {
    totalFiles: number;
    highRiskFiles: number;
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
  };
}

// ============ 执行计划 ============

/** 执行步骤状态 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rolled_back';

/** 执行步骤 */
export interface ExecutionStep {
  /** 步骤 ID */
  id: string;
  /** 步骤序号 */
  order: number;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description: string;
  /** 涉及的文件 */
  files: string[];
  /** 具体操作 */
  actions: StepAction[];
  /** 依赖的步骤 ID */
  dependsOn?: string[];
  /** 状态 */
  status: StepStatus;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 错误信息 */
  error?: string;
  /** 检查点数据（用于回滚） */
  checkpoint?: StepCheckpoint;
}

/** 步骤操作 */
export interface StepAction {
  /** 操作类型 */
  type: 'create' | 'modify' | 'delete' | 'rename' | 'move';
  /** 目标文件 */
  filePath: string;
  /** 新内容（create/modify） */
  newContent?: string;
  /** 原始内容（modify，用于 diff 和回滚） */
  originalContent?: string;
  /** 新路径（rename/move） */
  newPath?: string;
}

/** 检查点 */
export interface StepCheckpoint {
  /** 检查点 ID */
  id: string;
  /** 步骤 ID */
  stepId: string;
  /** 创建时间 */
  createdAt: number;
  /** 文件备份 */
  backups: Array<{
    filePath: string;
    content: string | null; // null 表示文件不存在
  }>;
}

/** 执行计划 */
export interface ExecutionPlan {
  /** 计划 ID */
  id: string;
  /** 关联的需求 */
  requestId: string;
  /** 计划名称 */
  name: string;
  /** 计划描述 */
  description: string;
  /** 执行步骤 */
  steps: ExecutionStep[];
  /** 计划状态 */
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled_back';
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 影响分析 */
  impactAnalysis?: ImpactAnalysis;
}

// ============ Composer 状态 ============

/** Composer 模式 */
export type ComposerMode = 'input' | 'analyzing' | 'planning' | 'reviewing' | 'executing' | 'complete' | 'error';

/** Composer 状态 */
export interface ComposerState {
  /** 当前模式 */
  mode: ComposerMode;
  /** 当前需求 */
  currentRequest?: RefactorRequest;
  /** 当前计划 */
  currentPlan?: ExecutionPlan;
  /** 影响分析 */
  impactAnalysis?: ImpactAnalysis;
  /** 错误信息 */
  error?: string;
  /** 是否正在加载 */
  isLoading: boolean;
}

// ============ 事件 ============

/** Composer 事件 */
export interface ComposerEvents {
  onModeChange: (mode: ComposerMode) => void;
  onStepStart: (step: ExecutionStep) => void;
  onStepComplete: (step: ExecutionStep) => void;
  onStepError: (step: ExecutionStep, error: Error) => void;
  onPlanComplete: (plan: ExecutionPlan) => void;
  onRollback: (step: ExecutionStep) => void;
}
