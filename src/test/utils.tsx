/**
 * Test Utils - 测试工具函数
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// 自定义渲染器（可添加 Providers）
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> { initialState?: Record<string, unknown>; }

function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>; // 可添加 ThemeProvider, I18nProvider 等
}

export function customRender(ui: ReactElement, options?: CustomRenderOptions): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  return { user, ...render(ui, { wrapper: AllProviders, ...options }) };
}

// Mock 工厂
export const createMockFile = (overrides?: Partial<{ path: string; name: string; content: string; isDirectory: boolean }>) => ({
  path: '/test/file.ts', name: 'file.ts', content: 'const x = 1;', isDirectory: false, ...overrides,
});

export const createMockEditor = () => ({
  getValue: vi.fn(() => 'code'), setValue: vi.fn(), getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
  setPosition: vi.fn(), getSelection: vi.fn(() => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })),
  focus: vi.fn(), dispose: vi.fn(),
});

export const createMockStore = <T extends object>(initial: T) => {
  let state = initial;
  return { getState: () => state, setState: (partial: Partial<T>) => { state = { ...state, ...partial }; }, subscribe: vi.fn(() => vi.fn()) };
};

// 等待工具
export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// 断言工具
export const expectToBeInDocument = (element: HTMLElement | null) => { expect(element).toBeInTheDocument(); };
export const expectNotToBeInDocument = (element: HTMLElement | null) => { expect(element).not.toBeInTheDocument(); };

// 重新导出
export * from '@testing-library/react';
export { userEvent };
