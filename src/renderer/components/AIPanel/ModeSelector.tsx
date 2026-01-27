/**
 * ModeSelector - AI 模式选择器
 */
import React, { memo, useState, useRef, useEffect } from 'react';
import { AIMode } from '../../stores';
import './ModeSelector.css';

const MODE_OPTIONS: { mode: AIMode; icon: string; label: string; shortcut?: string }[] = [
  { mode: 'agent', icon: '∞', label: 'Agent', shortcut: 'Ctrl+I' },
  { mode: 'plan', icon: '☰', label: 'Plan' },
  { mode: 'debug', icon: '⚙', label: 'Debug' },
  { mode: 'chat', icon: '◇', label: 'Ask' },
];

interface ModeSelectorProps {
  mode: AIMode;
  onModeChange: (mode: AIMode) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = memo(({
  mode,
  onModeChange,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentOption = MODE_OPTIONS.find(m => m.mode === mode) || MODE_OPTIONS[0];

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const handleSelect = (m: AIMode) => {
    onModeChange(m);
    setIsOpen(false);
  };

  return (
    <div className="mode-selector" ref={menuRef}>
      <button
        className={`mode-trigger ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(!isOpen); }}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="mode-icon">{currentOption.icon}</span>
        <span className="mode-label">{currentOption.label}</span>
        <svg className={`mode-chevron ${isOpen ? 'open' : ''}`} viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path d="M4 6l4 4 4-4H4z"/>
        </svg>
      </button>

      {isOpen && (
        <div className="mode-menu" role="listbox">
          {MODE_OPTIONS.map(opt => (
            <div
              key={opt.mode}
              className={`mode-option ${mode === opt.mode ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); handleSelect(opt.mode); }}
              role="option"
              aria-selected={mode === opt.mode}
            >
              <span className="mode-option-icon">{opt.icon}</span>
              <span className="mode-option-label">{opt.label}</span>
              {mode === opt.mode && <span className="mode-option-check">✓</span>}
              {opt.shortcut && <span className="mode-option-shortcut">{opt.shortcut}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ModeSelector.displayName = 'ModeSelector';
