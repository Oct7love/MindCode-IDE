/**
 * MessageContextMenu - 消息右键菜单组件
 * 
 * 特性：
 * - 支持 Copy / Copy as Plain Text / Copy as Markdown
 * - 位置自适应（避免溢出视口）
 * - 键盘导航
 * - 点击外部自动关闭
 */
import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { 
  copyMessage, 
  copyAllCodeBlocks, 
  CopyFormat,
  extractCodeBlocks 
} from './utils/copyService';
import './MessageContextMenu.css';

// ============================================
// 类型定义
// ============================================

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface MessageContextMenuProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 菜单位置 */
  position: ContextMenuPosition;
  /** 消息内容 */
  content: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 复制成功回调 */
  onCopySuccess?: (format: string) => void;
  /** 复制失败回调 */
  onCopyError?: (error: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => Promise<void>;
  disabled?: boolean;
  dividerAfter?: boolean;
}

// ============================================
// 图标组件
// ============================================

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
  </svg>
);

const TextIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M1.75 3a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75zM1.75 6a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75zM1.75 9a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75zM1.75 12a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/>
  </svg>
);

const MarkdownIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z"/>
  </svg>
);

const CodeIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
  </svg>
);

// ============================================
// 辅助函数
// ============================================

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function formatShortcut(shortcut: string): string {
  if (isMac) {
    return shortcut.replace('Ctrl', '⌘').replace('Shift', '⇧').replace('Alt', '⌥');
  }
  return shortcut;
}

// ============================================
// 主组件
// ============================================

export const MessageContextMenu: React.FC<MessageContextMenuProps> = memo(({
  isOpen,
  position,
  content,
  onClose,
  onCopySuccess,
  onCopyError
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // 检查代码块
  const codeBlocks = extractCodeBlocks(content);
  const hasCodeBlocks = codeBlocks.length > 0;

  // 菜单项
  const menuItems: MenuItem[] = [
    {
      id: 'copy',
      label: 'Copy',
      shortcut: 'Ctrl+C',
      icon: <CopyIcon />,
      action: async () => {
        const result = await copyMessage(content, 'markdown');
        if (result.success) {
          onCopySuccess?.('Markdown');
        } else {
          onCopyError?.(result.error || 'Failed');
        }
      }
    },
    {
      id: 'plaintext',
      label: 'Copy as Plain Text',
      shortcut: 'Ctrl+Shift+C',
      icon: <TextIcon />,
      action: async () => {
        const result = await copyMessage(content, 'plaintext');
        if (result.success) {
          onCopySuccess?.('Plain Text');
        } else {
          onCopyError?.(result.error || 'Failed');
        }
      }
    },
    {
      id: 'markdown',
      label: 'Copy as Markdown',
      icon: <MarkdownIcon />,
      dividerAfter: hasCodeBlocks,
      action: async () => {
        const result = await copyMessage(content, 'markdown');
        if (result.success) {
          onCopySuccess?.('Markdown');
        } else {
          onCopyError?.(result.error || 'Failed');
        }
      }
    },
    ...(hasCodeBlocks ? [{
      id: 'code',
      label: `Copy All Code Blocks (${codeBlocks.length})`,
      icon: <CodeIcon />,
      action: async () => {
        const result = await copyAllCodeBlocks(content);
        if (result.success) {
          onCopySuccess?.('Code Blocks');
        } else {
          onCopyError?.(result.error || 'Failed');
        }
      }
    }] : [])
  ];

  // 位置调整：防止溢出视口
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // 水平溢出检查
      if (x + rect.width > viewportWidth - 8) {
        x = viewportWidth - rect.width - 8;
      }
      if (x < 8) x = 8;

      // 垂直溢出检查
      if (y + rect.height > viewportHeight - 8) {
        y = viewportHeight - rect.height - 8;
      }
      if (y < 8) y = 8;

      setAdjustedPosition({ x, y });
    }
  }, [isOpen, position]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => {
            const next = prev + 1;
            return next >= menuItems.length ? 0 : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => {
            const next = prev - 1;
            return next < 0 ? menuItems.length - 1 : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && !menuItems[activeIndex].disabled) {
            handleItemClick(menuItems[activeIndex]);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, activeIndex, menuItems, onClose]);

  // 重置 activeIndex
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1);
    }
  }, [isOpen]);

  const handleItemClick = useCallback(async (item: MenuItem) => {
    if (item.disabled) return;
    
    await item.action();
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="message-context-menu"
      style={{ 
        left: adjustedPosition.x, 
        top: adjustedPosition.y 
      }}
      role="menu"
      aria-orientation="vertical"
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${activeIndex === index ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
            onMouseEnter={() => setActiveIndex(index)}
            role="menuitem"
            disabled={item.disabled}
            tabIndex={-1}
          >
            <span className="context-menu-item-icon">{item.icon}</span>
            <span className="context-menu-item-label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu-item-shortcut">
                {formatShortcut(item.shortcut)}
              </span>
            )}
          </button>
          {item.dividerAfter && <div className="context-menu-divider" />}
        </React.Fragment>
      ))}
    </div>
  );
});

MessageContextMenu.displayName = 'MessageContextMenu';

export default MessageContextMenu;
