/**
 * Toast 通知系统
 * 全局消息提示
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';
export interface ToastMessage { id: string; type: ToastType; message: string; duration?: number; }

interface ToastContextValue { show: (message: string, type?: ToastType, duration?: number) => void; info: (message: string) => void; success: (message: string) => void; warning: (message: string) => void; error: (message: string) => void; }

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  info: { bg: '#1e3a5f', border: '#3b82f6', icon: 'ℹ️' },
  success: { bg: '#14532d', border: '#22c55e', icon: '✓' },
  warning: { bg: '#713f12', border: '#f59e0b', icon: '⚠' },
  error: { bg: '#7f1d1d', border: '#ef4444', icon: '✕' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (duration > 0) setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const value: ToastContextValue = {
    show,
    info: (msg) => show(msg, 'info'),
    success: (msg) => show(msg, 'success'),
    warning: (msg) => show(msg, 'warning'),
    error: (msg) => show(msg, 'error'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast 容器 */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(toast => {
          const colors = TOAST_COLORS[toast.type];
          return (
            <div key={toast.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', animation: 'slideIn 0.2s ease', minWidth: 200, maxWidth: 400 }}>
              <span style={{ fontSize: 16 }}>{colors.icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#fff' }}>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

// 全局 Toast 实例（用于非 React 环境）
let globalToast: ToastContextValue | null = null;
export function setGlobalToast(toast: ToastContextValue): void { globalToast = toast; }
export function toast(message: string, type: ToastType = 'info'): void { globalToast?.show(message, type); }
