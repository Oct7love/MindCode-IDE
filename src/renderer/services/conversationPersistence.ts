/**
 * 对话持久化服务
 * 主存储: IndexedDB（无大小限制）
 * 降级存储: localStorage（同步加载，即时启动）
 */
import type { Conversation } from "@stores/useAIStore";
import { mindcodeDB } from "@services/indexedDB";

const STORAGE_KEY = "mindcode-ai-conversations";
const IDB_STORE = "settings";
const IDB_KEY = "conversations";

/** 反序列化对话（统一 timestamp → Date） */
function deserialize(parsed: Record<string, unknown>[]): Conversation[] {
  return parsed.map((c: Record<string, unknown>) => ({
    ...c,
    messages: ((c.messages as Record<string, unknown>[]) || []).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp as string | number),
    })),
  })) as Conversation[];
}

/** 同步加载（localStorage，用于 Zustand store 初始化） */
export function loadConversations(fallback: Conversation[]): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return deserialize(JSON.parse(stored));
  } catch (e) {
    console.error("[ConversationPersistence] localStorage 加载失败:", e);
  }
  return fallback;
}

/** 异步加载（IndexedDB 优先，用于启动后升级） */
export async function loadConversationsAsync(): Promise<Conversation[] | null> {
  try {
    const record = await mindcodeDB.get<{ key: string; value: Record<string, unknown>[] }>(
      IDB_STORE,
      IDB_KEY,
    );
    if (record?.value?.length) {
      console.log("[ConversationPersistence] 从 IndexedDB 加载", record.value.length, "个对话");
      return deserialize(record.value);
    }
  } catch (e) {
    console.warn("[ConversationPersistence] IndexedDB 加载失败:", e);
  }
  return null;
}

/** 保存对话（双写: localStorage 同步 + IndexedDB 异步） */
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveConversations(conversations: Conversation[], immediate = false): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  const doSave = () => {
    const toSave = conversations.slice(0, 50);
    // 同步写 localStorage（保证即时读取可用）
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        console.warn("[ConversationPersistence] localStorage 配额超限，裁剪到 20 条");
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave.slice(0, 20)));
        } catch {
          /* localStorage 已满，仅依赖 IndexedDB */
        }
      }
    }
    // 异步写 IndexedDB（主存储，无大小限制）
    mindcodeDB.put(IDB_STORE, { key: IDB_KEY, value: toSave }).catch((e) => {
      console.warn("[ConversationPersistence] IndexedDB 写入失败:", e);
    });
  };
  if (immediate) {
    doSave();
    return;
  }
  _saveTimer = setTimeout(doSave, 300);
}
