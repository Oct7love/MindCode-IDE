/**
 * WelcomePage - 欢迎页面
 * 首次启动引导、快捷操作入口
 */

import React from 'react';

interface WelcomePageProps { onOpenFolder?: () => void; onOpenFile?: () => void; onOpenRecent?: () => void; recentProjects?: { name: string; path: string }[]; onOpenProject?: (path: string) => void; version?: string; }

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenFolder, onOpenFile, onOpenRecent, recentProjects = [], onOpenProject, version = '1.0.0' }) => {
  const shortcuts = [
    { keys: 'Ctrl+Shift+P', desc: '命令面板' },
    { keys: 'Ctrl+P', desc: '快速打开' },
    { keys: 'Ctrl+L', desc: 'AI 对话' },
    { keys: 'Ctrl+`', desc: '终端' },
    { keys: 'Ctrl+B', desc: '侧边栏' },
    { keys: 'Ctrl+Shift+F', desc: '全局搜索' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, background: 'var(--color-bg-base)' }}>
      {/* Logo & Title */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🧠</div>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 300 }}>MindCode</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>AI-Powered Code Editor · v{version}</p>
      </div>

      {/* 主要操作 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 48 }}>
        <button onClick={onOpenFolder} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 32px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, cursor: 'pointer', minWidth: 140 }}>
          <span style={{ fontSize: 28 }}>📂</span>
          <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>打开文件夹</span>
        </button>
        <button onClick={onOpenFile} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 32px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, cursor: 'pointer', minWidth: 140 }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>打开文件</span>
        </button>
        <button onClick={onOpenRecent} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 32px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 12, cursor: 'pointer', minWidth: 140 }}>
          <span style={{ fontSize: 28 }}>🕐</span>
          <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>最近项目</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 48, maxWidth: 800, width: '100%' }}>
        {/* 最近项目 */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 500 }}>最近项目</h3>
          {recentProjects.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>无最近项目</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentProjects.slice(0, 5).map(project => (
                <button key={project.path} onClick={() => onOpenProject?.(project.path)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 16 }}>📁</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.path}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 快捷键 */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 500 }}>快捷键</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shortcuts.map(s => (
              <div key={s.keys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{s.desc}</span>
                <code style={{ padding: '4px 8px', background: 'var(--color-bg-elevated)', borderRadius: 4, fontSize: 11 }}>{s.keys}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部链接 */}
      <div style={{ marginTop: 48, display: 'flex', gap: 24, color: 'var(--color-text-muted)', fontSize: 12 }}>
        <a href="#" style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>📚 文档</a>
        <a href="#" style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>💬 反馈</a>
        <a href="#" style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>⭐ GitHub</a>
      </div>
    </div>
  );
};

export default WelcomePage;
