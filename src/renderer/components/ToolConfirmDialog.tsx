/**
 * ToolConfirmDialog - 工具执行确认对话框
 * 危险操作二次确认 UI
 */

import React from 'react';
import type { RiskLevel } from '../../core/ai/tools/schemas';

interface ToolConfirmDialogProps {
  isOpen: boolean;
  toolName: string;
  toolArgs: Record<string, any>;
  riskLevel: RiskLevel;
  onConfirm: () => void;
  onReject: () => void;
}

const RISK_CONFIG: Record<RiskLevel, { color: string; icon: string; label: string }> = {
  safe: { color: '#22c55e', icon: '✓', label: '安全' },
  low: { color: '#3b82f6', icon: 'ℹ', label: '低风险' },
  medium: { color: '#f59e0b', icon: '⚠', label: '中风险' },
  high: { color: '#ef4444', icon: '⚠', label: '高风险' },
  critical: { color: '#dc2626', icon: '🚨', label: '危险' },
};

export const ToolConfirmDialog: React.FC<ToolConfirmDialogProps> = ({ isOpen, toolName, toolArgs, riskLevel, onConfirm, onReject }) => {
  if (!isOpen) return null;
  const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.medium;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 420, background: 'var(--color-bg-elevated, #111)', borderRadius: 12, overflow: 'hidden', border: `2px solid ${config.color}` }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{config.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>确认执行操作</h3>
            <span style={{ fontSize: 12, color: config.color, fontWeight: 500 }}>{config.label}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>工具</div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'monospace' }}>{toolName}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>参数</div>
            <pre style={{ margin: 0, padding: 10, background: 'var(--color-bg-base)', borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 150 }}>
              {JSON.stringify(toolArgs, null, 2)}
            </pre>
          </div>
          {riskLevel === 'high' || riskLevel === 'critical' ? (
            <div style={{ padding: 10, background: `${config.color}20`, borderRadius: 6, fontSize: 12, color: config.color, marginBottom: 16 }}>
              ⚠️ 此操作可能造成不可逆的更改，请仔细确认。
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onReject} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-primary)' }}>取消</button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', background: config.color, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>确认执行</button>
        </div>
      </div>
    </div>
  );
};

export default ToolConfirmDialog;
