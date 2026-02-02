/**
 * TaskRunner - 任务运行器
 * npm scripts、自定义任务执行
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface Task { id: string; name: string; command: string; cwd?: string; type: 'npm' | 'shell' | 'custom'; }
export interface TaskRun { taskId: string; status: 'running' | 'success' | 'error'; output: string; startTime: number; endTime?: number; }

interface TaskRunnerProps { workspacePath?: string; onRunCommand?: (command: string, cwd?: string) => Promise<{ success: boolean; output: string }>; }

export const TaskRunner: React.FC<TaskRunnerProps> = ({ workspacePath, onRunCommand }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Map<string, TaskRun>>(new Map());
  const [newTask, setNewTask] = useState<Partial<Task> | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // 加载 package.json scripts
  useEffect(() => {
    if (!workspacePath) return;
    loadNpmScripts();
  }, [workspacePath]);

  const loadNpmScripts = async () => {
    if (!window.mindcode?.fs?.readFile) return;
    try {
      const result = await window.mindcode.fs.readFile(`${workspacePath}/package.json`);
      if (result.success && result.data) {
        const pkg = JSON.parse(result.data);
        const scripts = pkg.scripts || {};
        const npmTasks: Task[] = Object.entries(scripts).map(([name, command]) => ({
          id: `npm-${name}`, name, command: command as string, type: 'npm' as const,
        }));
        setTasks(prev => [...npmTasks, ...prev.filter(t => t.type !== 'npm')]);
      }
    } catch { /* ignore */ }
  };

  // 运行任务
  const runTask = useCallback(async (task: Task) => {
    if (!onRunCommand) return;
    const run: TaskRun = { taskId: task.id, status: 'running', output: '', startTime: Date.now() };
    setRuns(prev => new Map(prev).set(task.id, run));
    setSelectedTask(task.id);

    try {
      const command = task.type === 'npm' ? `npm run ${task.name}` : task.command;
      const result = await onRunCommand(command, task.cwd || workspacePath);
      setRuns(prev => {
        const updated = new Map(prev);
        updated.set(task.id, { ...run, status: result.success ? 'success' : 'error', output: result.output, endTime: Date.now() });
        return updated;
      });
    } catch (err: any) {
      setRuns(prev => {
        const updated = new Map(prev);
        updated.set(task.id, { ...run, status: 'error', output: err.message, endTime: Date.now() });
        return updated;
      });
    }
  }, [onRunCommand, workspacePath]);

  // 添加自定义任务
  const addTask = () => {
    if (!newTask?.name || !newTask?.command) return;
    const task: Task = { id: `custom-${Date.now()}`, name: newTask.name, command: newTask.command, type: 'custom' };
    setTasks(prev => [...prev, task]);
    setNewTask(null);
  };

  // 删除任务
  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTask === id) setSelectedTask(null);
  };

  const selectedRun = selectedTask ? runs.get(selectedTask) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4 }}>
        <button onClick={() => setNewTask({})} style={{ flex: 1, padding: '6px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>+ 添加任务</button>
        <button onClick={loadNpmScripts} title="刷新 npm scripts" style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)' }}>↻</button>
      </div>

      {/* 添加任务表单 */}
      {newTask && (
        <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-base)' }}>
          <input type="text" value={newTask.name || ''} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="任务名称" style={{ width: '100%', padding: '6px 8px', marginBottom: 4, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
          <input type="text" value={newTask.command || ''} onChange={e => setNewTask({ ...newTask, command: e.target.value })} placeholder="命令" style={{ width: '100%', padding: '6px 8px', marginBottom: 4, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit', fontFamily: 'monospace' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addTask} style={{ padding: '4px 10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>添加</button>
            <button onClick={() => setNewTask(null)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'inherit' }}>取消</button>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>无任务</div>
        ) : (
          tasks.map(task => {
            const run = runs.get(task.id);
            return (
              <div key={task.id} onClick={() => setSelectedTask(task.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: selectedTask === task.id ? 'var(--color-bg-hover)' : 'transparent' }}>
                <span style={{ fontSize: 12, color: task.type === 'npm' ? '#cb3837' : '#3b82f6' }}>{task.type === 'npm' ? '📦' : '⚡'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{task.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.command}</div>
                </div>
                {run && (
                  <span style={{ fontSize: 10, color: run.status === 'running' ? '#f59e0b' : run.status === 'success' ? '#22c55e' : '#ef4444' }}>
                    {run.status === 'running' ? '⏳' : run.status === 'success' ? '✓' : '✕'}
                  </span>
                )}
                <button onClick={e => { e.stopPropagation(); runTask(task); }} disabled={run?.status === 'running'} style={{ padding: '4px 8px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, opacity: run?.status === 'running' ? 0.5 : 1 }}>▶</button>
                {task.type === 'custom' && (
                  <button onClick={e => { e.stopPropagation(); deleteTask(task.id); }} style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 10 }}>✕</button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 输出面板 */}
      {selectedRun && (
        <div style={{ height: 150, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 8px', background: 'var(--color-bg-base)', fontSize: 10, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>输出</span>
            <span>{selectedRun.endTime ? `${((selectedRun.endTime - selectedRun.startTime) / 1000).toFixed(1)}s` : '运行中...'}</span>
          </div>
          <pre style={{ flex: 1, margin: 0, padding: 8, overflow: 'auto', fontSize: 11, fontFamily: 'monospace', background: 'var(--color-bg-base)' }}>{selectedRun.output || '(无输出)'}</pre>
        </div>
      )}
    </div>
  );
};

export default TaskRunner;
