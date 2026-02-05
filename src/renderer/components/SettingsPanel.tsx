/**
 * SettingsPanel - 设置面板
 * 分类配置、搜索、重置
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';

interface SettingItem { key: string; label: string; type: 'boolean' | 'string' | 'number' | 'select'; category: string; default: any; options?: string[]; description?: string; }

const SETTINGS: SettingItem[] = [
  // 编辑器
  { key: 'editor.fontSize', label: '字体大小', type: 'number', category: '编辑器', default: 14, description: '编辑器字体大小 (px)' },
  { key: 'editor.tabSize', label: 'Tab 大小', type: 'number', category: '编辑器', default: 2 },
  { key: 'editor.wordWrap', label: '自动换行', type: 'select', category: '编辑器', default: 'off', options: ['off', 'on', 'wordWrapColumn'] },
  { key: 'editor.minimap', label: '小地图', type: 'boolean', category: '编辑器', default: true },
  { key: 'editor.lineNumbers', label: '行号', type: 'select', category: '编辑器', default: 'on', options: ['on', 'off', 'relative'] },
  // AI
  { key: 'ai.model', label: '默认模型', type: 'select', category: 'AI', default: 'claude-sonnet-4-5-20250929', options: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'gpt-4o', 'gemini-2.5-pro', 'deepseek-chat'] },
  { key: 'ai.streaming', label: '流式输出', type: 'boolean', category: 'AI', default: true },
  { key: 'ai.autoComplete', label: '自动补全', type: 'boolean', category: 'AI', default: true },
  { key: 'completion.debounce', label: '补全延迟 (ms)', type: 'number', category: 'AI', default: 30 },
  // 外观
  { key: 'theme', label: '主题', type: 'select', category: '外观', default: 'dark', options: ['dark', 'light', 'abyss', 'monokai'] },
  { key: 'ui.sidebarWidth', label: '侧边栏宽度', type: 'number', category: '外观', default: 240 },
  { key: 'ui.density', label: '界面密度', type: 'select', category: '外观', default: 'comfortable', options: ['compact', 'comfortable', 'spacious'] },
  // 文件
  { key: 'files.autoSave', label: '自动保存', type: 'select', category: '文件', default: 'off', options: ['off', 'afterDelay', 'onFocusChange'] },
  { key: 'files.autoSaveDelay', label: '自动保存延迟 (ms)', type: 'number', category: '文件', default: 1000 },
  { key: 'files.encoding', label: '默认编码', type: 'select', category: '文件', default: 'utf-8', options: ['utf-8', 'gbk', 'gb2312', 'utf-16'] },
  // Git
  { key: 'git.autoFetch', label: '自动拉取', type: 'boolean', category: 'Git', default: false },
  { key: 'git.confirmSync', label: '同步前确认', type: 'boolean', category: 'Git', default: true },
];

interface SettingsPanelProps { isOpen: boolean; onClose: () => void; }

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // 加载设置
  useEffect(() => {
    const stored = localStorage.getItem('mindcode_settings');
    if (stored) setValues(JSON.parse(stored));
    else setValues(Object.fromEntries(SETTINGS.map(s => [s.key, s.default])));
  }, []);

  // 保存设置
  const saveSettings = useCallback((newValues: Record<string, any>) => {
    setValues(newValues);
    localStorage.setItem('mindcode_settings', JSON.stringify(newValues));
  }, []);

  // 更新单个设置
  const updateSetting = useCallback((key: string, value: any) => {
    saveSettings({ ...values, [key]: value });
  }, [values, saveSettings]);

  // 重置所有设置
  const resetAll = useCallback(() => {
    const defaults = Object.fromEntries(SETTINGS.map(s => [s.key, s.default]));
    saveSettings(defaults);
  }, [saveSettings]);

  // 分类
  const categories = useMemo(() => [...new Set(SETTINGS.map(s => s.category))], []);

  // 过滤设置
  const filtered = useMemo(() => {
    return SETTINGS.filter(s => {
      const matchSearch = !search || s.label.toLowerCase().includes(search.toLowerCase()) || s.key.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !activeCategory || s.category === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [search, activeCategory]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '80vw', maxWidth: 900, height: '70vh', background: 'var(--color-bg-elevated, #111)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>⚙️ 设置</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetAll} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 12 }}>重置所有</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索设置..." style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'inherit', fontSize: 13 }} />
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Categories */}
          <div style={{ width: 150, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
            <div onClick={() => setActiveCategory(null)} style={{ padding: '10px 12px', cursor: 'pointer', background: !activeCategory ? 'var(--color-bg-hover)' : 'transparent', fontSize: 13 }}>全部</div>
            {categories.map(cat => (
              <div key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '10px 12px', cursor: 'pointer', background: activeCategory === cat ? 'var(--color-bg-hover)' : 'transparent', fontSize: 13 }}>{cat}</div>
            ))}
          </div>

          {/* Settings List */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {filtered.map(setting => (
              <div key={setting.key} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>{setting.label}</label>
                  {setting.type === 'boolean' && (
                    <input type="checkbox" checked={values[setting.key] ?? setting.default} onChange={e => updateSetting(setting.key, e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  )}
                  {setting.type === 'number' && (
                    <input type="number" value={values[setting.key] ?? setting.default} onChange={e => updateSetting(setting.key, Number(e.target.value))} style={{ width: 80, padding: '4px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 12 }} />
                  )}
                  {setting.type === 'string' && (
                    <input type="text" value={values[setting.key] ?? setting.default} onChange={e => updateSetting(setting.key, e.target.value)} style={{ width: 200, padding: '4px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 12 }} />
                  )}
                  {setting.type === 'select' && (
                    <select value={values[setting.key] ?? setting.default} onChange={e => updateSetting(setting.key, e.target.value)} style={{ padding: '4px 8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 12 }}>
                      {setting.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{setting.key}</div>
                {setting.description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{setting.description}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
