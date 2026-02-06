/**
 * WelcomePage - Cursor 风格欢迎页
 * 精致的视觉设计 + 流畅的交互体验
 */

import React from 'react';
import { MindCodeLogo } from './MindCodeLogo';
import './WelcomePage.css';

interface WelcomePageProps {
  onOpenFolder?: () => void;
  onOpenFile?: () => void;
  onOpenRecent?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAIChat?: () => void;
  recentProjects?: { name: string; path: string }[];
  onOpenProject?: (path: string) => void;
  version?: string;
}

// 图标组件
const Icons = {
  Folder: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  File: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Command: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
    </svg>
  ),
  AI: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/>
    </svg>
  ),
  Project: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/>
      <path d="m19 9-5 5-4-4-3 3"/>
    </svg>
  ),
};

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onOpenFolder,
  onOpenFile,
  onOpenCommandPalette,
  onOpenAIChat,
  recentProjects = [],
  onOpenProject,
  version = '0.2.0'
}) => {
  const quickActions = [
    {
      icon: Icons.Folder,
      title: '打开文件夹',
      desc: '选择一个文件夹作为工作区',
      shortcut: 'Ctrl+K Ctrl+O',
      onClick: onOpenFolder
    },
    {
      icon: Icons.File,
      title: '打开文件',
      desc: '打开单个文件进行编辑',
      shortcut: 'Ctrl+O',
      onClick: onOpenFile
    },
    {
      icon: Icons.Command,
      title: '命令面板',
      desc: '快速执行任意命令',
      shortcut: 'Ctrl+Shift+P',
      onClick: onOpenCommandPalette
    },
    {
      icon: Icons.AI,
      title: 'AI 对话',
      desc: '与 AI 助手交流',
      shortcut: 'Ctrl+L',
      onClick: onOpenAIChat
    },
  ];

  return (
    <div className="welcome-page">
      <div className="welcome-content">
        {/* Logo */}
        <div className="welcome-logo">
          <MindCodeLogo size={80} animated={true} />
        </div>

        {/* 标题 */}
        <h1 className="welcome-title">MindCode</h1>
        <p className="welcome-subtitle">AI-Native Code Editor · v{version}</p>

        {/* 快速操作 */}
        <div className="welcome-actions">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              className="welcome-action"
              onClick={action.onClick}
            >
              <div className="welcome-action-icon">
                <action.icon />
              </div>
              <div className="welcome-action-content">
                <span className="welcome-action-title">{action.title}</span>
                <span className="welcome-action-desc">{action.desc}</span>
              </div>
              <span className="welcome-action-shortcut">{action.shortcut}</span>
            </button>
          ))}
        </div>

        {/* 最近项目 */}
        {recentProjects.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-header">
              <span className="welcome-recent-title">最近项目</span>
              <button className="welcome-recent-clear">清除</button>
            </div>
            <div className="welcome-recent-list">
              {recentProjects.slice(0, 5).map((project, idx) => (
                <button
                  key={idx}
                  className="welcome-recent-item"
                  onClick={() => onOpenProject?.(project.path)}
                >
                  <div className="welcome-recent-item-icon">
                    <Icons.Project />
                  </div>
                  <div className="welcome-recent-item-content">
                    <span className="welcome-recent-item-name">{project.name}</span>
                    <span className="welcome-recent-item-path">{project.path}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="welcome-footer">
        <span>Powered by Claude</span>
        <div className="welcome-footer-divider" />
        <a href="#">文档</a>
        <a href="#">反馈</a>
        <a href="#">GitHub</a>
      </div>
    </div>
  );
};

export default WelcomePage;
