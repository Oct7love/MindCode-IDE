/**
 * EditorSettings - 编辑器设置组件
 */

import React, { useState } from "react";
import { configManager } from "../config/app";

interface EditorConfig {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: "off" | "on" | "wordWrapColumn" | "bounded";
  lineNumbers: "on" | "off" | "relative";
  minimap: { enabled: boolean };
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  cursorStyle: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  smoothScrolling: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;
  bracketPairColorization: { enabled: boolean };
}

interface EditorSettingsProps {
  onClose?: () => void;
  onChange?: (config: Partial<EditorConfig>) => void;
}

const FONT_FAMILIES = [
  "'JetBrains Mono'",
  "'Fira Code'",
  "Consolas",
  "'Source Code Pro'",
  "'Cascadia Code'",
  "Monaco",
  "Menlo",
  "'Ubuntu Mono'",
];
const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24];
const TAB_SIZES = [2, 4, 8];

export const EditorSettings: React.FC<EditorSettingsProps> = ({ onClose, onChange }) => {
  const [config, setConfig] = useState<EditorConfig>(configManager.get("editor") as EditorConfig);

  const update = <K extends keyof EditorConfig>(key: K, value: EditorConfig[K]) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    configManager.set("editor", { [key]: value });
    onChange?.({ [key]: value });
  };

  const updateNested = <K extends keyof EditorConfig>(key: K, nestedKey: string, value: any) => {
    const newValue = { ...(config[key] as any), [nestedKey]: value };
    update(key, newValue);
  };

  return (
    <div className="w-96 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl">
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-medium">编辑器设置</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-auto">
        {/* 字体 */}
        <div>
          <label className="block text-sm font-medium mb-1">字体</label>
          <select
            value={config.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f.replace(/'/g, "")}
              </option>
            ))}
          </select>
        </div>

        {/* 字号 */}
        <div>
          <label className="block text-sm font-medium mb-1">字号</label>
          <select
            value={config.fontSize}
            onChange={(e) => update("fontSize", parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </div>

        {/* Tab 大小 */}
        <div>
          <label className="block text-sm font-medium mb-1">Tab 大小</label>
          <div className="flex gap-2">
            {TAB_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => update("tabSize", s)}
                className={`flex-1 py-2 rounded border ${config.tabSize === s ? "bg-[var(--color-accent-primary)] text-white border-transparent" : "bg-[var(--color-bg-secondary)] border-[var(--color-border)]"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 空格/Tab */}
        <div className="flex items-center justify-between">
          <span className="text-sm">使用空格缩进</span>
          <Toggle checked={config.insertSpaces} onChange={(v) => update("insertSpaces", v)} />
        </div>

        {/* 自动换行 */}
        <div>
          <label className="block text-sm font-medium mb-1">自动换行</label>
          <select
            value={config.wordWrap}
            onChange={(e) => update("wordWrap", e.target.value as any)}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          >
            <option value="off">关闭</option>
            <option value="on">开启</option>
            <option value="wordWrapColumn">按列宽</option>
            <option value="bounded">智能换行</option>
          </select>
        </div>

        {/* 行号 */}
        <div>
          <label className="block text-sm font-medium mb-1">行号</label>
          <select
            value={config.lineNumbers}
            onChange={(e) => update("lineNumbers", e.target.value as any)}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          >
            <option value="on">显示</option>
            <option value="off">隐藏</option>
            <option value="relative">相对行号</option>
          </select>
        </div>

        {/* 小地图 */}
        <div className="flex items-center justify-between">
          <span className="text-sm">显示小地图</span>
          <Toggle
            checked={config.minimap.enabled}
            onChange={(v) => updateNested("minimap", "enabled", v)}
          />
        </div>

        {/* 括号着色 */}
        <div className="flex items-center justify-between">
          <span className="text-sm">括号对着色</span>
          <Toggle
            checked={config.bracketPairColorization.enabled}
            onChange={(v) => updateNested("bracketPairColorization", "enabled", v)}
          />
        </div>

        {/* 平滑滚动 */}
        <div className="flex items-center justify-between">
          <span className="text-sm">平滑滚动</span>
          <Toggle checked={config.smoothScrolling} onChange={(v) => update("smoothScrolling", v)} />
        </div>

        {/* 粘贴格式化 */}
        <div className="flex items-center justify-between">
          <span className="text-sm">粘贴时格式化</span>
          <Toggle checked={config.formatOnPaste} onChange={(v) => update("formatOnPaste", v)} />
        </div>

        {/* 光标样式 */}
        <div>
          <label className="block text-sm font-medium mb-1">光标样式</label>
          <select
            value={config.cursorStyle}
            onChange={(e) => update("cursorStyle", e.target.value as any)}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          >
            <option value="line">竖线</option>
            <option value="block">方块</option>
            <option value="underline">下划线</option>
            <option value="line-thin">细竖线</option>
          </select>
        </div>

        {/* 空白字符 */}
        <div>
          <label className="block text-sm font-medium mb-1">显示空白字符</label>
          <select
            value={config.renderWhitespace}
            onChange={(e) => update("renderWhitespace", e.target.value as any)}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
          >
            <option value="none">不显示</option>
            <option value="selection">选中时</option>
            <option value="trailing">行尾</option>
            <option value="all">全部</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// Toggle 开关组件
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-5 rounded-full transition-colors ${checked ? "bg-[var(--color-accent-primary)]" : "bg-[var(--color-bg-tertiary)]"}`}
  >
    <div
      className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
    />
  </button>
);

export default EditorSettings;
