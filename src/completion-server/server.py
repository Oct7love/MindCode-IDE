"""
MindCode Completion Server - AI 驱动版
使用 DeepSeek Coder 进行真正的代码补全
"""

import os
import time
import asyncio
import httpx
from typing import List, Optional, Tuple
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ============================================================================
# 配置 - 所有密钥从环境变量读取，禁止硬编码
# ============================================================================

# ====== AI 提供商配置 ======
AI_PROVIDER_INLINE = "claude"
AI_PROVIDER_BLOCK = "claude"

# DeepSeek 配置
DEEPSEEK_API_KEY = os.environ.get("MINDCODE_DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("MINDCODE_DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = "deepseek-coder"

# Claude 配置
CLAUDE_API_KEY = os.environ.get("MINDCODE_CLAUDE_API_KEY", "")
CLAUDE_BASE_URL = os.environ.get("MINDCODE_CLAUDE_BASE_URL", "https://sub2.willapi.one")
CLAUDE_MODEL_INLINE = "claude-haiku-4-5-20251001"
CLAUDE_MODEL_BLOCK = "claude-sonnet-4-5-20250929"

# 补全参数
MAX_TOKENS_INLINE = 200   # inline 模式：单行补全
MAX_TOKENS_BLOCK = 1024   # block 模式：多行代码生成
TEMPERATURE = 0.0  # 低温度 = 更确定性的输出
TIMEOUT = 30.0  # API 超时时间（秒）- Claude 稍慢，给多点时间

# 获取当前模型名称（用于日志和响应）
def get_current_model(mode: str) -> str:
    if mode == "block":
        return CLAUDE_MODEL_BLOCK if AI_PROVIDER_BLOCK == "claude" else DEEPSEEK_MODEL
    return CLAUDE_MODEL_INLINE if AI_PROVIDER_INLINE == "claude" else DEEPSEEK_MODEL

# ============================================================================
# Pydantic Models
# ============================================================================

class CompletionInput(BaseModel):
    file_path: str = Field(..., description="当前文件路径")
    content: str = Field(..., description="完整文件内容")
    cursor_line: int = Field(..., ge=0, description="光标行号（0-indexed）")
    cursor_column: int = Field(..., ge=0, description="光标列号（0-indexed）")
    mode: str = Field("inline", description="补全模式: 'inline' 或 'block'")
    recent_files: List[str] = Field(default_factory=list)


class CompletionOutput(BaseModel):
    completion: str = Field(..., description="补全的代码")
    finish_reason: str = Field(..., description="完成原因")
    model: str = Field("deepseek", description="使用的模型")
    latency_ms: float = Field(0.0, description="处理延迟")
    cached: bool = Field(False)


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float
    mode: str


# ============================================================================
# Application
# ============================================================================

start_time = time.time()

app = FastAPI(
    title="MindCode Completion Server",
    version="2.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP 客户端
http_client = httpx.AsyncClient(timeout=TIMEOUT)


# ============================================================================
# AI Completion Logic
# ============================================================================

def get_language_from_path(file_path: str) -> str:
    """根据文件路径获取语言"""
    ext_map = {
        '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
        '.tsx': 'typescript', '.jsx': 'javascript', '.c': 'c',
        '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp', '.java': 'java',
        '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
        '.cs': 'csharp', '.swift': 'swift', '.kt': 'kotlin',
        '.html': 'html', '.css': 'css', '.json': 'json',
        '.md': 'markdown', '.sql': 'sql', '.sh': 'shell',
    }
    for ext, lang in ext_map.items():
        if file_path.lower().endswith(ext):
            return lang
    return 'text'


def build_fim_prompt(prefix: str, suffix: str, language: str, mode: str) -> Tuple[str, str]:
    """
    构建 FIM (Fill-In-the-Middle) 格式的 prompt
    mode: 'inline' 或 'block'
    """
    # 系统提示 - 根据模式调整
    if mode == "block":
        system_prompt = f"""You are an expert {language} programmer. Generate complete, working code.
Rules:
- Output ONLY the code, no explanations or markdown
- When the comment describes a data structure (like linked list, tree, etc.), implement the complete structure with all common operations
- Include necessary struct/class definitions
- Match the existing code style and indentation
- Generate production-ready code"""
    else:
        system_prompt = f"""You are an expert {language} programmer. Complete the code at the cursor position.
Rules:
- Output ONLY the code to insert, no explanations
- Match the existing code style and indentation
- Keep completions concise (single line preferred)
- If completing a comment, generate the described code"""

    # 用户提示
    user_prompt = f"""Complete the code at <CURSOR>:

```{language}
{prefix}<CURSOR>{suffix}
```

Output only the code to insert:"""

    return system_prompt, user_prompt


async def call_deepseek_api(system_prompt: str, user_prompt: str, mode: str = "inline") -> Optional[str]:
    """调用 DeepSeek API 进行补全"""
    max_tokens = MAX_TOKENS_BLOCK if mode == "block" else MAX_TOKENS_INLINE
    stop_sequences = ["```", "<CURSOR>"] if mode == "block" else ["\n\n", "```", "<CURSOR>"]

    try:
        response = await http_client.post(
            f"{DEEPSEEK_BASE_URL}/v1/chat/completions",
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                "max_tokens": max_tokens, "temperature": TEMPERATURE, "stop": stop_sequences,
            },
        )
        if response.status_code != 200:
            print(f"[DeepSeek] API 错误: {response.status_code} - {response.text}")
            return None
        data = response.json()
        completion = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return clean_completion(completion)
    except httpx.TimeoutException:
        print("[DeepSeek] 请求超时")
        return None
    except Exception as e:
        print(f"[DeepSeek] 请求异常: {e}")
        return None


async def call_claude_api(system_prompt: str, user_prompt: str, mode: str = "inline") -> Optional[str]:
    """调用 Claude (Codesuc) API 进行补全 - Anthropic 原生格式"""
    max_tokens = MAX_TOKENS_BLOCK if mode == "block" else MAX_TOKENS_INLINE
    model = CLAUDE_MODEL_BLOCK if mode == "block" else CLAUDE_MODEL_INLINE
    print(f"[Claude] 使用模型: {model}")

    try:
        response = await http_client.post(
            f"{CLAUDE_BASE_URL}/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": max_tokens,
                "system": [{"type": "text", "text": system_prompt}],  # Anthropic 要求数组格式
                "messages": [{"role": "user", "content": user_prompt}],
            },
        )
        if response.status_code != 200:
            print(f"[Claude] API 错误: {response.status_code} - {response.text}")
            return None
        data = response.json()
        # Anthropic 格式: content 是数组
        content_blocks = data.get("content", [])
        completion = ""
        for block in content_blocks:
            if block.get("type") == "text":
                completion += block.get("text", "")
        return clean_completion(completion)
    except httpx.TimeoutException:
        print("[Claude] 请求超时")
        return None
    except Exception as e:
        print(f"[Claude] 请求异常: {e}")
        return None


