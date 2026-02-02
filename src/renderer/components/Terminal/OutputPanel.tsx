/**
 * OutputPanel - 输出/问题面板
 * 日志、警告、错误分类显示
 */

import React, { useState, useMemo, useCallback } from 'react';

export type OutputType = 'log' | 'info' | 'warn' | 'error';
export interface OutputItem { id: string; type: OutputType; message: string; source?: string; timestamp: number; line?: number; file?: string; }

interface OutputPanelProps { items: OutputItem[]; onNavigate?: (file: string, line: number) => void; onClear?: () => void; }

export const OutputPanel: React.FC<OutputPanelProps> = ({ items, onNavigate, onClear }) => {
  const [filter, setFilter] = useState<OutputType | 'all'>('all');
  const [search, setSearch] = useState('');

  // 过滤
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (search && !item.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, search]);

  // 统计
  const counts = useMemo(() => ({
    all: items.length,
    log: items.filter(i => i.type === 'log').length,
    info: items.filter(i => i.type === 'info').length,
    warn: items.filter(i => i.type === 'warn').length,
    error: items.filter(i => i.type === 'error').length,
  }), [items]);

  // 类型样式
  const getTypeStyle = (type: OutputType) => ({
    log: { color: '#d4d4d4', icon: '○' },
    info: { color: '#3b82f6', icon: 'ℹ' },
    warn: { color: '#f59e0b', icon: '⚠' },
    error: { color: '#ef4444', icon: '✕' },
  }[type]);

  // 格式化时间
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', color: '#d4d4d4' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #333' }}>
        {/* 过滤按钮 */}
        {(['all', 'error', 'warn', 'info', 'log'] as const).map(type => (
          <button key={type} onClick={() => setFilter(type)} style={{ padding: '4px 8px', background: filter === type ? '#333' : 'transparent', border: '1px solid #333', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: type === 'all' ? '#d4d4d4' : getTypeStyle(type as OutputType).color }}>
            {type === 'all' ? '全部' : type.toUpperCase()} ({counts[type]})
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." style={{ padding: '4px 8px', background: '#333', border: 'none', borderRadius: 3, color: '#d4d4d4', fontSize: 11, width: 120 }} />
        <button onClick={onClear} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #333', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#888' }}>清空</button>
      </div>

      {/* 输出列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 12 }}>无输出</div>
        ) : (
          filtered.map(item => {
            const style = getTypeStyle(item.type);
            return (
              <div key={item.id} onClick={() => item.file && item.line && onNavigate?.(item.file, item.line)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 12px', borderBottom: '1px solid #2d2d2d', cursor: item.file ? 'pointer' : 'default', fontSize: 11 }}>
                <span style={{ color: style.color, width: 12 }}>{style.icon}</span>
                <span style={{ color: '#666', width: 60, flexShrink: 0 }}>{formatTime(item.timestamp)}</span>
                {item.source && <span style={{ color: '#569cd6', flexShrink: 0 }}>[{item.source}]</span>}
                <span style={{ flex: 1, color: style.color, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.message}</span>
                {item.file && <span style={{ color: '#666', fontSize: 10 }}>{item.file}{item.line ? `:${item.line}` : ''}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// 输出管理 Hook
export function useOutput() {
  const [items, setItems] = useState<OutputItem[]>([]);
  
  const log = useCallback((message: string, source?: string) => {
    setItems(prev => [...prev, { id: `out-${Date.now()}`, type: 'log', message, source, timestamp: Date.now() }]);
  }, []);
  
  const info = useCallback((message: string, source?: string) => {
    setItems(prev => [...prev, { id: `out-${Date.now()}`, type: 'info', message, source, timestamp: Date.now() }]);
  }, []);
  
  const warn = useCallback((message: string, source?: string, file?: string, line?: number) => {
    setItems(prev => [...prev, { id: `out-${Date.now()}`, type: 'warn', message, source, timestamp: Date.now(), file, line }]);
  }, []);
  
  const error = useCallback((message: string, source?: string, file?: string, line?: number) => {
    setItems(prev => [...prev, { id: `out-${Date.now()}`, type: 'error', message, source, timestamp: Date.now(), file, line }]);
  }, []);
  
  const clear = useCallback(() => setItems([]), []);

  return { items, log, info, warn, error, clear };
}

export default OutputPanel;
