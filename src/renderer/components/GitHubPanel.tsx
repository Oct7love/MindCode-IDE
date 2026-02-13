/**
 * GitHubPanel - GitHub 集成面板
 * 显示 PR、Issue、CI 状态
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  getGitHubClient,
  type GitHubUser,
  type GitHubRepo,
  type GitHubPR,
  type GitHubIssue,
  type CheckRun,
} from "../../core/github";

interface GitHubPanelProps {
  repoOwner?: string;
  repoName?: string;
}

type TabType = "prs" | "issues" | "ci";

export const GitHubPanel: React.FC<GitHubPanelProps> = ({ repoOwner, repoName }) => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; name: string } | null>(
    repoOwner && repoName ? { owner: repoOwner, name: repoName } : null,
  );
  const [prs, setPRs] = useState<GitHubPR[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [checks, setChecks] = useState<CheckRun[]>([]);
  const [tab, setTab] = useState<TabType>("prs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = getGitHubClient();

  // 初始化
  useEffect(() => {
    client.init().then((ok) => {
      if (ok) setUser(client.getAuthUser());
    });
  }, []);

  // 加载仓库列表
  useEffect(() => {
    if (user) client.listRepos().then(setRepos);
  }, [user]);

  // 加载 PR/Issue/CI
  useEffect(() => {
    if (!selectedRepo) return;
    setLoading(true);
    setError(null);
    Promise.all([
      client.listPRs(selectedRepo.owner, selectedRepo.name),
      client.listIssues(selectedRepo.owner, selectedRepo.name),
      client.getCheckRuns(selectedRepo.owner, selectedRepo.name, "HEAD"),
    ])
      .then(([prs, issues, checks]) => {
        setPRs(prs);
        setIssues(issues.filter((i: any) => !(i as any).pull_request));
        setChecks(checks);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedRepo]);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    const auth = await client.login();
    if (auth) {
      setUser(auth.user);
      setError(null);
    } else setError("登录失败");
    setLoading(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await client.logout();
    setUser(null);
    setRepos([]);
    setSelectedRepo(null);
  }, []);

  // 未登录
  if (!user) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🐙</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>连接 GitHub</h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--color-text-muted)" }}>
          登录后可查看 PR、Issue 和 CI 状态
        </p>
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: "#238636",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {loading ? "登录中..." : "使用 GitHub 登录"}
        </button>
        {error && <p style={{ marginTop: 12, color: "#f85149", fontSize: 12 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 用户信息 */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <img src={user.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: 12 }} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{user.login}</span>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          登出
        </button>
      </div>

      {/* 仓库选择 */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border)" }}>
        <select
          value={selectedRepo ? `${selectedRepo.owner}/${selectedRepo.name}` : ""}
          onChange={(e) => {
            const [o, n] = e.target.value.split("/");
            setSelectedRepo(o && n ? { owner: o, name: n } : null);
          }}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: "var(--color-bg-base)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            fontSize: 12,
            color: "inherit",
          }}
        >
          <option value="">选择仓库...</option>
          {repos.map((r) => (
            <option key={r.id} value={r.full_name}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
        {(["prs", "issues", "ci"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              background: tab === t ? "var(--color-bg-hover)" : "transparent",
              border: "none",
              borderBottom:
                tab === t ? "2px solid var(--color-accent-primary)" : "2px solid transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t === "prs"
              ? `PR (${prs.length})`
              : t === "issues"
                ? `Issue (${issues.length})`
                : `CI (${checks.length})`}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
            加载中...
          </div>
        )}
        {!loading && !selectedRepo && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: 12,
            }}
          >
            请选择仓库
          </div>
        )}

        {/* PR 列表 */}
        {!loading &&
          selectedRepo &&
          tab === "prs" &&
          (prs.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 12,
              }}
            >
              无 PR
            </div>
          ) : (
            prs.map((pr) => (
              <div
                key={pr.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--color-border)",
                  cursor: "pointer",
                }}
                onClick={() => window.open(pr.html_url)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{ color: pr.state === "open" ? "#238636" : "#8957e5", fontSize: 12 }}
                  >
                    {pr.draft ? "○" : "●"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                    #{pr.number} {pr.title}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  {pr.user.login} · {pr.head.ref} → {pr.base.ref}
                </div>
              </div>
            ))
          ))}

        {/* Issue 列表 */}
        {!loading &&
          selectedRepo &&
          tab === "issues" &&
          (issues.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 12,
              }}
            >
              无 Issue
            </div>
          ) : (
            issues.map((issue) => (
              <div
                key={issue.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--color-border)",
                  cursor: "pointer",
                }}
                onClick={() => window.open(issue.html_url)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{ color: issue.state === "open" ? "#238636" : "#8957e5", fontSize: 12 }}
                  >
                    ●
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                    #{issue.number} {issue.title}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  {issue.user.login} · {issue.labels.map((l) => l.name).join(", ") || "无标签"}
                </div>
              </div>
            ))
          ))}

        {/* CI 状态 */}
        {!loading &&
          selectedRepo &&
          tab === "ci" &&
          (checks.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 12,
              }}
            >
              无 CI
            </div>
          ) : (
            checks.map((check) => (
              <div
                key={check.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--color-border)",
                  cursor: "pointer",
                }}
                onClick={() => window.open(check.html_url)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      color:
                        check.conclusion === "success"
                          ? "#238636"
                          : check.conclusion === "failure"
                            ? "#f85149"
                            : "#d29922",
                      fontSize: 12,
                    }}
                  >
                    {check.status === "completed"
                      ? check.conclusion === "success"
                        ? "✓"
                        : "✗"
                      : "◐"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>{check.name}</span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {check.status}
                  </span>
                </div>
              </div>
            ))
          ))}
      </div>
    </div>
  );
};

export default GitHubPanel;
