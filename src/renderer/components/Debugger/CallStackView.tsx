/**
 * 调用栈查看面板
 */

import React from 'react';
import type { StackFrame } from '../../../core/debugger';

interface CallStackViewProps {
  frames: StackFrame[];
  onFrameClick: (frame: StackFrame) => void;
}

export const CallStackView: React.FC<CallStackViewProps> = ({ frames, onFrameClick }) => {
  return (
    <div className="callstack-view">
      <div className="view-header">
        <span className="view-title">Call Stack</span>
      </div>

      <div className="callstack-list">
        {frames.length === 0 ? (
          <div className="empty-state">No call stack available</div>
        ) : (
          frames.map((frame, index) => (
            <div
              key={frame.id}
              className={`frame-item ${index === 0 ? 'current' : ''}`}
              onClick={() => onFrameClick(frame)}
            >
              <div className="frame-main">
                <span className="frame-index">{index}</span>
                <span className="frame-name">{frame.name}</span>
              </div>
              <div className="frame-location">
                <span className="frame-file">{frame.file}</span>
                <span className="frame-position">
                  Ln {frame.line}, Col {frame.column}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
