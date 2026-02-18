/**
 * CopyMenu - 复制操作菜单组件
 *
 * 提供多种复制格式选项：
 * - Copy as Plain Text
 * - Copy as Markdown
 * - Copy All Code Blocks
 */
import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import ReactDOM from "react-dom";
import { copyMessage, copyAllCodeBlocks, extractCodeBlocks } from "./utils/copyService";
import "./CopyMenu.css";

// ============================================
// 类型定义
// ============================================

interface CopyMenuProps {
  /** 消息内容 */
  content: string;
  /** 复制成功回调 */
  onCopySuccess?: (format: string) => void;
  /** 复制失败回调 */
  onCopyError?: (error: string) => void;
  /** 菜单关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
}

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => Promise<void>;
  disabled?: boolean;
}

// ============================================
// 图标组件
// ============================================

const MoreIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
  </svg>
);

const TextIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M1.75 3a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75zM1.75 6a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75zM1.75 9a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75zM1.75 12a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z" />
  </svg>
);

const MarkdownIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z" />
  </svg>
);

const CodeIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z" />
  </svg>
);

// ============================================
// 主组件
// ============================================

export const CopyMenu: React.FC<CopyMenuProps> = memo(
  ({ content, onCopySuccess, onCopyError, onClose, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 检查是否有代码块
    const codeBlocks = extractCodeBlocks(content);
    const hasCodeBlocks = codeBlocks.length > 0;

    // 菜单项
    const menuItems: MenuItem[] = [
      {
        id: "plaintext",
        label: "Copy as Plain Text",
        icon: <TextIcon />,
        action: async () => {
          const result = await copyMessage(content, "plaintext");
          if (result.success) {
            onCopySuccess?.("Plain Text");
          } else {
            onCopyError?.(result.error || "Failed");
          }
        },
      },
      {
        id: "markdown",
        label: "Copy as Markdown",
        icon: <MarkdownIcon />,
        action: async () => {
          const result = await copyMessage(content, "markdown");
          if (result.success) {
            onCopySuccess?.("Markdown");
          } else {
            onCopyError?.(result.error || "Failed");
          }
        },
      },
      {
        id: "code",
        label: `Copy Code Blocks (${codeBlocks.length})`,
        icon: <CodeIcon />,
        disabled: !hasCodeBlocks,
        action: async () => {
          if (!hasCodeBlocks) return;
          const result = await copyAllCodeBlocks(content);
          if (result.success) {
            onCopySuccess?.("Code Blocks");
          } else {
            onCopyError?.(result.error || "Failed");
          }
        },
      },
    ];

    // 点击外部关闭
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          menuRef.current &&
          !menuRef.current.contains(target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(target)
        ) {
          setIsOpen(false);
          onClose?.();
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen, onClose]);

    // 键盘导航
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
          case "Escape":
            e.preventDefault();
            setIsOpen(false);
            buttonRef.current?.focus();
            onClose?.();
            break;
          case "ArrowDown":
            e.preventDefault();
            setActiveIndex((prev) => {
              const next = prev + 1;
              return next >= menuItems.length ? 0 : next;
            });
            break;
          case "ArrowUp":
            e.preventDefault();
            setActiveIndex((prev) => {
              const next = prev - 1;
              return next < 0 ? menuItems.length - 1 : next;
            });
            break;
          case "Enter":
            e.preventDefault();
            if (activeIndex >= 0 && !menuItems[activeIndex].disabled) {
              handleItemClick(menuItems[activeIndex]);
            }
            break;
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
      }

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen, activeIndex, menuItems, onClose]);

    const toggleMenu = useCallback(() => {
      if (!isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          left: rect.right - 180, // 右对齐，菜单宽度 180px
        });
      }
      setIsOpen((prev) => !prev);
      setActiveIndex(-1);
    }, [isOpen]);

    const handleItemClick = useCallback(
      async (item: MenuItem) => {
        if (item.disabled) return;

        await item.action();
        setIsOpen(false);
        onClose?.();
      },
      [onClose],
    );

    return (
      <div className={`copy-menu-container ${className}`} ref={menuRef}>
        <button
          ref={buttonRef}
          type="button"
          className={`copy-menu-trigger ${isOpen ? "active" : ""}`}
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="More copy options"
          title="More copy options"
        >
          <MoreIcon />
        </button>

        {isOpen &&
          ReactDOM.createPortal(
            <div
              ref={dropdownRef}
              className="copy-menu-dropdown"
              role="menu"
              aria-orientation="vertical"
              style={{
                position: "fixed",
                top: dropdownPos.top,
                left: dropdownPos.left,
                zIndex: 9999,
              }}
            >
              {menuItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`copy-menu-item ${item.disabled ? "disabled" : ""} ${activeIndex === index ? "active" : ""}`}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="menuitem"
                  disabled={item.disabled}
                  tabIndex={-1}
                >
                  <span className="copy-menu-item-icon">{item.icon}</span>
                  <span className="copy-menu-item-label">{item.label}</span>
                  {item.shortcut && (
                    <span className="copy-menu-item-shortcut">{item.shortcut}</span>
                  )}
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

CopyMenu.displayName = "CopyMenu";

export default CopyMenu;
