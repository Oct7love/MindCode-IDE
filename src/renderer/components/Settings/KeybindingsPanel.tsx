import React, { useState, useEffect, useCallback } from 'react';
import { keybindingService, Keybinding, KeybindingConflict } from '../../services/keybindingService';

// 快捷键设置面板
export const KeybindingsPanel: React.FC = () => {
  const [bindings, setBindings] = useState<Keybinding[]>([]);
  const [conflicts, setConflicts] = useState<KeybindingConflict[]>([]);
  const [vimEnabled, setVimEnabled] = useState(false);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState(false);

  // 加载数据
  useEffect(() => {
    const update = () => {
      setBindings(keybindingService.getAll());
      setConflicts(keybindingService.detectConflicts());
      setVimEnabled(keybindingService.isVimEnabled());
    };
    update();
    return keybindingService.subscribe(update);
  }, []);

  // 过滤快捷键
  const filtered = bindings.filter(b => !filter || b.command.toLowerCase().includes(filter.toLowerCase()) || b.key.toLowerCase().includes(filter.toLowerCase()));

  // 录制快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (!recordingKey) return;
    e.preventDefault();
    e.stopPropagation();
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    const key = e.key.toLowerCase();
    if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key === ' ' ? 'space' : key);
    if (parts.length > 0 && parts[parts.length - 1] !== 'ctrl' && parts[parts.length - 1] !== 'shift' && parts[parts.length - 1] !== 'alt') {
      const binding = bindings.find(b => b.id === id);
      if (binding) keybindingService.set(id, parts.join('+'), binding.command, binding.when);
      setEditingId(null);
      setRecordingKey(false);
    }
  }, [recordingKey, bindings]);

  // Vim 模式切换
  const toggleVim = () => { keybindingService.setVimMode(!vimEnabled); };

  return (
    <div className="keybindings-panel">
      <div className="keybindings-header">
        <h3>快捷键设置</h3>
        <div className="keybindings-actions">
          <label className="vim-toggle">
            <input type="checkbox" checked={vimEnabled} onChange={toggleVim} />
            <span>Vim 模式</span>
          </label>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="keybindings-conflicts">
          <div className="conflict-warning">⚠️ 检测到 {conflicts.length} 个快捷键冲突</div>
          {conflicts.map(c => (
            <div key={c.key} className="conflict-item">
              <span className="conflict-key">{c.key}</span>
              <span className="conflict-commands">{c.bindings.map(b => b.command).join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="keybindings-search">
        <input type="text" placeholder="搜索快捷键或命令..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      <div className="keybindings-list">
        <div className="keybindings-list-header">
          <span className="col-command">命令</span>
          <span className="col-key">快捷键</span>
          <span className="col-source">来源</span>
          <span className="col-actions">操作</span>
        </div>
        {filtered.map(b => (
          <div key={b.id} className={`keybinding-row${editingId === b.id ? ' editing' : ''}`}>
            <span className="col-command" title={b.command}>{b.command}</span>
            <span className="col-key">
              {editingId === b.id && recordingKey ? (
                <input type="text" className="key-recorder" placeholder="按下新快捷键..." autoFocus onKeyDown={e => handleKeyDown(e, b.id)} onBlur={() => { setEditingId(null); setRecordingKey(false); }} />
              ) : (
                <kbd onClick={() => { setEditingId(b.id); setRecordingKey(true); }}>{b.key}</kbd>
              )}
            </span>
            <span className="col-source">{b.source === 'user' ? '自定义' : b.source === 'extension' ? '扩展' : '默认'}</span>
            <span className="col-actions">
              {b.source === 'user' && (
                <button className="btn-reset" onClick={() => keybindingService.reset(b.id)} title="重置为默认">↺</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeybindingsPanel;
