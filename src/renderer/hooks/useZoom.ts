import { useState, useEffect, useCallback } from 'react';

// 全局界面缩放 Hook - Ctrl+Shift++ 放大, Ctrl+Shift+- 缩小
const ZOOM_KEY = 'mindcode.zoom';
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

export function useZoom() {
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem(ZOOM_KEY);
    return saved ? parseFloat(saved) : 1;
  });

  // 应用缩放到根元素
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-zoom', String(zoom));
    document.documentElement.style.fontSize = `${zoom * 14}px`; // 基础字体随缩放变化
    localStorage.setItem(ZOOM_KEY, String(zoom));
  }, [zoom]);

  // 放大
  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10));
  }, []);

  // 缩小
  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10));
  }, []);

  // 重置
  const zoomReset = useCallback(() => { setZoom(1); }, []);

  // 快捷键监听 - 使用 e.code 更可靠
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); zoomIn(); } // Ctrl+Shift++
        else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); zoomOut(); } // Ctrl+Shift+-
        else if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); zoomReset(); } // Ctrl+Shift+0
      }
    };
    window.addEventListener('keydown', handleKeyDown, true); // capture phase 优先级更高
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [zoomIn, zoomOut, zoomReset]);

  return { zoom, zoomIn, zoomOut, zoomReset, zoomPercent: Math.round(zoom * 100) };
}

export default useZoom;
