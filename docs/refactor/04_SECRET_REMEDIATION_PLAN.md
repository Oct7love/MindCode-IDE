# 04 · Secret Remediation Plan（密钥泄露处置方案）

> 日期：2026-07-05 · 分支 `refactor/baseline-audit-and-hardening`
> 扫描工具：gitleaks 8.30.1（`.gitleaks.toml` 自定义配置）+ 手工核验
> **本文所有密钥均以指纹形式呈现（`前4****后4`），不含任何完整密钥。**
> 关联：01_BUG_AND_RISK_REGISTER.md P0-1

---

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 当前工作树 / 已跟踪源码 | ✅ **干净**，无真实密钥（gitleaks `--no-git` = 0 命中） |
| `.env.example` / 配置模板 | ✅ 干净（所有 `*_API_KEY=` 值为空） |
| 测试 / 快照 / 文档 | ✅ 干净（唯一的测试假 fixture 已重构为拼接片段；审计文档只含指纹） |
| 应用运行日志 | ✅ 已在 M1 加脱敏层（`core/logger/redact.ts`），且日志目录 `logs/` 已被忽略 |
| **git 历史** | 🔴 **仍含 7 个唯一真实密钥**，分布在 6 个历史提交，仓库曾公开 |
| 是否必须重写历史 | **取决于 Owner 风险偏好**（见第 5 节 A/B 方案）；无论选哪个，**都必须先吊销/轮换全部 7 个 key** |

---

## 1. 扫描范围与方法

```bash
gitleaks detect --source . --config .gitleaks.toml              # 全 git 历史（82 提交）
gitleaks detect --source . --no-git --config .gitleaks.toml     # 仅工作树
# 辅以手工：git ls-files 过滤 + grep 已知前缀 + .env.example / docs 核验
```

- 工作树命中：**0**
- 历史命中：**16 条，去重后 7 个唯一密钥**

---

## 2. 泄露密钥清单（指纹，按唯一 key）

| # | 指纹 | 推断类型 | 出现文件 | 出现提交 | 风险 |
|---|---|---|---|---|---|
| 1 | `sk-2****1632` | 中转 key（`sub.openclaudecode.cn`，被用作 claude/gemini 路由）；server.py 中标为 `CLAUDE_API_KEY` | `src/core/ai/config.ts`、`src/completion-server/server.py` | `5fd1361`、`680b27a3`、`d9a91d1c`、`542647c` | **高**（出现最频繁，跨 4 提交） |
| 2 | `sk-4****4e1c` | 中转 key（`sub.openclaudecode.cn`，被用作 openai/deepseek 路由） | `src/core/ai/config.ts` | `5fd1361` | 高 |
| 3 | `sk-c****c05b` | **DeepSeek**（server.py 明确标 `DEEPSEEK_API_KEY`；若为官方 key 则直接产生账单） | `server.py`、`config.ts` | `542647c`、`d9a91d1c` | **高**（可能官方计费） |
| 4 | `sk-E****UOkF` | Gemini（历史审计确认为 `sk-EJimY2…` 系 gemini 字段） | `src/core/ai/config.ts` | `48766e9` | 高 |
| 5 | `sk-3****My36` | Anthropic/中转（config.ts apiKey 字段） | `src/core/ai/config.ts` | `48766e9` | 高 |
| 6 | `cr_6****6e51` | 自定义前缀 `cr_`（疑似 codesuc/自建中转 key） | `src/core/ai/config.ts` | `1855237` | 中-高 |
| 7 | `942f****YBY8` | 无标准前缀的通用 key（config.ts apiKey 字段） | `src/core/ai/config.ts` | `d9a91d1c` | 中-高 |

作者均为 `Oct7love`。涉及第三方中转域名：`sub.openclaudecode.cn`、`sub2.willapi.one`、`2api.novai.su`（M1 已从默认值移除，见 ADR-0001）。

