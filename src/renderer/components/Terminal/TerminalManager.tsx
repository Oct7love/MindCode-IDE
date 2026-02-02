/**
 * TerminalManager - 终端管理器
 * 多终端标签页、创建、切换、关闭
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

export interface TerminalTab { id: string; name: string; cwd?: string; pid?: number; status: 'running' | 'idle' | 'error'; output: string[]; }

interface TerminalManagerProps { workspacePath?: string; onExecute?: (cmd: string, cwd?: string) => Promise<{ output: string; exitCode: number }>; }

export const TerminalManager: React.FC<TerminalManagerProps> = ({ workspacePath, onExecute }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 'term-1', name: 'Terminal 1', cwd: workspacePath, status: 'idle', output: [] }]);
  const [activeTab, setActiveTab] = useState('term-1');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);

  // 当前终端
  const currentTab = tabs.find(t => t.id === activeTab);

  // 滚动到底部
  useEffect(() => { outputRef.current?.scrollTo(0, outputRef.current.scrollHeight); }, [currentTab?.output]);

  // 创建新终端
  const createTab = () => {
    const id = `term-${Date.now()}`;
    const newTab: TerminalTab = { id, name: `Terminal ${tabs.length + 1}`, cwd: workspacePath, status: 'idle', output: [] };
    setTabs([...tabs, newTab]);
    setActiveTab(id);
  };

  // 关闭终端
  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTab === id) setActiveTab(newTabs[0].id);
  };

  // 重命名终端
  const renameTab = (id: string, name: string) => {
    setTabs(tabs.map(t => t.id === id ? { ...t, name } : t));
  };

  // 执行命令
  const executeCommand = useCallback(async () => {
    if (!input.trim() || !onExecute || !currentTab) return;
    const cmd = input.trim();
    setInput('');
    setHistory(prev => [...prev.filter(h => h !== cmd), cmd].slice(-100));
    setHistoryIndex(-1);

    // 添加命令到输出
    setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, output: [...t.output, `$ ${cmd}`], status: 'running' } : t));

    try {
      const result = await onExecute(cmd, currentTab.cwd);
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, output: [...t.output, result.output], status: result.exitCode === 0 ? 'idle' : 'error' } : t));
    } catch (err: any) {
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, output: [...t.output, `Error: ${err.message}`], status: 'error' } : t));
    }
  }, [input, onExecute, currentTab, activeTab]);

  // 历史导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { executeCommand(); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  // 清空输出
  const clearOutput = () => {
    setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, output: [] } : t));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e' }}>
      {/* 标签栏 */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #333', background: '#252526' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', cursor: 'pointer', background: activeTab === tab.id ? '#1e1e1e' : 'transparent', borderRight: '1px solid #333', fontSize: 12, color: activeTab === tab.id ? '#fff' : '#888' }}>
              <span style={{ color: tab.status === 'running' ? '#f59e0b' : tab.status === 'error' ? '#ef4444' : '#22c55e' }}>●</span>
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button onClick={e => { e.stopPropagation(); closeTab(tab.id); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '0 8px' }}>
          <button onClick={createTab} title="新建终端" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>+</button>
          <button onClick={clearOutput} title="清空" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>🗑</button>
        </div>
      </div>

      {/* 输出区域 */}
      <div ref={outputRef} style={{ flex: 1, overflow: 'auto', padding: 12, fontFamily: 'Consolas, Monaco, monospace', fontSize: 12, color: '#d4d4d4' }}>
        {currentTab?.output.map((line, idx) => (
          <div key={idx} style={{ marginBottom: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: line.startsWith('$') ? '#569cd6' : line.startsWith('Error') ? '#ef4444' : '#d4d4d4' }}>{line}</div>
        ))}
      </div>

      {/* 输入区域 */}
      <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #333', padding: 8 }}>
        <span style={{ color: '#569cd6', marginRight: 8, fontSize: 12 }}>$</span>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入命令..." style={{ flex: 1, background: 'transparent', border: 'none', color: '#d4d4d4', fontSize: 12, fontFamily: 'Consolas, Monaco, monospace', outline: 'none' }} autoFocus />
      </div>
    </div>
  );
};

export default TerminalManager;
