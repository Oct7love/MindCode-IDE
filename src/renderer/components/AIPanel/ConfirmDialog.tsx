/**
 * ConfirmDialog - 工具执行确认对话框
 */
import React, { memo } from 'react';
import { ToolCallStatus } from '../../stores';

interface ConfirmDialogProps {
  call: ToolCallStatus;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = memo(({ call, onConfirm, onCancel }) => {
  return (
    <div className="unified-confirm-overlay">
      <div className="unified-confirm-dialog">
        <div className="unified-confirm-title">⚠️ 确认执行</div>
        <div className="unified-confirm-tool">{call.name}</div>
        <pre className="unified-confirm-args">{JSON.stringify(call.args, null, 2)}</pre>
        <div className="unified-confirm-actions">
          <button onClick={onCancel}>取消</button>
          <button className="primary" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';
