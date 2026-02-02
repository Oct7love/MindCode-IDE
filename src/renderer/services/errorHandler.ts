/**
 * Error Handler - 全局错误处理
 */

interface AppError { code: string; message: string; stack?: string; context?: Record<string, unknown>; timestamp: number; handled: boolean; }
type ErrorCallback = (error: AppError) => void;

class ErrorHandler {
  private errors: AppError[] = [];
  private listeners: ErrorCallback[] = [];
  private maxErrors = 100;

  init(): void { // 初始化全局错误捕获
    window.onerror = (msg, url, line, col, err) => { this.capture(err || new Error(String(msg)), { url, line, col }); return true; };
    window.onunhandledrejection = (e) => { this.capture(e.reason instanceof Error ? e.reason : new Error(String(e.reason)), { type: 'unhandledrejection' }); };
  }

  capture(error: Error | string, context?: Record<string, unknown>): AppError { // 捕获错误
    const appError: AppError = {
      code: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: Date.now(),
      handled: false,
    };
    this.errors.push(appError);
    if (this.errors.length > this.maxErrors) this.errors = this.errors.slice(-this.maxErrors);
    this.listeners.forEach(fn => fn(appError));
    console.error('[ErrorHandler]', appError.message, context);
    return appError;
  }

  wrap<T extends (...args: any[]) => any>(fn: T, context?: Record<string, unknown>): T { // 包装函数
    return ((...args: Parameters<T>) => { try { return fn(...args); } catch (e) { this.capture(e as Error, context); throw e; } }) as T;
  }

  async wrapAsync<T>(fn: () => Promise<T>, context?: Record<string, unknown>): Promise<T> { // 包装异步
    try { return await fn(); } catch (e) { this.capture(e as Error, context); throw e; }
  }

  boundary<T>(fn: () => T, fallback: T, context?: Record<string, unknown>): T { // 错误边界
    try { return fn(); } catch (e) { this.capture(e as Error, context); return fallback; }
  }

  subscribe(fn: ErrorCallback): () => void { // 订阅错误
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(f => f !== fn); };
  }

  getErrors(since?: number): AppError[] { return since ? this.errors.filter(e => e.timestamp >= since) : this.errors; }
  getLastError(): AppError | undefined { return this.errors[this.errors.length - 1]; }
  clear(): void { this.errors = []; }
}

export const errorHandler = new ErrorHandler();

// 自定义错误类
export class AppException extends Error {
  constructor(public code: string, message: string, public context?: Record<string, unknown>) { super(message); this.name = 'AppException'; }
}
export class NetworkError extends AppException { constructor(message: string, context?: Record<string, unknown>) { super('NETWORK_ERROR', message, context); } }
export class ValidationError extends AppException { constructor(message: string, context?: Record<string, unknown>) { super('VALIDATION_ERROR', message, context); } }
export class AuthError extends AppException { constructor(message: string, context?: Record<string, unknown>) { super('AUTH_ERROR', message, context); } }

// React Hook
import { useEffect, useState } from 'react';
export function useErrors(since?: number): AppError[] {
  const [errors, setErrors] = useState<AppError[]>([]);
  useEffect(() => {
    setErrors(errorHandler.getErrors(since));
    return errorHandler.subscribe(() => setErrors(errorHandler.getErrors(since)));
  }, [since]);
  return errors;
}

export default errorHandler;
