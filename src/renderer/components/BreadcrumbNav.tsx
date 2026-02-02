/**
 * BreadcrumbNav - 面包屑导航组件
 */

import React, { useState, useRef, useEffect } from 'react';

export interface BreadcrumbItem { id: string; label: string; icon?: React.ReactNode; path?: string; onClick?: () => void; children?: BreadcrumbItem[]; }
export interface BreadcrumbNavProps { items: BreadcrumbItem[]; separator?: React.ReactNode; maxItems?: number; onItemClick?: (item: BreadcrumbItem) => void; }

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({ items, separator = '/', maxItems = 0, onItemClick }) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayItems = maxItems > 0 && items.length > maxItems
    ? [items[0], { id: '...', label: '...', children: items.slice(1, -maxItems + 1) }, ...items.slice(-maxItems + 1)]
    : items;

  const handleClick = (item: BreadcrumbItem) => {
    if (item.children?.length) { setOpenDropdown(openDropdown === item.id ? null : item.id); return; }
    item.onClick?.();
    onItemClick?.(item);
    setOpenDropdown(null);
  };

  return (
    <nav className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] overflow-hidden" ref={dropdownRef}>
      {displayItems.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && <span className="text-[var(--color-text-muted)] opacity-50 mx-1">{separator}</span>}
          <div className="relative">
            <button
              onClick={() => handleClick(item)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors max-w-[200px] truncate ${index === displayItems.length - 1 ? 'text-[var(--color-text-primary)] font-medium' : ''}`}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
              {item.children?.length ? <span className="ml-0.5 text-xs">▾</span> : null}
            </button>

            {/* 下拉菜单 */}
            {openDropdown === item.id && item.children && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 min-w-[150px] max-h-[300px] overflow-auto">
                {item.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => { handleClick(child); setOpenDropdown(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    {child.icon && <span className="flex-shrink-0">{child.icon}</span>}
                    <span className="truncate">{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </React.Fragment>
      ))}
    </nav>
  );
};

// ============ 文件路径面包屑 ============
export const FileBreadcrumb: React.FC<{ path: string; onNavigate?: (path: string) => void }> = ({ path, onNavigate }) => {
  const parts = path.split(/[/\\]/).filter(Boolean);
  const items: BreadcrumbItem[] = parts.map((part, index) => {
    const fullPath = parts.slice(0, index + 1).join('/');
    return { id: fullPath, label: part, path: fullPath, onClick: () => onNavigate?.(fullPath) };
  });

  return <BreadcrumbNav items={items} separator={<span className="text-xs">›</span>} />;
};

// ============ 符号面包屑 ============
export interface SymbolBreadcrumbItem { name: string; kind: string; line: number; }

export const SymbolBreadcrumb: React.FC<{ symbols: SymbolBreadcrumbItem[]; onNavigate?: (symbol: SymbolBreadcrumbItem) => void }> = ({ symbols, onNavigate }) => {
  const kindIcons: Record<string, string> = { class: '🔷', function: '⚡', method: '🔹', property: '🔸', variable: '📝', interface: '🔶', enum: '📊' };

  const items: BreadcrumbItem[] = symbols.map((sym, i) => ({
    id: `${sym.name}-${i}`,
    label: sym.name,
    icon: <span className="text-xs">{kindIcons[sym.kind.toLowerCase()] || '📌'}</span>,
    onClick: () => onNavigate?.(sym),
  }));

  return <BreadcrumbNav items={items} separator={<span className="text-xs opacity-50">›</span>} />;
};

export default BreadcrumbNav;
