/**
 * NotificationCenter - 通知中心组件
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

export interface Notification { id: string; type: 'info' | 'success' | 'warning' | 'error'; title: string; message?: string; duration?: number; actions?: { label: string; onClick: () => void }[]; dismissible?: boolean; timestamp: number; read?: boolean; }

interface NotificationContextType { notifications: Notification[]; show: (notification: Omit<Notification, 'id' | 'timestamp'>) => string; dismiss: (id: string) => void; dismissAll: () => void; markAsRead: (id: string) => void; unreadCount: number; }

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => { const ctx = useContext(NotificationContext); if (!ctx) throw new Error('useNotifications must be used within NotificationProvider'); return ctx; };

export const NotificationProvider: React.FC<{ children: React.ReactNode; maxNotifications?: number }> = ({ children, maxNotifications = 50 }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const show = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>): string => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newNotif: Notification = { ...notification, id, timestamp: Date.now(), dismissible: notification.dismissible ?? true };
    setNotifications(prev => [newNotif, ...prev].slice(0, maxNotifications));
    if (notification.duration && notification.duration > 0) setTimeout(() => dismiss(id), notification.duration);
    return id;
  }, [maxNotifications]);

  const dismiss = useCallback((id: string) => { setNotifications(prev => prev.filter(n => n.id !== id)); }, []);
  const dismissAll = useCallback(() => { setNotifications([]); }, []);
  const markAsRead = useCallback((id: string) => { setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); }, []);
  const unreadCount = notifications.filter(n => !n.read).length;

  return <NotificationContext.Provider value={{ notifications, show, dismiss, dismissAll, markAsRead, unreadCount }}>{children}</NotificationContext.Provider>;
};

// 通知弹窗组件
const ICONS = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
const COLORS = { info: 'var(--color-info)', success: 'var(--color-success)', warning: 'var(--color-warning)', error: 'var(--color-error)' };

export const NotificationToast: React.FC<{ notification: Notification; onDismiss: () => void }> = ({ notification, onDismiss }) => (
  <div className="flex items-start gap-3 p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg max-w-sm animate-slideInRight" style={{ borderLeftColor: COLORS[notification.type], borderLeftWidth: 3 }}>
    <span className="text-lg">{ICONS[notification.type]}</span>
    <div className="flex-1 min-w-0">
      <div className="font-medium text-sm">{notification.title}</div>
      {notification.message && <div className="text-xs text-[var(--color-text-muted)] mt-1">{notification.message}</div>}
      {notification.actions && notification.actions.length > 0 && (
        <div className="flex gap-2 mt-2">{notification.actions.map((action, i) => <button key={i} onClick={action.onClick} className="text-xs px-2 py-1 bg-[var(--color-bg-hover)] rounded hover:bg-[var(--color-bg-active)]">{action.label}</button>)}</div>
      )}
    </div>
    {notification.dismissible && <button onClick={onDismiss} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>}
  </div>
);

// 通知列表容器
export const NotificationContainer: React.FC = () => {
  const { notifications, dismiss } = useNotifications();
  const visibleNotifs = notifications.filter(n => !n.read).slice(0, 5);

  if (visibleNotifs.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[var(--z-toast)] flex flex-col gap-2">
      {visibleNotifs.map(n => <NotificationToast key={n.id} notification={n} onDismiss={() => dismiss(n.id)} />)}
    </div>
  );
};

// 通知中心面板
export const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, dismiss, dismissAll, markAsRead, unreadCount } = useNotifications();

  return (
    <div className="w-80 h-full bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="font-medium">通知</span>
          {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-[var(--color-accent-primary)] text-white text-xs rounded-full">{unreadCount}</span>}
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && <button onClick={dismissAll} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">清空</button>}
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">暂无通知</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-hover)] ${n.read ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                <span>{ICONS[n.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.message && <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{n.message}</div>}
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(n.timestamp).toLocaleTimeString()}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 全局通知函数
let globalShow: NotificationContextType['show'] | null = null;
export const setGlobalNotify = (show: NotificationContextType['show']) => { globalShow = show; };
export const notify = (notification: Omit<Notification, 'id' | 'timestamp'>) => { if (globalShow) return globalShow(notification); console.warn('[Notify] Provider not ready'); return ''; };
export const notifyInfo = (title: string, message?: string, duration = 5000) => notify({ type: 'info', title, message, duration });
export const notifySuccess = (title: string, message?: string, duration = 3000) => notify({ type: 'success', title, message, duration });
export const notifyWarning = (title: string, message?: string, duration = 5000) => notify({ type: 'warning', title, message, duration });
export const notifyError = (title: string, message?: string, duration = 0) => notify({ type: 'error', title, message, duration });

export default { NotificationProvider, NotificationContainer, NotificationPanel, useNotifications, notify, notifyInfo, notifySuccess, notifyWarning, notifyError };
