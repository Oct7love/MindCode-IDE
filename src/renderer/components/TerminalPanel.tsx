/**
 * TerminalPanel - 终端面板组件
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface TerminalInstance { id: string; name: string; cwd: string; output: string[]; isRunning: boolean; exitCode?: number; }

interface TerminalPanelProps { onCommand?: (terminalId: string, command: string) => void; onClose?: (terminalId: string) => void; onNew?: () => void; }

const win = window as any;

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ onCommand, onClose, onNew }) => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([{ id: 'term-1', name: 'Terminal 1', cwd: '~', output: ['Welcome to MindCode Terminal\n'], isRunning: false }]);
  const [activeId, setActiveId] = useState('term-1');
  const [input, setInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  const activeTerminal = terminals.find(t => t.id === activeId);

  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [activeTerminal?.output]);

  const addTerminal = () => {
    const id = `term-${Date.now()}`;
    setTerminals(prev => [...prev, { id, name: `Terminal ${prev.length + 1}`, cwd: '~', output: [], isRunning: false }]);
    setActiveId(id);
    onNew?.();
  };

  const closeTerminal = (id: string) => {
    setTerminals(prev => prev.filter(t => t.id !== id));
    if (activeId === id) setActiveId(terminals[0]?.id || '');
    onClose?.(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeTerminal) return;

    const cmd = input.trim();
    setInput('');

    // 添加命令到输出
    setTerminals(prev => prev.map(t => t.id === activeId ? { ...t, output: [...t.output, `$ ${cmd}\n`], isRunning: true } : t));

    onCommand?.(activeId, cmd);

    // 执行命令
    try {
      if (win.mindcode?.terminal?.execute) {
        const result = await win.mindcode.terminal.execute(cmd, activeTerminal.cwd);
        setTerminals(prev => prev.map(t => t.id === activeId ? { ...t, output: [...t.output, result.output || '', result.error || ''], isRunning: false, exitCode: result.exitCode } : t));
      } else {
        setTerminals(prev => prev.map(t => t.id === activeId ? { ...t, output: [...t.output, `[Mock] ${cmd}\n`], isRunning: false } : t));
      }
    } catch (e) { setTerminals(prev => prev.map(t => t.id === activeId ? { ...t, output: [...t.output, `Error: ${(e as Error).message}\n`], isRunning: false } : t)); }
  };

  const clear = () => { setTerminals(prev => prev.map(t => t.id === activeId ? { ...t, output: [] } : t)); };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* 标签栏 */}
      <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex-1 flex items-center overflow-x-auto">
          {terminals.map(t => (
            <div key={t.id} onClick={() => setActiveId(t.id)} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-[var(--color-border)] ${activeId === t.id ? 'bg-[var(--color-bg-primary)]' : 'hover:bg-[var(--color-bg-hover)]'}`}>
              <span className="text-xs">{t.isRunning ? '⏳' : '⬤'}</span>
              <span className="text-sm">{t.name}</span>
              {terminals.length > 1 && <button onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2">
          <button onClick={addTerminal} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="新建终端">+</button>
          <button onClick={clear} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="清空">🗑️</button>
        </div>
      </div>

      {/* 输出区域 */}
      <div ref={outputRef} className="flex-1 overflow-auto p-2 font-mono text-sm bg-[#1e1e1e] text-[#d4d4d4]">
        {activeTerminal?.output.map((line, i) => <div key={i} className="whitespace-pre-wrap">{line}</div>)}
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="flex items-center border-t border-[var(--color-border)] bg-[#1e1e1e]">
        <span className="px-2 text-[#569cd6] font-mono text-sm">{activeTerminal?.cwd} $</span>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 py-2 bg-transparent text-[#d4d4d4] font-mono text-sm outline-none" placeholder="输入命令..." autoFocus disabled={activeTerminal?.isRunning} />
      </form>
    </div>
  );
};

// 输出面板
export interface OutputEntry { timestamp: number; level: 'info' | 'warn' | 'error' | 'debug'; source: string; message: string; }

export const OutputPanel: React.FC<{ entries: OutputEntry[]; onClear?: () => void }> = ({ entries, onClear }) => {
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entries]);

  const filtered = entries.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (filter && !e.message.toLowerCase().includes(filter.toLowerCase()) && !e.source.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const levelColors = { info: 'text-[var(--color-info)]', warn: 'text-[var(--color-warning)]', error: 'text-[var(--color-error)]', debug: 'text-[var(--color-text-muted)]' };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-[var(--color-border)]">
        <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="筛选输出..." className="flex-1 px-2 py-1 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded" />
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="px-2 py-1 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded">
          <option value="all">全部</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>
        {onClear && <button onClick={onClear} className="px-2 py-1 text-sm bg-[var(--color-bg-hover)] rounded">清空</button>}
      </div>
      <div ref={ref} className="flex-1 overflow-auto font-mono text-xs">
        {filtered.map((e, i) => (
          <div key={i} className={`flex items-start gap-2 px-2 py-1 hover:bg-[var(--color-bg-hover)] ${levelColors[e.level]}`}>
            <span className="text-[var(--color-text-muted)] w-16 flex-shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
            <span className="w-16 flex-shrink-0">[{e.source}]</span>
            <span className="flex-1 whitespace-pre-wrap">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 问题面板
export interface Problem { file: string; line: number; column: number; severity: 'error' | 'warning' | 'info'; message: string; source?: string; code?: string; }

export const ProblemsPanel: React.FC<{ problems: Problem[]; onProblemClick?: (problem: Problem) => void }> = ({ problems, onProblemClick }) => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  const filtered = filter === 'all' ? problems : problems.filter(p => p.severity === filter);
  const grouped = filtered.reduce((acc, p) => { (acc[p.file] = acc[p.file] || []).push(p); return acc; }, {} as Record<string, Problem[]>);

  const severityIcon = { error: '❌', warning: '⚠️', info: 'ℹ️' };
  const severityColor = { error: 'text-[var(--color-error)]', warning: 'text-[var(--color-warning)]', info: 'text-[var(--color-info)]' };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-[var(--color-border)]">
        <button onClick={() => setFilter('all')} className={`px-2 py-1 text-sm rounded ${filter === 'all' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-bg-hover)]'}`}>全部 ({problems.length})</button>
        <button onClick={() => setFilter('error')} className={`px-2 py-1 text-sm rounded flex items-center gap-1 ${filter === 'error' ? 'bg-[var(--color-error)] text-white' : 'bg-[var(--color-bg-hover)]'}`}>❌ {errorCount}</button>
        <button onClick={() => setFilter('warning')} className={`px-2 py-1 text-sm rounded flex items-center gap-1 ${filter === 'warning' ? 'bg-[var(--color-warning)] text-white' : 'bg-[var(--color-bg-hover)]'}`}>⚠️ {warningCount}</button>
      </div>
      <div className="flex-1 overflow-auto">
        {Object.entries(grouped).map(([file, fileProblems]) => (
          <div key={file}>
            <div className="px-2 py-1 text-sm font-medium bg-[var(--color-bg-secondary)] sticky top-0">{file}</div>
            {fileProblems.map((p, i) => (
              <div key={i} onClick={() => onProblemClick?.(p)} className={`flex items-start gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--color-bg-hover)] ${severityColor[p.severity]}`}>
                <span>{severityIcon[p.severity]}</span>
                <span className="text-[var(--color-text-muted)] text-xs">[{p.line},{p.column}]</span>
                <span className="text-sm flex-1">{p.message}</span>
                {p.code && <span className="text-xs text-[var(--color-text-muted)]">{p.code}</span>}
              </div>
            ))}
          </div>
        ))}
        {problems.length === 0 && <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">没有问题</div>}
      </div>
    </div>
  );
};

export default TerminalPanel;
