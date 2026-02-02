/**
 * 执行计划生成器
 * 根据需求生成分步执行计划
 */

import type {
  RefactorRequest,
  ExecutionPlan,
  ExecutionStep,
  StepAction,
  ImpactAnalysis,
} from './types';

/** 计划生成配置 */
export interface PlanGeneratorConfig {
  /** 最大步骤数 */
  maxSteps: number;
  /** 是否自动检测依赖 */
  detectDependencies: boolean;
  /** AI 模型 */
  model: string;
}

const DEFAULT_CONFIG: PlanGeneratorConfig = {
  maxSteps: 20,
  detectDependencies: true,
  model: 'claude-sonnet-4-5',
};

/**
 * 生成执行计划
 * 使用 AI 分析需求并生成分步计划
 */
export async function generatePlan(
  request: RefactorRequest,
  context: {
    workspacePath: string;
    projectRules?: string;
    relatedCode?: Array<{ filePath: string; code: string }>;
  },
  config: Partial<PlanGeneratorConfig> = {}
): Promise<ExecutionPlan> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 构建 AI 提示词
  const prompt = buildPlanPrompt(request, context);
  
  // 调用 AI 生成计划
  let planData: any;
  
  if (window.mindcode?.ai?.chat) {
    const result = await window.mindcode.ai.chat(finalConfig.model, [
      {
        role: 'system',
        content: `你是一个代码重构专家。根据用户需求生成详细的执行计划。
输出 JSON 格式：
{
  "name": "计划名称",
  "description": "计划描述",
  "steps": [
    {
      "name": "步骤名称",
      "description": "步骤描述",
      "files": ["涉及的文件"],
      "actions": [
        {
          "type": "create|modify|delete|rename",
          "filePath": "文件路径",
          "newContent": "新内容（可选）",
          "newPath": "新路径（rename时）"
        }
      ]
    }
  ]
}

注意：
1. 每个步骤应该是原子的、可独立验证的
2. 按照依赖顺序排列步骤
3. 高风险操作放在后面，低风险操作放在前面
4. 确保步骤可以逐个回滚`
      },
      {
        role: 'user',
        content: prompt
      }
    ]);
    
    if (result.success && result.data) {
      try {
        // 尝试从响应中提取 JSON
        const jsonMatch = result.data.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('[PlanGenerator] 解析 AI 响应失败:', e);
      }
    }
  }
  
  // 如果 AI 生成失败，使用默认计划
  if (!planData) {
    planData = generateDefaultPlan(request);
  }
  
  // 构建执行计划
  const plan: ExecutionPlan = {
    id: `plan-${Date.now()}`,
    requestId: request.id,
    name: planData.name || '重构计划',
    description: planData.description || request.description,
    steps: (planData.steps || []).map((step: any, index: number) => ({
      id: `step-${Date.now()}-${index}`,
      order: index + 1,
      name: step.name || `步骤 ${index + 1}`,
      description: step.description || '',
      files: step.files || [],
      actions: (step.actions || []).map((action: any) => ({
        type: action.type || 'modify',
        filePath: action.filePath || '',
        newContent: action.newContent,
        newPath: action.newPath,
      })),
      status: 'pending' as const,
    })),
    status: 'draft',
    currentStepIndex: -1,
    createdAt: Date.now(),
  };
  
  return plan;
}

/**
 * 构建计划生成提示词
 */
function buildPlanPrompt(
  request: RefactorRequest,
  context: {
    workspacePath: string;
    projectRules?: string;
    relatedCode?: Array<{ filePath: string; code: string }>;
  }
): string {
  const parts: string[] = [];
  
  parts.push(`# 重构需求\n${request.description}`);
  
  if (context.projectRules) {
    parts.push(`\n# 项目规则\n${context.projectRules}`);
  }
  
  if (context.relatedCode && context.relatedCode.length > 0) {
    parts.push('\n# 相关代码');
    for (const { filePath, code } of context.relatedCode.slice(0, 5)) {
      const lang = filePath.split('.').pop() || 'text';
      parts.push(`\n## ${filePath}\n\`\`\`${lang}\n${code}\n\`\`\``);
    }
  }
  
  if (request.context?.selectedFiles && request.context.selectedFiles.length > 0) {
    parts.push(`\n# 选中的文件\n${request.context.selectedFiles.join('\n')}`);
  }
  
  parts.push('\n请生成详细的执行计划（JSON 格式）。');
  
  return parts.join('\n');
}

/**
 * 生成默认计划（AI 失败时的后备）
 */
function generateDefaultPlan(request: RefactorRequest): any {
  return {
    name: '重构计划',
    description: request.description,
    steps: [
      {
        name: '分析代码结构',
        description: '分析相关文件的代码结构和依赖关系',
        files: request.context?.selectedFiles || [],
        actions: [],
      },
      {
        name: '执行重构',
        description: '根据需求执行代码修改',
        files: request.context?.selectedFiles || [],
        actions: [],
      },
      {
        name: '验证结果',
        description: '验证重构后的代码是否正确',
        files: request.context?.selectedFiles || [],
        actions: [],
      },
    ],
  };
}

/**
 * 分析影响范围
 */
export async function analyzeImpact(
  plan: ExecutionPlan,
  workspacePath: string
): Promise<ImpactAnalysis> {
  const affectedFiles = new Set<string>();
  const dependencies: ImpactAnalysis['dependencies'] = [];
  
  // 收集所有受影响的文件
  for (const step of plan.steps) {
    for (const file of step.files) {
      affectedFiles.add(file);
    }
    for (const action of step.actions) {
      affectedFiles.add(action.filePath);
      if (action.newPath) {
        affectedFiles.add(action.newPath);
      }
    }
  }
  
  // 构建影响分析结果
  const analysis: ImpactAnalysis = {
    affectedFiles: Array.from(affectedFiles).map(filePath => {
      const action = plan.steps
        .flatMap(s => s.actions)
        .find(a => a.filePath === filePath);
      
      return {
        filePath,
        changeType: action?.type === 'create' ? 'create' :
                    action?.type === 'delete' ? 'delete' : 'modify',
        reason: '由重构计划确定',
        riskLevel: action?.type === 'delete' ? 'high' :
                   action?.type === 'create' ? 'low' : 'medium',
      };
    }),
    dependencies,
    riskSummary: {
      totalFiles: affectedFiles.size,
      highRiskFiles: Array.from(affectedFiles).filter(f => {
        const action = plan.steps.flatMap(s => s.actions).find(a => a.filePath === f);
        return action?.type === 'delete';
      }).length,
      estimatedComplexity: affectedFiles.size > 10 ? 'complex' :
                          affectedFiles.size > 5 ? 'moderate' : 'simple',
    },
  };
  
  return analysis;
}

/**
 * 验证计划
 */
export function validatePlan(plan: ExecutionPlan): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (plan.steps.length === 0) {
    errors.push('计划没有任何步骤');
  }
  
  for (const step of plan.steps) {
    if (!step.name) {
      errors.push(`步骤 ${step.order} 没有名称`);
    }
    
    if (step.actions.length === 0 && step.files.length === 0) {
      warnings.push(`步骤 "${step.name}" 没有任何操作或关联文件`);
    }
    
    for (const action of step.actions) {
      if (!action.filePath) {
        errors.push(`步骤 "${step.name}" 的操作缺少文件路径`);
      }
      
      if (action.type === 'modify' && !action.newContent) {
        warnings.push(`步骤 "${step.name}" 的修改操作没有指定新内容`);
      }
      
      if (action.type === 'rename' && !action.newPath) {
        errors.push(`步骤 "${step.name}" 的重命名操作缺少新路径`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
