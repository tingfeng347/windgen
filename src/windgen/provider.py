import json
from urllib.parse import urlsplit

import httpx

from windgen.config import Settings


async def completion(settings: Settings, messages, *, max_tokens=12000, temperature=0.5):
    """Close the upstream stream when the generator is cancelled or disconnected."""
    if not settings.api_key:
        raise ValueError("未配置 LLM_API_KEY。请在项目 .env 中设置，或选择演示样例。")
    payload = {
        "model": settings.model,
        "messages": messages,
        "stream": True,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    # DeepSeek defaults to thinking, which can consume the whole completion budget
    # before emitting any DIL. Other OpenAI-compatible endpoints get no vendor fields.
    if urlsplit(settings.base_url).hostname == "api.deepseek.com":
        payload["thinking"] = {"type": "disabled"}
    finished = False
    source_chars = 0
    reasoning_chars = 0
    reported_reasoning = 0
    async with (
        httpx.AsyncClient(timeout=settings.timeout) as client,
        client.stream(
            "POST",
            f"{settings.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.api_key}"},
            json=payload,
        ) as response,
    ):
        if response.status_code >= 400:
            # Never include upstream bodies, URLs or headers that could echo credentials.
            raise ValueError(f"模型服务返回 HTTP {response.status_code}，请检查配置后重试。")
        async for line in response.aiter_lines():
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                return
            chunk = json.loads(data)
            if chunk.get("error"):
                raise ValueError("模型服务返回生成错误，请重试。")
            choices = chunk.get("choices", [])
            if not choices:
                continue
            delta = choices[0].get("delta", {})
            if delta.get("reasoning_content"):
                reasoning_chars += len(delta["reasoning_content"])
                if not reported_reasoning or reasoning_chars - reported_reasoning >= 400:
                    reported_reasoning = reasoning_chars
                    yield "thinking", "模型正在组织教程"
            if delta.get("content"):
                source_chars += len(delta["content"])
                yield "source", delta["content"]
            reason = choices[0].get("finish_reason")
            if reason == "length":
                if not source_chars and reasoning_chars:
                    raise ValueError("模型思考耗尽了输出额度，尚未返回教程；请使用非思考模式后重试。")
                raise ValueError("模型输出未完整结束，已保留生成的部分；请缩小教程范围后重试。")
            if reason == "content_filter":
                raise ValueError("模型服务终止了本次输出，请调整教程需求后重试。")
            if reason == "stop":
                finished = True
        if not finished:
            raise ValueError("模型连接在生成完成前中断，请重试。")
