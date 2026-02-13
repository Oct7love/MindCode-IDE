/**
 * 主进程调试器模块 - 统一导出
 */
export { DAPClient } from "./dap-client";
export type {
  DAPCapabilities,
  DAPBreakpoint,
  DAPStackFrame,
  DAPScope,
  DAPVariable,
  DAPState,
} from "./dap-client";
export {
  getAdapter,
  registerAdapter,
  getSupportedLanguages,
  detectAdapter,
} from "./adapter-registry";
export type { AdapterConfig, LaunchParams, AttachParams } from "./adapter-registry";
export { debugSessionManager, DebugSessionManager } from "./session-manager";
export type { DebugSessionInfo } from "./session-manager";