def clean_completion(completion: str) -> str:
    """清理补全结果"""
    completion = completion.strip()
    if completion.startswith("```"):
        lines = completion.split("\n")
        completion = "\n".join(lines[1:])
    if completion.endswith("```"):
        completion = completion[:-3]
    return completion.strip()


async def call_ai_api(system_prompt: str, user_prompt: str, mode: str = "inline") -> Optional[str]:
    """根据模式调用对应的 AI API（混合模式）"""
    if mode == "block":
        # block 模式：用 Claude（智能）
        provider = AI_PROVIDER_BLOCK
        print(f"[混合模式] block -> {provider.upper()}")
    else:
        # inline 模式：用 DeepSeek（快）
        provider = AI_PROVIDER_INLINE
        print(f"[混合模式] inline -> {provider.upper()}")

    if provider == "claude":
        return await call_claude_api(system_prompt, user_prompt, mode)
    else:
        return await call_deepseek_api(system_prompt, user_prompt, mode)


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/v1/health", response_model=HealthResponse)
async def health_check():
    """健康检查"""
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        uptime_seconds=time.time() - start_time,
        mode="ai",
    )


@app.get("/v1/stats")
async def get_stats():
    """获取统计信息"""
    return {
        "uptime_seconds": time.time() - start_time,
        "mode": "claude (混合)",
        "model_inline": CLAUDE_MODEL_INLINE,
        "model_block": CLAUDE_MODEL_BLOCK,
        "requests_handled": 0,
    }


