import asyncio
from dataclasses import replace

import httpx
import pytest

from windgen.config import settings
from windgen.provider import completion


def test_stream_protocol_and_upstream_close_on_cancel(monkeypatch):
    original = httpx.AsyncClient
    closed = []
    captured = []

    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
            await asyncio.sleep(60)

        async def aclose(self):
            closed.append(True)

    def handler(request):
        captured.append(request)
        return httpx.Response(200, stream=Stream())

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )

    async def run():
        stream = completion(
            replace(settings, api_key="placeholder"), [{"role": "user", "content": "test"}]
        )
        assert await anext(stream) == ("source", "hello")
        await stream.aclose()

    asyncio.run(run())
    assert closed == [True]
    assert captured[0].url.path == "/chat/completions"


@pytest.mark.parametrize(
    "payload",
    [
        b'data: {"choices":[{"delta":{"content":"half"}}]}\n\n',
        b'data: {"choices":[{"delta":{"content":"half"},"finish_reason":"length"}]}\n\n',
    ],
)
def test_truncated_stream_is_rejected(monkeypatch, payload):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, content=payload)),
            **kwargs,
        ),
    )

    async def run():
        with pytest.raises(ValueError, match="未完整|中断"):
            async for _ in completion(replace(settings, api_key="placeholder"), []):
                pass

    asyncio.run(run())


def test_upstream_error_body_does_not_echo_secret(monkeypatch):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(lambda request: httpx.Response(401, text="secret-value")),
            **kwargs,
        ),
    )

    async def run():
        with pytest.raises(ValueError) as error:
            async for _ in completion(replace(settings, api_key="placeholder"), []):
                pass
        assert "secret-value" not in str(error.value)
        assert "401" in str(error.value)

    asyncio.run(run())
