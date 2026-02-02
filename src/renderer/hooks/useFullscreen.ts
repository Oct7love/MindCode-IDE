/**
 * useFullscreen - 全屏模式 Hook
 */

import { useState, useEffect, useCallback } from 'react';

interface FullscreenState { isFullscreen: boolean; isSupported: boolean; }

export function useFullscreen(element?: HTMLElement | null): FullscreenState & { enter: () => Promise<void>; exit: () => Promise<void>; toggle: () => Promise<void>; } {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSupported = typeof document !== 'undefined' && (document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);

  const handleChange = useCallback(() => {
    setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, [handleChange]);

  const enter = useCallback(async () => {
    const el = element || document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
    } catch (e) { console.error('[Fullscreen] Enter failed:', e); }
  }, [element]);

  const exit = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
    } catch (e) { console.error('[Fullscreen] Exit failed:', e); }
  }, []);

  const toggle = useCallback(async () => { isFullscreen ? await exit() : await enter(); }, [isFullscreen, enter, exit]);

  return { isFullscreen, isSupported, enter, exit, toggle };
}

// ============ 缩放 Hook ============

interface ZoomState { zoom: number; minZoom: number; maxZoom: number; }

export function useZoom(config?: { initial?: number; min?: number; max?: number; step?: number; persist?: boolean }): ZoomState & { zoomIn: () => void; zoomOut: () => void; resetZoom: () => void; setZoom: (zoom: number) => void; } {
  const { initial = 1, min = 0.5, max = 2, step = 0.1, persist = true } = config || {};
  const storageKey = 'mindcode-zoom';

  const [zoom, setZoomState] = useState(() => {
    if (persist) {
      const stored = localStorage.getItem(storageKey);
      if (stored) return Math.max(min, Math.min(max, parseFloat(stored)));
    }
    return initial;
  });

  const setZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(min, Math.min(max, newZoom));
    setZoomState(clamped);
    if (persist) localStorage.setItem(storageKey, String(clamped));
    document.documentElement.style.fontSize = `${clamped * 100}%`;
  }, [min, max, persist]);

  const zoomIn = useCallback(() => setZoom(zoom + step), [zoom, step, setZoom]);
  const zoomOut = useCallback(() => setZoom(zoom - step), [zoom, step, setZoom]);
  const resetZoom = useCallback(() => setZoom(initial), [initial, setZoom]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomOut(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  // 滚轮缩放
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.deltaY < 0 ? zoomIn() : zoomOut();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);

  // 应用初始缩放
  useEffect(() => { document.documentElement.style.fontSize = `${zoom * 100}%`; }, []);

  return { zoom, minZoom: min, maxZoom: max, zoomIn, zoomOut, resetZoom, setZoom };
}

// ============ 窗口大小 Hook ============

export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// ============ 禅模式 (Zen Mode) Hook ============

export function useZenMode(): { isZenMode: boolean; enter: () => void; exit: () => void; toggle: () => void; } {
  const [isZenMode, setIsZenMode] = useState(false);
  const fullscreen = useFullscreen();

  const enter = useCallback(() => {
    setIsZenMode(true);
    fullscreen.enter();
    document.body.classList.add('zen-mode');
  }, [fullscreen]);

  const exit = useCallback(() => {
    setIsZenMode(false);
    fullscreen.exit();
    document.body.classList.remove('zen-mode');
  }, [fullscreen]);

  const toggle = useCallback(() => { isZenMode ? exit() : enter(); }, [isZenMode, enter, exit]);

  // F11 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isZenMode, enter, exit, toggle };
}

export default { useFullscreen, useZoom, useWindowSize, useZenMode };
