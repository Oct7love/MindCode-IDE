// 对话持久化服务 - 管理 localStorage 中的对话读写
import type { Conversation } from "@stores/useAIStore";

const STORAGE_KEY = "mindcode-ai-conversations";

/** 从 localStorage 加载对话列表 */
export function loadConversations(fallback: Conversation[]): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((c: any) => ({
        ...c,
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
      }));
    }
  } catch (e) {
    console.error("[ConversationPersistence] 加载失败:", e);
  }
  return fallback;
}

/** 保存对话到 localStorage（带 300ms 防抖，避免流式输出时频繁写入） */
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveConversations(conversations: Conversation[], immediate = false): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  const doSave = () => {
    try {
      const toSave = conversations.slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        console.warn("[ConversationPersistence] localStorage 配额超限，裁剪旧对话");
        try {
          const trimmed = conversations.slice(0, 20);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch (e2) {
          console.warn("[ConversationPersistence] 裁剪后仍无法保存:", e2);
        }
      } else {
        console.error("[ConversationPersistence] 保存失败:", e);
      }
    }
  };
  if (immediate) {
    doSave();
    return;
  }
  _saveTimer = setTimeout(doSave, 300);
}
