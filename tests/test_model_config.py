from dataclasses import replace

import httpx
import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

import windgen.api as module
import windgen.config as configuration
from windgen.store import Store


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(configuration, "ROOT", tmp_path)
    monkeypatch.setattr(module, "store", Store(tmp_path / "test.sqlite3"))
    monkeypatch.setattr(
        module,
        "settings",
        replace(
            module.settings,
            base_url="https://api.example.test/v1",
            model="old-model",
            api_key="stored-placeholder-key",
        ),
    )
    for name in ["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"]:
        monkeypatch.setenv(name, "test-value")
    module.running.clear()
    (tmp_path / ".env").write_text("# keep this comment\nWINDGEN_PORT=8787\n")
    return TestClient(module.app)


def test_save_is_private_durable_and_used_by_next_generation(client, tmp_path, monkeypatch):
    payload = {"base_url": "https://api.example.test/v1/", "model": "new-model"}
    result = client.put("/api/config", json=payload)
    assert result.status_code == 200
    assert result.json()["configured"] is True
    assert "stored-placeholder-key" not in result.text + client.get("/api/config").text
    saved = dotenv_values(tmp_path / ".env")
    assert saved["LLM_MODEL"] == "new-model" and saved["LLM_API_KEY"] == "stored-placeholder-key"
    assert saved["WINDGEN_PORT"] == "8787"
    assert "keep this comment" in (tmp_path / ".env").read_text()
    assert (tmp_path / ".env").stat().st_mode & 0o777 == 0o600
    captured = []

    async def fake(settings, messages):
        captured.append(settings)
        yield "source", "<text>新配置已用于生成</text>"

    monkeypatch.setattr(module, "completion", fake)
    cid = client.post("/api/conversations").json()["id"]
    assert (
        "event: done"
        in client.post(f"/api/conversations/{cid}/generate", json={"prompt": "教学"}).text
    )
    assert captured[0].model == "new-model"
    assert captured[0].base_url == "https://api.example.test/v1"


def test_switch_requires_own_key_and_origin_is_checked(client, tmp_path):
    draft = {"base_url": "https://other.example.test/v1", "model": "new-model"}
    assert client.put("/api/config", json=draft).status_code == 422
    draft["api_key"] = "replacement-placeholder"
    assert (
        client.put(
            "/api/config", json=draft, headers={"Origin": "https://foreign.example.test"}
        ).status_code
        == 403
    )
    assert module.settings.api_key == "stored-placeholder-key"
    assert client.put("/api/config", json=draft).status_code == 200
    assert module.settings.api_key == "replacement-placeholder"
    assert dotenv_values(tmp_path / ".env")["LLM_BASE_URL"] == draft["base_url"]


def test_busy_and_failed_write_leave_current_configuration(client, tmp_path, monkeypatch):
    draft = {
        "base_url": module.settings.base_url,
        "model": "new-model",
        "api_key": "replacement-placeholder",
    }
    before = (tmp_path / ".env").read_text()
    module.running.add("active")
    assert client.put("/api/config", json=draft).status_code == 409
    module.running.clear()

    def denied(*args):
        raise PermissionError("sensitive file details")

    monkeypatch.setattr(configuration.os, "replace", denied)
    failed = client.put("/api/config", json=draft)
    assert failed.status_code == 500 and "sensitive" not in failed.text
    assert module.settings.model == "old-model"
    assert (tmp_path / ".env").read_text() == before
    assert not list(tmp_path.glob(".env-update-*"))


def test_connection_checks_use_draft_and_do_not_save_or_echo_errors(client, tmp_path, monkeypatch):
    original = httpx.AsyncClient
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"data": [{"id": "draft-model"}]})

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    draft = {"base_url": module.settings.base_url, "model": "draft-model"}
    response = client.post("/api/config/test", json=draft)
    assert response.status_code == 200 and response.json()["ok"] is True
    assert requests[0].url.path == "/v1/models"
    assert requests[0].headers["Authorization"] == "Bearer stored-placeholder-key"
    assert module.settings.model == "old-model"
    assert "LLM_MODEL" not in dotenv_values(tmp_path / ".env")

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(401, text="stored-placeholder-key")
            ),
            **kwargs,
        ),
    )
    failed = client.post("/api/config/test", json=draft)
    assert failed.status_code == 400 and "401" in failed.text
    assert "stored-placeholder-key" not in failed.text


@pytest.mark.parametrize(
    "base",
    [
        "javascript:alert(1)",
        "https://user:pass@example.test",
        "https://[invalid",
        "https://example.test/chat/completions",
    ],
)
def test_invalid_endpoints_are_rejected(client, base):
    result = client.put(
        "/api/config",
        json={"base_url": base, "model": "model", "api_key": "replacement-placeholder"},
    )
    assert result.status_code == 422
