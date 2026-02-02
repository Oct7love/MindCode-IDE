/**
 * ColorPicker - 颜色选择器组件
 */

import React, { useState, useRef, useEffect } from 'react';

interface ColorPickerProps { value: string; onChange: (color: string) => void; presets?: string[]; showInput?: boolean; label?: string; }

const DEFAULT_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#64748b', '#71717a', '#737373', '#78716c', '#ffffff', '#000000', '#6b7280',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, presets = DEFAULT_PRESETS, showInput = true, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  };

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm text-[var(--color-text-muted)] mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <button onClick={() => setIsOpen(!isOpen)} className="w-8 h-8 rounded border border-[var(--color-border)] shadow-sm cursor-pointer" style={{ backgroundColor: value }} title="选择颜色" />
        {showInput && (
          <input type="text" value={inputValue} onChange={handleInputChange} className="w-24 px-2 py-1 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded" placeholder="#000000" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {presets.map(color => (
              <button key={color} onClick={() => { onChange(color); setIsOpen(false); }} className={`w-6 h-6 rounded border ${value === color ? 'ring-2 ring-[var(--color-accent-primary)] ring-offset-1' : 'border-transparent hover:border-[var(--color-border)]'}`} style={{ backgroundColor: color }} />
            ))}
          </div>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-8 cursor-pointer rounded" />
        </div>
      )}
    </div>
  );
};

// 透明度颜色选择器
interface ColorWithAlphaPickerProps extends ColorPickerProps { alpha?: number; onAlphaChange?: (alpha: number) => void; }

export const ColorWithAlphaPicker: React.FC<ColorWithAlphaPickerProps> = ({ value, onChange, alpha = 1, onAlphaChange, ...props }) => {
  return (
    <div className="space-y-2">
      <ColorPicker value={value} onChange={onChange} {...props} />
      {onAlphaChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">透明度</span>
          <input type="range" min="0" max="1" step="0.01" value={alpha} onChange={(e) => onAlphaChange(parseFloat(e.target.value))} className="flex-1" />
          <span className="text-xs w-12 text-right">{Math.round(alpha * 100)}%</span>
        </div>
      )}
    </div>
  );
};

// 主题色选择器
interface ThemeColorPickerProps { colors: Record<string, string>; onChange: (key: string, color: string) => void; }

export const ThemeColorPicker: React.FC<ThemeColorPickerProps> = ({ colors, onChange }) => {
  const colorLabels: Record<string, string> = {
    primary: '主色', secondary: '次要色', accent: '强调色', background: '背景色',
    foreground: '前景色', border: '边框色', success: '成功', warning: '警告', error: '错误',
  };

  return (
    <div className="space-y-3">
      {Object.entries(colors).map(([key, color]) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-sm">{colorLabels[key] || key}</span>
          <ColorPicker value={color} onChange={(c) => onChange(key, c)} showInput={false} />
        </div>
      ))}
    </div>
  );
};

export default ColorPicker;
