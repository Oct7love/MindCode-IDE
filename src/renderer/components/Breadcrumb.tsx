/**
 * Breadcrumb 面包屑导航
 * 显示当前文件路径，支持快速跳转
 */

import React, { useMemo } from 'react';

interface BreadcrumbProps { path: string; workspaceRoot?: string; onNavigate?: (path: string) => void; }

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ path, workspaceRoot, onNavigate }) => {
  const segments = useMemo(() => {
    if (!path) return [];
    // 移除工作区根路径前缀
    let displayPath = path;
    if (workspaceRoot && path.startsWith(workspaceRoot)) {
      displayPath = path.slice(workspaceRoot.length).replace(/^[/\\]/, '');
    }
    // 分割路径
    const parts = displayPath.split(/[/\\]/).filter(Boolean);
    const result: Array<{ name: string; path: string; isLast: boolean }> = [];
    let currentPath = workspaceRoot || '';
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      result.push({ name: parts[i], path: currentPath, isLast: i === parts.length - 1 });
    }
    return result;
  }, [path, workspaceRoot]);

  if (segments.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden' }}>
      {/* 工作区根 */}
      {workspaceRoot && (
        <>
          <span onClick={() => onNavigate?.(workspaceRoot)} style={{ cursor: 'pointer', opacity: 0.7 }} title={workspaceRoot}>📁</span>
          <span style={{ opacity: 0.5 }}>/</span>
        </>
      )}
      {/* 路径段 */}
      {segments.map((seg, idx) => (
        <React.Fragment key={idx}>
          <span onClick={() => !seg.isLast && onNavigate?.(seg.path)} style={{ cursor: seg.isLast ? 'default' : 'pointer', color: seg.isLast ? 'var(--color-text-primary)' : 'inherit', fontWeight: seg.isLast ? 500 : 400, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={seg.path}>
            {seg.name}
          </span>
          {!seg.isLast && <span style={{ opacity: 0.5 }}>/</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumb;