**风险说明**：仓库在 GitHub 曾/仍公开，任何人 `git log -S sk- --all` 或直接爬取即可提取以上历史密钥。官方厂商 key（DeepSeek/Gemini）可直接盗刷计费；中转 key 消耗预付余额并可能被用于滥用。工作树虽已清理（`ec55777` 起改为仅环境变量），但**移除工作树 ≠ 移除历史**。

---

## 3. 各载体是否残留 secret（逐项核验）

| 载体 | 状态 | 证据 |
|---|---|---|
| 已跟踪源码（非 test/docs） | ✅ 无 | `git ls-files | grep -v test/docs | xargs grep 'sk-…{20}'` → 空 |
| `.env`（真实） | ✅ 未被跟踪 | `.gitignore` 忽略 `.env`、`.env.*`；`git ls-files | grep .env` 仅 `.env.example` |
| `.env.example` | ✅ 空值模板 | 5 个 `MINDCODE_*_API_KEY=` 均为空 |
| 测试 fixture | ✅ 已处理 | `guards.test.ts` 原有假 `sk-abcdef123456` 已重构为运行时拼接片段，不再以字面量出现，gitleaks worktree = 0 |
| 审计/整改文档 | ✅ 仅指纹 | `docs/refactor/**` grep 无 ≥30 字符完整 key |
| 应用日志 | ✅ 已脱敏 + 忽略 | M1 加 `redact()`；`.gitignore` 忽略 `logs/`、`*.log` |
| 私钥/证书文件 | ✅ 无 | 无 `*.pem/*.key/id_rsa` 被跟踪 |

---

## 4. 已落地的防护（本次提交）

| 防护 | 文件 | 说明 |
|---|---|---|
| gitleaks 配置 | `.gitleaks.toml` | 继承默认规则；allowlist 仅排除测试假值 / `dist` / 审计文档指纹 / 空模板，**不排除** `config.ts`/`server.py`，确保历史真实 key 仍可检出 |
| pre-commit 扫描 | `.husky/pre-commit` | `lint-staged` 后加 `gitleaks protect --staged`；未装 gitleaks 则告警（CI 为强制关卡） |
| CI secret-scan | `.github/workflows/ci.yml` | 新增 `secret-scan` job，安装 gitleaks 并**按提交范围增量扫描**（阻断新泄露，不因历史遗留而红）；`build` 依赖它 |
| `.gitignore` 增强 | `.gitignore` | 补 `*.pem/*.key/*.p12/*.pfx/id_rsa*/secrets*.json/credentials.json/gitleaks-report.json` 等；`.env.*` 全忽略但保留 `.env.example` |
| README 密钥指引 | `README.md` | 新增「🔑 配置 AI 密钥（本地）」：`cp .env.example .env`、只用环境变量、禁止入库、gitleaks 提示 |

验证：`gitleaks detect --no-git` = 0；`gitleaks protect --staged`（本次改动）= PASS。

---

## 5. 两套处置方案

> **共同前提（两套都必须先做，且只能由 Owner 手动执行）**：登录以下控制台**吊销/轮换全部 7 个 key**——DeepSeek 控制台、Google AI(Gemini) 控制台、Anthropic 控制台，以及中转站 `openclaudecode.cn / willapi.one / novai.su` 后台。吊销后旧 key 立即失效，泄露即失去价值。**这一步不能由 Claude 代做，也不需要重写历史即可完成。**

### 方案 A：只吊销/轮换，不重写历史

- **思路**：承认历史已泄露，靠“让泄露的 key 失效”消除风险；历史提交保持原样。
- **适用**：仓库协作者多 / 有 fork / 有 CI 依赖历史 SHA / 不想承担 force-push 风险；且泄露的都是可无痛轮换的 key。
- **代价**：git 历史里仍能读到这些（已失效的）旧 key——对合规审计不完美，但已无实际盗刷价值。
- **执行步骤**：
  1. Owner 在各控制台吊销/轮换 7 个 key（见上）。
  2. 新 key 只写进本地 `.env`（**绝不入库**）。
  3. 合入本分支（含 M0/M1 + 本次防护），确保 `.env.example` 为空、默认端点为官方。
  4. `gitleaks detect` 确认工作树 0 命中；CI secret-scan 增量关卡生效。
