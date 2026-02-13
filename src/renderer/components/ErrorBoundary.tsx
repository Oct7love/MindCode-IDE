/**
 * ErrorBoundary - React 错误边界组件
 * 捕获子组件渲染错误，显示优雅的降级 UI
 */
import type { ErrorInfo, ReactNode } from "react";
import React, { Component } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}
interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: 20,
            background: "var(--color-bg-base, #0a0a0c)",
            color: "var(--color-text-primary, #e5e5e5)",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>组件渲染出错</h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text-muted, #737373)",
              textAlign: "center",
              maxWidth: 400,
            }}
          >
            {this.state.error?.message || "未知错误"}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "8px 16px",
              background: "var(--color-accent-primary, #8b5cf6)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            重试
          </button>
          {this.state.errorInfo && (
            <details
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "var(--color-text-muted, #525252)",
                maxWidth: "80%",
                overflow: "auto",
              }}
            >
              <summary style={{ cursor: "pointer" }}>错误详情</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8 }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// 用于 AI 面板的错误边界
export const AIPanelErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
        AI 面板加载失败，请刷新页面
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// 用于编辑器的错误边界
export const EditorErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
        编辑器加载失败，请刷新页面
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
