const recentWrites = new Map<string, number>();
const WRITE_IGNORE_MS = 1500;

export function rememberOwnWrite(path: string, now = Date.now()): void {
  recentWrites.set(path, now);
}

export function wasOwnWrite(path: string, now = Date.now()): boolean {
  const writtenAt = recentWrites.get(path);
  return writtenAt !== undefined && now - writtenAt < WRITE_IGNORE_MS;
}
