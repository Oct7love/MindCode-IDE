# ADR-0001 · AI 默认端点改为官方端点（移除第三方中转默认值）

- 状态：已采纳（M1 实施）
- 日期：2026-07-05
- 关联：01_BUG_AND_RISK_REGISTER.md P0-2、P0-3

## 背景

`src/core/ai/config.ts` 的 `DEFAULT_BASE_URLS` 把 **claude / openai 默认指向 `https://sub2.willapi.one`、gemini 指向 `https://2api.novai.su`** —— 均为第三方个人中转站，且写死在公开仓库中。

`getEnvVar(key, fallback)` 在用户未设置 `MINDCODE_*_BASE_URL` 时返回这些中转默认值。因此:

- 用户只配置**自己的官方 API Key**、但没改 BASE_URL 时,Key 与请求内容(含用户源代码、对话)会**默认发往第三方中转站**,运营者可记录全部明文流量与凭据。
- `.env.example` 却写着官方端点(api.anthropic.com 等),使用户误以为默认走官方。
- 私有中转域名写死进公开仓库,构成内部基础设施泄漏。

同时 `indexService` 的 `enableEmbeddings` 默认 `true`,索引时把源码块上传到 embedding 端点(默认同样是中转)。

## 决策

1. **`DEFAULT_BASE_URLS` 全部改为各厂商官方端点**,与 `.env.example` 对齐:
   - claude → `https://api.anthropic.com`
   - openai → `https://api.openai.com/v1`
   - gemini → `https://generativelanguage.googleapis.com/v1`
   - deepseek → `https://api.deepseek.com`(原本已是官方)
   - glm → `https://open.bigmodel.cn/api/anthropic`(原本已是官方域名;走 Anthropic 兼容协议,故保留 `/api/anthropic`)
2. **第三方/自建中转仅作为用户显式配置**:用户如需中转,自行设置 `MINDCODE_*_BASE_URL` 环境变量。
3. **`enableEmbeddings` 默认改为 `false`**(indexService.ts 与 indexing/types.ts 两处),避免在未告知用户的情况下把源码外发;由用户显式开启。

## 取舍

- **优点**:secure by default —— 不做任何配置时,凭据与代码只发往官方端点或根本不发(无 Key 时);消除公开仓库内部 URL 泄漏。
- **代价 / 已知遗留**:
  - `DEFAULT_MODELS` 中仍有**中转专用的模型名**(如 gemini 的 `[次]gemini-3-pro-preview`、`glm-5`),它们与官方端点不匹配。本 ADR **不修改模型名**(超出 M1 安全范围),留待 M4「AI 子系统重构」统一处理模型路由与模型清单。在此之前,指向官方端点的用户需为对应 provider 显式配置合法模型。此为**既有问题**(`glm-5` 本就不在 GLMProvider 模型列表中),本次修改不使其恶化,仅修复凭据外泄这一 P0。
  - 若 Owner 确认某中转是团队既定基础设施,应改为「默认官方 + 文档/UI 明示可切中转」,而非静默默认中转。

## 后果

- 现有依赖中转默认值的用户升级后,需显式设置 `MINDCODE_*_BASE_URL` 才能继续用中转。这是**有意的破坏性变更**,换取安全默认。
- 后续 M4 需一并校正 `DEFAULT_MODELS` 使默认模型与官方端点自洽。
