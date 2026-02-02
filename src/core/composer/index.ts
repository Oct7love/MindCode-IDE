/**
 * Composer 模块入口
 * 项目级多文件重构系统
 */

// 类型导出
export * from './types';

// 计划生成器
export { 
  generatePlan, 
  analyzeImpact, 
  validatePlan,
  type PlanGeneratorConfig 
} from './planGenerator';

// 执行器
export { 
  PlanExecutor, 
  createExecutor,
  type ExecutorConfig,
  type ExecutorEvents 
} from './executor';
