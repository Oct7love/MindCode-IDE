import React, { useState, useEffect } from 'react';
import { useAIStore, useUIStore } from '../../stores';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'ai' | 'editor' | 'shortcuts' | 'appearance';

const defaultSettings = {
  ai: { defaultModel: 'claude-4-5-opus', enableGhostText: true, completionDelay: 300, completionModel: 'gemini-2-5-flash-lite', maxTokens: 4096, temperature: 0.7 },
  editor: { fontSize: 14, fontFamily: 'JetBrains Mono', tabSize: 2, wordWrap: 'off', minimap: true, lineNumbers: 'on', formatOnSave: false },
  appearance: { theme: 'dark-plus', sidebarWidth: 240, aiPanelWidth: 380 },
  shortcuts: { openAIPanel: 'Ctrl+L', commandPalette: 'Ctrl+Shift+P', quickOpen: 'Ctrl+P', inlineEdit: 'Ctrl+K', toggleTerminal: 'Ctrl+`' },
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { model, setModel } = useAIStore();
  const { theme, setTheme, aiPanelWidth, setAIPanelWidth } = useUIStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [settings, setSettings] = useState(defaultSettings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => { // 加载设置
    const saved = localStorage.getItem('mindcode-settings');
    if (saved) try { setSettings({ ...defaultSettings, ...JSON.parse(saved) }); } catch {}
  }, []);

  const updateSetting = <T extends keyof typeof settings>(section: T, key: keyof typeof settings[T], value: any) => {
    setSettings(s => ({ ...s, [section]: { ...s[section], [key]: value } }));
    setIsDirty(true);
  };

  const saveSettings = () => {
    localStorage.setItem('mindcode-settings', JSON.stringify(settings));
    setModel(settings.ai.defaultModel);
    setTheme(settings.appearance.theme);
    setAIPanelWidth(settings.appearance.aiPanelWidth);
    setIsDirty(false);
    // 发送设置更新事件
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
  };

  const resetSettings = () => { setSettings(defaultSettings); setIsDirty(true); };

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'ai', label: 'AI 设置', icon: '🤖' },
    { id: 'editor', label: '编辑器', icon: '📝' },
    { id: 'appearance', label: '外观', icon: '🎨' },
    { id: 'shortcuts', label: '快捷键', icon: '⌨️' },
  ];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>设置</h2>
          <button className="settings-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          <div className="settings-tabs">
            {tabs.map(tab => (
              <button key={tab.id} className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          <div className="settings-body">
            {activeTab === 'ai' && (
              <div className="settings-section">
                <div className="setting-item">
                  <label>默认模型</label>
                  <select value={settings.ai.defaultModel} onChange={e => updateSetting('ai', 'defaultModel', e.target.value)}>
                    <optgroup label="Claude"><option value="claude-4-5-opus">Claude 4.5 Opus</option><option value="claude-4-5-sonnet">Claude 4.5 Sonnet</option></optgroup>
                    <optgroup label="Gemini"><option value="gemini-2-5-flash">Gemini 2.5 Flash</option><option value="gemini-2-5-flash-lite">Gemini 2.5 Flash Lite</option></optgroup>
                    <optgroup label="OpenAI"><option value="gpt-4o">GPT-4o</option></optgroup>
                  </select>
                </div>
                <div className="setting-item">
                  <label>启用 Ghost Text 补全</label>
                  <input type="checkbox" checked={settings.ai.enableGhostText} onChange={e => updateSetting('ai', 'enableGhostText', e.target.checked)} />
                </div>
                <div className="setting-item">
                  <label>补全触发延迟 (ms)</label>
                  <input type="number" value={settings.ai.completionDelay} min={100} max={2000} step={100} onChange={e => updateSetting('ai', 'completionDelay', +e.target.value)} />
                </div>
                <div className="setting-item">
                  <label>补全模型</label>
                  <select value={settings.ai.completionModel} onChange={e => updateSetting('ai', 'completionModel', e.target.value)}>
                    <option value="gemini-2-5-flash-lite">Gemini 2.5 Flash Lite (快速)</option>
                    <option value="gemini-2-5-flash">Gemini 2.5 Flash</option>
                    <option value="claude-4-5-sonnet">Claude 4.5 Sonnet</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>最大 Token 数</label>
                  <input type="number" value={settings.ai.maxTokens} min={1024} max={32000} step={1024} onChange={e => updateSetting('ai', 'maxTokens', +e.target.value)} />
                </div>
                <div className="setting-item">
                  <label>Temperature</label>
                  <input type="range" value={settings.ai.temperature} min={0} max={1} step={0.1} onChange={e => updateSetting('ai', 'temperature', +e.target.value)} />
                  <span>{settings.ai.temperature}</span>
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="settings-section">
                <div className="setting-item">
                  <label>字体大小</label>
                  <input type="number" value={settings.editor.fontSize} min={10} max={24} onChange={e => updateSetting('editor', 'fontSize', +e.target.value)} />
                </div>
                <div className="setting-item">
                  <label>字体</label>
                  <select value={settings.editor.fontFamily} onChange={e => updateSetting('editor', 'fontFamily', e.target.value)}>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="SF Mono">SF Mono</option>
                    <option value="Consolas">Consolas</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>Tab 大小</label>
                  <select value={settings.editor.tabSize} onChange={e => updateSetting('editor', 'tabSize', +e.target.value)}>
                    <option value={2}>2</option><option value={4}>4</option><option value={8}>8</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>自动换行</label>
                  <select value={settings.editor.wordWrap} onChange={e => updateSetting('editor', 'wordWrap', e.target.value)}>
                    <option value="off">关闭</option><option value="on">开启</option><option value="bounded">有界</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>显示 Minimap</label>
                  <input type="checkbox" checked={settings.editor.minimap} onChange={e => updateSetting('editor', 'minimap', e.target.checked)} />
                </div>
                <div className="setting-item">
                  <label>显示行号</label>
                  <select value={settings.editor.lineNumbers} onChange={e => updateSetting('editor', 'lineNumbers', e.target.value)}>
                    <option value="on">显示</option><option value="off">隐藏</option><option value="relative">相对</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>保存时格式化</label>
                  <input type="checkbox" checked={settings.editor.formatOnSave} onChange={e => updateSetting('editor', 'formatOnSave', e.target.checked)} />
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-section">
                <div className="setting-item">
                  <label>主题</label>
                  <select value={settings.appearance.theme} onChange={e => updateSetting('appearance', 'theme', e.target.value)}>
                    <option value="dark-plus">Dark+</option>
                    <option value="mindcode-dark">MindCode Dark</option>
                    <option value="one-dark-pro">One Dark Pro</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>侧边栏宽度</label>
                  <input type="number" value={settings.appearance.sidebarWidth} min={180} max={400} onChange={e => updateSetting('appearance', 'sidebarWidth', +e.target.value)} />
                </div>
                <div className="setting-item">
                  <label>AI 面板宽度</label>
                  <input type="number" value={settings.appearance.aiPanelWidth} min={280} max={600} onChange={e => updateSetting('appearance', 'aiPanelWidth', +e.target.value)} />
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="settings-section">
                {Object.entries(settings.shortcuts).map(([key, value]) => (
                  <div key={key} className="setting-item">
                    <label>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
                    <input type="text" value={value} onChange={e => updateSetting('shortcuts', key as any, e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-btn" onClick={resetSettings}>重置默认</button>
          <div style={{ flex: 1 }} />
          <button className="settings-btn" onClick={onClose}>取消</button>
          <button className="settings-btn primary" onClick={saveSettings} disabled={!isDirty}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
