/**
 * MindCode - 文件右键菜单组件
 */

import React, { useState, useRef, useEffect } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
}

interface FileContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  targetPath: string;
  targetName: string;
  isFolder: boolean;
  isWorkspaceRoot?: boolean;
  onClose: () => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (path: string, name: string) => void;
  onDelete: (path: string, name: string, isFolder: boolean) => void;
  onCopy: (path: string) => void;
  onPaste: (targetPath: string) => void;
  onRevealInExplorer?: (path: string) => void;
  hasCopiedPath: boolean;
}

// 图标
const Icons = {
  File: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M10.5 1H3.5C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V4.5L10.5 1z"/>
    </svg>
  ),
  Folder: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3z"/>
    </svg>
  ),
  Rename: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M3.5 12l-.5.5v1l.5.5H6v-1H4v-1h-.5zm8-9H6v1h5.5l.5.5v8l-.5.5H6v1h5.5l.5-.5v-10l-.5-.5z"/>
    </svg>
  ),
  Delete: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5zm2 2h1v6H7V6zm2 0h1v6H9V6z"/>
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M4 4l1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3l-3-3H5v10h8V7zM3 1L2 2v10l1 1V2h6.414l-1-1H3z"/>
    </svg>
  ),
  Paste: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M11 1H6L5 2v1H4L3 4v10l1 1h7l1-1v-1h1l1-1V4l-1-1h-1V2l-1-1zm0 2v1H6V2h5v1zM4 14V4h7v10H4z"/>
    </svg>
  ),
  Reveal: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M1.5 14h13l.5-.5v-5l-.5-.5H14v5H2V8H.5l-.5.5v5l.5.5zM8 2L4 6h3v5h2V6h3L8 2z"/>
    </svg>
  ),
};

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  isOpen,
  position,
  targetPath,
  targetName,
  isFolder,
  isWorkspaceRoot,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopy,
  onPaste,
  onRevealInExplorer,
  hasCopiedPath
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 计算菜单应该放置的位置（获取父目录路径）
  const parentPath = isFolder ? targetPath : targetPath.replace(/[/\\][^/\\]+$/, '');

  const menuItems: MenuItem[] = [
    { id: 'new-file', label: '新建文件', icon: <Icons.File />, shortcut: '' },
    { id: 'new-folder', label: '新建文件夹', icon: <Icons.Folder />, shortcut: '' },
    { id: 'divider-1', label: '', divider: true },
    { id: 'copy', label: '复制', icon: <Icons.Copy />, shortcut: 'Ctrl+C' },
    { id: 'paste', label: '粘贴', icon: <Icons.Paste />, shortcut: 'Ctrl+V', disabled: !hasCopiedPath || !isFolder },
    { id: 'divider-2', label: '', divider: true },
    { id: 'rename', label: '重命名', icon: <Icons.Rename />, shortcut: 'F2', disabled: isWorkspaceRoot },
    { id: 'delete', label: '删除', icon: <Icons.Delete />, danger: true, disabled: isWorkspaceRoot },
  ];

  // 可选：在文件资源管理器中显示
  if (onRevealInExplorer) {
    menuItems.push(
      { id: 'divider-3', label: '', divider: true },
      { id: 'reveal', label: '在资源管理器中显示', icon: <Icons.Reveal /> }
    );
  }

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled || item.divider) return;

    switch (item.id) {
      case 'new-file':
        onNewFile(parentPath);
        break;
      case 'new-folder':
        onNewFolder(parentPath);
        break;
      case 'rename':
        onRename(targetPath, targetName);
        break;
      case 'delete':
        onDelete(targetPath, targetName, isFolder);
        break;
      case 'copy':
        onCopy(targetPath);
        break;
      case 'paste':
        if (isFolder) onPaste(targetPath);
        break;
      case 'reveal':
        onRevealInExplorer?.(targetPath);
        break;
    }
    onClose();
  };

  // 确保菜单不超出视口
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 300)
  };

  return (
    <div
      ref={menuRef}
      className="file-context-menu"
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 10000
      }}
    >
      {menuItems.map((item) => {
        if (item.divider) {
          return <div key={item.id} className="file-context-menu-divider" />;
        }
        return (
          <div
            key={item.id}
            className={`file-context-menu-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}`}
            onClick={() => handleItemClick(item)}
          >
            <span className="file-context-menu-icon">{item.icon}</span>
            <span className="file-context-menu-label">{item.label}</span>
            {item.shortcut && (
              <span className="file-context-menu-shortcut">{item.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 输入对话框组件
interface InputDialogProps {
  isOpen: boolean;
  title: string;
  placeholder: string;
  defaultValue?: string;
  confirmText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  title,
  placeholder,
  defaultValue = '',
  confirmText = '确认',
  onConfirm,
  onCancel
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && value.trim()) {
        onConfirm(value.trim());
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, value, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="input-dialog-overlay" onClick={onCancel}>
      <div className="input-dialog" onClick={e => e.stopPropagation()}>
        <div className="input-dialog-title">{title}</div>
        <input
          ref={inputRef}
          type="text"
          className="input-dialog-input"
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <div className="input-dialog-actions">
          <button className="input-dialog-btn cancel" onClick={onCancel}>
            取消
          </button>
          <button
            className="input-dialog-btn confirm"
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// 确认对话框组件
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="input-dialog-overlay" onClick={onCancel}>
      <div className="input-dialog" onClick={e => e.stopPropagation()}>
        <div className="input-dialog-title">{title}</div>
        <div className="input-dialog-message">{message}</div>
        <div className="input-dialog-actions">
          <button className="input-dialog-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`input-dialog-btn confirm${danger ? ' danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileContextMenu;
