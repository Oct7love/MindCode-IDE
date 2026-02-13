import React, { useState, useEffect, useCallback } from "react";

interface SettingItem {
  id: string;
  label: string;
  desc: string;
  type: "toggle" | "select" | "number";
  cat: string;
  value: any;
  opts?: { label: string; value: string }[];
}

const ITEMS: SettingItem[] = [
  {
    id: "completion.enabled",
    label: "Code Completion",
    desc: "Enable AI inline code completion (Ghost Text)",
    type: "toggle",
    cat: "AI",
    value: true,
  },
  {
    id: "completion.model",
    label: "Completion Model",
    desc: "Model used for code completion",
    type: "select",
    cat: "AI",
    value: "codesuc-sonnet",
    opts: [
      { label: "Codesuc Sonnet", value: "codesuc-sonnet" },
      { label: "Codesuc Haiku (faster)", value: "codesuc-haiku" },
      { label: "DeepSeek Coder", value: "deepseek-coder" },
    ],
  },
  {
    id: "completion.debounceMs",
    label: "Completion Delay (ms)",
    desc: "Delay before triggering completion request",
    type: "number",
    cat: "AI",
    value: 150,
  },
  {
    id: "editor.fontSize",
    label: "Font Size",
    desc: "Editor font size in pixels",
    type: "number",
    cat: "Editor",
    value: 14,
  },
  {
    id: "editor.tabSize",
    label: "Tab Size",
    desc: "Number of spaces per tab",
    type: "number",
    cat: "Editor",
    value: 2,
  },
  {
    id: "editor.wordWrap",
    label: "Word Wrap",
    desc: "Enable word wrapping in the editor",
    type: "toggle",
    cat: "Editor",
    value: false,
  },
  {
    id: "editor.minimap",
    label: "Minimap",
    desc: "Show minimap in editor gutter",
    type: "toggle",
    cat: "Editor",
    value: true,
  },
  {
    id: "editor.lineNumbers",
    label: "Line Numbers",
    desc: "Show line numbers",
    type: "toggle",
    cat: "Editor",
    value: true,
  },
  {
    id: "index.autoIndex",
    label: "Auto Index",
    desc: "Automatically index workspace on open",
    type: "toggle",
    cat: "Indexing",
    value: true,
  },
  {
    id: "review.autoReview",
    label: "Auto Review",
    desc: "Run AI code review before commit",
    type: "toggle",
    cat: "Git",
    value: false,
  },
];

export const SettingsView: React.FC<{ workspacePath?: string | null }> = () => {
  const [items, setItems] = useState<SettingItem[]>(ITEMS);
  const [filter, setFilter] = useState("");
  const [activeCat, setActiveCat] = useState("");

  useEffect(() => {
    ITEMS.forEach(async (s) => {
      try {
        const v = await window.mindcode?.settings?.get?.(s.id);
        if (v !== undefined && v !== null) {
          setItems((prev) => prev.map((i) => (i.id === s.id ? { ...i, value: v } : i)));
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  const save = useCallback(async (id: string, val: any) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, value: val } : i)));
    try {
      await window.mindcode?.settings?.set?.(id, val);
    } catch (e) {
      console.warn("[Settings] Save failed:", id, e);
    }
  }, []);

  const cats = Array.from(new Set(items.map((s) => s.cat)));
  const shown = items.filter((s) => {
    if (filter)
      return (s.label + " " + s.desc + " " + s.id).toLowerCase().includes(filter.toLowerCase());
    if (activeCat) return s.cat === activeCat;
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        color: "var(--vscode-foreground, #ccc)",
      }}
    >
      <input
        type="text"
        value={filter}
        placeholder="Search settings..."
        onChange={(e) => {
          setFilter(e.target.value);
          setActiveCat("");
        }}
        style={{
          margin: 8,
          padding: "6px 10px",
          background: "var(--vscode-input-background, #1e1e1e)",
          color: "var(--vscode-input-foreground, #ccc)",
          border: "1px solid var(--vscode-input-border, #3a3a3a)",
          borderRadius: 4,
          fontSize: 12,
          outline: "none",
        }}
      />

      <div style={{ display: "flex", gap: 4, padding: "0 8px 8px", flexWrap: "wrap" }}>
        <CatBtn
          label="All"
          active={!activeCat && !filter}
          onClick={() => {
            setActiveCat("");
            setFilter("");
          }}
        />
        {cats.map((c) => (
          <CatBtn
            key={c}
            label={c}
            active={activeCat === c}
            onClick={() => {
              setActiveCat(c);
              setFilter("");
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
        {shown.map((s) => (
          <div
            key={s.id}
            style={{
              padding: "10px 8px",
              borderBottom: "1px solid var(--vscode-panel-border, #2a2a2a)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "var(--vscode-descriptionForeground, #888)" }}>
                  {s.desc}
                </div>
              </div>
              <SettingControl item={s} onSave={save} />
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{s.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CatBtn: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      background: active ? "var(--vscode-button-background, #0078d4)" : "transparent",
      color: active ? "#fff" : "var(--vscode-descriptionForeground, #888)",
      border: "1px solid var(--vscode-input-border, #3a3a3a)",
      borderRadius: 12,
      padding: "2px 10px",
      fontSize: 11,
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);

const SettingControl: React.FC<{ item: SettingItem; onSave: (id: string, val: any) => void }> = ({
  item,
  onSave,
}) => {
  if (item.type === "toggle") {
    return (
      <button
        onClick={() => onSave(item.id, !item.value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: "none",
          background: item.value ? "var(--vscode-button-background, #0078d4)" : "#555",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            background: "#fff",
            position: "absolute",
            top: 2,
            left: item.value ? 18 : 2,
            transition: "left 0.2s",
          }}
        />
      </button>
    );
  }

  if (item.type === "select") {
    return (
      <select
        value={item.value}
        onChange={(e) => onSave(item.id, e.target.value)}
        style={{
          background: "var(--vscode-input-background, #1e1e1e)",
          color: "var(--vscode-input-foreground, #ccc)",
          border: "1px solid var(--vscode-input-border, #3a3a3a)",
          borderRadius: 3,
          padding: "3px 6px",
          fontSize: 12,
          outline: "none",
        }}
      >
        {(item.opts || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="number"
      value={item.value}
      onChange={(e) => onSave(item.id, parseInt(e.target.value) || 0)}
      style={{
        background: "var(--vscode-input-background, #1e1e1e)",
        color: "var(--vscode-input-foreground, #ccc)",
        border: "1px solid var(--vscode-input-border, #3a3a3a)",
        borderRadius: 3,
        padding: "3px 6px",
        fontSize: 12,
        width: 60,
        outline: "none",
      }}
    />
  );
};
