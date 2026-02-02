/**
 * Workspace Manager - 工作区管理
 */

import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceConfig { name?: string; settings?: Record<string, unknown>; extensions?: string[]; tasks?: TaskConfig[]; launch?: LaunchConfig[]; }
export interface TaskConfig { label: string; type: string; command: string; args?: string[]; group?: string; }
export interface LaunchConfig { name: string; type: string; request: string; program?: string; args?: string[]; env?: Record<string, string>; }
export interface WorkspaceSession { openFiles: string[]; activeFile?: string; layout?: { sidebarWidth: number; panelHeight: number; sidebarVisible: boolean }; scrollPositions?: Record<string, number>; }
export interface RecentWorkspace { path: string; name: string; lastOpened: number; pinned?: boolean; }

const CONFIG_DIR = '.mindcode';
const CONFIG_FILE = 'workspace.json';
const SESSION_FILE = 'session.json';
const RECENT_KEY = 'mindcode-recent-workspaces';

class WorkspaceManager {
  private workspacePath: string | null = null;
  private config: WorkspaceConfig = {};
  private session: WorkspaceSession = { openFiles: [] };
  private trusted = false;

  async open(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;
    await this.loadConfig();
    await this.loadSession();
    this.addToRecent(workspacePath);
  }

  close(): void { this.saveSession(); this.workspacePath = null; this.config = {}; this.session = { openFiles: [] }; }

  getPath(): string | null { return this.workspacePath; }
  getConfig(): WorkspaceConfig { return this.config; }
  getSession(): WorkspaceSession { return this.session; }
  isTrusted(): boolean { return this.trusted; }
  setTrusted(trusted: boolean): void { this.trusted = trusted; }

  private getConfigPath(): string { return path.join(this.workspacePath!, CONFIG_DIR, CONFIG_FILE); }
  private getSessionPath(): string { return path.join(this.workspacePath!, CONFIG_DIR, SESSION_FILE); }

  private async loadConfig(): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) { console.error('[Workspace] Failed to load config:', e); }
  }

  async saveConfig(): Promise<void> {
    if (!this.workspacePath) return;
    try {
      const configDir = path.join(this.workspacePath, CONFIG_DIR);
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(this.getConfigPath(), JSON.stringify(this.config, null, 2));
    } catch (e) { console.error('[Workspace] Failed to save config:', e); }
  }

  private async loadSession(): Promise<void> {
    try {
      const sessionPath = this.getSessionPath();
      if (fs.existsSync(sessionPath)) this.session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch (e) { console.error('[Workspace] Failed to load session:', e); }
  }

  async saveSession(): Promise<void> {
    if (!this.workspacePath) return;
    try {
      const configDir = path.join(this.workspacePath, CONFIG_DIR);
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(this.getSessionPath(), JSON.stringify(this.session, null, 2));
    } catch (e) { console.error('[Workspace] Failed to save session:', e); }
  }

  updateConfig(updates: Partial<WorkspaceConfig>): void { this.config = { ...this.config, ...updates }; }
  updateSession(updates: Partial<WorkspaceSession>): void { this.session = { ...this.session, ...updates }; }

  addOpenFile(filePath: string): void { if (!this.session.openFiles.includes(filePath)) this.session.openFiles.push(filePath); }
  removeOpenFile(filePath: string): void { this.session.openFiles = this.session.openFiles.filter(f => f !== filePath); }
  setActiveFile(filePath: string): void { this.session.activeFile = filePath; }

  private addToRecent(workspacePath: string): void {
    const recent = this.getRecentWorkspaces();
    const filtered = recent.filter(w => w.path !== workspacePath);
    filtered.unshift({ path: workspacePath, name: path.basename(workspacePath), lastOpened: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 20)));
  }

  getRecentWorkspaces(): RecentWorkspace[] {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
  }

  removeFromRecent(workspacePath: string): void {
    const recent = this.getRecentWorkspaces().filter(w => w.path !== workspacePath);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }

  togglePinned(workspacePath: string): void {
    const recent = this.getRecentWorkspaces().map(w => w.path === workspacePath ? { ...w, pinned: !w.pinned } : w);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }
}

export const workspaceManager = new WorkspaceManager();
export default workspaceManager;