- **回滚**：无破坏性操作，天然可回滚（轮换 key 不可“回滚”，但那正是目的）。
- **风险**：低。唯一残留是“历史可读到已失效 key”。

### 方案 B：吊销/轮换 + 重写 git 历史（彻底清除）

- **思路**：在 A 的基础上，用 `git filter-repo` 把历史中的 key 替换为占位，从所有提交中抹除。
- **适用**：需要满足“仓库历史不得含任何凭据”的合规要求 / 准备长期公开 / 洁癖式彻底。
- **代价（重要）**：
  - **改写所有历史提交 SHA** → 所有协作者必须 **重新 clone 或 rebase**，旧 clone / fork / PR 全部失配。
  - 需要 `--force` push（本任务**不执行**）。
  - 已被 GitHub 缓存 / 被他人 clone / 被搜索引擎或密钥爬虫收录的旧提交**无法收回**——所以**即便重写历史，吊销 key 仍是唯一真正止血手段**。
- **⚠️ 以下命令仅为方案，禁止在本次任务中执行；须 Owner 明确授权后手动运行**：

  ```bash
  # 0) 前置：已完成方案 A 的 key 吊销/轮换；已全员通知；已备份
  git clone --mirror <repo-url> repo-backup.git   # 备份（回滚依据）

  # 1) 安装 git-filter-repo（brew install git-filter-repo）
  # 2) 准备替换规则文件 replacements.txt，每行一个（用真实值→占位；此处用指纹示意）：
  #    sk-2193…1632==>REDACTED
  #    sk-4926…4e1c==>REDACTED
  #    sk-c…c05b==>REDACTED
  #    sk-E…UOkF==>REDACTED
  #    sk-3…My36==>REDACTED
  #    cr_6…6e51==>REDACTED
  #    942f…YBY8==>REDACTED
  #    （Owner 填入完整真实值；该文件本身含明文，用后立即安全删除，勿入库）

  git filter-repo --replace-text replacements.txt

  # 3) 核验历史已干净
  gitleaks detect --source . --config .gitleaks.toml   # 期望 0

  # 4) 强制推送（谨慎！须协调所有协作者）
  # git push origin --force --all
  # git push origin --force --tags

  # 5) 通知所有协作者重新 clone；GitHub 侧可联系 support 清理缓存/PR 引用
  ```

- **回滚**：靠第 0 步的 `repo-backup.git` 镜像还原（`git push` 回原 SHA）；但一旦 force-push 且他人已同步，回滚会二次扰动，故务必先备份+通知。
- **风险**：中-高（协作扰动 + force-push），技术收益是历史彻底无凭据。

### 建议

**先无条件执行共同前提（吊销/轮换 7 个 key）**，这是真正止血。再按仓库现实选 A 或 B：

- 若这些 key 都能轮换、且仓库协作面小 → **A 足够**（成本最低，风险已消）。
- 若有强合规诉求或长期公开洁癖 → 轮换后再走 **B**（须 Owner 授权、全员协调、先备份）。

无论 A/B，本次已加的 gitleaks/pre-commit/CI/.gitignore 防护确保**不再新增**泄露。

---

## 6. 验证命令

```bash
npm run lint        # 0 error
npm run build       # exit 0
npm run test        # 266 passed
npm run test:e2e    # 14 passed
gitleaks detect --source . --no-git --config .gitleaks.toml   # 工作树 = 0 命中
gitleaks detect --source . --config .gitleaks.toml            # 历史 = 7 个真实 key（A 未清则仍在；B 执行后应为 0）
```

本次执行结果：lint=0 / build=0 / test=266 passed / e2e=14 passed / worktree gitleaks=0 / history gitleaks=7（待 Owner 处置）。

---

## 7. 待 Owner 决策 / 手动执行

