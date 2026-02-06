/**
 * Debugger - 调试器核心模块
 */

export interface LaunchConfig { name: string; type: 'node' | 'chrome' | 'python' | 'go' | 'rust'; request: 'launch' | 'attach'; program?: string; args?: string[]; cwd?: string; env?: Record<string, string>; port?: number; runtimeExecutable?: string; sourceMaps?: boolean; }
export interface Breakpoint { id: string; file: string; line: number; column?: number; condition?: string; hitCondition?: string; logMessage?: string; enabled: boolean; verified: boolean; }
export interface StackFrame { id: number; name: string; file: string; line: number; column: number; source?: string; }
export interface Variable { name: string; value: string; type: string; variablesReference: number; children?: Variable[]; }
export interface DebugSession { id: string; name: string; config: LaunchConfig; state: 'inactive' | 'running' | 'paused' | 'stopped'; breakpoints: Breakpoint[]; stackFrames: StackFrame[]; variables: Variable[]; }

type DebugEventHandler = (event: string, data: any) => void;
// 安全地访问 window（兼容主进程和渲染进程）
const win = typeof window !== 'undefined' ? (window as any) : null;

class DebuggerManager {
  private sessions = new Map<string, DebugSession>();
  private activeSessionId: string | null = null;
  private breakpoints = new Map<string, Breakpoint[]>(); // file -> breakpoints
  private eventHandlers: DebugEventHandler[] = [];
  private breakpointIdCounter = 0;

  // ============ 会话管理 ============

  async startSession(config: LaunchConfig): Promise<string | null> {
    const id = `debug-${Date.now()}`;
    const session: DebugSession = { id, name: config.name, config, state: 'inactive', breakpoints: [], stackFrames: [], variables: [] };
    this.sessions.set(id, session);
    this.activeSessionId = id;

    try {
      if (win.mindcode?.debug?.start) {
        const result = await win.mindcode.debug.start(config);
        if (result.success) { session.state = 'running'; this.emit('sessionStarted', { sessionId: id }); return id; }
      }
      session.state = 'stopped';
      return null;
    } catch (e) { console.error('[Debugger] 启动失败:', e); session.state = 'stopped'; return null; }
  }

  async stopSession(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    const session = this.sessions.get(id);
    if (!session) return;

    try { if (win.mindcode?.debug?.stop) await win.mindcode.debug.stop(id); }
    catch (e) { console.error('[Debugger] 停止失败:', e); }

    session.state = 'stopped';
    this.emit('sessionStopped', { sessionId: id });
    if (this.activeSessionId === id) this.activeSessionId = null;
  }

  getSession(sessionId?: string): DebugSession | undefined { return this.sessions.get(sessionId || this.activeSessionId || ''); }
  getActiveSession(): DebugSession | undefined { return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined; }
  listSessions(): DebugSession[] { return Array.from(this.sessions.values()); }

  // ============ 调试控制 ============

  async continue(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    try { if (win.mindcode?.debug?.continue) await win.mindcode.debug.continue(id); this.updateState(id, 'running'); }
    catch (e) { console.error('[Debugger] Continue 失败:', e); }
  }

  async stepOver(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    try { if (win.mindcode?.debug?.stepOver) await win.mindcode.debug.stepOver(id); }
    catch (e) { console.error('[Debugger] StepOver 失败:', e); }
  }

  async stepInto(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    try { if (win.mindcode?.debug?.stepInto) await win.mindcode.debug.stepInto(id); }
    catch (e) { console.error('[Debugger] StepInto 失败:', e); }
  }

  async stepOut(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    try { if (win.mindcode?.debug?.stepOut) await win.mindcode.debug.stepOut(id); }
    catch (e) { console.error('[Debugger] StepOut 失败:', e); }
  }

  async pause(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    try { if (win.mindcode?.debug?.pause) await win.mindcode.debug.pause(id); this.updateState(id, 'paused'); }
    catch (e) { console.error('[Debugger] Pause 失败:', e); }
  }

  async restart(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    if (!id) return;
    const session = this.sessions.get(id);
    if (!session) return;
    await this.stopSession(id);
    await this.startSession(session.config);
  }

  // ============ 断点管理 ============

  addBreakpoint(file: string, line: number, options?: Partial<Breakpoint>): Breakpoint {
    const bp: Breakpoint = { id: `bp-${++this.breakpointIdCounter}`, file, line, enabled: true, verified: false, ...options };
    const fileBps = this.breakpoints.get(file) || [];
    fileBps.push(bp);
    this.breakpoints.set(file, fileBps);
    this.syncBreakpoints(file);
    this.emit('breakpointAdded', bp);
    return bp;
  }

  removeBreakpoint(id: string): void {
    for (const [file, bps] of this.breakpoints) {
      const idx = bps.findIndex(bp => bp.id === id);
      if (idx !== -1) { const [removed] = bps.splice(idx, 1); this.syncBreakpoints(file); this.emit('breakpointRemoved', removed); return; }
    }
  }

  toggleBreakpoint(file: string, line: number): Breakpoint | null {
    const fileBps = this.breakpoints.get(file) || [];
    const existing = fileBps.find(bp => bp.line === line);
    if (existing) { this.removeBreakpoint(existing.id); return null; }
    return this.addBreakpoint(file, line);
  }

  getBreakpoints(file?: string): Breakpoint[] {
    if (file) return this.breakpoints.get(file) || [];
    return Array.from(this.breakpoints.values()).flat();
  }

  clearBreakpoints(file?: string): void {
    if (file) { this.breakpoints.delete(file); this.syncBreakpoints(file); }
    else { this.breakpoints.clear(); }
    this.emit('breakpointsCleared', { file });
  }

  private async syncBreakpoints(file: string): Promise<void> {
    if (!win.mindcode?.debug?.setBreakpoints) return;
    const bps = this.breakpoints.get(file) || [];
    try { await win.mindcode.debug.setBreakpoints(file, bps.filter(bp => bp.enabled).map(bp => ({ line: bp.line, condition: bp.condition }))); }
    catch (e) { console.error('[Debugger] 同步断点失败:', e); }
  }

  // ============ 变量查看 ============

  async getVariables(frameId?: number): Promise<Variable[]> {
    const session = this.getActiveSession();
    if (!session || session.state !== 'paused') return [];
    try {
      if (win.mindcode?.debug?.getVariables) return await win.mindcode.debug.getVariables(session.id, frameId);
    } catch (e) { console.error('[Debugger] 获取变量失败:', e); }
    return [];
  }

  async evaluate(expression: string, frameId?: number): Promise<string> {
    const session = this.getActiveSession();
    if (!session) return '';
    try {
      if (win.mindcode?.debug?.evaluate) { const result = await win.mindcode.debug.evaluate(session.id, expression, frameId); return result?.value || ''; }
    } catch (e) { console.error('[Debugger] 求值失败:', e); }
    return '';
  }

  // ============ 事件 ============

  private updateState(sessionId: string, state: DebugSession['state']): void {
    const session = this.sessions.get(sessionId);
    if (session) { session.state = state; this.emit('stateChanged', { sessionId, state }); }
  }

  onEvent(handler: DebugEventHandler): () => void { this.eventHandlers.push(handler); return () => { this.eventHandlers = this.eventHandlers.filter(h => h !== handler); }; }
  private emit(event: string, data: any): void { this.eventHandlers.forEach(h => h(event, data)); }
}

export const debuggerManager = new DebuggerManager();
export default debuggerManager;
