/**
 * useProjectRules - 项目规则 Hook
 *
 * 管理项目规则的加载、启用/禁用、编辑
 */
import { useState, useEffect, useCallback } from "react";
import { useFileStore } from "../stores";
import type { ProjectRule } from "../services/rulesService";
import {
  loadProjectRules,
  generateRulesPrompt,
  saveRule,
  createRule,
  deleteRule,
} from "../services/rulesService";

interface UseProjectRulesReturn {
  /** 规则列表 */
  rules: ProjectRule[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 生成的系统提示词片段 */
  rulesPrompt: string;
  /** 重新加载规则 */
  reloadRules: () => Promise<void>;
  /** 切换规则启用状态 */
  toggleRule: (id: string) => Promise<void>;
  /** 更新规则优先级 */
  updatePriority: (id: string, priority: number) => Promise<void>;
  /** 创建新规则 */
  addRule: (name: string, content: string) => Promise<ProjectRule | null>;
  /** 删除规则 */
  removeRule: (id: string) => Promise<boolean>;
  /** 更新规则内容 */
  updateRuleContent: (id: string, content: string) => Promise<boolean>;
}

export function useProjectRules(): UseProjectRulesReturn {
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { workspaceRoot } = useFileStore();

  // 生成规则提示词
  const rulesPrompt = generateRulesPrompt(rules);

  // 加载规则
  const reloadRules = useCallback(async () => {
    if (!workspaceRoot) {
      setRules([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedRules = await loadProjectRules(workspaceRoot);
      setRules(loadedRules);
    } catch (err: any) {
      setError(err.message || "加载规则失败");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot]);

  // 初始加载
  useEffect(() => {
    reloadRules();
  }, [reloadRules]);

  // 切换规则启用状态
  const toggleRule = useCallback(
    async (id: string) => {
      const rule = rules.find((r) => r.id === id);
      if (!rule) return;

      const updatedRule = { ...rule, enabled: !rule.enabled };
      const success = await saveRule(updatedRule);

      if (success) {
        setRules((prev) => prev.map((r) => (r.id === id ? updatedRule : r)));
      }
    },
    [rules],
  );

  // 更新规则优先级
  const updatePriority = useCallback(
    async (id: string, priority: number) => {
      const rule = rules.find((r) => r.id === id);
      if (!rule) return;

      const updatedRule = { ...rule, priority };
      const success = await saveRule(updatedRule);

      if (success) {
        setRules((prev) => {
          const updated = prev.map((r) => (r.id === id ? updatedRule : r));
          return updated.sort((a, b) => b.priority - a.priority);
        });
      }
    },
    [rules],
  );

  // 创建新规则
  const addRule = useCallback(
    async (name: string, content: string): Promise<ProjectRule | null> => {
      if (!workspaceRoot) return null;

      const newRule = await createRule(workspaceRoot, name, content);
      if (newRule) {
        setRules((prev) => [...prev, newRule].sort((a, b) => b.priority - a.priority));
      }
      return newRule;
    },
    [workspaceRoot],
  );

  // 删除规则
  const removeRule = useCallback(
    async (id: string): Promise<boolean> => {
      const rule = rules.find((r) => r.id === id);
      if (!rule) return false;

      const success = await deleteRule(rule);
      if (success) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
      return success;
    },
    [rules],
  );

  // 更新规则内容
  const updateRuleContent = useCallback(
    async (id: string, content: string): Promise<boolean> => {
      const rule = rules.find((r) => r.id === id);
      if (!rule) return false;

      const updatedRule = { ...rule, content };
      const success = await saveRule(updatedRule);

      if (success) {
        setRules((prev) => prev.map((r) => (r.id === id ? updatedRule : r)));
      }
      return success;
    },
    [rules],
  );

  return {
    rules,
    isLoading,
    error,
    rulesPrompt,
    reloadRules,
    toggleRule,
    updatePriority,
    addRule,
    removeRule,
    updateRuleContent,
  };
}

export default useProjectRules;
