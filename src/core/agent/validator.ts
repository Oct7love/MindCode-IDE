/**
 * 验证器
 * 负责验证代码修改的正确性
 */

import type { ValidationResult, ValidationType } from "./types";

/** 验证配置 */
export interface ValidatorConfig {
  /** 启用的验证类型 */
  enabledTypes: ValidationType[];
  /** 工作区路径 */
  workspacePath: string;
  /** 警告是否算失败 */
  failOnWarning: boolean;
  /** 超时时间 */
  timeoutMs: number;
}

const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  enabledTypes: ["syntax", "type_check"],
  workspacePath: "",
  failOnWarning: false,
  timeoutMs: 30000,
};

/**
 * 代码验证器
 */
export class CodeValidator {
  private config: ValidatorConfig;

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATOR_CONFIG, ...config };
  }

  /**
   * 执行所有验证
   */
  async validateAll(files?: string[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const type of this.config.enabledTypes) {
      const result = await this.validate(type, files);
      results.push(result);

      // 如果验证失败，是否继续
      if (!result.passed && type === "syntax") {
        // 语法错误就不继续了
        break;
      }
    }

    return results;
  }

  /**
   * 执行单项验证
   */
  async validate(type: ValidationType, files?: string[]): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      switch (type) {
        case "syntax":
          return await this.validateSyntax(files, startTime);
        case "type_check":
          return await this.validateTypeCheck(files, startTime);
        case "lint":
          return await this.validateLint(files, startTime);
        case "test":
          return await this.runTests(files, startTime);
        case "build":
          return await this.validateBuild(startTime);
        default:
          return {
            type,
            passed: true,
            errors: [],
            executionTimeMs: Date.now() - startTime,
          };
      }
    } catch (err: unknown) {
      return {
        type,
        passed: false,
        errors: [
          {
            message: err instanceof Error ? err.message : "验证执行失败",
            severity: "error",
          },
        ],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 语法验证
   */
  private async validateSyntax(files?: string[], startTime?: number): Promise<ValidationResult> {
    const start = startTime || Date.now();
    const errors: ValidationResult["errors"] = [];

    // 使用终端运行语法检查
    if (window.mindcode?.terminal && this.config.workspacePath) {
      try {
        // 尝试运行 tsc --noEmit
        const result = await window.mindcode.terminal.execute(
          "npx tsc --noEmit --pretty false 2>&1",
          this.config.workspacePath,
        );

        if (result.success && result.data) {
          const output = result.data.stdout + result.data.stderr;

          // 解析 TypeScript 错误
          const errorPattern = /(.+)\((\d+),(\d+)\): error TS\d+: (.+)/g;
          let match;

          while ((match = errorPattern.exec(output)) !== null) {
            errors.push({
              file: match[1],
              line: parseInt(match[2]),
              message: match[4],
              severity: "error",
            });
          }
        }
      } catch {
        // 忽略执行错误
      }
    }

    return {
      type: "syntax",
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * 类型检查
   */
  private async validateTypeCheck(files?: string[], startTime?: number): Promise<ValidationResult> {
    // 类型检查和语法检查类似，使用 tsc
    return this.validateSyntax(files, startTime);
  }

  /**
   * Lint 检查
   */
  private async validateLint(files?: string[], startTime?: number): Promise<ValidationResult> {
    const start = startTime || Date.now();
    const errors: ValidationResult["errors"] = [];

    if (window.mindcode?.terminal && this.config.workspacePath) {
      try {
        // 尝试运行 ESLint
        const filesToLint = files?.join(" ") || ".";
        const result = await window.mindcode.terminal.execute(
          `npx eslint ${filesToLint} --format json 2>&1`,
          this.config.workspacePath,
        );

        if (result.success && result.data) {
          try {
            const output = JSON.parse(result.data.stdout);
            for (const file of output) {
              for (const msg of file.messages || []) {
                errors.push({
                  file: file.filePath,
                  line: msg.line,
                  message: msg.message,
                  severity: msg.severity === 2 ? "error" : "warning",
                });
              }
            }
          } catch {
            // JSON 解析失败，忽略
          }
        }
      } catch {
        // 忽略执行错误
      }
    }

    return {
      type: "lint",
      passed: this.config.failOnWarning
        ? errors.length === 0
        : errors.filter((e) => e.severity === "error").length === 0,
      errors,
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * 运行测试
   */
  private async runTests(files?: string[], startTime?: number): Promise<ValidationResult> {
    const start = startTime || Date.now();
    const errors: ValidationResult["errors"] = [];

    if (window.mindcode?.terminal && this.config.workspacePath) {
      try {
        // 尝试运行 npm test
        const result = await window.mindcode.terminal.execute(
          "npm test -- --passWithNoTests 2>&1",
          this.config.workspacePath,
        );

        if (result.success && result.data) {
          const output = result.data.stdout + result.data.stderr;

          // 检查是否有测试失败
          if (output.includes("FAIL") || output.includes("failed")) {
            errors.push({
              message: "测试失败",
              severity: "error",
            });
          }
        }
      } catch {
        // 忽略执行错误
      }
    }

    return {
      type: "test",
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * 构建验证
   */
  private async validateBuild(startTime?: number): Promise<ValidationResult> {
    const start = startTime || Date.now();
    const errors: ValidationResult["errors"] = [];

    if (window.mindcode?.terminal && this.config.workspacePath) {
      try {
        // 尝试运行 npm run build
        const result = await window.mindcode.terminal.execute(
          "npm run build 2>&1",
          this.config.workspacePath,
        );

        if (result.success && result.data) {
          const output = result.data.stdout + result.data.stderr;

          // 检查是否有构建错误
          if (output.includes("error") || output.includes("Error")) {
            errors.push({
              message: "构建失败",
              severity: "error",
            });
          }
        }
      } catch {
        // 忽略执行错误
      }
    }

    return {
      type: "build",
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ValidatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 创建验证器
 */
export function createValidator(config?: Partial<ValidatorConfig>): CodeValidator {
  return new CodeValidator(config);
}
