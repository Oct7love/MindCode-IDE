/**
 * OutlinePanel - 符号导航面板
 * 显示当前文件的代码结构（类、函数、变量等）
 */

import React, { useState, useEffect, useMemo } from 'react';

export type SymbolKind = 'class' | 'interface' | 'function' | 'method' | 'variable' | 'constant' | 'enum' | 'property' | 'type';
export interface OutlineSymbol { name: string; kind: SymbolKind; line: number; endLine?: number; children?: OutlineSymbol[]; }

const SYMBOL_ICONS: Record<SymbolKind, string> = { class: '🔷', interface: '🔶', function: 'ƒ', method: '◆', variable: '◇', constant: '●', enum: '▣', property: '○', type: '◈' };
const SYMBOL_COLORS: Record<SymbolKind, string> = { class: '#569cd6', interface: '#4ec9b0', function: '#dcdcaa', method: '#dcdcaa', variable: '#9cdcfe', constant: '#4fc1ff', enum: '#b5cea8', property: '#9cdcfe', type: '#4ec9b0' };

interface OutlinePanelProps { symbols: OutlineSymbol[]; onNavigate: (line: number) => void; currentLine?: number; }

export const OutlinePanel: React.FC<OutlinePanelProps> = ({ symbols, onNavigate, currentLine }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  // 初始展开所有
  useEffect(() => { setExpanded(new Set(symbols.map(s => s.name))); }, [symbols]);

  // 过滤符号
  const filtered = useMemo(() => {
    if (!filter) return symbols;
    const lowerFilter = filter.toLowerCase();
    const filterSymbols = (syms: OutlineSymbol[]): OutlineSymbol[] => {
      return syms.filter(s => s.name.toLowerCase().includes(lowerFilter) || (s.children && filterSymbols(s.children).length > 0))
        .map(s => ({ ...s, children: s.children ? filterSymbols(s.children) : undefined }));
    };
    return filterSymbols(symbols);
  }, [symbols, filter]);

  const toggleExpand = (name: string) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  };

  const renderSymbol = (symbol: OutlineSymbol, depth = 0): React.ReactNode => {
    const hasChildren = symbol.children && symbol.children.length > 0;
    const isExpanded = expanded.has(symbol.name);
    const isActive = currentLine !== undefined && currentLine >= symbol.line && (!symbol.endLine || currentLine <= symbol.endLine);

    return (
      <div key={`${symbol.name}-${symbol.line}`}>
        <div onClick={() => onNavigate(symbol.line)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', paddingLeft: 8 + depth * 16, cursor: 'pointer', background: isActive ? 'var(--color-bg-hover)' : 'transparent', borderLeft: isActive ? '2px solid var(--color-accent-primary)' : '2px solid transparent' }}>
          {hasChildren ? (
            <span onClick={e => { e.stopPropagation(); toggleExpand(symbol.name); }} style={{ width: 12, cursor: 'pointer', opacity: 0.6 }}>{isExpanded ? '▼' : '▶'}</span>
          ) : <span style={{ width: 12 }} />}
          <span style={{ color: SYMBOL_COLORS[symbol.kind], fontSize: 12 }}>{SYMBOL_ICONS[symbol.kind]}</span>
          <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{symbol.name}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{symbol.line}</span>
        </div>
        {hasChildren && isExpanded && symbol.children!.map(child => renderSymbol(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 搜索框 */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="筛选符号..." style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
      </div>
      {/* 符号列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>无符号</div>
        ) : filtered.map(s => renderSymbol(s))}
      </div>
    </div>
  );
};

/** 从代码提取符号（简化版） */
export function extractSymbols(code: string, language: string): OutlineSymbol[] {
  const symbols: OutlineSymbol[] = [];
  const lines = code.split('\n');
  const patterns: Record<string, Array<{ pattern: RegExp; kind: SymbolKind }>> = {
    typescript: [
      { pattern: /^(?:export\s+)?class\s+(\w+)/, kind: 'class' },
      { pattern: /^(?:export\s+)?interface\s+(\w+)/, kind: 'interface' },
      { pattern: /^(?:export\s+)?type\s+(\w+)/, kind: 'type' },
      { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: 'function' },
      { pattern: /^(?:export\s+)?const\s+(\w+)\s*=/, kind: 'constant' },
      { pattern: /^(?:export\s+)?enum\s+(\w+)/, kind: 'enum' },
    ],
    javascript: [
      { pattern: /^(?:export\s+)?class\s+(\w+)/, kind: 'class' },
      { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: 'function' },
      { pattern: /^(?:export\s+)?const\s+(\w+)\s*=/, kind: 'constant' },
    ],
    python: [
      { pattern: /^class\s+(\w+)/, kind: 'class' },
      { pattern: /^(?:async\s+)?def\s+(\w+)/, kind: 'function' },
    ],
  };
  const langPatterns = patterns[language] || patterns.typescript;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    for (const { pattern, kind } of langPatterns) {
      const match = trimmed.match(pattern);
      if (match) { symbols.push({ name: match[1], kind, line: idx + 1 }); break; }
    }
  });
  return symbols;
}

export default OutlinePanel;
