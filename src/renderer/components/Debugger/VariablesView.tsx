/**
 * 变量查看面板
 * 显示当前作用域的变量
 */

import React, { useState } from 'react';
import type { Variable } from '../../../core/debugger';

interface VariablesViewProps {
  variables: Variable[];
  onRefresh: () => void;
}

export const VariablesView: React.FC<VariablesViewProps> = ({ variables, onRefresh }) => {
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());

  const toggleExpand = (varName: string) => {
    setExpandedVars(prev => {
      const next = new Set(prev);
      if (next.has(varName)) {
        next.delete(varName);
      } else {
        next.add(varName);
      }
      return next;
    });
  };

  const renderVariable = (variable: Variable, level = 0) => {
    const hasChildren = variable.children && variable.children.length > 0;
    const isExpanded = expandedVars.has(variable.name);
    const indent = level * 16;

    return (
      <div key={variable.name} className="variable-item">
        <div 
          className="variable-main" 
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => hasChildren && toggleExpand(variable.name)}
        >
          {hasChildren && (
            <span className="expand-icon">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span className="expand-icon placeholder">•</span>}
          
          <span className="variable-name">{variable.name}</span>
          <span className="variable-separator">:</span>
          <span className="variable-type">{variable.type}</span>
          <span className="variable-value">{variable.value}</span>
        </div>

        {hasChildren && isExpanded && (
          <div className="variable-children">
            {variable.children!.map(child => renderVariable(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="variables-view">
      <div className="view-header">
        <span className="view-title">Variables</span>
        <button className="refresh-btn" onClick={onRefresh} title="Refresh">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M12.75 8a4.75 4.75 0 0 1-8.61 2.63l-.62.75A6 6 0 1 0 8 2V0l3 3-3 3V4a4 4 0 1 1-4 4H3a5 5 0 1 0 9.75 0h-.25z"/>
          </svg>
        </button>
      </div>

      <div className="variables-list">
        {variables.length === 0 ? (
          <div className="empty-state">No variables in current scope</div>
        ) : (
          variables.map(v => renderVariable(v))
        )}
      </div>
    </div>
  );
};
