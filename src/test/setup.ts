/**
 * Test Setup - 测试环境配置
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));

// Mock localStorage
const localStorageMock = { store: {} as Record<string, string>, getItem: vi.fn((key: string) => localStorageMock.store[key] || null), setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }), removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }), clear: vi.fn(() => { localStorageMock.store = {}; }) };
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Electron IPC
(window as any).electron = {
  invoke: vi.fn().mockResolvedValue(null),
  on: vi.fn().mockReturnValue(() => {}),
  send: vi.fn(),
};

// Mock Monaco Editor
vi.mock('monaco-editor', () => ({ editor: { create: vi.fn(), createModel: vi.fn(), setTheme: vi.fn() }, languages: { register: vi.fn(), setMonarchTokensProvider: vi.fn() } }));

// 清理
afterEach(() => { vi.clearAllMocks(); localStorageMock.clear(); });
