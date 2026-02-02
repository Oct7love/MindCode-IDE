/**
 * 检查点管理器
 * 负责创建、存储和恢复检查点
 */

import type { Checkpoint, CheckpointType } from './types';

/** 检查点管理器 */
export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private maxCheckpoints: number;
  
  constructor(maxCheckpoints = 50) {
    this.maxCheckpoints = maxCheckpoints;
  }
  
  /**
   * 创建检查点
   */
  async create(
    taskId: string,
    type: CheckpointType,
    files?: string[]
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      type,
      createdAt: Date.now(),
      data: {},
    };
    
    // 备份文件
    if (type === 'file' || type === 'full') {
      checkpoint.data.files = [];
      
      if (files && files.length > 0 && window.mindcode?.fs) {
        for (const filePath of files) {
          try {
            const result = await window.mindcode.fs.readFile(filePath);
            checkpoint.data.files.push({
              path: filePath,
              content: result.success ? result.data! : null,
              existed: result.success,
            });
          } catch {
            checkpoint.data.files.push({
              path: filePath,
              content: null,
              existed: false,
            });
          }
        }
      }
    }
    
    // 存储检查点
    this.checkpoints.set(checkpoint.id, checkpoint);
    
    // 清理旧检查点
    this.cleanup();
    
    console.log(`[CheckpointManager] 创建检查点: ${checkpoint.id}, 备份 ${checkpoint.data.files?.length || 0} 个文件`);
    
    return checkpoint;
  }
  
  /**
   * 恢复检查点
   */
  async restore(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      console.error(`[CheckpointManager] 检查点不存在: ${checkpointId}`);
      return false;
    }
    
    console.log(`[CheckpointManager] 恢复检查点: ${checkpointId}`);
    
    // 恢复文件
    if (checkpoint.data.files && window.mindcode?.fs) {
      for (const file of checkpoint.data.files) {
        try {
          if (file.existed && file.content !== null) {
            // 恢复文件内容
            await window.mindcode.fs.writeFile(file.path, file.content);
          } else if (!file.existed) {
            // 删除文件（因为原来不存在）
            await window.mindcode.fs.delete(file.path).catch(() => {});
          }
        } catch (err) {
          console.error(`[CheckpointManager] 恢复文件失败: ${file.path}`, err);
        }
      }
    }
    
    return true;
  }
  
  /**
   * 删除检查点
   */
  delete(checkpointId: string): void {
    this.checkpoints.delete(checkpointId);
  }
  
  /**
   * 删除任务的所有检查点
   */
  deleteByTask(taskId: string): void {
    for (const [id, cp] of this.checkpoints) {
      if (cp.taskId === taskId) {
        this.checkpoints.delete(id);
      }
    }
  }
  
  /**
   * 获取检查点
   */
  get(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }
  
  /**
   * 列出检查点
   */
  list(taskId?: string): Checkpoint[] {
    const all = Array.from(this.checkpoints.values());
    
    if (taskId) {
      return all.filter(cp => cp.taskId === taskId);
    }
    
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  /**
   * 清理旧检查点
   */
  private cleanup(): void {
    if (this.checkpoints.size <= this.maxCheckpoints) return;
    
    // 按时间排序
    const sorted = Array.from(this.checkpoints.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    
    // 删除最旧的
    const toDelete = sorted.slice(0, sorted.length - this.maxCheckpoints);
    for (const [id] of toDelete) {
      this.checkpoints.delete(id);
    }
  }
  
  /**
   * 清空所有检查点
   */
  clear(): void {
    this.checkpoints.clear();
  }
  
  /**
   * 获取统计信息
   */
  getStats(): { count: number; totalFiles: number } {
    let totalFiles = 0;
    for (const cp of this.checkpoints.values()) {
      totalFiles += cp.data.files?.length || 0;
    }
    
    return {
      count: this.checkpoints.size,
      totalFiles,
    };
  }
}

/**
 * 创建检查点管理器
 */
export function createCheckpointManager(maxCheckpoints?: number): CheckpointManager {
  return new CheckpointManager(maxCheckpoints);
}

// 全局实例
let globalCheckpointManager: CheckpointManager | null = null;

export function getCheckpointManager(): CheckpointManager {
  if (!globalCheckpointManager) {
    globalCheckpointManager = createCheckpointManager();
  }
  return globalCheckpointManager;
}
