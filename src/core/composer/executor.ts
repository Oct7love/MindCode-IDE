/**
 * 执行引擎
 * 负责按计划执行重构操作
 */

import type {
  ExecutionPlan,
  ExecutionStep,
  StepAction,
  StepCheckpoint,
  StepStatus,
} from './types';

/** 执行器配置 */
export interface ExecutorConfig {
  /** 是否自动创建检查点 */
  autoCheckpoint: boolean;
  /** 失败时是否自动回滚 */
  autoRollbackOnError: boolean;
  /** 执行间隔（毫秒） */
  stepDelayMs: number;
  /** 工作区路径 */
  workspacePath: string;
}

/** 执行器事件 */
export interface ExecutorEvents {
  onStepStart?: (step: ExecutionStep) => void;
  onStepComplete?: (step: ExecutionStep) => void;
  onStepError?: (step: ExecutionStep, error: Error) => void;
  onCheckpoint?: (checkpoint: StepCheckpoint) => void;
  onRollback?: (step: ExecutionStep) => void;
  onPlanComplete?: (plan: ExecutionPlan) => void;
  onPlanError?: (plan: ExecutionPlan, error: Error) => void;
}

/** 执行引擎 */
export class PlanExecutor {
  private config: ExecutorConfig;
  private events: ExecutorEvents = {};
  private isRunning = false;
  private isPaused = false;
  private currentPlan: ExecutionPlan | null = null;
  private checkpoints: Map<string, StepCheckpoint> = new Map();
  
  constructor(config: Partial<ExecutorConfig> & { workspacePath: string }) {
    this.config = {
      autoCheckpoint: true,
      autoRollbackOnError: true,
      stepDelayMs: 100,
      ...config,
    };
  }
  
  /**
   * 设置事件处理器
   */
  on<K extends keyof ExecutorEvents>(event: K, handler: ExecutorEvents[K]): void {
    this.events[event] = handler;
  }
  
