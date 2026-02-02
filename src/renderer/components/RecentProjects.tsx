/**
 * RecentProjects - 最近项目列表
 * 快速打开、管理最近的工作区
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface RecentProject { path: string; name: string; lastOpened: number; pinned?: boolean; }

const STORAGE_KEY = 'mindcode_recent_projects';
const MAX_RECENT = 20;

interface RecentProjectsProps { isOpen: boolean; onClose: () => void; onOpen: (path: string) => void; currentPath?: string; }

export const RecentProjects: React.FC<RecentProjectsProps> = ({ isOpen, onClose, onOpen, currentPath }) => {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [filter, setFilter] = useState('');

  // 加载项目
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setProjects(JSON.parse(stored));
  }, []);

  // 保存项目
  const saveProjects = useCallback((newProjects: RecentProject[]) => {
    setProjects(newProjects);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects.slice(0, MAX_RECENT)));
  }, []);

  // 打开项目
  const handleOpen = useCallback((project: RecentProject) => {
    // 更新打开时间
    const updated = projects.map(p => p.path === project.path ? { ...p, lastOpened: Date.now() } : p);
    saveProjects(updated);
    onOpen(project.path);
    onClose();
  }, [projects, saveProjects, onOpen, onClose]);

  // 移除项目
  const removeProject = useCallback((path: string) => {
    saveProjects(projects.filter(p => p.path !== path));
  }, [projects, saveProjects]);

  // 固定/取消固定
  const togglePin = useCallback((path: string) => {
    saveProjects(projects.map(p => p.path === path ? { ...p, pinned: !p.pinned } : p));
  }, [projects, saveProjects]);

  // 清空非固定项目
  const clearUnpinned = useCallback(() => {
    saveProjects(projects.filter(p => p.pinned));
  }, [projects, saveProjects]);

  // 过滤和排序
  const filtered = projects
    .filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.path.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => { if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1; return b.lastOpened - a.lastOpened; });

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '60vw', maxWidth: 700, height: '60vh', background: 'var(--color-bg-elevated)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>📂 最近项目</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={clearUnpinned} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 11 }}>清空历史</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索项目..." autoFocus style={{ width: '100%', padding: '10px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, color: 'inherit' }} />
        </div>

        {/* 项目列表 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13 }}>无最近项目</div>
            </div>
          ) : (
            filtered.map(project => (
              <div key={project.path} onClick={() => handleOpen(project)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: project.path === currentPath ? 'var(--color-bg-hover)' : 'transparent' }}>
                <span style={{ fontSize: 20 }}>{project.pinned ? '📌' : '📁'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.path}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatTime(project.lastOpened)}</span>
                <button onClick={e => { e.stopPropagation(); togglePin(project.path); }} title={project.pinned ? '取消固定' : '固定'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: project.pinned ? '#f59e0b' : 'var(--color-text-muted)', padding: 4 }}>{project.pinned ? '★' : '☆'}</button>
                <button onClick={e => { e.stopPropagation(); removeProject(project.path); }} title="移除" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-muted)', padding: 4 }}>✕</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// 添加项目到最近列表
export function addRecentProject(path: string, name?: string): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const projects: RecentProject[] = stored ? JSON.parse(stored) : [];
  const existing = projects.find(p => p.path === path);
  const projectName = name || path.split(/[/\\]/).pop() || path;
  if (existing) {
    existing.lastOpened = Date.now();
  } else {
    projects.unshift({ path, name: projectName, lastOpened: Date.now() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_RECENT)));
}

export default RecentProjects;