@app.post("/v1/completion", response_model=CompletionOutput)
async def create_completion(input_data: CompletionInput):
    """
    AI 代码补全端点
    """
    request_start = time.time()
    print(f"\n{'='*50}")
    print(f"[收到补全请求] {input_data.file_path}:{input_data.cursor_line}:{input_data.cursor_column}")
    print(f"[内容预览] {input_data.content[:100]}...")
    print(f"{'='*50}")

    # 分割 PREFIX / SUFFIX
    lines = input_data.content.split('\n')
    cursor_line = min(input_data.cursor_line, len(lines) - 1)
    cursor_col = input_data.cursor_column

    # 构建 PREFIX（光标前的所有内容）
    prefix_lines = lines[:cursor_line]
    if cursor_line < len(lines):
        prefix_lines.append(lines[cursor_line][:cursor_col])
    prefix = '\n'.join(prefix_lines)

    # 构建 SUFFIX（光标后的所有内容）
    suffix_lines = []
    if cursor_line < len(lines):
        suffix_lines.append(lines[cursor_line][cursor_col:])
        suffix_lines.extend(lines[cursor_line + 1:])
    suffix = '\n'.join(suffix_lines)

    # 获取语言
    language = get_language_from_path(input_data.file_path)

    # 如果内容太少，不触发补全
    if len(prefix.strip()) < 3:
        return CompletionOutput(
            completion="",
            finish_reason="skip",
            model="skipped",
            latency_ms=(time.time() - request_start) * 1000,
            cached=False,
        )

    # 智能检测：如果注释描述复杂结构，自动升级为 block 模式
    mode = input_data.mode
    complex_keywords = ['链表', '树', '栈', '队列', '图', 'linked list', 'tree', 'stack',
                        'queue', 'graph', 'struct', 'class', '实现', 'implement']
    last_line = prefix.strip().split('\n')[-1].lower() if prefix.strip() else ""
    if any(kw in last_line for kw in complex_keywords):
        mode = "block"
        print(f"[Completion] 检测到复杂结构请求，升级为 block 模式")

    # 构建 prompt
    system_prompt, user_prompt = build_fim_prompt(prefix, suffix, language, mode)

    # 调用 AI API
    completion = await call_ai_api(system_prompt, user_prompt, mode)

    if completion is None:
        completion = ""

    # 不再截断多行 - 让前端决定如何显示
    # Cursor 风格：inline 也可以显示多行 ghost text

    latency_ms = (time.time() - request_start) * 1000

    print(f"[Completion] {input_data.file_path}:{cursor_line}:{cursor_col} -> '{completion[:50]}...' ({latency_ms:.1f}ms)")

    return CompletionOutput(
        completion=completion,
        finish_reason="stop" if completion else "empty",
        model=get_current_model(mode),
        latency_ms=latency_ms,
        cached=False,
    )


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  MindCode Completion Server v2.0 (AI Mode)")
    print(f"  [Claude 混合模式]")
    print(f"  Inline: {CLAUDE_MODEL_INLINE} (快速)")
    print(f"  Block:  {CLAUDE_MODEL_BLOCK} (智能)")
    print("  http://localhost:8765")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8765)
