/**
 * 实时协作服务 - 基础架构
 * 支持多人实时编辑和 AI 共享
 */

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { file: string; line: number; column: number };
}
export interface CollabSession {
  id: string;
  name: string;
  host: string;
  users: CollabUser[];
  createdAt: number;
  status: "active" | "ended";
}
export interface CollabEdit {
  userId: string;
  file: string;
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  text: string;
  timestamp: number;
}

type CollabEventHandler = (event: string, data: unknown) => void;

class CollabService {
  private session: CollabSession | null = null;
  private handlers = new Set<CollabEventHandler>();
  private userId = `user-${Date.now().toString(36)}`;
  private userName = "Anonymous";

  /** 创建协作会话 (占位) */
  async createSession(
    name: string,
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    this.session = {
      id: `session-${Date.now()}`,
      name,
      host: this.userId,
      users: [{ id: this.userId, name: this.userName, color: this.randomColor() }],
      createdAt: Date.now(),
      status: "active",
    };
    this.emit("sessionCreated", this.session);
    console.log(`[Collab] 创建会话: ${this.session.id}`);
    return { success: true, sessionId: this.session.id };
  }

  /** 加入协作会话 (占位) */
  async joinSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    // TODO: 实现真实的 WebSocket/WebRTC 连接
    const user: CollabUser = { id: this.userId, name: this.userName, color: this.randomColor() };
    this.session = {
      id: sessionId,
      name: "Joined Session",
      host: "remote",
      users: [user],
      createdAt: Date.now(),
      status: "active",
    };
    this.emit("sessionJoined", this.session);
    console.log(`[Collab] 加入会话: ${sessionId}`);
    return { success: true };
  }

  /** 离开协作会话 */
  async leaveSession(): Promise<void> {
    if (!this.session) return;
    this.emit("sessionLeft", { sessionId: this.session.id, userId: this.userId });
    this.session = null;
  }

  /** 发送编辑操作 (占位) */
  async sendEdit(edit: Omit<CollabEdit, "userId" | "timestamp">): Promise<void> {
    if (!this.session) return;
    const fullEdit: CollabEdit = { ...edit, userId: this.userId, timestamp: Date.now() };
    this.emit("edit", fullEdit);
    // TODO: 通过 WebSocket 发送到其他用户
  }

  /** 发送光标位置 */
  async sendCursor(file: string, line: number, column: number): Promise<void> {
    if (!this.session) return;
    this.emit("cursor", { userId: this.userId, file, line, column });
  }

  /** 共享 AI 对话 (占位) */
  async shareAIResponse(message: string, response: string): Promise<void> {
    if (!this.session) return;
    this.emit("aiShared", { userId: this.userId, message, response, timestamp: Date.now() });
  }

  /** 监听事件 */
  on(handler: CollabEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: string, data: any): void {
    this.handlers.forEach((h) => h(event, data));
  }

  /** 设置用户名 */
  setUserName(name: string): void {
    this.userName = name;
  }

  /** 获取当前会话 */
  getSession(): CollabSession | null {
    return this.session;
  }

  /** 获取用户 ID */
  getUserId(): string {
    return this.userId;
  }

  private randomColor(): string {
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#ffeaa7",
      "#dfe6e9",
      "#74b9ff",
      "#a29bfe",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const collabService = new CollabService();
export default collabService;
