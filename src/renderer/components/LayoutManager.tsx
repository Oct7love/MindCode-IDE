/**
 * LayoutManager - 布局管理器
 * 面板布局、拖拽调整、保存恢复
 */

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';

export interface PanelConfig { id: string; visible: boolean; size: number; minSize?: number; maxSize?: number; }
export interface LayoutConfig { sidebar: PanelConfig; aiPanel: PanelConfig; terminal: PanelConfig; bottomPanel: PanelConfig; }

const STORAGE_KEY = 'mindcode_layout';

const DEFAULT_LAYOUT: LayoutConfig = {
  sidebar: { id: 'sidebar', visible: true, size: 250, minSize: 150, maxSize: 500 },
  aiPanel: { id: 'aiPanel', visible: true, size: 400, minSize: 300, maxSize: 800 },
  terminal: { id: 'terminal', visible: false, size: 200, minSize: 100, maxSize: 500 },
  bottomPanel: { id: 'bottomPanel', visible: false, size: 200, minSize: 100, maxSize: 400 },
};

// Context
interface LayoutContextValue {
  layout: LayoutConfig;
  togglePanel: (panel: keyof LayoutConfig) => void;
  setPanelSize: (panel: keyof LayoutConfig, size: number) => void;
  resetLayout: () => void;
}
const LayoutContext = createContext<LayoutContextValue | null>(null);

export const useLayout = () => { const ctx = useContext(LayoutContext); if (!ctx) throw new Error('useLayout must be used within LayoutProvider'); return ctx; };

// Provider
export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);

  // 加载保存的布局
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setLayout(prev => ({ ...prev, ...JSON.parse(saved) }));
  }, []);

  // 保存布局
  const saveLayout = useCallback((newLayout: LayoutConfig) => {
    setLayout(newLayout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  }, []);

  // 切换面板
  const togglePanel = useCallback((panel: keyof LayoutConfig) => {
    saveLayout({ ...layout, [panel]: { ...layout[panel], visible: !layout[panel].visible } });
  }, [layout, saveLayout]);

  // 设置面板大小
  const setPanelSize = useCallback((panel: keyof LayoutConfig, size: number) => {
    const config = layout[panel];
    const newSize = Math.max(config.minSize || 0, Math.min(config.maxSize || Infinity, size));
    saveLayout({ ...layout, [panel]: { ...config, size: newSize } });
  }, [layout, saveLayout]);

  // 重置布局
  const resetLayout = useCallback(() => { saveLayout(DEFAULT_LAYOUT); }, [saveLayout]);

  return <LayoutContext.Provider value={{ layout, togglePanel, setPanelSize, resetLayout }}>{children}</LayoutContext.Provider>;
};

// 可调整大小的分割条
interface ResizableProps { direction: 'horizontal' | 'vertical'; onResize: (delta: number) => void; }

export const Resizable: React.FC<ResizableProps> = ({ direction, onResize }) => {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      onResize(currentPos - startPos);
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div onMouseDown={handleMouseDown} style={{
      position: 'relative',
      [direction === 'horizontal' ? 'width' : 'height']: 4,
      [direction === 'horizontal' ? 'cursor' : 'cursor']: direction === 'horizontal' ? 'col-resize' : 'row-resize',
      background: dragging ? 'var(--color-accent-primary)' : 'transparent',
      transition: 'background 0.15s',
      flexShrink: 0,
      zIndex: 10,
    }}>
      <div style={{
        position: 'absolute',
        [direction === 'horizontal' ? 'left' : 'top']: -2,
        [direction === 'horizontal' ? 'right' : 'bottom']: -2,
        [direction === 'horizontal' ? 'top' : 'left']: 0,
        [direction === 'horizontal' ? 'bottom' : 'right']: 0,
      }} />
    </div>
  );
};

// 面板容器
interface PanelContainerProps { config: PanelConfig; position: 'left' | 'right' | 'bottom'; onResize?: (size: number) => void; children: React.ReactNode; }

export const PanelContainer: React.FC<PanelContainerProps> = ({ config, position, onResize, children }) => {
  if (!config.visible) return null;

  const isVertical = position === 'bottom';
  const sizeStyle = isVertical ? { height: config.size } : { width: config.size };

  return (
    <div style={{ display: 'flex', flexDirection: isVertical ? 'column' : 'row', ...sizeStyle, flexShrink: 0 }}>
      {position === 'right' && onResize && <Resizable direction="horizontal" onResize={delta => onResize(config.size - delta)} />}
      {position === 'bottom' && onResize && <Resizable direction="vertical" onResize={delta => onResize(config.size - delta)} />}
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
      {position === 'left' && onResize && <Resizable direction="horizontal" onResize={delta => onResize(config.size + delta)} />}
    </div>
  );
};

export default { LayoutProvider, useLayout, Resizable, PanelContainer };
