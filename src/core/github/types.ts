/**
 * GitHub 集成类型定义
 */

// ============ 用户 ============

export interface GitHubUser { login: string; id: number; avatar_url: string; name?: string; email?: string; }

// ============ 仓库 ============

export interface GitHubRepo {
  id: number; name: string; full_name: string; owner: GitHubUser; description?: string;
  private: boolean; fork: boolean; html_url: string; clone_url: string; ssh_url: string;
  default_branch: string; language?: string; stargazers_count: number; forks_count: number;
  updated_at: string; pushed_at: string;
}

// ============ PR ============

export type PRState = 'open' | 'closed' | 'merged';
export interface GitHubPR {
  id: number; number: number; title: string; body?: string; state: PRState;
  user: GitHubUser; html_url: string; diff_url: string; patch_url: string;
  head: { ref: string; sha: string; repo?: GitHubRepo };
  base: { ref: string; sha: string; repo?: GitHubRepo };
  draft: boolean; mergeable?: boolean; merged: boolean; merged_at?: string;
  labels: Array<{ name: string; color: string }>; assignees: GitHubUser[];
  requested_reviewers: GitHubUser[]; created_at: string; updated_at: string;
}

export interface PRReview { id: number; user: GitHubUser; body?: string; state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING'; submitted_at: string; }
export interface PRComment { id: number; user: GitHubUser; body: string; path?: string; line?: number; created_at: string; }

// ============ Issue ============

export interface GitHubIssue {
  id: number; number: number; title: string; body?: string; state: 'open' | 'closed';
  user: GitHubUser; html_url: string; labels: Array<{ name: string; color: string }>;
  assignees: GitHubUser[]; milestone?: { title: string; number: number };
  created_at: string; updated_at: string; closed_at?: string;
}

// ============ CI/Checks ============

export type CheckStatus = 'queued' | 'in_progress' | 'completed';
export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';

export interface CheckRun {
  id: number; name: string; status: CheckStatus; conclusion?: CheckConclusion;
  html_url: string; started_at?: string; completed_at?: string;
}

export interface WorkflowRun {
  id: number; name: string; workflow_id: number; status: CheckStatus; conclusion?: CheckConclusion;
  html_url: string; head_branch: string; head_sha: string; run_number: number;
  created_at: string; updated_at: string;
}

// ============ 授权 ============

export interface GitHubAuth { token: string; user: GitHubUser; scopes: string[]; expiresAt?: number; }
