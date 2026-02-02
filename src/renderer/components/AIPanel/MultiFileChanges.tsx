/**
 * MultiFileChanges - 多文件变更组件
 * 
 * 功能：
 * - 显示 Agent 模式批量修改的文件列表
 * - 每个文件可独立预览 Diff
 * - 支持批量接受/拒绝
 * - 支持单个文件接受/拒绝
 */
import React, { useState, useCallback, memo } from 'react';
import { DiffPreview } from './DiffPreview';
import './MultiFileChanges.css';

export interface FileChange {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  language: string;
  isNewFile: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  additions: number;
  deletions: number;
}

interface MultiFileChangesProps {
  changes: FileChange[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
  isApplying?: boolean;
}

// 文件图标
const FileIcon: React.FC<{ isNew: boolean }> = ({ isNew }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    {isNew ? (
      <path d="M9.293 0H4a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.707A1 1 0 0013.707 4L10 .293A1 1 0 009.293 0zM9.5 1.5v3a.5.5 0 00.5.5h3L9.5 1.5zM8 6.5a.5.5 0 011 0V8h1.5a.5.5 0 010 1H9v1.5a.5.5 0 01-1 0V9H6.5a.5.5 0 010-1H8V6.5z"/>
    ) : (
      <path d="M3.5 1h6.586a1.5 1.5 0 011.06.44l2.415 2.414a1.5 1.5 0 01.439 1.06V13a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13V2.5A1.5 1.5 0 013.5 1z"/>
    )}
  </svg>
);

// 状态徽章
const StatusBadge: React.FC<{ status: FileChange['status'] }> = ({ status }) => {
  const config = {
    pending: { label: 'Pending', className: 'pending' },
    accepted: { label: 'Accepted', className: 'accepted' },
    rejected: { label: 'Rejected', className: 'rejected' },
  };
  const { label, className } = config[status];
  return <span className={`status-badge status-badge--${className}`}>{label}</span>;
};

export const MultiFileChanges: React.FC<MultiFileChangesProps> = memo(({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onClose,
  isApplying = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 统计
  const stats = {
    total: changes.length,
    pending: changes.filter(c => c.status === 'pending').length,
    accepted: changes.filter(c => c.status === 'accepted').length,
    rejected: changes.filter(c => c.status === 'rejected').length,
    totalAdditions: changes.reduce((sum, c) => sum + c.additions, 0),
    totalDeletions: changes.reduce((sum, c) => sum + c.deletions, 0),
  };

  // 切换展开
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 打开 Diff 预览
  const handleOpenDiff = useCallback((change: FileChange) => {
    setSelectedFile(change);
  }, []);

  // 关闭 Diff 预览
  const handleCloseDiff = useCallback(() => {
    setSelectedFile(null);
  }, []);

  // 接受当前预览的文件
  const handleAcceptCurrent = useCallback(() => {
    if (selectedFile) {
      onAccept(selectedFile.id);
      setSelectedFile(null);
    }
  }, [selectedFile, onAccept]);

  // 拒绝当前预览的文件
  const handleRejectCurrent = useCallback(() => {
    if (selectedFile) {
      onReject(selectedFile.id);
      setSelectedFile(null);
    }
  }, [selectedFile, onReject]);

  return (
    <div className="multi-file-changes">
      {/* Header */}
      <div className="mfc-header">
        <div className="mfc-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.75 1.5a.75.75 0 00-1.5 0V5H3.75a.75.75 0 000 1.5H7.25V10H3.75a.75.75 0 000 1.5H7.25v3.5a.75.75 0 001.5 0V11.5h3.5a.75.75 0 000-1.5h-3.5V6.5h3.5a.75.75 0 000-1.5h-3.5V1.5z"/>
          </svg>
          <span>文件变更</span>
          <span className="mfc-count">{stats.total} 个文件</span>
        </div>
        <div className="mfc-stats">
          {stats.totalAdditions > 0 && (
            <span className="stat-added">+{stats.totalAdditions}</span>
          )}
          {stats.totalDeletions > 0 && (
            <span className="stat-deleted">-{stats.totalDeletions}</span>
          )}
        </div>
        <button className="mfc-close" onClick={onClose}>×</button>
      </div>

      {/* File List */}
      <div className="mfc-list">
        {changes.map(change => (
          <div 
            key={change.id} 
            className={`mfc-item mfc-item--${change.status}`}
          >
            <div className="mfc-item-header" onClick={() => toggleExpand(change.id)}>
              <div className="mfc-item-left">
                <span className={`mfc-expand ${expandedIds.has(change.id) ? 'expanded' : ''}`}>
                  ▶
                </span>
                <FileIcon isNew={change.isNewFile} />
                <span className="mfc-item-path">{change.filePath}</span>
                {change.isNewFile && <span className="mfc-badge new">NEW</span>}
              </div>
              <div className="mfc-item-right">
                <span className="mfc-item-stats">
                  {change.additions > 0 && <span className="stat-added">+{change.additions}</span>}
                  {change.deletions > 0 && <span className="stat-deleted">-{change.deletions}</span>}
                </span>
                <StatusBadge status={change.status} />
              </div>
            </div>
            
            {expandedIds.has(change.id) && (
              <div className="mfc-item-actions">
                <button 
                  className="mfc-action-btn preview"
                  onClick={() => handleOpenDiff(change)}
                >
                  预览
                </button>
                {change.status === 'pending' && (
                  <>
                    <button 
                      className="mfc-action-btn reject"
                      onClick={() => onReject(change.id)}
                      disabled={isApplying}
                    >
                      拒绝
                    </button>
                    <button 
                      className="mfc-action-btn accept"
                      onClick={() => onAccept(change.id)}
                      disabled={isApplying}
                    >
                      接受
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mfc-footer">
        <div className="mfc-footer-info">
          {stats.pending > 0 && (
            <span>{stats.pending} 个待处理</span>
          )}
          {stats.accepted > 0 && (
            <span className="accepted">{stats.accepted} 个已接受</span>
          )}
          {stats.rejected > 0 && (
            <span className="rejected">{stats.rejected} 个已拒绝</span>
          )}
        </div>
        <div className="mfc-footer-actions">
          <button 
            className="mfc-btn secondary"
            onClick={onRejectAll}
            disabled={stats.pending === 0 || isApplying}
          >
            全部拒绝
          </button>
          <button 
            className="mfc-btn primary"
            onClick={onAcceptAll}
            disabled={stats.pending === 0 || isApplying}
          >
            {isApplying ? '应用中...' : '全部接受'}
          </button>
        </div>
      </div>

      {/* Diff Preview Modal */}
      {selectedFile && (
        <DiffPreview
          isOpen={true}
          filePath={selectedFile.filePath}
          originalContent={selectedFile.originalContent}
          modifiedContent={selectedFile.newContent}
          language={selectedFile.language}
          isNewFile={selectedFile.isNewFile}
          onAccept={handleAcceptCurrent}
          onReject={handleRejectCurrent}
          onClose={handleCloseDiff}
        />
      )}
    </div>
  );
});

MultiFileChanges.displayName = 'MultiFileChanges';

export default MultiFileChanges;
