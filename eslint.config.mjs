import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // 全局忽略
  { ignores: ['dist/**', 'release/**', 'node_modules/**', '*.js', '*.mjs'] },

  // 基础规则
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 全局设置
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-require-imports': 'off',

      // 通用
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-duplicate-imports': 'error',
    },
  },

  // Renderer (React) 专用规则
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Main 进程专用规则
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document'],
    },
  },

  // 测试文件放宽
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
