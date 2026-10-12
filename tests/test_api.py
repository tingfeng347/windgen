import json

import pytest
from fastapi.testclient import TestClient

import windgen.api as module
from windgen.store import Store


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(module, "store", Store(tmp_path / "test.sqlite3"))
    module.running.clear()
    return TestClient(module.app)


def test_demo_persists_source_and_version_state(client):
    cid = client.post("/api/conversations").json()["id"]
    response = client.post(
        f"/api/conversations/{cid}/generate",
        json={"prompt": "卷积演示", "mode": "demo", "example": "convolution"},
    )
    assert response.status_code == 200
    assert "event: done" in response.text
    revision = client.get(f"/api/conversations/{cid}").json()["revisions"][0]
    assert revision["status"] == "complete"
    assert "padding=0" in revision["source"]
    rid = revision["id"]
    assert (
        client.put(
            f"/api/conversations/{cid}/revisions/{rid}/state",
            json={"state": {"step": 3, "stride": 1}},
        ).status_code
        == 200
    )
    assert client.get(f"/api/conversations/{cid}").json()["revisions"][0]["state"]["step"] == 3
    # State from a different conversation cannot be overwritten.
    other = client.post("/api/conversations").json()["id"]
    assert (
        client.put(
            f"/api/conversations/{other}/revisions/{rid}/state", json={"state": {"step": 9}}
        ).status_code
        == 404
    )
    assert Store(module.store.path).get(cid)["revisions"][0]["state"]["step"] == 3


def test_latest_snapshot_is_in_context_and_previous_revision_stays(client, monkeypatch):
    from dataclasses import replace

    monkeypatch.setattr(module, "settings", replace(module.settings, api_key="test-placeholder"))
    captured = []

    async def fake(settings, messages):
        captured.append(messages)
        yield "source", "<text>更新后的教程</text>"

    monkeypatch.setattr(module, "completion", fake)
    cid = client.post("/api/conversations").json()["id"]
    client.post(f"/api/conversations/{cid}/generate", json={"prompt": "生成教程"})
    rid = client.get(f"/api/conversations/{cid}").json()["revisions"][0]["id"]
    response = client.post(
        f"/api/conversations/{cid}/generate",
        json={
            "prompt": "解释当前一步",
            "revision_id": rid,
            "state": {"step": 7, "learningRate": 0.3},
        },
    )
    assert "event: done" in response.text
    snapshot = next(m for m in captured[-1] if m["content"].startswith("CURRENT USER STATE"))
    assert json.loads(snapshot["content"].split("\n", 1)[1])["step"] == 7
    revisions = client.get(f"/api/conversations/{cid}").json()["revisions"]
    assert len(revisions) == 2
    assert revisions[0]["state"] == {"step": 7, "learningRate": 0.3}
    assert revisions[0]["prompt"] == "生成教程"


def test_generation_error_is_not_success(client, monkeypatch):
    from dataclasses import replace

    monkeypatch.setattr(module, "settings", replace(module.settings, api_key="test-placeholder"))

    async def broken(settings, messages):
        yield "source", "<text>未完成"
        raise ValueError("模型输出未完整结束")

    monkeypatch.setattr(module, "completion", broken)
    cid = client.post("/api/conversations").json()["id"]
    result = client.post(f"/api/conversations/{cid}/generate", json={"prompt": "测试错误"})
    assert "event: error" in result.text and "event: done" not in result.text
    assert module.store.get(cid)["revisions"][0]["status"] == "error"
    assert cid not in module.running


def test_state_limits_and_sandbox_policy(client):
    cid = client.post("/api/conversations").json()["id"]
    rid = module.store.begin(cid, "test", {}, "demo")
    assert (
        client.put(
            f"/api/conversations/{cid}/revisions/{rid}/state",
            json={"state": {"large": "x" * 100001}},
        ).status_code
        == 413
    )
    response = client.get("/sandbox/frame")
    csp = response.headers["content-security-policy"]
    assert "connect-src 'none'" in csp and "worker-src blob:" in csp
    assert "sha256-" in csp


def test_entry_html_is_not_cached_and_missing_bundles_are_revalidated(client):
    response = client.get("/")
    if response.status_code == 200:
        assert response.headers["cache-control"] == "no-store"
    sandbox = client.get("/sandbox/frame")
    assert sandbox.headers["cache-control"] == "no-store"
    missing = client.get("/assets/nonexistent-script.js")
    assert missing.status_code == 404
    assert missing.headers["cache-control"] == "no-cache"


def test_old_compiler_url_survives_frontend_rebuild(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from windgen import api as module
    from windgen.api import app
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "worker-current.js").write_text("self.postMessage({kind: 'ready'})")
    monkeypatch.setattr(module, "dist", tmp_path)
    client = TestClient(app)
    response = client.get('/assets/worker-obsolete-build.js')
    assert response.status_code == 200
    assert 'javascript' in response.headers['content-type']
    assert response.headers['cache-control'] == 'no-store'
    assert 'postMessage' in response.text
