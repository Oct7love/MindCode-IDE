/**
 * 插件系统模块入口
 */

export * from './types';
export { PluginLoader } from './loader';
export { CommandRegistry, getCommandRegistry, type CommandHandler, type CommandInfo } from './commands';
export { PluginManager, getPluginManager } from './manager';
export { marketplaceService, type ExtensionInfo } from './marketplace';
