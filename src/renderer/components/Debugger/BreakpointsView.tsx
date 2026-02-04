/**
 * 断点管理面板
 */

import React from 'react';
import type { Breakpoint } from '../../../core/debugger';

interface BreakpointsViewProps {
  breakpoints: Breakpoint[];
  onRefresh: () => void;
  onToggle: (breakpoint: Breakpoint) => void;
  onRemove: (breakpoint: Breakpoint) => void;
}

export const BreakpointsView: React.FC<BreakpointsViewProps> = ({
  breakpoints,
  onRefresh,
  onToggle,
  onRemove
}) => {
  return (
    <div className="breakpoints-view">
      <div className="view-header">
        <span className="view-title">Breakpoints ({breakpoints.length})</span>
        <button className="refresh-btn" onClick={onRefresh} title="Refresh">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M12.75 8a4.75 4.75 0 0 1-8.61 2.63l-.62.75A6 6 0 1 0 8 2V0l3 3-3 3V4a4 4 0 1 1-4 4H3a5 5 0 1 0 9.75 0h-.25z"/>
          </svg>
        </button>
      </div>

      <div className="breakpoints-list">
        {breakpoints.length === 0 ? (
          <div className="empty-state">
            <div>No breakpoints</div>
            <div className="empty-hint">Click in the gutter to add a breakpoint</div>
          </div>
        ) : (
          breakpoints.map(bp => (
            <div key={bp.id} className={`breakpoint-item ${!bp.enabled ? 'disabled' : ''}`}>
              <div className="breakpoint-main">
                <input
                  type="checkbox"
                  className="breakpoint-checkbox"
                  checked={bp.enabled}
                  onChange={() => onToggle(bp)}
                />
                <span className="breakpoint-icon">
                  {bp.verified ? '🔴' : '⚪'}
                </span>
                <div className="breakpoint-info">
                  <div className="breakpoint-location">
                    <span className="file-name">{bp.file.split(/[\/\\]/).pop()}</span>
                    <span className="line-number">:{bp.line}</span>
                  </div>
                  {bp.condition && (
                    <div className="breakpoint-condition">
                      Condition: {bp.condition}
                    </div>
                  )}
                  {bp.hitCondition && (
                    <div className="breakpoint-hit">
                      Hit count: {bp.hitCondition}
                    </div>
                  )}
                  {bp.logMessage && (
                    <div className="breakpoint-log">
                      Log: {bp.logMessage}
                    </div>
                  )}
                </div>
                <button
                  className="remove-btn"
                  onClick={() => onRemove(bp)}
                  title="Remove Breakpoint"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
