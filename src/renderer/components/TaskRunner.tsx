/**
 * TaskRunner - 任务运行面板
 */

import React, { useState, useEffect } from 'react';

export interface Task { id: string; name: string; command: string; group?: string; isDefault?: boolean; }
export interface TaskRun { taskId: string; status: 'pending' | 'running' | 'success' | 'failed'; startTime?: number; endTime?: number; output?: string; exitCode?: number; }

interface TaskRunnerProps { tasks: Task[]; onRunTask?: (task: Task) => Promise<void>; onStopTask?: (taskId: string) => void; }

const win = window as any;

export const TaskRunner: React.FC<TaskRunnerProps> = ({ tasks: propTasks, onRunTask, onStopTask }) => {
  const [tasks, setTasks] = useState<Task[]>(propTasks);
  const [runs, setRuns] = useState<Map<string, TaskRun>>(new Map());
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // 从 package.json 加载任务
  useEffect(() => {
    const loadTasks = async () => {
      try {
        if (win.mindcode?.fs?.readFile) {
          const content = await win.mindcode.fs.readFile('package.json');
          const pkg = JSON.parse(content);
          if (pkg.scripts) {
            const npmTasks: Task[] = Object.entries(pkg.scripts).map(([name, cmd]) => ({
              id: `npm:${name}`,
              name: `npm run ${name}`,
              command: cmd as string,
              group: 'npm',
            }));
            setTasks(prev => [...prev.filter(t => t.group !== 'npm'), ...npmTasks]);
          }
        }
      } catch {}
    };
    loadTasks();
  }, []);

  const runTask = async (task: Task) => {
    setRuns(prev => new Map(prev).set(task.id, { taskId: task.id, status: 'running', startTime: Date.now() }));

    try {
      if (onRunTask) { await onRunTask(task); }
      else if (win.mindcode?.terminal?.execute) {
        const result = await win.mindcode.terminal.execute(task.command);
        setRuns(prev => {
          const updated = new Map(prev);
          updated.set(task.id, { taskId: task.id, status: result.exitCode === 0 ? 'success' : 'failed', startTime: prev.get(task.id)?.startTime, endTime: Date.now(), output: result.output, exitCode: result.exitCode });
          return updated;
        });
      }
    } catch (e) {
      setRuns(prev => {
        const updated = new Map(prev);
        updated.set(task.id, { taskId: task.id, status: 'failed', startTime: prev.get(task.id)?.startTime, endTime: Date.now(), output: (e as Error).message });
        return updated;
      });
    }
  };

  const stopTask = (taskId: string) => {
    onStopTask?.(taskId);
    setRuns(prev => {
      const updated = new Map(prev);
      updated.set(taskId, { ...prev.get(taskId)!, status: 'failed', endTime: Date.now() });
      return updated;
    });
  };

  const grouped = tasks.reduce((acc, t) => {
    const group = t.group || '其他';
    (acc[group] = acc[group] || []).push(t);
    return acc;
  }, {} as Record<string, Task[]>);

  const statusIcon = { pending: '⏸️', running: '⏳', success: '✅', failed: '❌' };
  const selectedRun = selectedTask ? runs.get(selectedTask) : null;

  return (
    <div className="flex h-full">
      {/* 任务列表 */}
      <div className="w-64 border-r border-[var(--color-border)] flex flex-col">
        <div className="p-2 border-b border-[var(--color-border)] text-sm font-medium">任务</div>
        <div className="flex-1 overflow-auto">
          {Object.entries(grouped).map(([group, groupTasks]) => (
            <div key={group}>
              <div className="px-2 py-1 text-xs text-[var(--color-text-muted)] uppercase bg-[var(--color-bg-secondary)]">{group}</div>
              {groupTasks.map(task => {
                const run = runs.get(task.id);
                return (
                  <div key={task.id} onClick={() => setSelectedTask(task.id)} className={`flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-[var(--color-bg-hover)] ${selectedTask === task.id ? 'bg-[var(--color-bg-active)]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{run ? statusIcon[run.status] : '▶️'}</span>
                      <span className="text-sm truncate">{task.name}</span>
                    </div>
                    {run?.status === 'running' ? (
                      <button onClick={(e) => { e.stopPropagation(); stopTask(task.id); }} className="text-xs px-1 text-[var(--color-error)]">停止</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); runTask(task); }} className="text-xs px-1 text-[var(--color-accent-primary)]">运行</button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 输出面板 */}
      <div className="flex-1 flex flex-col">
        {selectedTask ? (
          <>
            <div className="p-2 border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-sm font-medium">{tasks.find(t => t.id === selectedTask)?.name}</span>
              {selectedRun && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {selectedRun.status === 'running' ? '运行中...' : selectedRun.endTime ? `耗时 ${((selectedRun.endTime - (selectedRun.startTime || 0)) / 1000).toFixed(1)}s` : ''}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-xs bg-[#1e1e1e] text-[#d4d4d4] whitespace-pre-wrap">
              {selectedRun?.output || '点击运行按钮开始任务'}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">选择一个任务查看详情</div>
        )}
      </div>
    </div>
  );
};

// 搜索结果面板
export interface SearchResultItem { file: string; line: number; column: number; text: string; matchStart: number; matchLength: number; }

export const SearchResultsPanel: React.FC<{ results: SearchResultItem[]; query: string; onResultClick?: (result: SearchResultItem) => void; onClose?: () => void }> = ({ results, query, onResultClick, onClose }) => {
  const grouped = results.reduce((acc, r) => { (acc[r.file] = acc[r.file] || []).push(r); return acc; }, {} as Record<string, SearchResultItem[]>);
  const fileCount = Object.keys(grouped).length;

  const highlightMatch = (text: string, start: number, length: number) => (
    <>{text.slice(0, start)}<mark className="bg-[var(--color-accent-primary)] bg-opacity-40 text-inherit">{text.slice(start, start + length)}</mark>{text.slice(start + length)}</>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-sm"><strong>{results.length}</strong> 个结果，<strong>{fileCount}</strong> 个文件中包含 "<strong>{query}</strong>"</span>
        {onClose && <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>}
      </div>
      <div className="flex-1 overflow-auto">
        {Object.entries(grouped).map(([file, fileResults]) => (
          <div key={file}>
            <div className="px-2 py-1 text-sm font-medium bg-[var(--color-bg-secondary)] sticky top-0 flex items-center gap-2">
              <span>📄</span>
              <span className="truncate">{file}</span>
              <span className="text-xs text-[var(--color-text-muted)]">({fileResults.length})</span>
            </div>
            {fileResults.map((r, i) => (
              <div key={i} onClick={() => onResultClick?.(r)} className="flex items-start gap-2 px-3 py-1 cursor-pointer hover:bg-[var(--color-bg-hover)] font-mono text-xs">
                <span className="text-[var(--color-text-muted)] w-10 text-right flex-shrink-0">{r.line}</span>
                <span className="flex-1 truncate">{highlightMatch(r.text, r.matchStart, r.matchLength)}</span>
              </div>
            ))}
          </div>
        ))}
        {results.length === 0 && <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">没有找到结果</div>}
      </div>
    </div>
  );
};

export default TaskRunner;
