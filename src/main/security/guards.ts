/**
 * 主进程安全守卫（Security Guards）
 *
 * 提供跨 IPC handler 复用的最小安全原语：
 * - 敏感环境变量剔除（防止密钥经子进程 / git hook 外泄）
 * - 工作区路径包含校验（防止路径遍历 / 越界执行）
 *
 * 说明：fs-handlers 目前仍保留自有的 isPathAllowed 实现，M3 架构收敛时统一到本模块
 * （见 docs/refactor/03_REFACTOR_ROADMAP.md）。
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** 敏感环境变量匹配（API Key / Token / Secret / 密码 / 凭据） */
const SECRET_ENV_PATTERN = /(API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|_PWD|CREDENTIAL)/i;

/**
 * 返回剔除了敏感变量的环境副本。
 * 一律剔除本应用注入的 MINDCODE_* 变量与任何形似凭据的变量，
 * 防止子进程（git/调试器/终端）或其 hook 窃取 AI API Key。
 */
export function sanitizeSecretEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    if (key.startsWith("MINDCODE_")) continue;
    if (SECRET_ENV_PATTERN.test(key)) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * 解析真实路径（跟随符号链接）。目标不存在时（如尚未创建的新文件），向上找到最近的
 * 已存在祖先目录做 realpath，再拼回其余不存在的路径段——保证祖先中的符号链接（如
 * macOS `/var`→`/private/var` 的 tmp 目录）也被一致解析，避免包含判断出现假阴性。
 */
function resolveRealPath(target: string): string {
  const absolute = path.resolve(target);
  let current = absolute;
  const trailing: string[] = [];
  // 逐级向上，直到找到存在的祖先或到达根。
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return trailing.length ? path.join(real, ...trailing.reverse()) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return absolute; // 到达根仍不存在
      trailing.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * 判断 target 是否位于受信工作区 root 之内（含 root 自身），已防路径遍历与软链穿越。
 * root 为空（未打开工作区）时一律返回 false。
 */
export function isWithinWorkspace(target: string, root: string | null): boolean {
  if (!root || !target) return false;
  try {
    const normalizedRoot = resolveRealPath(root);
    const normalizedTarget = resolveRealPath(target);
    return (
      normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + path.sep)
    );
  } catch {
    return false;
  }
}

/** 系统关键目录（未打开工作区时的兜底 denylist 基础项）。 */
function systemDenyDirs(): string[] {
  return process.platform === "win32"
    ? ["C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData"]
    : ["/etc", "/usr", "/bin", "/sbin", "/var", "/root", "/boot", "/sys", "/proc"];
}

/** 用户主目录下的敏感凭据位置（.ssh / .aws / .env 等）。 */
function homeSecretDirs(): string[] {
  const home = os.homedir();
  return [
    ".ssh",
    ".aws",
    ".gnupg",
    ".kube",
    ".docker",
    ".config",
    ".netrc",
    ".npmrc",
    ".git-credentials",
    ".env",
  ].map((d) => path.join(home, d));
}

/**
 * 判断路径是否落在「未打开工作区时」应拒绝的敏感位置（系统关键目录 + 主目录凭据位置）。
 *
 * 关键点：denylist 条目与目标路径都做 realpath 规范化后再比对，避免 macOS 上
 * /etc→/private/etc、/var→/private/var、/tmp→/private/tmp 等符号链接导致 startsWith 失效
 * 而被绕过（历史缺陷）。空路径按拒绝处理。
 */
export function isDeniedSystemPath(target: string): boolean {
  if (!target) return true;
  const real = resolveRealPath(target).toLowerCase();
  const denied = new Set<string>();
  for (const d of [...systemDenyDirs(), ...homeSecretDirs()]) {
    denied.add(d);
    try {
      // 目录存在则加入其 realpath 规范化形式（覆盖 /etc→/private/etc 之类映射）。
      denied.add(fs.realpathSync(d));
    } catch {
      // 目录不存在则忽略其 realpath 形式。
    }
  }
  return [...denied].some((d) => {
    const dd = d.toLowerCase();
    return real === dd || real.startsWith(dd + path.sep);
  });
}
