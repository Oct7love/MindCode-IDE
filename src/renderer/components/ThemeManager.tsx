/**
 * ThemeManager - 主题管理器
 * 主题切换、自定义、预览
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

export interface Theme { id: string; name: string; type: 'dark' | 'light'; colors: ThemeColors; }
export interface ThemeColors { bgBase: string; bgElevated: string; bgHover: string; textPrimary: string; textSecondary: string; textMuted: string; border: string; accent: string; accentHover: string; success: string; warning: string; error: string; info: string; }

const STORAGE_KEY = 'mindcode_theme';

const DEFAULT_THEMES: Theme[] = [
  { id: 'dark', name: 'Dark', type: 'dark', colors: { bgBase: '#1e1e1e', bgElevated: '#252526', bgHover: '#2a2d2e', textPrimary: '#d4d4d4', textSecondary: '#cccccc', textMuted: '#808080', border: '#3c3c3c', accent: '#007acc', accentHover: '#1a8ad4', success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6' } },
  { id: 'light', name: 'Light', type: 'light', colors: { bgBase: '#ffffff', bgElevated: '#f3f3f3', bgHover: '#e8e8e8', textPrimary: '#1f1f1f', textSecondary: '#424242', textMuted: '#6e6e6e', border: '#e5e5e5', accent: '#0066b8', accentHover: '#005a9e', success: '#16a34a', warning: '#d97706', error: '#dc2626', info: '#2563eb' } },
  { id: 'monokai', name: 'Monokai', type: 'dark', colors: { bgBase: '#272822', bgElevated: '#2d2e27', bgHover: '#3e3d32', textPrimary: '#f8f8f2', textSecondary: '#cfcfc2', textMuted: '#75715e', border: '#3e3d32', accent: '#a6e22e', accentHover: '#b6f23e', success: '#a6e22e', warning: '#e6db74', error: '#f92672', info: '#66d9ef' } },
  { id: 'dracula', name: 'Dracula', type: 'dark', colors: { bgBase: '#282a36', bgElevated: '#21222c', bgHover: '#44475a', textPrimary: '#f8f8f2', textSecondary: '#e0e0e0', textMuted: '#6272a4', border: '#44475a', accent: '#bd93f9', accentHover: '#caa9fa', success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555', info: '#8be9fd' } },
  { id: 'github', name: 'GitHub', type: 'light', colors: { bgBase: '#ffffff', bgElevated: '#f6f8fa', bgHover: '#f0f2f4', textPrimary: '#24292f', textSecondary: '#57606a', textMuted: '#8b949e', border: '#d0d7de', accent: '#0969da', accentHover: '#0550ae', success: '#1a7f37', warning: '#9a6700', error: '#cf222e', info: '#0969da' } },
  { id: 'nord', name: 'Nord', type: 'dark', colors: { bgBase: '#2e3440', bgElevated: '#3b4252', bgHover: '#434c5e', textPrimary: '#eceff4', textSecondary: '#e5e9f0', textMuted: '#4c566a', border: '#4c566a', accent: '#88c0d0', accentHover: '#8fbcbb', success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a', info: '#81a1c1' } },
];

// Context
interface ThemeContextValue { theme: Theme; setTheme: (id: string) => void; themes: Theme[]; addTheme: (theme: Theme) => void; }
const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = () => { const ctx = useContext(ThemeContext); if (!ctx) throw new Error('useTheme must be used within ThemeProvider'); return ctx; };

// Provider
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<Theme[]>(DEFAULT_THEMES);
  const [currentTheme, setCurrentTheme] = useState<Theme>(DEFAULT_THEMES[0]);

  // 加载保存的主题
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const theme = themes.find(t => t.id === saved) || themes[0];
      setCurrentTheme(theme);
    }
  }, [themes]);

  // 应用主题 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    const { colors } = currentTheme;
    root.style.setProperty('--color-bg-base', colors.bgBase);
    root.style.setProperty('--color-bg-elevated', colors.bgElevated);
    root.style.setProperty('--color-bg-hover', colors.bgHover);
    root.style.setProperty('--color-text-primary', colors.textPrimary);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-accent-primary', colors.accent);
    root.style.setProperty('--color-accent-hover', colors.accentHover);
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-error', colors.error);
    root.style.setProperty('--color-info', colors.info);
    document.body.style.background = colors.bgBase;
    document.body.style.color = colors.textPrimary;
  }, [currentTheme]);

  const setTheme = useCallback((id: string) => {
    const theme = themes.find(t => t.id === id);
    if (theme) { setCurrentTheme(theme); localStorage.setItem(STORAGE_KEY, id); }
  }, [themes]);

  const addTheme = useCallback((theme: Theme) => { setThemes(prev => [...prev.filter(t => t.id !== theme.id), theme]); }, []);

  return <ThemeContext.Provider value={{ theme: currentTheme, setTheme, themes, addTheme }}>{children}</ThemeContext.Provider>;
};

// UI 组件
interface ThemeManagerProps { isOpen: boolean; onClose: () => void; }

export const ThemeManager: React.FC<ThemeManagerProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, themes } = useTheme();
  const [preview, setPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '50vw', maxWidth: 600, background: 'var(--color-bg-elevated)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>🎨 主题</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* 主题列表 */}
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxHeight: 400, overflow: 'auto' }}>
          {themes.map(t => (
            <div key={t.id} onClick={() => setTheme(t.id)} onMouseEnter={() => setPreview(t.id)} onMouseLeave={() => setPreview(null)} style={{ padding: 12, borderRadius: 8, border: `2px solid ${theme.id === t.id ? 'var(--color-accent-primary)' : 'var(--color-border)'}`, cursor: 'pointer', background: preview === t.id ? 'var(--color-bg-hover)' : 'transparent' }}>
              {/* 预览色块 */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: t.colors.bgBase, border: '1px solid var(--color-border)' }} />
                <div style={{ width: 20, height: 20, borderRadius: 4, background: t.colors.accent }} />
                <div style={{ width: 20, height: 20, borderRadius: 4, background: t.colors.success }} />
                <div style={{ width: 20, height: 20, borderRadius: 4, background: t.colors.error }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {t.type === 'dark' ? '🌙' : '☀️'} {t.type === 'dark' ? '深色' : '浅色'}
                {theme.id === t.id && <span style={{ marginLeft: 'auto', color: 'var(--color-accent-primary)' }}>✓ 当前</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThemeManager;
