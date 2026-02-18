/**
 * KeyboardShortcuts - 快捷键显示组件
 */

import React, { useState, useMemo } from "react";
import { shortcutManager } from "../services/shortcutManager";

interface KeyboardShortcutsProps {
  onClose?: () => void;
  editable?: boolean;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  onClose,
  editable = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKeys, setNewKeys] = useState("");

  const groups = useMemo(() => shortcutManager.listByCategory(), []);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        shortcuts: g.shortcuts.filter(
          (s) =>
            s.description.toLowerCase().includes(q) ||
            s.keys.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.shortcuts.length > 0);
  }, [groups, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingId) return;
    e.preventDefault();
    const keys: string[] = [];
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.altKey) keys.push("Alt");
    if (e.shiftKey) keys.push("Shift");
    if (e.metaKey) keys.push("Cmd");
    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key))
      keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    setNewKeys(keys.join("+"));
  };

  const saveBinding = (id: string) => {
    if (newKeys) {
      shortcutManager.setBinding(id, newKeys);
    }
    setEditingId(null);
    setNewKeys("");
  };

  const resetBinding = (id: string) => {
    shortcutManager.resetBinding(id);
    setEditingId(null);
    setNewKeys("");
  };

  return (
    <div className="w-full max-w-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-medium">快捷键</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索快捷键..."
            className="w-48 px-3 py-1.5 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          />
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto p-4">
        {filteredGroups.map((group) => (
          <div key={group.category} className="mb-6">
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {group.category}
            </h3>
            <div className="space-y-1">
              {group.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-[var(--color-bg-hover)]"
                >
                  <span className="text-sm">{shortcut.description}</span>
                  <div className="flex items-center gap-2">
                    {editingId === shortcut.id ? (
                      <>
                        <input
                          type="text"
                          value={newKeys}
                          onKeyDown={handleKeyDown}
                          onChange={() => {}}
                          placeholder="按下快捷键..."
                          className="w-32 px-2 py-1 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-accent-primary)] rounded text-center"
                          autoFocus
                        />
                        <button
                          onClick={() => saveBinding(shortcut.id)}
                          className="text-xs px-2 py-1 bg-[var(--color-accent-primary)] text-white rounded"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => resetBinding(shortcut.id)}
                          className="text-xs px-2 py-1 bg-[var(--color-bg-hover)] rounded"
                        >
                          重置
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-[var(--color-text-muted)]"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <KeyCombo keys={shortcutManager.getBinding(shortcut.id)} />
                        {editable && (
                          <button
                            onClick={() => {
                              setEditingId(shortcut.id);
                              setNewKeys("");
                            }}
                            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ml-2"
                          >
                            编辑
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="text-center text-[var(--color-text-muted)] py-8">未找到匹配的快捷键</div>
        )}
      </div>

      {editable && (
        <div className="p-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => shortcutManager.resetAllBindings()}
            className="text-sm px-3 py-1.5 bg-[var(--color-bg-hover)] rounded hover:bg-[var(--color-bg-active)]"
          >
            重置所有快捷键
          </button>
        </div>
      )}
    </div>
  );
};

// 快捷键组合显示
export const KeyCombo: React.FC<{ keys: string; size?: "sm" | "md" }> = ({ keys, size = "sm" }) => {
  const formatted = shortcutManager.formatKeys(keys);
  const parts = formatted.split(" ");
  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className={`${sizeClass} bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded font-mono`}
        >
          {part}
        </kbd>
      ))}
    </div>
  );
};

// 快捷键提示工具
export const ShortcutHint: React.FC<{ shortcutId: string; children: React.ReactNode }> = ({
  shortcutId,
  children,
}) => {
  const shortcut = shortcutManager.getShortcut(shortcutId);
  if (!shortcut) return <>{children}</>;

  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center gap-2 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded shadow-lg whitespace-nowrap z-50">
        <span className="text-xs">{shortcut.description}</span>
        <KeyCombo keys={shortcutManager.getBinding(shortcutId)} />
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
