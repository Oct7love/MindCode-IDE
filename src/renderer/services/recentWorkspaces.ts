/**
 * Recent Workspaces Service
 * Tracks recently opened workspaces for the Welcome page
 */

const STORAGE_KEY = "mindcode.recentWorkspaces";
const MAX_RECENT = 8;

export interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: number;
}

export function getRecentWorkspaces(): RecentWorkspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentWorkspace[];
  } catch {
    return [];
  }
}

export function addRecentWorkspace(path: string): void {
  const name = path.split(/[/\\]/).pop() || "Workspace";
  const recent = getRecentWorkspaces().filter((w) => w.path !== path);
  recent.unshift({ path, name, lastOpened: Date.now() });
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}

export function removeRecentWorkspace(path: string): void {
  const recent = getRecentWorkspaces().filter((w) => w.path !== path);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}

export function clearRecentWorkspaces(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(timestamp).toLocaleDateString();
}
