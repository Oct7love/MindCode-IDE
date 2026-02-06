/**
 * ActivityBar - Cursor 风格活动栏
 * 精致的图标按钮 + 优雅的悬停效果
 */
import React, { memo } from 'react';
import './ActivityBar.css';

export type ActivityItem = 'explorer' | 'search' | 'git' | 'debug' | 'extensions' | 'ai';

interface ActivityBarProps {
  activeItem: ActivityItem;
  onItemClick: (item: ActivityItem) => void;
  onSettingsClick?: () => void;
  onAccountClick?: () => void;
  showAIBadge?: boolean;
}

// 图标组件
const Icons = {
  Explorer: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  Git: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"/>
      <circle cx="6" cy="6" r="3"/>
      <path d="M6 21V9a9 9 0 0 0 9 9"/>
    </svg>
  ),
  Debug: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 2 1.88 1.88"/>
      <path d="M14.12 3.88 16 2"/>
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
      <path d="M12 20v-9"/>
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>
      <path d="M6 13H2"/>
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4"/>
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/>
      <path d="M22 13h-4"/>
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
    </svg>
  ),
  Extensions: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4"/>
      <path d="m6.41 6.41 2.83 2.83"/>
      <path d="M2 12h4"/>
      <path d="m6.41 17.59 2.83-2.83"/>
      <path d="M12 22v-4"/>
      <path d="m17.59 17.59-2.83-2.83"/>
      <path d="M22 12h-4"/>
      <path d="m17.59 6.41-2.83 2.83"/>
    </svg>
  ),
  AI: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Account: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5"/>
      <path d="M20 21a8 8 0 0 0-16 0"/>
    </svg>
  ),
};

const ACTIVITY_ITEMS: { id: ActivityItem; icon: React.FC; label: string; shortcut?: string }[] = [
  { id: 'explorer', icon: Icons.Explorer, label: '资源管理器', shortcut: 'Ctrl+Shift+E' },
  { id: 'search', icon: Icons.Search, label: '搜索', shortcut: 'Ctrl+Shift+F' },
  { id: 'git', icon: Icons.Git, label: '源代码管理', shortcut: 'Ctrl+Shift+G' },
  { id: 'debug', icon: Icons.Debug, label: '运行和调试', shortcut: 'Ctrl+Shift+D' },
  { id: 'extensions', icon: Icons.Extensions, label: '扩展', shortcut: 'Ctrl+Shift+X' },
];

export const ActivityBar: React.FC<ActivityBarProps> = memo(({
  activeItem,
  onItemClick,
  onSettingsClick,
  onAccountClick,
  showAIBadge
}) => {
  return (
    <div className="activity-bar">
      {/* 主要活动项 */}
      <div className="activity-bar-top">
        {ACTIVITY_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`activity-bar-item ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => onItemClick(item.id)}
              title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
            >
              <div className="activity-bar-item-indicator" />
              <div className="activity-bar-item-icon">
                <Icon />
              </div>
            </button>
          );
        })}
        
        {/* AI 按钮 - 特殊样式 */}
        <button
          className={`activity-bar-item activity-bar-item-ai ${activeItem === 'ai' ? 'active' : ''}`}
          onClick={() => onItemClick('ai')}
          title="AI 助手 (Ctrl+L)"
        >
          <div className="activity-bar-item-indicator" />
          <div className="activity-bar-item-icon">
            <Icons.AI />
          </div>
          {showAIBadge && <span className="activity-bar-badge" />}
        </button>
      </div>

      {/* 底部设置区 */}
      <div className="activity-bar-bottom">
        {onAccountClick && (
          <button
            className="activity-bar-item activity-bar-item-secondary"
            onClick={onAccountClick}
            title="账户"
          >
            <div className="activity-bar-item-icon">
              <Icons.Account />
            </div>
          </button>
        )}
        
        {onSettingsClick && (
          <button
            className="activity-bar-item activity-bar-item-secondary"
            onClick={onSettingsClick}
            title="设置 (Ctrl+,)"
          >
            <div className="activity-bar-item-icon">
              <Icons.Settings />
            </div>
          </button>
        )}
      </div>
    </div>
  );
});

ActivityBar.displayName = 'ActivityBar';

export default ActivityBar;
