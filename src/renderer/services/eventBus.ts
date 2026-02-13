/**
 * Event Bus - 全局事件总线
 */

type EventCallback<T = unknown> = (data: T) => void;
type EventMap = Record<string, unknown>;

class EventBus<E extends EventMap = EventMap> {
  private listeners = new Map<keyof E, Set<EventCallback<any>>>();
  private onceListeners = new Map<keyof E, Set<EventCallback<any>>>();
  private history = new Map<keyof E, unknown>();
  private maxHistorySize = 10;

  on<K extends keyof E>(event: K, callback: EventCallback<E[K]>): () => void {
    // 订阅
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  once<K extends keyof E>(event: K, callback: EventCallback<E[K]>): () => void {
    // 单次订阅
    if (!this.onceListeners.has(event)) this.onceListeners.set(event, new Set());
    this.onceListeners.get(event)!.add(callback);
    return () => this.onceListeners.get(event)?.delete(callback);
  }

  off<K extends keyof E>(event: K, callback?: EventCallback<E[K]>): void {
    // 取消订阅
    if (!callback) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      return;
    }
    this.listeners.get(event)?.delete(callback);
    this.onceListeners.get(event)?.delete(callback);
  }

  emit<K extends keyof E>(event: K, data: E[K]): void {
    // 发布
    this.history.set(event, data);
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[EventBus] Error:", e);
      }
    });
    const once = this.onceListeners.get(event);
    if (once) {
      once.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error("[EventBus] Error:", e);
        }
      });
      this.onceListeners.delete(event);
    }
  }

  async emitAsync<K extends keyof E>(event: K, data: E[K]): Promise<void> {
    // 异步发布
    this.history.set(event, data);
    const callbacks = [
      ...(this.listeners.get(event) || []),
      ...(this.onceListeners.get(event) || []),
    ];
    await Promise.all(callbacks.map((fn) => Promise.resolve().then(() => fn(data))));
    this.onceListeners.delete(event);
  }

  getLastEvent<K extends keyof E>(event: K): E[K] | undefined {
    return this.history.get(event) as E[K];
  } // 获取最近事件
  hasListeners<K extends keyof E>(event: K): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }
  listenerCount<K extends keyof E>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
    this.history.clear();
  }
  events(): (keyof E)[] {
    return Array.from(this.listeners.keys());
  }
}

// 预定义事件类型
export interface AppEvents extends Record<string, unknown> {
  "file:open": { path: string };
  "file:save": { path: string; content: string };
  "file:close": { path: string };
  "file:change": { path: string; content: string };
  "editor:focus": { path: string };
  "editor:blur": { path: string };
  "editor:selection": { path: string; start: number; end: number };
  "ai:request": { prompt: string };
  "ai:response": { content: string; model: string };
  "ai:error": { error: string };
  "git:status": { changed: number; staged: number };
  "git:commit": { hash: string; message: string };
  "theme:change": { theme: string };
  "settings:change": { key: string; value: unknown };
  "workspace:open": { path: string };
  "workspace:close": void;
  "notification:show": { type: "info" | "success" | "warning" | "error"; message: string };
  "shortcut:trigger": { key: string };
}

export const eventBus = new EventBus<AppEvents>();

// React Hook
import { useEffect, useState } from "react";
export function useEvent<K extends keyof AppEvents>(event: K): AppEvents[K] | undefined {
  const [data, setData] = useState<AppEvents[K] | undefined>(eventBus.getLastEvent(event));
  useEffect(() => eventBus.on(event, setData), [event]);
  return data;
}

export { EventBus };
export default eventBus;
