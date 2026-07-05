import React, { useState, useCallback } from "react";
import { useAIStore, useFileStore } from "../../stores";
import { ModelPicker } from "./ModelPicker";
import "./DebugView.css";

interface DebugIssue {
  title: string;
  description: string;
  empathy: string;
  hypotheses: { rank: number; probability: string; cause: string; evidence: string }[];
  evidence: { type: string; description: string; command?: string }[];
  steps: { order: number; action: string; command?: string; expected: string }[];
  branches: { condition: string; nextAction: string }[];
  fixes: { id: string; title: string; description: string; diff?: string }[];
}

export const DebugView: React.FC = () => {
  const {
    debugInfo: _debugInfo,
    setDebugInfo,
    model,
    setModel,
    addContext,
    setMode,
  } = useAIStore();
  const { workspaceRoot, getActiveFile } = useFileStore();
  const [errorInput, setErrorInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issue, setIssue] = useState<DebugIssue | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [collectedLogs, setCollectedLogs] = useState<string>("");

  const collectFromTerminal = useCallback(async () => {
    // 从终端收集错误
    const res = await window.mindcode?.terminal?.execute?.(
      'echo "[模拟终端输出]"',
      workspaceRoot || undefined,
    );
    if (res?.success) {
      setCollectedLogs(res.data?.stdout || res.data?.stderr || "");
      setErrorInput((prev) => prev + "\n" + (res.data?.stderr || res.data?.stdout || ""));
    }
  }, [workspaceRoot]);

  const collectFromGit = useCallback(async () => {
    // 从 Git 收集信息
    const status = await window.mindcode?.git?.status?.(workspaceRoot || "");
    if (status?.success) {
      const files = status.data?.map((f: any) => `${f.status}: ${f.path}`).join("\n");
      setErrorInput((prev) => prev + "\n[Git Status]\n" + files);
    }
  }, [workspaceRoot]);

  const analyzeError = useCallback(async () => {
    // AI 分析错误
    if (!errorInput.trim()) return;
    setIsAnalyzing(true);
    const activeFile = getActiveFile();
    const prompt = `你是一个专业的调试专家。分析以下错误并提供调试方案。

【工作区】${workspaceRoot || "未知"}
【当前文件】${activeFile?.path || "无"}

【错误信息】
${errorInput}

请以 JSON 格式返回调试方案：
{
  "title": "错误标题（简短）",
  "description": "错误描述",
  "empathy": "一句安抚性的话",
  "hypotheses": [{"rank": 1, "probability": "70%", "cause": "可能原因", "evidence": "判断依据"}],
  "evidence": [{"type": "file|terminal|config", "description": "需要收集的证据", "command": "可执行命令"}],
  "steps": [{"order": 1, "action": "操作步骤", "command": "可执行命令", "expected": "预期结果"}],
  "branches": [{"condition": "如果...情况", "nextAction": "则..."}],
  "fixes": [{"id": "1", "title": "修复方案", "description": "说明", "diff": "代码差异"}]
}`;
    try {
      const res = await window.mindcode?.ai?.chat?.(model, [{ role: "user", content: prompt }]);
      if (res?.success && res.data) {
        const jsonMatch = res.data.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as DebugIssue;
          setIssue(parsed);
          setDebugInfo({
            title: parsed.title,
            description: parsed.description,
            observations: parsed.hypotheses.map((h) => h.cause),
          });
        }
      }
    } catch (e) {
      console.error("Debug analysis error:", e);
    }
    setIsAnalyzing(false);
  }, [errorInput, model, workspaceRoot, getActiveFile, setDebugInfo]);

  const executeStep = useCallback(
    async (step: DebugIssue["steps"][0]) => {
      // 执行验证步骤
      if (step.command) {
        const res = await window.mindcode?.terminal?.execute?.(
          step.command,
          workspaceRoot || undefined,
        );
        if (res) {
          setCollectedLogs(
            (prev) =>
              prev +
              `\n[Step ${step.order}] ${step.command}\n${res.data?.stdout || res.data?.stderr || res.error || ""}`,
          );
        }
      }
      setCompletedSteps((s) => new Set([...s, step.order]));
    },
    [workspaceRoot],
  );

  const applyFix = useCallback(
    async (fix: DebugIssue["fixes"][0]) => {
      // 应用修复
      if (fix.diff) navigator.clipboard.writeText(fix.diff);
      // 提示用户切换到 Agent 模式应用修复
      if (confirm(`是否切换到 Agent 模式自动应用修复？\n\n${fix.title}`)) {
        addContext({
          id: `fix-${Date.now()}`,
          type: "error",
          label: "修复方案",
          data: { content: `应用修复: ${fix.title}\n\n${fix.description}\n\n${fix.diff || ""}` },
        });
        setMode("agent");
      }
    },
    [addContext, setMode],
  );

  const clearDebug = useCallback(() => {
    setIssue(null);
    setDebugInfo(null);
    setErrorInput("");
    setCompletedSteps(new Set());
    setCollectedLogs("");
  }, [setDebugInfo]);

  if (!issue) {
    return (
      <div className="ai-debug-view">
        <div className="ai-debug-input-section">
          <div className="ai-debug-section-title">📋 粘贴或输入错误信息</div>
          <textarea
            className="ai-debug-error-input"
            value={errorInput}
            onChange={(e) => setErrorInput(e.target.value)}
            placeholder="粘贴错误日志、堆栈跟踪或描述遇到的问题..."
            rows={6}
          />
          <div className="ai-debug-collect-actions">
            <button className="ai-debug-btn" onClick={collectFromTerminal}>
              从终端收集
            </button>
            <button className="ai-debug-btn" onClick={collectFromGit}>
              从 Git 收集
            </button>
          </div>
          <button
            className="ai-debug-btn primary"
            onClick={analyzeError}
            disabled={!errorInput.trim() || isAnalyzing}
          >
            {isAnalyzing ? "分析中..." : "开始分析"}
          </button>
        </div>
        {!errorInput && (
          <div className="ai-empty-state">
            <div className="ai-empty-state-icon">🐛</div>
            <div className="ai-empty-state-text">Debug 模式帮你系统排查问题</div>
            <div className="ai-empty-state-hint">
              粘贴错误信息或从终端/Git 收集，AI 会分析原因并给出解决方案
            </div>
          </div>
        )}
        <div className="ai-debug-footer">
          <ModelPicker model={model} onModelChange={setModel} disabled={isAnalyzing} />
        </div>
      </div>
    );
  }

  return (
    <div className="ai-debug-view">
      <div className="ai-debug-issue-card">
        <div className="ai-debug-issue-title">🐛 {issue.title}</div>
        <div className="ai-debug-issue-empathy">{issue.empathy}</div>
        <div className="ai-debug-issue-description">{issue.description}</div>
      </div>

      <div className="ai-debug-section">
        <div className="ai-debug-section-title">💡 可能原因 (Top {issue.hypotheses.length})</div>
        <div className="ai-debug-hypotheses">
          {issue.hypotheses.map((h) => (
            <div key={h.rank} className="ai-debug-hypothesis">
              <div className="ai-debug-hypothesis-header">
                <span className="ai-debug-hypothesis-rank">#{h.rank}</span>
                <span className="ai-debug-hypothesis-prob">{h.probability}</span>
              </div>
              <div className="ai-debug-hypothesis-cause">{h.cause}</div>
              <div className="ai-debug-hypothesis-evidence">依据: {h.evidence}</div>
            </div>
          ))}
        </div>
      </div>

      {issue.evidence.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">📊 需要收集的证据</div>
          {issue.evidence.map((e, i) => (
            <div key={i} className="ai-debug-evidence-item">
              <span className="ai-debug-evidence-type">[{e.type}]</span>
              <span className="ai-debug-evidence-desc">{e.description}</span>
              {e.command && <code className="ai-debug-evidence-cmd">{e.command}</code>}
            </div>
          ))}
        </div>
      )}

      <div className="ai-debug-section">
        <div className="ai-debug-section-title">🔍 验证步骤</div>
        {issue.steps.map((step) => (
          <div
            key={step.order}
            className={`ai-debug-step ${completedSteps.has(step.order) ? "completed" : ""}`}
          >
            <div className="ai-debug-step-header">
              <input
                type="checkbox"
                checked={completedSteps.has(step.order)}
                onChange={() =>
                  setCompletedSteps((s) => {
                    const n = new Set(s);
                    if (n.has(step.order)) n.delete(step.order);
                    else n.add(step.order);
                    return n;
                  })
                }
              />
              <span className="ai-debug-step-order">步骤 {step.order}</span>
              {step.command && (
                <button className="ai-debug-step-run" onClick={() => executeStep(step)}>
                  执行
                </button>
              )}
            </div>
            <div className="ai-debug-step-action">{step.action}</div>
            {step.command && <code className="ai-debug-step-cmd">{step.command}</code>}
            <div className="ai-debug-step-expected">预期: {step.expected}</div>
          </div>
        ))}
      </div>

      {issue.branches.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">🔀 分支处理</div>
          {issue.branches.map((b, i) => (
            <div key={i} className="ai-debug-branch">
              <span className="ai-debug-branch-condition">{b.condition}</span>
              <span className="ai-debug-branch-action">→ {b.nextAction}</span>
            </div>
          ))}
        </div>
      )}

      {issue.fixes.length > 0 && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">🔧 修复方案</div>
          {issue.fixes.map((fix) => (
            <div key={fix.id} className="ai-debug-fix">
              <div className="ai-debug-fix-title">{fix.title}</div>
              <div className="ai-debug-fix-desc">{fix.description}</div>
              {fix.diff && <pre className="ai-debug-fix-diff">{fix.diff}</pre>}
              <div className="ai-debug-fix-actions">
                <button
                  className="ai-debug-btn"
                  onClick={() => navigator.clipboard.writeText(fix.diff || fix.description)}
                >
                  复制
                </button>
                <button className="ai-debug-btn primary" onClick={() => applyFix(fix)}>
                  应用修复
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {collectedLogs && (
        <div className="ai-debug-section">
          <div className="ai-debug-section-title">📋 收集的日志</div>
          <pre className="ai-debug-logs">{collectedLogs}</pre>
        </div>
      )}

      <div className="ai-debug-actions">
        <button className="ai-debug-btn" onClick={clearDebug}>
          清除
        </button>
        <button className="ai-debug-btn" onClick={analyzeError} disabled={isAnalyzing}>
          重新分析
        </button>
      </div>
      <div className="ai-debug-footer">
        <ModelPicker model={model} onModelChange={setModel} disabled={isAnalyzing} />
      </div>
    </div>
  );
};
