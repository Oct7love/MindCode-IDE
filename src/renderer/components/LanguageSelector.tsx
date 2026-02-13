import React from "react";
import { SUPPORTED_LANGUAGES } from "../stores";

interface LanguageSelectorProps {
  isOpen: boolean;
  targetFileId: string | null;
  onSelect: (languageId: string, ext: string) => void;
  onClose: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  isOpen,
  targetFileId,
  onSelect,
  onClose,
}) => {
  if (!isOpen || !targetFileId) return null;

  return (
    <div className="language-selector-overlay" onClick={onClose}>
      <div className="language-selector-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="language-selector-header">
          <span>选择语言类型</span>
          <button className="language-selector-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="language-selector-list">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              className="language-selector-item"
              onClick={() => onSelect(lang.id, lang.ext)}
            >
              <span className="lang-name">{lang.name}</span>
              <span className="lang-ext">{lang.ext}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
