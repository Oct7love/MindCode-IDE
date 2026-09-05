/**
 * 流式 AI 请求会话：requestId → AbortController。
 * 取消必须中止底层网络，而不是只丢弃 token。
 */
export interface StreamSession {
  abort: AbortController;
  cancelled: boolean;
  buffer?: { destroy: () => void };
}

const sessions = new Map<string, StreamSession>();

export function startStreamSession(requestId: string): StreamSession {
  const existing = sessions.get(requestId);
  if (existing && !existing.cancelled) {
    existing.cancelled = true;
    existing.abort.abort();
    existing.buffer?.destroy();
  }
  const session: StreamSession = {
    abort: new AbortController(),
    cancelled: false,
  };
  sessions.set(requestId, session);
  return session;
}

export function cancelStreamSession(requestId: string): boolean {
  const session = sessions.get(requestId);
  if (!session) return false;
  if (!session.cancelled) {
    session.cancelled = true;
    session.abort.abort();
    session.buffer?.destroy();
  }
  sessions.delete(requestId);
  return true;
}

export function finishStreamSession(requestId: string): void {
  sessions.delete(requestId);
}

export function abortAllStreamSessions(): void {
  for (const id of [...sessions.keys()]) {
    cancelStreamSession(id);
  }
}

export function getActiveStreamCount(): number {
  return sessions.size;
}

export function isStreamCancelled(requestId: string): boolean {
  return sessions.get(requestId)?.cancelled === true;
}
