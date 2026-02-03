/**
 * 索引状态组件 - 显示代码索引进度和统计
 */

import React, { useState, useEffect, useCallback } from 'react';
import './IndexStatus.css';

interface IndexStats { totalFiles: number; totalSymbols: number; totalCallRelations: number; totalDependencies: number; totalChunks: number; }
interface IndexProgress { status: string; totalFiles: number; indexedFiles: number; currentFile?: string; }

export const IndexStatus: React.FC<{ workspacePath: string | null }> = ({ workspacePath }) => {
  const [progress, setProgress] = useState<IndexProgress>({ status: 'idle', totalFiles: 0, indexedFiles: 0 });
  const [stats, setStats] = useState<IndexStats>({ totalFiles: 0, totalSymbols: 0, totalCallRelations: 0, totalDependencies: 0, totalChunks: 0 });
  const [expanded, setExpanded] = useState(false);

  // 监听索引进度
  useEffect(() => {
    if (!window.mindcode?.index) return;
    const cleanup1 = window.mindcode.index.onProgress?.((p) => setProgress(p));
    const cleanup2 = window.mindcode.index.onComplete?.((s) => { setStats(prev => ({ ...prev, totalFiles: s.files, totalSymbols: s.symbols })); setProgress({ status: 'complete', totalFiles: s.files, indexedFiles: s.files }); });
    return () => { cleanup1?.(); cleanup2?.(); };
  }, []);

  // 获取统计
  useEffect(() => {
    if (!workspacePath) return;
    window.mindcode?.index?.getStats?.().then(setStats).catch(() => {});
    window.mindcode?.index?.getProgress?.().then(setProgress).catch(() => {});
  }, [workspacePath]);

  // 开始索引
  const startIndex = useCallback(async () => {
    if (!workspacePath) return;
    setProgress({ status: 'scanning', totalFiles: 0, indexedFiles: 0 });
    await window.mindcode?.index?.indexWorkspace?.(workspacePath);
  }, [workspacePath]);

  // 取消索引
  const cancelIndex = useCallback(async () => {
    await window.mindcode?.index?.cancel?.();
    setProgress(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const isIndexing = progress.status === 'scanning' || progress.status === 'indexing';
  const percent = progress.totalFiles > 0 ? Math.round((progress.indexedFiles / progress.totalFiles) * 100) : 0;

  return (
    <div className="index-status">
      <div className="index-status-header" onClick={() => setExpanded(!expanded)}>
        <span className="index-status-icon">{isIndexing ? '🔄' : stats.totalSymbols > 0 ? '✓' : '○'}</span>
        <span className="index-status-label">索引</span>
        {isIndexing && <span className="index-status-progress">{percent}%</span>}
        {!isIndexing && stats.totalSymbols > 0 && <span className="index-status-count">{stats.totalSymbols} 符号</span>}
        <span className="index-status-chevron">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="index-status-details">
          <div className="index-status-stats">
            <div><span>📁</span> {stats.totalFiles} 文件</div>
            <div><span>🔣</span> {stats.totalSymbols} 符号</div>
            <div><span>🔗</span> {stats.totalCallRelations} 调用</div>
            <div><span>📦</span> {stats.totalDependencies} 依赖</div>
          </div>
          {isIndexing && (
            <div className="index-status-bar">
              <div className="index-status-bar-fill" style={{ width: `${percent}%` }} />
              <span className="index-status-bar-text">{progress.currentFile?.split(/[/\\]/).pop() || '扫描中...'}</span>
            </div>
          )}
          <div className="index-status-actions">
            {isIndexing ? (
              <button onClick={cancelIndex} className="index-btn index-btn-cancel">取消</button>
            ) : (
              <button onClick={startIndex} className="index-btn index-btn-start" disabled={!workspacePath}>{stats.totalSymbols > 0 ? '重建索引' : '开始索引'}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IndexStatus;
