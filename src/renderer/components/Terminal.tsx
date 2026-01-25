/**
 * MindCode - 集成终端组件
 * 简易实现，支持基本的命令执行
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

interface TerminalProps {
  workspacePath: string | null;
  isVisible: boolean;
  onClose: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({ workspacePath, isVisible, onClose }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: '1',
      type: 'system',
      content: 'MindCode Terminal - 输入命令开始使用',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentDir, setCurrentDir] = useState(workspacePath || '');

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 更新工作目录
  useEffect(() => {
    if (workspacePath && currentDir !== workspacePath) {
      setCurrentDir(workspacePath);
      addLine('system', `工作目录: ${workspacePath}`);
    }
  }, [workspacePath]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // 聚焦输入框
  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      type,
      content,
      timestamp: new Date()
    }]);
  }, []);

  // 执行命令
  const executeCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;

    // 添加输入行
    addLine('input', `$ ${cmd}`);
    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setIsExecuting(true);

    // 内置命令处理
    const trimmedCmd = cmd.trim();

    // clear / cls 命令
    if (trimmedCmd === 'clear' || trimmedCmd === 'cls') {
      setLines([{
        id: Date.now().toString(),
        type: 'system',
        content: 'Terminal cleared',
        timestamp: new Date()
      }]);
      setIsExecuting(false);
      return;
    }

    // cd 命令
    if (trimmedCmd.startsWith('cd ')) {
      const newDir = trimmedCmd.slice(3).trim();
      if (window.mindcode?.terminal) {
        try {
          const result = await window.mindcode.terminal.cd(currentDir, newDir);
          if (result.success && result.data) {
            setCurrentDir(result.data);
            addLine('output', result.data);
          } else {
            addLine('error', result.error || '目录不存在');
          }
        } catch (err: any) {
          addLine('error', err.message);
        }
      } else {
        addLine('error', '终端 API 不可用');
      }
      setIsExecuting(false);
      return;
    }

    // pwd 命令
    if (trimmedCmd === 'pwd') {
      addLine('output', currentDir || process.cwd?.() || '未知');
      setIsExecuting(false);
      return;
    }

    // 执行外部命令
    if (window.mindcode?.terminal) {
      try {
        const result = await window.mindcode.terminal.execute(trimmedCmd, currentDir);
        if (result.success) {
          if (result.data?.stdout) {
            result.data.stdout.split('\n').forEach((line: string) => {
              if (line.trim()) addLine('output', line);
            });
          }
          if (result.data?.stderr) {
            result.data.stderr.split('\n').forEach((line: string) => {
              if (line.trim()) addLine('error', line);
            });
          }
        } else {
          addLine('error', result.error || '命令执行失败');
        }
      } catch (err: any) {
        addLine('error', err.message);
      }
    } else {
      addLine('error', '终端 API 不可用，请在 Electron 中运行');
    }

    setIsExecuting(false);
  }, [currentDir, addLine]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
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
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      // Ctrl+C 取消
      if (isExecuting) {
        addLine('system', '^C');
        setIsExecuting(false);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      // Ctrl+L 清屏
      e.preventDefault();
      setLines([{
        id: Date.now().toString(),
        type: 'system',
        content: 'Terminal cleared',
        timestamp: new Date()
      }]);
    }
  }, [input, history, historyIndex, isExecuting, executeCommand, addLine]);

  // 获取当前目录显示名
  const displayDir = currentDir ? currentDir.split(/[/\\]/).pop() || currentDir : '~';

  if (!isVisible) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <div className="terminal-tab active">
            <span className="terminal-tab-icon">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V3h12v10z"/>
                <path d="M4 5l4 3-4 3v-6z"/>
                <path d="M8 11h4v1H8z"/>
              </svg>
            </span>
            <span className="terminal-tab-label">终端</span>
          </div>
        </div>
        <div className="terminal-actions">
          <button className="terminal-action-btn" onClick={() => setLines([{
            id: Date.now().toString(),
            type: 'system',
            content: 'Terminal cleared',
            timestamp: new Date()
          }])} title="清空终端">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5z"/>
            </svg>
          </button>
          <button className="terminal-action-btn" onClick={onClose} title="关闭终端">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="terminal-content" ref={scrollRef} onClick={() => inputRef.current?.focus()}>
        {lines.map(line => (
          <div key={line.id} className={`terminal-line terminal-line-${line.type}`}>
            {line.content}
          </div>
        ))}

        <div className="terminal-input-line">
          <span className="terminal-prompt">
            <span className="terminal-prompt-user">mindcode</span>
            <span className="terminal-prompt-sep">:</span>
            <span className="terminal-prompt-dir">{displayDir}</span>
            <span className="terminal-prompt-symbol">$</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            spellCheck={false}
            autoComplete="off"
          />
          {isExecuting && <span className="terminal-spinner" />}
        </div>
      </div>
    </div>
  );
};

export default Terminal;
