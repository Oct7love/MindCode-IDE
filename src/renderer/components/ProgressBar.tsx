/**
 * ProgressBar 进度指示器
 * 全局加载状态显示
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface ProgressContextValue {
  start: (id?: string) => string;
  update: (id: string, progress: number) => void;
  done: (id: string) => void;
  isLoading: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Map<string, number>>(new Map());

  const start = useCallback((id?: string): string => {
    const taskId = id || `task-${Date.now()}`;
    setTasks(prev => new Map(prev).set(taskId, 0));
    return taskId;
  }, []);

  const update = useCallback((id: string, progress: number) => {
    setTasks(prev => { const m = new Map(prev); if (m.has(id)) m.set(id, Math.min(100, progress)); return m; });
  }, []);

  const done = useCallback((id: string) => {
    setTasks(prev => { const m = new Map(prev); m.delete(id); return m; });
  }, []);

  const isLoading = tasks.size > 0;
  const avgProgress = isLoading ? Array.from(tasks.values()).reduce((a, b) => a + b, 0) / tasks.size : 0;

  return (
    <ProgressContext.Provider value={{ start, update, done, isLoading }}>
      {children}
      {/* 顶部进度条 */}
      {isLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'var(--color-bg-base)', zIndex: 9999 }}>
          <div style={{ height: '100%', background: 'var(--color-accent-primary, #8b5cf6)', width: `${avgProgress || 30}%`, transition: 'width 0.3s ease', animation: avgProgress === 0 ? 'indeterminate 1.5s infinite' : 'none' }} />
        </div>
      )}
      <style>{`@keyframes indeterminate { 0% { width: 0%; margin-left: 0%; } 50% { width: 30%; margin-left: 35%; } 100% { width: 0%; margin-left: 100%; } }`}</style>
    </ProgressContext.Provider>
  );
};

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used within ProgressProvider');
  return context;
}

// 简单的进度条组件
export const ProgressBar: React.FC<{ progress: number; height?: number; color?: string }> = ({ progress, height = 4, color = 'var(--color-accent-primary)' }) => (
  <div style={{ width: '100%', height, background: 'var(--color-bg-hover)', borderRadius: height / 2, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, progress))}%`, background: color, borderRadius: height / 2, transition: 'width 0.2s ease' }} />
  </div>
);

export default ProgressBar;
