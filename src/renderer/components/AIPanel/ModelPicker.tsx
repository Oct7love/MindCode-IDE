import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactDOM from 'react-dom';
import './ModelPicker.css';

export interface ModelInfo { id: string; name: string; icon: string; desc: string; provider: string; toolCapable?: boolean; }

export const MODELS: ModelInfo[] = [
  // Claude 系列 (智能路由：Opus/Sonnet 简单任务自动调用 Haiku)
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', icon: '🧠', desc: '最强思维 (含智能路由)', provider: 'claude', toolCapable: true },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', icon: '💡', desc: '代码推理 (含智能路由)', provider: 'claude', toolCapable: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', icon: '⚡', desc: '快速响应', provider: 'claude', toolCapable: true },
  // Gemini 系列
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', icon: '⚡', desc: '极速预览', provider: 'gemini', toolCapable: true },
  { id: 'gemini-3-pro-high', name: 'Gemini 3 Pro', icon: '🎯', desc: '最强推理', provider: 'gemini', toolCapable: true },
  { id: 'gemini-3-pro-low', name: 'Gemini 3 Lite', icon: '💨', desc: '轻量极速', provider: 'gemini', toolCapable: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡', desc: '极速响应', provider: 'gemini', toolCapable: true },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', icon: '🧠', desc: '思维链', provider: 'gemini', toolCapable: true },
  // DeepSeek 系列
  { id: 'deepseek-chat', name: 'DeepSeek V3', icon: '🐋', desc: '性价比高', provider: 'deepseek', toolCapable: true },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', icon: '💻', desc: '代码专家', provider: 'deepseek', toolCapable: true },
  { id: 'deepseek-reasoner', name: 'DeepSeek R2', icon: '🧠', desc: '深度推理', provider: 'deepseek', toolCapable: true },
  // GLM 系列
  { id: 'glm-4.7', name: 'GLM-4.7', icon: '🔮', desc: '高智能旗舰', provider: 'glm', toolCapable: true },
  { id: 'glm-4.7-flashx', name: 'GLM-4.7 FlashX', icon: '⚡', desc: '轻量高速', provider: 'glm', toolCapable: true },
  // ===== 特价渠道 (智能路由：Opus/Sonnet 简单任务自动调用 Haiku) =====
  { id: 'codesuc-opus', name: 'Claude Opus 4.5 [特价]', icon: '💎', desc: '特价渠道 (含智能路由)', provider: 'codesuc', toolCapable: true },
  { id: 'codesuc-sonnet', name: 'Claude Sonnet 4.5 [特价]', icon: '💰', desc: '特价渠道 (含智能路由)', provider: 'codesuc', toolCapable: true },
  { id: 'codesuc-haiku', name: 'Claude Haiku 4.5 [特价]', icon: '🏷️', desc: '特价渠道', provider: 'codesuc', toolCapable: true },
];

// 支持工具调用的模型列表
export const TOOL_CAPABLE_MODELS = MODELS.filter(m => m.toolCapable).map(m => m.id);

interface ModelPickerProps {
  model: string;
  onModelChange: (model: string) => void;
  whitelist?: string[];
  disabled?: boolean;
  compact?: boolean;
  isResizing?: boolean;
}

interface DropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement>;
  models: ModelInfo[];
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({ anchorRef, models, current, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', escHandler);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose, anchorRef]);

  const normalModels = models.filter(m => m.provider !== 'codesuc');
  const specialModels = models.filter(m => m.provider === 'codesuc');

  // 计算位置：简单地放在按钮上方
  const getStyle = (): React.CSSProperties => {
    if (!anchorRef.current) return {};
    const rect = anchorRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      left: rect.left,
      bottom: window.innerHeight - rect.top + 6,
      maxHeight: 350,
    };
  };

  return ReactDOM.createPortal(
    <div
      ref={ref}
      className="ai-model-dropdown"
      style={getStyle()}
      role="listbox"
    >
      {normalModels.map(m => (
        <button
          key={m.id}
          className={`ai-model-option ${m.id === current ? 'active' : ''}`}
          onClick={() => onSelect(m.id)}
          role="option"
          aria-selected={m.id === current}
        >
          <span className="ai-model-option-icon">{m.icon}</span>
          <div className="ai-model-option-info">
            <span className="ai-model-option-name">{m.name}</span>
            <span className="ai-model-option-desc">{m.desc}</span>
          </div>
          {m.id === current && (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
        </button>
      ))}
      {specialModels.length > 0 && (
        <>
          <div className="ai-model-divider"><span>💎 特价渠道</span></div>
          {specialModels.map(m => (
            <button
              key={m.id}
              className={`ai-model-option special ${m.id === current ? 'active' : ''}`}
              onClick={() => onSelect(m.id)}
              role="option"
              aria-selected={m.id === current}
            >
              <span className="ai-model-option-icon">{m.icon}</span>
              <div className="ai-model-option-info">
                <span className="ai-model-option-name">{m.name}</span>
                <span className="ai-model-option-desc">{m.desc}</span>
              </div>
              {m.id === current && (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
              )}
            </button>
          ))}
        </>
      )}
    </div>,
    document.body
  );
};

export const ModelPicker: React.FC<ModelPickerProps> = memo(({ model, onModelChange, whitelist, disabled, compact, isResizing }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const models = whitelist ? MODELS.filter(m => whitelist.includes(m.id)) : MODELS;
  const current = models.find(m => m.id === model) || models[0];

  // 当父组件正在调整大小时，关闭下拉菜单
  useEffect(() => {
    if (isResizing && open) {
      setOpen(false);
    }
  }, [isResizing, open]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isResizing) return;
    setOpen(prev => !prev);
  }, [disabled, isResizing]);

  const handleSelect = useCallback((id: string) => {
    onModelChange(id);
    setOpen(false);
  }, [onModelChange]);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <div className="ai-model-picker">
      <button
        ref={btnRef}
        className={`ai-model-trigger ${disabled ? 'disabled' : ''} ${open ? 'active' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="ai-model-icon">{current.icon}</span>
        <span className="ai-model-name">{compact ? current.name.split(' ')[0] : current.name}</span>
        <svg className={`ai-model-chevron ${open ? 'open' : ''}`} viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path d="M4 6l4 4 4-4z"/>
        </svg>
      </button>
      {open && (
        <Dropdown
          anchorRef={btnRef}
          models={models}
          current={model}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </div>
  );
});
