/**
 * 调试控制台
 * 用于求值表达式
 */

import React, { useState, useRef, useEffect } from 'react';
import type { DebugSession } from '../../../core/debugger';

interface DebugConsoleProps {
  session: DebugSession | null;
  onEvaluate: (expression: string) => Promise<string>;
}

interface ConsoleEntry {
  id: string;
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: number;
}

export const DebugConsole: React.FC<DebugConsoleProps> = ({ session, onEvaluate }) => {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries]);

  const handleEvaluate = async () => {
    if (!input.trim() || !session) return;

    const expr = input.trim();
    const entryId = Date.now().toString();

    // 添加输入
    setEntries(prev => [...prev, {
      id: entryId + '-input',
      type: 'input',
      content: expr,
      timestamp: Date.now()
    }]);

    // 添加到历史
    setHistory(prev => [...prev, expr]);
    setHistoryIndex(-1);
    setInput('');

    try {
      const result = await onEvaluate(expr);
      setEntries(prev => [...prev, {
        id: entryId + '-output',
        type: 'output',
        content: result,
        timestamp: Date.now()
      }]);
    } catch (error: any) {
      setEntries(prev => [...prev, {
        id: entryId + '-error',
        type: 'error',
        content: error.message || 'Evaluation failed',
        timestamp: Date.now()
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEvaluate();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const clearConsole = () => {
    setEntries([]);
  };

  return (
    <div className="debug-console">
      <div className="console-header">
        <span className="console-title">Debug Console</span>
        <button className="clear-btn" onClick={clearConsole} title="Clear Console">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 1L1 8l7 7 7-7-7-7zM7 11H6V6h1v5zm2 0H8V6h1v5z"/>
          </svg>
        </button>
      </div>

      <div className="console-entries" ref={listRef}>
        {entries.map(entry => (
          <div key={entry.id} className={`console-entry entry-${entry.type}`}>
            {entry.type === 'input' && <span className="entry-prompt">&gt; </span>}
            <span className="entry-content">{entry.content}</span>
          </div>
        ))}
      </div>

      <div className="console-input-area">
        <span className="input-prompt">&gt; </span>
        <input
          ref={inputRef}
          type="text"
          className="console-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={session ? "Evaluate expression..." : "Start debugging to use console"}
          disabled={!session}
        />
      </div>
    </div>
  );
};
