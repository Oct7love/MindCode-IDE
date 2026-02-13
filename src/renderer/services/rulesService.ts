/**
 * Rules Service - 项目规则服务
 *
 * 功能：
 * - 读取 .mindcode/rules/*.md 规则文件
 * - 解析规则内容
 * - 生成系统提示词片段
 */

export interface ProjectRule {
  id: string;
  name: string;
  path: string;
  content: string;
  enabled: boolean;
  priority: number;
}

export interface RulesConfig {
  rules: ProjectRule[];
  enabled: boolean;
}

// 默认规则目录
const RULES_DIR = ".mindcode/rules";

/**
 * 加载项目规则
 */
export async function loadProjectRules(workspaceRoot: string): Promise<ProjectRule[]> {
  const rules: ProjectRule[] = [];

  try {
    const rulesPath = `${workspaceRoot}/${RULES_DIR}`;

    // 检查规则目录是否存在
    const dirExists = await window.mindcode?.fs?.exists?.(rulesPath);
    if (!dirExists) {
      // 如果目录不存在，返回空数组
      return [];
    }

    // 读取目录内容
    const files = await window.mindcode?.fs?.readDir?.(rulesPath);
    if (!files?.success || !files.data) {
      return [];
    }

    // 过滤 .md 文件
    const mdFiles = files.data.filter((f) => f.name.endsWith(".md"));

    // 读取每个规则文件
    for (const fileEntry of mdFiles) {
      const fileName = fileEntry.name;
      const filePath = `${rulesPath}/${fileName}`;
      const result = await window.mindcode?.fs?.readFile?.(filePath);

      if (result?.success && result.data) {
        const rule = parseRuleFile(fileName, filePath, result.data);
        rules.push(rule);
      }
    }

    // 按优先级排序
    rules.sort((a, b) => b.priority - a.priority);
  } catch (error) {
    console.error("[RulesService] Error loading rules:", error);
  }

  return rules;
}

/**
 * 解析规则文件
 */
function parseRuleFile(fileName: string, filePath: string, content: string): ProjectRule {
  // 从文件名生成 ID
  const id = fileName
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  // 从文件名生成名称
  const name = fileName.replace(/\.md$/i, "").replace(/[-_]/g, " ");

  // 尝试从内容中提取元数据
  let priority = 0;
  let enabled = true;

  // 检查是否有 frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // 提取 priority
    const priorityMatch = frontmatter.match(/priority:\s*(\d+)/);
    if (priorityMatch) {
      priority = parseInt(priorityMatch[1], 10);
    }

    // 提取 enabled
    const enabledMatch = frontmatter.match(/enabled:\s*(true|false)/);
    if (enabledMatch) {
      enabled = enabledMatch[1] === "true";
    }

    // 移除 frontmatter
    content = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
  }

  return {
    id,
    name,
    path: filePath,
    content: content.trim(),
    enabled,
    priority,
  };
}

/**
 * 生成规则系统提示词
 */
export function generateRulesPrompt(rules: ProjectRule[]): string {
  const enabledRules = rules.filter((r) => r.enabled);

  if (enabledRules.length === 0) {
    return "";
  }

  const rulesContent = enabledRules.map((r) => `### ${r.name}\n${r.content}`).join("\n\n");

  return `
## 项目规则

以下是本项目的特定规则，请在生成代码时遵守：

${rulesContent}
`;
}

/**
 * 保存规则文件
 */
export async function saveRule(rule: ProjectRule): Promise<boolean> {
  try {
    // 生成 frontmatter
    const frontmatter = `---
priority: ${rule.priority}
enabled: ${rule.enabled}
---

`;

    const content = frontmatter + rule.content;

    const result = await window.mindcode?.fs?.writeFile?.(rule.path, content);
    return result?.success ?? false;
  } catch (error) {
    console.error("[RulesService] Error saving rule:", error);
    return false;
  }
}

/**
 * 创建新规则
 */
export async function createRule(
  workspaceRoot: string,
  name: string,
  content: string,
): Promise<ProjectRule | null> {
  try {
    const rulesPath = `${workspaceRoot}/${RULES_DIR}`;

    // 确保目录存在
    await window.mindcode?.fs?.createFolder?.(rulesPath);

    // 生成文件名
    const fileName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".md";
    const filePath = `${rulesPath}/${fileName}`;

    const rule: ProjectRule = {
      id: fileName.replace(".md", ""),
      name,
      path: filePath,
      content,
      enabled: true,
      priority: 0,
    };

    const success = await saveRule(rule);
    return success ? rule : null;
  } catch (error) {
    console.error("[RulesService] Error creating rule:", error);
    return null;
  }
}

/**
 * 删除规则
 */
export async function deleteRule(rule: ProjectRule): Promise<boolean> {
  try {
    const result = await window.mindcode?.fs?.delete?.(rule.path);
    return result?.success ?? false;
  } catch (error) {
    console.error("[RulesService] Error deleting rule:", error);
    return false;
  }
}

export default {
  loadProjectRules,
  generateRulesPrompt,
  saveRule,
  createRule,
  deleteRule,
};
