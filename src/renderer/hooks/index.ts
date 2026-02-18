/**
 * Hooks - 自定义 React Hooks 集合
 */

import { useState, useEffect, useCallback, useRef } from "react";

// useLocalStorage - 本地存储
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
        localStorage.setItem(key, JSON.stringify(newValue));
        return newValue;
      });
    },
    [key],
  );
  return [storedValue, setValue];
}

// useSessionStorage - 会话存储
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
        sessionStorage.setItem(key, JSON.stringify(newValue));
        return newValue;
      });
    },
    [key],
  );
  return [storedValue, setValue];
}

// useAsync - 异步操作
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: any[] = [],
): AsyncState<T> & { execute: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: false, error: null });
  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await asyncFn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, deps);
  return { ...state, execute };
}

// useDebounce - 防抖值
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// useDebouncedCallback - 防抖回调
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }) as T,
    [delay],
  );
}

// useThrottle - 节流值
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(
        () => {
          lastUpdated.current = Date.now();
          setThrottledValue(value);
        },
        interval - (now - lastUpdated.current),
      );
      return () => clearTimeout(timer);
    }
  }, [value, interval]);
  return throttledValue;
}

// useEventListener - 事件监听
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | HTMLElement | null = window,
): void {
  const savedHandler = useRef(handler);
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!element) return;
    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    element.addEventListener(eventName, eventListener);
    return () => element.removeEventListener(eventName, eventListener);
  }, [eventName, element]);
}

// useKeyPress - 按键监听
export function useKeyPress(targetKey: string, handler: () => void): void {
  useEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === targetKey) handler();
  });
}

// useClipboard - 剪贴板
export function useClipboard(): {
  copy: (text: string) => Promise<boolean>;
  paste: () => Promise<string>;
  copied: boolean;
} {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);
  const paste = useCallback(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  }, []);
  return { copy, paste, copied };
}

// useMediaQuery - 媒体查询
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// useWindowSize - 窗口大小
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

// usePrevious - 前一个值
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// useToggle - 切换状态
export function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}

// useInterval - 定时器
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// useTimeout - 超时
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

// useMounted - 是否已挂载
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  return mounted;
}

// useUpdateEffect - 跳过首次执行
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useUpdateEffect(effect: () => void | (() => void), deps: any[]): void {
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    return effect();
  }, deps);
}

// useClickOutside - 点击外部
export function useClickOutside<T extends HTMLElement>(handler: () => void): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [handler]);
  return ref;
}

// useHover - 悬停状态
export function useHover<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleMouseEnter = () => setHovered(true);
    const handleMouseLeave = () => setHovered(false);
    node.addEventListener("mouseenter", handleMouseEnter);
    node.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      node.removeEventListener("mouseenter", handleMouseEnter);
      node.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);
  return [ref, hovered];
}

// useFocus - 焦点状态
export function useFocus<T extends HTMLElement>(): [React.RefObject<T>, boolean, () => void] {
  const [focused, setFocused] = useState(false);
  const ref = useRef<T>(null);
  const focus = useCallback(() => ref.current?.focus(), []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleFocus = () => setFocused(true);
    const handleBlur = () => setFocused(false);
    node.addEventListener("focus", handleFocus);
    node.addEventListener("blur", handleBlur);
    return () => {
      node.removeEventListener("focus", handleFocus);
      node.removeEventListener("blur", handleBlur);
    };
  }, []);
  return [ref, focused, focus];
}

export { useZoom } from "./useZoom";
export { useLSP } from "./useLSP";

export default {
  useLocalStorage,
  useSessionStorage,
  useAsync,
  useDebounce,
  useDebouncedCallback,
  useThrottle,
  useEventListener,
  useKeyPress,
  useClipboard,
  useMediaQuery,
  useWindowSize,
  usePrevious,
  useToggle,
  useInterval,
  useTimeout,
  useMounted,
  useUpdateEffect,
  useClickOutside,
  useHover,
  useFocus,
};