  /**
   * 执行计划
   */
  async execute(plan: ExecutionPlan): Promise<ExecutionPlan> {
    if (this.isRunning) {
      throw new Error('已有计划正在执行');
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.currentPlan = { ...plan, status: 'running', startedAt: Date.now() };
    
    try {
      for (let i = 0; i < this.currentPlan.steps.length; i++) {
        // 检查是否暂停
        while (this.isPaused) {
          await this.delay(100);
          if (!this.isRunning) break;
        }
        
        if (!this.isRunning) {
          this.currentPlan.status = 'paused';
          break;
        }
        
        const step = this.currentPlan.steps[i];
        this.currentPlan.currentStepIndex = i;
        
        try {
          await this.executeStep(step);
          this.currentPlan.steps[i] = { ...step, status: 'completed', completedAt: Date.now() };
        } catch (error) {
          const err = error as Error;
          this.currentPlan.steps[i] = { ...step, status: 'failed', error: err.message };
          this.events.onStepError?.(step, err);
          
          if (this.config.autoRollbackOnError) {
            await this.rollbackToStep(i - 1);
            this.currentPlan.status = 'rolled_back';
          } else {
            this.currentPlan.status = 'failed';
          }
          
          this.events.onPlanError?.(this.currentPlan, err);
          break;
        }
        
        // 步骤间延迟
        if (this.config.stepDelayMs > 0 && i < this.currentPlan.steps.length - 1) {
          await this.delay(this.config.stepDelayMs);
        }
      }
      
      // 检查是否全部完成
      if (this.currentPlan.steps.every(s => s.status === 'completed')) {
        this.currentPlan.status = 'completed';
        this.currentPlan.completedAt = Date.now();
        this.events.onPlanComplete?.(this.currentPlan);
      }
      
      return this.currentPlan;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * 执行单个步骤
   */
  private async executeStep(step: ExecutionStep): Promise<void> {
    step.status = 'running';
    step.startedAt = Date.now();
    this.events.onStepStart?.(step);
    
    // 创建检查点
    if (this.config.autoCheckpoint) {
      const checkpoint = await this.createCheckpoint(step);
      step.checkpoint = checkpoint;
      this.checkpoints.set(step.id, checkpoint);
      this.events.onCheckpoint?.(checkpoint);
    }
    
    // 执行操作
    for (const action of step.actions) {
      await this.executeAction(action);
    }
    
    this.events.onStepComplete?.(step);
  }
  
  /**
   * 执行单个操作
   */
  private async executeAction(action: StepAction): Promise<void> {
    if (!window.mindcode?.fs) {
      throw new Error('文件系统 API 不可用');
    }
    
    const fullPath = this.getFullPath(action.filePath);
    
    switch (action.type) {
      case 'create':
        if (!action.newContent) {
          throw new Error(`创建操作缺少内容: ${action.filePath}`);
        }
        await window.mindcode.fs.writeFile(fullPath, action.newContent);
        break;
        
      case 'modify':
        if (!action.newContent) {
          throw new Error(`修改操作缺少内容: ${action.filePath}`);
        }
        // 读取原始内容
        const readResult = await window.mindcode.fs.readFile(fullPath);
        if (readResult.success) {
          action.originalContent = readResult.data;
        }
        await window.mindcode.fs.writeFile(fullPath, action.newContent);
        break;
        
      case 'delete':
        // 读取原始内容（用于回滚）
        const backupResult = await window.mindcode.fs.readFile(fullPath);
        if (backupResult.success) {
          action.originalContent = backupResult.data;
        }
        await window.mindcode.fs.delete(fullPath);
        break;
        
      case 'rename':
      case 'move':
        if (!action.newPath) {
          throw new Error(`重命名/移动操作缺少新路径: ${action.filePath}`);
        }
        const newFullPath = this.getFullPath(action.newPath);
        await window.mindcode.fs.rename(fullPath, newFullPath);
        break;
    }
  }
  
  /**
   * 创建检查点
   */
  private async createCheckpoint(step: ExecutionStep): Promise<StepCheckpoint> {
    const backups: StepCheckpoint['backups'] = [];
    
    for (const action of step.actions) {
      const fullPath = this.getFullPath(action.filePath);
      
      // 备份现有文件内容
      if (window.mindcode?.fs) {
        const result = await window.mindcode.fs.readFile(fullPath);
        backups.push({
          filePath: action.filePath,
          content: result.success ? result.data! : null,
        });
      }
    }
    
    return {
      id: `checkpoint-${step.id}-${Date.now()}`,
      stepId: step.id,
      createdAt: Date.now(),
      backups,
    };
  }
  
  /**
   * 回滚到指定步骤
   */
  async rollbackToStep(targetStepIndex: number): Promise<void> {
    if (!this.currentPlan) return;
    
    // 从最后一个完成的步骤开始回滚
    for (let i = this.currentPlan.currentStepIndex; i > targetStepIndex; i--) {
      const step = this.currentPlan.steps[i];
      
      if (step.status === 'completed' || step.status === 'failed') {
        await this.rollbackStep(step);
        step.status = 'rolled_back';
        this.events.onRollback?.(step);
      }
    }
    
    this.currentPlan.currentStepIndex = targetStepIndex;
  }
  
  /**
   * 回滚单个步骤
   */
  private async rollbackStep(step: ExecutionStep): Promise<void> {
    const checkpoint = this.checkpoints.get(step.id);
    if (!checkpoint) {
      console.warn(`[Executor] 步骤 ${step.id} 没有检查点，无法回滚`);
      return;
    }
    
    // 恢复文件
    for (const backup of checkpoint.backups) {
      const fullPath = this.getFullPath(backup.filePath);
      
      if (window.mindcode?.fs) {
        if (backup.content === null) {
          // 原来不存在，删除
          await window.mindcode.fs.delete(fullPath).catch(() => {});
        } else {
          // 恢复原始内容
          await window.mindcode.fs.writeFile(fullPath, backup.content);
        }
      }
    }
    
    // 处理重命名/移动的回滚
    for (const action of step.actions) {
      if ((action.type === 'rename' || action.type === 'move') && action.newPath) {
        const newFullPath = this.getFullPath(action.newPath);
        const oldFullPath = this.getFullPath(action.filePath);
        
        if (window.mindcode?.fs) {
          await window.mindcode.fs.rename(newFullPath, oldFullPath).catch(() => {});
        }
      }
    }
  }
  
  /**
   * 暂停执行
   */
  pause(): void {
    this.isPaused = true;
    if (this.currentPlan) {
      this.currentPlan.status = 'paused';
    }
  }
  
  /**
   * 继续执行
   */
  resume(): void {
    this.isPaused = false;
    if (this.currentPlan) {
      this.currentPlan.status = 'running';
    }
  }
  
  /**
   * 停止执行
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.currentPlan) {
      this.currentPlan.status = 'paused';
    }
  }
  
  /**
   * 获取当前计划
   */
  getCurrentPlan(): ExecutionPlan | null {
    return this.currentPlan;
  }
  
  /**
   * 是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * 获取完整路径
   */
  private getFullPath(relativePath: string): string {
    if (relativePath.startsWith('/') || relativePath.match(/^[a-zA-Z]:/)) {
      return relativePath;
    }
    return `${this.config.workspacePath}/${relativePath}`;
  }
  
  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建执行器
 */
export function createExecutor(config: Partial<ExecutorConfig> & { workspacePath: string }): PlanExecutor {
  return new PlanExecutor(config);
}