1. **立即吊销/轮换 7 个 key**（第 2 节清单；DeepSeek 与 Gemini 若为官方 key 优先）。**只有 Owner 能做，Claude 不代持不代吊销。**
2. 选择方案 **A** 或 **B**（若 B，须显式授权后由 Owner 手动执行第 5 节命令；Claude 不自动执行历史重写、不 push）。
3. 确认本分支 4+ 个提交可合并（M0/M1 + 本次 secret 防护）。

---

## 8. Owner Remediation Status（Owner 处置状态记录）

> 记录时间：2026-07-05 · 数据来源：**Owner 自述**（Owner 已在各服务商控制台手动处理历史泄漏 key）。
> ⚠️ **本节不含任何完整 key / 新 key / API token / 账号密码 / 控制台敏感信息**；key 仅以第 2 节的脱敏指纹引用。
> ⚠️ 状态由 Owner 自行掌握，**Claude 无法访问任何控制台、无法独立核验**；标 ✅ = Owner 已确认，标 ☐ = 待 Owner 逐项确认后自行勾选补填。此处不代填未获确认的项。

### 8.1 按平台状态

| 平台 | 关联 key 指纹（脱敏） | 已吊销旧 key | 已轮换新 key | 已查用量/账单 | 已设额度限制 | 处理日期 | Owner 备注 |
|---|---|:--:|:--:|:--:|:--:|---|---|
| **DeepSeek**（可能官方计费，优先） | `sk-c****c05b` | ✅ | ☐ | ☐ | ☐ | 2026-07-05 | Owner 报告已处理；官方 key 需重点核对账单 |
| **Google AI / Gemini** | `sk-E****UOkF` | ✅ | ☐ | ☐ | ☐ | 2026-07-05 | Owner 报告已处理 |
| **Anthropic** | `sk-3****My36`（若为官方） | ✅ | ☐ | ☐ | ☐ | 2026-07-05 | Owner 报告已处理 |
| **openclaudecode.cn**（中转） | `sk-2****1632`、`sk-4****4e1c` | ✅ | ☐ | ☐ | ☐ | 2026-07-05 | 中转账号；如仍使用需换新 key，否则吊销即可 |
| **willapi.one**（中转） | 见备注 | ☐ | ☐ | ☐ | ☐ | — | 后期默认 baseURL 域名；对应中转账号/余额由 Owner 确认，指纹未在第 2 节单独绑定 |
| **novai.su**（中转，gemini 曾默认） | 见备注 | ☐ | ☐ | ☐ | ☐ | — | 同上；如有独立中转 key/余额由 Owner 确认处理 |
| **其他**（codesuc/自建中转） | `cr_6****6e51` | ☐ | ☐ | ☐ | ☐ | — | `cr_` 前缀，疑似自建/codesuc 中转，来源待 Owner 确认 |
| **其他**（通用 key） | `942f****YBY8` | ☐ | ☐ | ☐ | ☐ | — | 无标准前缀，出现于 `d9a91d1c`，来源待 Owner 确认 |

### 8.2 说明与后续

- **吊销 = 真正止血**：只要旧 key 在各控制台被吊销，即便 git 历史仍可读到，也已失去盗刷价值。
- **轮换（新 key）** 仅在该 provider/中转仍需继续使用时才必要；若某中转已弃用，**吊销即可，无需轮换**。故上表「已轮换」留待 Owner 按实际使用情况勾选。
- **用量/账单核对** 与 **额度限制** 属额外风险控制（尤其 DeepSeek/Gemini 若为官方 key 会直接计费），建议 Owner 逐项确认后勾选。
- `willapi.one` / `novai.su` 是 M1 前 `config.ts` 默认 baseURL 中的第三方中转域名（M1 已改回官方，见 ADR-0001）；其对应中转账号/余额是否需处置，由 Owner 按是否曾充值/使用判断。
- **历史清除（可选）**：本记录不涉及 git 历史重写。若 Owner 需要历史层面彻底清除这些（已失效的）指纹，另见第 5 节方案 B（须 Owner 显式授权后手动执行，Claude 不自动执行、不 force push）。
- 本节由 Claude 依 Owner 自述代为登记；后续 Owner 可直接编辑本表勾选剩余 ☐ 项并补充处理日期，作为处置台账。
