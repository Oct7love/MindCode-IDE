/**
 * AISettings - AI 设置面板
 * 模型选择、参数配置、API 管理
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAIStore } from '../../stores';

export interface AIConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  stream: boolean;
  systemPrompt?: string;
}

const PROVIDERS = {
  anthropic: { name: 'Anthropic', models: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'] },
  openai: { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  google: { name: 'Google', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'] },
  local: { name: '本地/代理', models: ['codesuc-opus', 'codesuc-sonnet', 'codesuc-haiku', 'deepseek-chat', 'qwen-turbo'] },
};

const STORAGE_KEY = 'mindcode_ai_config';
const DEFAULT_CONFIG: AIConfig = { provider: 'local', model: 'codesuc-sonnet', temperature: 0.7, maxTokens: 4096, topP: 1, stream: true };

interface AISettingsProps { isOpen: boolean; onClose: () => void; onSave?: (config: AIConfig) => void; }

export const AISettings: React.FC<AISettingsProps> = ({ isOpen, onClose, onSave }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'model' | 'params' | 'prompt'>('model');
  const { useSmartRouting, setUseSmartRouting, lastRoutingDecision } = useAIStore();

  // 加载配置
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setConfig(JSON.parse(stored));
  }, [isOpen]);

  // 保存配置
  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    onSave?.(config);
    onClose();
  }, [config, onSave, onClose]);

  // 切换提供商时重置模型
  const handleProviderChange = (provider: AIConfig['provider']) => {
    setConfig({ ...config, provider, model: PROVIDERS[provider].models[0] });
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '50vw', maxWidth: 600, background: 'var(--color-bg-elevated)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>⚙️ AI 设置</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          {[{ id: 'model', label: '模型' }, { id: 'params', label: '参数' }, { id: 'prompt', label: '系统提示' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ flex: 1, padding: '10px', background: activeTab === tab.id ? 'var(--color-bg-hover)' : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-primary)' : '2px solid transparent', cursor: 'pointer', color: 'inherit', fontSize: 12 }}>{tab.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 16, maxHeight: 400, overflow: 'auto' }}>
          {activeTab === 'model' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>服务提供商</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(PROVIDERS).map(([key, { name }]) => (
                    <button key={key} onClick={() => handleProviderChange(key as any)} style={{ flex: 1, padding: '8px', background: config.provider === key ? 'var(--color-accent-primary)' : 'var(--color-bg-base)', color: config.provider === key ? '#fff' : 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>{name}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>模型</label>
                <select value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 12 }}>
                  {PROVIDERS[config.provider].models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'params' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Temperature</span><span>{config.temperature}</span></label>
                <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>控制输出随机性，0=确定性，2=高随机</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Max Tokens</span><span>{config.maxTokens}</span></label>
                <input type="range" min="256" max="16384" step="256" value={config.maxTokens} onChange={e => setConfig({ ...config, maxTokens: parseInt(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Top P</span><span>{config.topP}</span></label>
                <input type="range" min="0" max="1" step="0.05" value={config.topP} onChange={e => setConfig({ ...config, topP: parseFloat(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={config.stream} onChange={e => setConfig({ ...config, stream: e.target.checked })} />
                  启用流式输出
                </label>
              </div>
              
              {/* 智能模型路由 */}
              <div style={{ marginTop: 16, padding: 12, background: 'var(--color-bg-base)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>🔀 智能模型路由</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>自动选择模型：简单任务用 Haiku，复杂任务用主模型</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={useSmartRouting} 
                      onChange={e => setUseSmartRouting(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      background: useSmartRouting ? '#22c55e' : 'var(--color-bg-hover)',
                      borderRadius: 20,
                      transition: '0.2s',
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: 16, width: 16,
                        left: useSmartRouting ? 22 : 2,
                        bottom: 2,
                        background: '#fff',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }} />
                    </span>
                  </label>
                </div>
                {lastRoutingDecision && (
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '4px 8px', background: 'var(--color-bg-hover)', borderRadius: 4 }}>
                    上次路由: {lastRoutingDecision.model} ({lastRoutingDecision.taskType})
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'prompt' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>系统提示词（可选）</label>
              <textarea value={config.systemPrompt || ''} onChange={e => setConfig({ ...config, systemPrompt: e.target.value })} placeholder="定义 AI 的行为和风格..." style={{ width: '100%', height: 200, padding: 8, background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'inherit', fontSize: 12, resize: 'vertical' }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setConfig(DEFAULT_CONFIG)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'inherit' }}>重置</button>
          <button onClick={handleSave} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>保存</button>
        </div>
      </div>
    </div>
  );
};

// 获取当前配置
export function getAIConfig(): AIConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
}

export default AISettings;
