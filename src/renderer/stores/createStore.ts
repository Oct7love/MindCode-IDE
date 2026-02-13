/**
 * Store Factory - Zustand 增强工厂
 */

import type { StateCreator, StoreApi, UseBoundStore } from "zustand";
import { create } from "zustand";
import { persist, createJSONStorage, devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type Middleware<T> = (config: StateCreator<T>) => StateCreator<T>;

interface StoreOptions<T> {
  name: string;
  persist?: boolean;
  devtools?: boolean;
  immer?: boolean;
  subscribeWithSelector?: boolean;
  partialize?: (state: T) => Partial<T>;
  onRehydrateStorage?: (state: T | undefined) => void;
}

export function createStore<T extends object>(
  initializer: StateCreator<T, [], []>,
  options: StoreOptions<T>,
): UseBoundStore<StoreApi<T>> {
  let config: StateCreator<T, [], []> = initializer;
  if (options.immer)
    config = immer(config as StateCreator<T, [["zustand/immer", never]], []>) as StateCreator<
      T,
      [],
      []
    >;
  if (options.subscribeWithSelector)
    config = subscribeWithSelector(
      config as StateCreator<T, [["zustand/subscribeWithSelector", never]], []>,
    ) as StateCreator<T, [], []>;
  if (options.persist) {
    config = persist(config as StateCreator<T, [["zustand/persist", unknown]], []>, {
      name: `mindcode-${options.name}`,
      storage: createJSONStorage(() => localStorage),
      partialize: options.partialize as (state: T) => T,
      onRehydrateStorage: options.onRehydrateStorage ? () => options.onRehydrateStorage : undefined,
    }) as StateCreator<T, [], []>;
  }
  if (options.devtools)
    config = devtools(config as StateCreator<T, [["zustand/devtools", never]], []>, {
      name: options.name,
    }) as StateCreator<T, [], []>;
  return create<T>()(config);
}

// 日志中间件
export const loggerMiddleware =
  <T extends object>(config: StateCreator<T>): StateCreator<T> =>
  (set, get, api) =>
    config(
      (args) => {
        console.log("[Store] prev:", get());
        set(args);
        console.log("[Store] next:", get());
      },
      get,
      api,
    );

// 性能中间件
export const perfMiddleware =
  <T extends object>(config: StateCreator<T>): StateCreator<T> =>
  (set, get, api) =>
    config(
      (args) => {
        const start = performance.now();
        set(args);
        console.log(`[Perf] Update: ${(performance.now() - start).toFixed(2)}ms`);
      },
      get,
      api,
    );

// 撤销/重做中间件
interface UndoState<T> {
  past: T[];
  future: T[];
}
export function createUndoStore<T extends object>(
  initializer: StateCreator<
    T & { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }
  >,
) {
  const undoState: UndoState<T> = { past: [], future: [] };
  return create<T & { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }>()(
    (set, get, api) => ({
      ...initializer(set, get, api),
      canUndo: false,
      canRedo: false,
      undo: () => {
        const { past, future } = undoState;
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        undoState.past = past.slice(0, -1);
        undoState.future = [get() as unknown as T, ...future];
        set({ ...prev, canUndo: undoState.past.length > 0, canRedo: true } as T & {
          undo: () => void;
          redo: () => void;
          canUndo: boolean;
          canRedo: boolean;
        });
      },
      redo: () => {
        const { past, future } = undoState;
        if (future.length === 0) return;
        const next = future[0];
        undoState.past = [...past, get() as unknown as T];
        undoState.future = future.slice(1);
        set({ ...next, canUndo: true, canRedo: undoState.future.length > 0 } as T & {
          undo: () => void;
          redo: () => void;
          canUndo: boolean;
          canRedo: boolean;
        });
      },
    }),
  );
}

// 选择器缓存
const selectorCache = new WeakMap<object, Map<string, unknown>>();
export function createSelector<T, R>(
  store: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean,
): () => R {
  return () => store(selector as any) as R;
}

// 批量更新
export function batchUpdate<T>(store: StoreApi<T>, updates: Partial<T>[]): void {
  const state = store.getState();
  const merged = updates.reduce((acc, update) => ({ ...acc, ...update }), state);
  store.setState(merged);
}

export default createStore;
