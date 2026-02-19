/**
 * IPC Handler Registry
 *
 * 统一注册所有 IPC 处理器模块。
 */
export { registerFSHandlers } from "./fs-handlers";
export { registerAIHandlers, warmupAIProviders } from "./ai-handlers";
export { registerGitHandlers } from "./git-handlers";
export { registerTerminalHandlers } from "./terminal-handlers";
export { registerSettingsHandlers, getSettingsCache } from "./settings-handlers";
export { registerDebugHandlers } from "./debug-handlers";
export { registerLSPHandlers } from "./lsp-handlers";
export { registerIndexHandlers } from "./index-handlers";
export { registerDashboardHandlers } from "./dashboard-handlers";
export type { IPCContext } from "./types";
