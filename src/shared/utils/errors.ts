/**
 * 统一错误处理工具
 */

// ==================== 错误类型 ====================

export type ErrorType = 
  | 'validation'      // 参数验证错误
  | 'permission'      // 权限错误
  | 'not_found'       // 资源不存在
  | 'network'         // 网络错误
  | 'timeout'         // 超时错误
  | 'rate_limit'      // 限流错误
  | 'auth'            // 认证错误
  | 'internal'        // 内部错误
  | 'unknown';        // 未知错误

// ==================== IPC 响应类型 ====================

export interface IPCSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface IPCErrorResponse {
  success: false;
  error: string;
  errorType?: ErrorType;
  errorCode?: string;
}

export type IPCResponse<T = unknown> = IPCSuccessResponse<T> | IPCErrorResponse;

// ==================== 错误创建 ====================

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T): IPCSuccessResponse<T> {
  return { success: true, data };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  error: string | Error,
  errorType: ErrorType = 'unknown',
  errorCode?: string
): IPCErrorResponse {
  const message = error instanceof Error ? error.message : error;
  return {
    success: false,
    error: message,
    errorType,
    errorCode
  };
}

// ==================== 错误包装器 ====================

/**
 * IPC 处理器包装器 - 统一错误处理
 * 使用方式:
 * ipcMain.handle('channel', wrapIPCHandler(async (event, args) => {
 *   // 业务逻辑
 *   return data;
 * }));
 */
export function wrapIPCHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<IPCResponse<TResult>> {
  return async (...args: TArgs): Promise<IPCResponse<TResult>> => {
    try {
      const result = await handler(...args);
      return createSuccessResponse(result);
    } catch (error) {
      const errorType = classifyError(error);
      return createErrorResponse(error as Error, errorType);
    }
  };
}

/**
 * 错误分类
 */
export function classifyError(error: unknown): ErrorType {
  if (!error) return 'unknown';
  
  const message = error instanceof Error 
    ? error.message.toLowerCase() 
    : String(error).toLowerCase();
  
  // 权限相关
  if (message.includes('permission') || message.includes('access denied') || message.includes('eacces')) {
    return 'permission';
  }
  
  // 不存在
  if (message.includes('not found') || message.includes('enoent') || message.includes('no such file')) {
    return 'not_found';
  }
  
  // 网络相关
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return 'network';
  }
  
  // 超时
  if (message.includes('timeout') || message.includes('etimedout')) {
    return 'timeout';
  }
  
  // 限流
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return 'rate_limit';
  }
  
  // 认证
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
    return 'auth';
  }
  
  // 验证
  if (message.includes('invalid') || message.includes('validation')) {
    return 'validation';
  }
  
  return 'unknown';
}

// ==================== 用户友好错误消息 ====================

const ERROR_MESSAGES: Record<ErrorType, string> = {
  validation: '参数验证失败',
  permission: '没有权限执行此操作',
  not_found: '请求的资源不存在',
  network: '网络连接失败，请检查网络',
  timeout: '请求超时，请稍后重试',
  rate_limit: '请求过于频繁，请稍后重试',
  auth: '认证失败，请检查凭据',
  internal: '内部错误',
  unknown: '发生未知错误'
};

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(errorType: ErrorType): string {
  return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.unknown;
}

/**
 * 从错误对象获取用户友好消息
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return ERROR_MESSAGES.unknown;
  
  const errorType = classifyError(error);
  const baseMessage = getUserFriendlyMessage(errorType);
  
  // 如果是已知类型，使用友好消息
  if (errorType !== 'unknown') {
    return baseMessage;
  }
  
  // 未知类型返回原始消息
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}
