/**
 * GotoLine - 跳转到行号/符号
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Symbol { name: string; kind: 'class' | 'function' | 'variable' | 'interface' | 'type' | 'const' | 'enum'; line: number; column: number; }
interface GotoLineProps { maxLine: number; symbols?: Symbol[]; onGoto: (line: number, column?: number) => void; onClose: () => void; }

const SYMBOL_ICONS: Record<string, string> = { class: '🔷', function: '🔹', variable: '🔸', interface: '🔶', type: '📘', const: '📌', enum: '📋' };

export const GotoLine: React.FC<GotoLineProps> = ({ maxLine, symbols = [], onGoto, onClose }) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'line' | 'symbol'>('line');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filteredSymbols = symbols.filter(s => s.name.toLowerCase().includes(input.toLowerCase().replace('@', '')));

  useEffect(() => { // 检测模式
    if (input.startsWith('@')) setMode('symbol');
    else if (input.startsWith(':') || /^\d/.test(input)) setMode('line');
    setSelectedIndex(0);
  }, [input]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter') {
      if (mode === 'line') {
        const lineNum = parseInt(input.replace(':', ''), 10);
        if (!isNaN(lineNum) && lineNum >= 1 && lineNum <= maxLine) { onGoto(lineNum); onClose(); }
      } else if (mode === 'symbol' && filteredSymbols[selectedIndex]) {
        const s = filteredSymbols[selectedIndex];
        onGoto(s.line, s.column);
        onClose();
      }
      return;
    }
    if (mode === 'symbol') {
      if (e.key === 'ArrowDown') { setSelectedIndex(i => Math.min(i + 1, filteredSymbols.length - 1)); e.preventDefault(); }
      if (e.key === 'ArrowUp') { setSelectedIndex(i => Math.max(i - 1, 0)); e.preventDefault(); }
    }
  }, [input, mode, filteredSymbols, selectedIndex, maxLine, onGoto, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-50" onClick={onClose}>
      <div className="w-[500px] bg-[var(--color-bg-elevated)] rounded-lg shadow-xl border border-[var(--color-border)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-[var(--color-border)]">
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder=":行号 或 @符号" className="w-full px-3 py-2 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded text-sm focus:border-[var(--color-accent-primary)] outline-none" autoFocus />
          <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
            <span className={mode === 'line' ? 'text-[var(--color-accent-primary)]' : ''}>:行号 - 跳转到行</span>
            <span className={mode === 'symbol' ? 'text-[var(--color-accent-primary)]' : ''}>@符号 - 跳转到符号</span>
          </div>
        </div>
        {mode === 'symbol' && (
          <div className="max-h-[300px] overflow-auto">
            {filteredSymbols.length === 0 && <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">未找到符号</div>}
            {filteredSymbols.map((s, i) => (
              <div key={`${s.name}-${s.line}`} onClick={() => { onGoto(s.line, s.column); onClose(); }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${i === selectedIndex ? 'bg-[var(--color-accent-primary)] text-white' : 'hover:bg-[var(--color-bg-hover)]'}`}>
                <span>{SYMBOL_ICONS[s.kind] || '📄'}</span>
                <span className="flex-1 font-mono text-sm">{s.name}</span>
                <span className={`text-xs ${i === selectedIndex ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>:{s.line}</span>
              </div>
            ))}
          </div>
        )}
        {mode === 'line' && input && (
          <div className="p-3 text-sm">
            {(() => {
              const lineNum = parseInt(input.replace(':', ''), 10);
              if (isNaN(lineNum)) return <span className="text-[var(--color-text-muted)]">输入行号...</span>;
              if (lineNum < 1 || lineNum > maxLine) return <span className="text-[var(--color-error)]">行号超出范围 (1-{maxLine})</span>;
              return <span className="text-[var(--color-success)]">按 Enter 跳转到第 {lineNum} 行</span>;
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default GotoLine;
