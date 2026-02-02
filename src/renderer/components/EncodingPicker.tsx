import React, { useState, useEffect, useRef } from 'react';

// 支持的编码列表 (与后端同步)
const ENCODINGS = [
  { id: 'utf8', label: 'UTF-8' },
  { id: 'utf8bom', label: 'UTF-8 with BOM' },
  { id: 'utf16le', label: 'UTF-16 LE' },
  { id: 'utf16be', label: 'UTF-16 BE' },
  { id: 'gbk', label: 'GBK (中文简体)' },
  { id: 'gb18030', label: 'GB18030' },
  { id: 'big5', label: 'Big5 (中文繁体)' },
  { id: 'shiftjis', label: 'Shift JIS (日文)' },
  { id: 'eucjp', label: 'EUC-JP' },
  { id: 'euckr', label: 'EUC-KR (韩文)' },
  { id: 'iso88591', label: 'ISO 8859-1 (Latin-1)' },
  { id: 'windows1251', label: 'Windows 1251 (Cyrillic)' },
  { id: 'windows1252', label: 'Windows 1252 (Western)' },
];

interface EncodingPickerProps {
  currentEncoding: string;
  onSelect: (encoding: string) => void;
}

export const EncodingPicker: React.FC<EncodingPickerProps> = ({ currentEncoding, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { // 点击外部关闭
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = ENCODINGS.filter(e => e.label.toLowerCase().includes(filter.toLowerCase()) || e.id.includes(filter.toLowerCase()));
  const current = ENCODINGS.find(e => e.id === currentEncoding)?.label || currentEncoding.toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span className="status-item status-item-clickable" onClick={() => setIsOpen(!isOpen)} title="选择文件编码">
        {current}
      </span>
      {isOpen && (
        <div className="encoding-picker-dropdown">
          <input
            type="text"
            placeholder="搜索编码..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
            className="encoding-picker-search"
          />
          <div className="encoding-picker-list">
            {filtered.map(enc => (
              <div
                key={enc.id}
                className={`encoding-picker-item ${enc.id === currentEncoding ? 'active' : ''}`}
                onClick={() => { onSelect(enc.id); setIsOpen(false); setFilter(''); }}
              >
                {enc.label}
                {enc.id === currentEncoding && <span className="checkmark">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EncodingPicker;
