/**
 * TitleBar - Cursor 风格标题栏
 * 精致的毛玻璃效果 + 优雅的窗口控制按钮
 */
import React, { useState, useCallback, useEffect } from 'react';
import { MindCodeLogo } from './MindCodeLogo';
import './TitleBar.css';

interface TitleBarProps {
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  onSearchClick?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'MindCode',
  subtitle,
  showSearch = true,
  onSearchClick
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  // 监听窗口状态变化
  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI?.isMaximized) {
        const maximized = await window.electronAPI.isMaximized();
        setIsMaximized(maximized);
      }
    };
    
    checkMaximized();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow?.();
  }, []);

  const handleMaximize = useCallback(async () => {
    if (window.electronAPI?.maximizeWindow) {
      await window.electronAPI.maximizeWindow();
      setIsMaximized(prev => !prev);
    }
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow?.();
  }, []);

  return (
    <div className="titlebar">
      {/* 可拖拽区域 */}
      <div className="titlebar-drag-region" />
      
      {/* 左侧 - Logo + 标题 */}
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <MindCodeLogo size={20} animated={false} />
        </div>
        <div className="titlebar-title-group">
          <span className="titlebar-title">{title}</span>
          {subtitle && (
            <>
              <span className="titlebar-separator">—</span>
              <span className="titlebar-subtitle">{subtitle}</span>
            </>
          )}
        </div>
      </div>

      {/* 中间 - 快速搜索 */}
      {showSearch && (
        <div className="titlebar-center">
          <button 
            className="titlebar-search"
            onClick={onSearchClick}
            title="搜索文件... (Ctrl+P)"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M15.25 14.19l-4.06-4.06a5.5 5.5 0 1 0-1.06 1.06l4.06 4.06 1.06-1.06zM6.5 10.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
            </svg>
            <span>搜索文件...</span>
            <kbd>Ctrl+P</kbd>
          </button>
        </div>
      )}

      {/* 右侧 - 窗口控制 */}
      <div className="titlebar-controls">
        <button 
          className="titlebar-btn titlebar-btn-minimize"
          onClick={handleMinimize}
          title="最小化"
        >
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        
        <button 
          className="titlebar-btn titlebar-btn-maximize"
          onClick={handleMaximize}
          title={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path fill="currentColor" d="M3.5 1h5a.5.5 0 01.5.5V3h1.5a.5.5 0 01.5.5v7a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5V9H1.5a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5h2zm0 1H2v6h6V4H3.5a.5.5 0 01-.5-.5V2zm1 2h5v5H4V4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <rect x="2" y="2" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          )}
        </button>
        
        <button 
          className="titlebar-btn titlebar-btn-close"
          onClick={handleClose}
          title="关闭"
        >
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path fill="currentColor" d="M6.707 6l2.647-2.646-.708-.708L6 5.293 3.354 2.646l-.708.708L5.293 6 2.646 8.646l.708.708L6 6.707l2.646 2.647.708-.708L6.707 6z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
