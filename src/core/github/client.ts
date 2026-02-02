/**
 * GitHub API 客户端
 * 封装 GitHub REST API 调用
 */

import type { GitHubUser, GitHubRepo, GitHubPR, GitHubIssue, CheckRun, WorkflowRun, PRReview, PRComment, GitHubAuth } from './types';

const API_BASE = 'https://api.github.com';
const KEYTAR_SERVICE = 'mindcode-github';

export class GitHubClient {
  private token: string | null = null;
  private user: GitHubUser | null = null;

  /** 初始化 - 从 keytar 加载 Token */
  async init(): Promise<boolean> {
    try {
      if (window.mindcode?.keytar?.getPassword) {
        this.token = await window.mindcode.keytar.getPassword(KEYTAR_SERVICE, 'token');
        if (this.token) { this.user = await this.getUser(); return !!this.user; }
      }
    } catch (e) { console.error('[GitHub] 初始化失败:', e); }
    return false;
  }

  /** OAuth 登录（通过主进程） */
  async login(): Promise<GitHubAuth | null> {
    try {
      if (window.mindcode?.github?.login) {
        const result = await window.mindcode.github.login();
        if (result.success && result.token) {
          this.token = result.token;
          await window.mindcode.keytar?.setPassword(KEYTAR_SERVICE, 'token', result.token);
          this.user = await this.getUser();
          return { token: result.token, user: this.user!, scopes: result.scopes || [] };
        }
      }
    } catch (e) { console.error('[GitHub] 登录失败:', e); }
    return null;
  }

  /** 登出 */
  async logout(): Promise<void> {
    this.token = null;
    this.user = null;
    await window.mindcode?.keytar?.deletePassword(KEYTAR_SERVICE, 'token');
  }

  /** 是否已登录 */
  isAuthenticated(): boolean { return !!this.token && !!this.user; }
  getAuthUser(): GitHubUser | null { return this.user; }

  // ============ 用户 API ============

  async getUser(): Promise<GitHubUser | null> {
    return this.request<GitHubUser>('GET', '/user');
  }

  // ============ 仓库 API ============

  async listRepos(page = 1, perPage = 30): Promise<GitHubRepo[]> {
    return this.request<GitHubRepo[]>('GET', `/user/repos?sort=updated&per_page=${perPage}&page=${page}`) || [];
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
    return this.request<GitHubRepo>('GET', `/repos/${owner}/${repo}`);
  }

  // ============ PR API ============

  async listPRs(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPR[]> {
    return this.request<GitHubPR[]>('GET', `/repos/${owner}/${repo}/pulls?state=${state}`) || [];
  }

  async getPR(owner: string, repo: string, number: number): Promise<GitHubPR | null> {
    return this.request<GitHubPR>('GET', `/repos/${owner}/${repo}/pulls/${number}`);
  }

  async getPRDiff(owner: string, repo: string, number: number): Promise<string | null> {
    return this.requestRaw('GET', `/repos/${owner}/${repo}/pulls/${number}`, { Accept: 'application/vnd.github.diff' });
  }

  async getPRReviews(owner: string, repo: string, number: number): Promise<PRReview[]> {
    return this.request<PRReview[]>('GET', `/repos/${owner}/${repo}/pulls/${number}/reviews`) || [];
  }

  async getPRComments(owner: string, repo: string, number: number): Promise<PRComment[]> {
    return this.request<PRComment[]>('GET', `/repos/${owner}/${repo}/pulls/${number}/comments`) || [];
  }

  async createPRComment(owner: string, repo: string, number: number, body: string): Promise<PRComment | null> {
    return this.request<PRComment>('POST', `/repos/${owner}/${repo}/issues/${number}/comments`, { body });
  }

  async approvePR(owner: string, repo: string, number: number, body?: string): Promise<PRReview | null> {
    return this.request<PRReview>('POST', `/repos/${owner}/${repo}/pulls/${number}/reviews`, { event: 'APPROVE', body });
  }

  async requestChangesPR(owner: string, repo: string, number: number, body: string): Promise<PRReview | null> {
    return this.request<PRReview>('POST', `/repos/${owner}/${repo}/pulls/${number}/reviews`, { event: 'REQUEST_CHANGES', body });
  }

  async mergePR(owner: string, repo: string, number: number, method: 'merge' | 'squash' | 'rebase' = 'merge'): Promise<boolean> {
    const result = await this.request<{ merged: boolean }>('PUT', `/repos/${owner}/${repo}/pulls/${number}/merge`, { merge_method: method });
    return result?.merged || false;
  }

  // ============ Issue API ============

  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    return this.request<GitHubIssue[]>('GET', `/repos/${owner}/${repo}/issues?state=${state}`) || [];
  }

  async createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]): Promise<GitHubIssue | null> {
    return this.request<GitHubIssue>('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels });
  }

  async closeIssue(owner: string, repo: string, number: number): Promise<GitHubIssue | null> {
    return this.request<GitHubIssue>('PATCH', `/repos/${owner}/${repo}/issues/${number}`, { state: 'closed' });
  }

  // ============ CI/Checks API ============

  async getCheckRuns(owner: string, repo: string, ref: string): Promise<CheckRun[]> {
    const result = await this.request<{ check_runs: CheckRun[] }>('GET', `/repos/${owner}/${repo}/commits/${ref}/check-runs`);
    return result?.check_runs || [];
  }

  async listWorkflowRuns(owner: string, repo: string, branch?: string): Promise<WorkflowRun[]> {
    const query = branch ? `?branch=${branch}` : '';
    const result = await this.request<{ workflow_runs: WorkflowRun[] }>('GET', `/repos/${owner}/${repo}/actions/runs${query}`);
    return result?.workflow_runs || [];
  }

  // ============ 私有方法 ============

  private async request<T>(method: string, path: string, body?: any): Promise<T | null> {
    if (!this.token) return null;
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) { console.error(`[GitHub] ${method} ${path} failed:`, response.status); return null; }
      return await response.json();
    } catch (e) { console.error(`[GitHub] ${method} ${path} error:`, e); return null; }
  }

  private async requestRaw(method: string, path: string, headers: Record<string, string>): Promise<string | null> {
    if (!this.token) return null;
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${this.token}`, ...headers },
      });
      if (!response.ok) return null;
      return await response.text();
    } catch { return null; }
  }
}

// 单例
let _client: GitHubClient | null = null;
export function getGitHubClient(): GitHubClient { if (!_client) _client = new GitHubClient(); return _client; }
