import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactDOM from 'react-dom';
import './ModelPicker.css';

export interface ModelInfo { id: string; name: string; icon: string; desc: string; provider: string; toolCapable?: boolean; }

export const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-5-thinking', name: 'Claude Opus 4.5 (Thinking)', icon: '🧠', desc: '最强思维', provider: 'claude', toolCapable: true },
  { id: 'claude-sonnet-4-5-thinking', name: 'Claude Sonnet 4.5 (Thinking)', icon: '💡', desc: '思维链', provider: 'claude', toolCapable: true },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', icon: '⚡', desc: '代码推理', provider: 'claude', toolCapable: true },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', icon: '⚡', desc: '极速预览', provider: 'gemini', toolCapable: true },
  { id: 'gemini-3-pro-high', name: 'Gemini 3 Pro', icon: '🎯', desc: '最强推理', provider: 'gemini', toolCapable: true },
  { id: 'gemini-3-pro-low', name: 'Gemini 3 Lite', icon: '💨', desc: '轻量极速', provider: 'gemini', toolCapable: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡', desc: '极速响应', provider: 'gemini', toolCapable: true },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', icon: '🧠', desc: '思维链', provider: 'gemini', toolCapable: true },
  { id: 'deepseek-chat', name: 'DeepSeek V3', icon: '🐋', desc: '性价比高', provider: 'deepseek', toolCapable: true },
  { id: 'deepseek-reasoner', name: 'DeepSeek R2', icon: '🧠', desc: '深度推理', provider: 'deepseek', toolCapable: true },
  { id: 'glm-4.7', name: 'GLM-4.7', icon: '🔮', desc: '高智能旗舰', provider: 'glm', toolCapable: true },
  { id: 'glm-4.7-flashx', name: 'GLM-4.7 FlashX', icon: '⚡', desc: '轻量高速', provider: 'glm', toolCapable: true },
];

export const TOOL_CAPABLE_MODELS = MODELS.filter(m => m.toolCapable).map(m => m.id);

interface ModelPickerProps { model: string; onModelChange: (model: string) => void; whitelist?: string[]; disabled?: boolean; compact?: boolean; }

const Dropdown: React.FC<{ pos: { x: number; y: number }; models: ModelInfo[]; current: string; onSelect: (id: string) => void; onClose: () => void }> = ({ pos, models, current, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', escHandler); };
  }, [onClose]);
  return ReactDOM.createPortal(
    <div ref={ref} className="ai-model-dropdown" style={{ left: pos.x, top: pos.y }} role="listbox">
      {models.map(m => (
        <button key={m.id} className={`ai-model-option ${m.id === current ? 'active' : ''}`} onClick={() => onSelect(m.id)} role="option" aria-selected={m.id === current}>
          <span className="ai-model-option-icon">{m.icon}</span>
          <div className="ai-model-option-info"><span className="ai-model-option-name">{m.name}</span><span className="ai-model-option-desc">{m.desc}</span></div>
          {m.id === current && <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>}
        </button>
      ))}
    </div>,
    document.body
  );
};

export const ModelPicker: React.FC<ModelPickerProps> = memo(({ model, onModelChange, whitelist, disabled, compact }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const models = whitelist ? MODELS.filter(m => whitelist.includes(m.id)) : MODELS;
  const current = models.find(m => m.id === model) || models[0];

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dropH = Math.min(models.length * 44 + 16, 400);
    const above = r.top > dropH || r.top > window.innerHeight - r.bottom;
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 280)), y: above ? Math.max(8, r.top - dropH - 4) : r.bottom + 4 });
    setOpen(true);
  }, [disabled, models.length]);

  const handleSelect = useCallback((id: string) => { onModelChange(id); setOpen(false); }, [onModelChange]);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <div className="ai-model-picker">
      <button ref={btnRef} className={`ai-model-trigger ${disabled ? 'disabled' : ''}`} onClick={handleOpen} disabled={disabled} type="button">
        <span className="ai-model-icon">{current.icon}</span>
        <span className="ai-model-name">{compact ? current.name.split(' ')[0] : current.name}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 6l4 4 4-4z"/></svg>
      </button>
      {open && <Dropdown pos={pos} models={models} current={model} onSelect={handleSelect} onClose={handleClose} />}
    </div>
  );
});
