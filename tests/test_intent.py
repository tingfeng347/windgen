import asyncio
from dataclasses import replace

from fastapi.testclient import TestClient

from windgen import api, intent
from windgen.config import settings
from windgen.store import Store


def test_classifier_reads_context_and_returns_animation_contract(monkeypatch):
    captured = []
    async def model(config, messages, **options):
        captured.extend(messages)
        assert options["max_tokens"] == 256
        yield "source", '{"kind":"lesson","animation":true,"dimension":"2d"}'
    monkeypatch.setattr(intent, "completion", model)
    route = asyncio.run(intent.identify_intent(settings, "2D图，不是播放单步", [{"request":"生成动图"}]))
    assert route == intent.Intent("lesson", True, "2d")
    assert "生成动图" in captured[-1]["content"]


def test_chat_is_persisted_as_text_and_followup_keeps_lesson_context(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "store", Store(tmp_path / "db"))
    monkeypatch.setattr(api, "settings", replace(settings, api_key="test-placeholder"))
    captured=[]
    async def classify(config,prompt,context):
        return intent.Intent("chat" if prompt=="谢谢，为什么除以根号d？" else "lesson",False,"auto")
    async def model(config,messages):
        captured.append(messages)
        yield "source", "它用于控制点积的尺度。" if messages[0]["content"]==api.CHAT_PROMPT else "<text>已修改</text>"
    monkeypatch.setattr(api,"identify_intent",classify);monkeypatch.setattr(api,"completion",model)
    client=TestClient(api.app);cid=api.store.create()["id"]
    original=api.store.begin(cid,"演示注意力",{"temperature":.7},"live")
    api.store.finish(original,"<text>原始教程</text>","complete")
    response=client.post(f"/api/conversations/{cid}/generate",json={"prompt":"谢谢，为什么除以根号d？","revision_id":original,"state":{"temperature":.9}})
    assert '"kind": "chat"' in response.text
    turns=api.store.get(cid)["revisions"];assert turns[-1]["kind"]=="chat";assert turns[-1]["state"]=={}
    assert turns[0]["source"]=="<text>原始教程</text>";assert turns[0]["state"]["temperature"]==.9
    client.post(f"/api/conversations/{cid}/generate",json={"prompt":"改成二维","revision_id":turns[-1]["id"]})
    assert any("原始教程" in m["content"] for m in captured[-1])
    assert any("控制点积" in m["content"] for m in captured[-1])
    assert api.store.get(cid)["revisions"][-1]["kind"]=="lesson"


def test_missing_animation_is_retried_once_and_replaced(tmp_path,monkeypatch):
    monkeypatch.setattr(api,"store",Store(tmp_path/"db"));monkeypatch.setattr(api,"settings",replace(settings,api_key="test-placeholder"))
    async def classify(*args):return intent.Intent("lesson",True,"2d")
    calls=[]
    async def model(config,messages):
        calls.append(messages)
        yield "source", '<text>静态讲解</text>' if len(calls)==1 else '<flow-diagram nodes={[]} edges={[]}/>'
    monkeypatch.setattr(api,"identify_intent",classify);monkeypatch.setattr(api,"completion",model)
    cid=api.store.create()["id"];response=TestClient(api.app).post(f"/api/conversations/{cid}/generate",json={"prompt":"让它动起来"})
    assert "event: source_reset" in response.text;assert "event: done" in response.text
    assert len(calls)==2;assert api.store.get(cid)["revisions"][-1]["source"].startswith('<flow-diagram')


def test_legacy_database_migrates_kind_without_losing_sources(tmp_path):
    import sqlite3
    path=tmp_path/'old.db'
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE conversations(id TEXT PRIMARY KEY,title TEXT,updated REAL)')
        db.execute('CREATE TABLE revisions(id TEXT PRIMARY KEY,conversation_id TEXT,prompt TEXT,source TEXT,state TEXT,status TEXT,created REAL,mode TEXT)')
        db.execute("INSERT INTO conversations VALUES ('c','旧会话',1)")
        db.execute("INSERT INTO revisions VALUES ('r','c','示例','<text>保留</text>','{}','complete',1,'live')")
    data=Store(path).get('c')['revisions'][0]
    assert data['kind']=='lesson';assert data['source']=='<text>保留</text>'


def test_internal_repair_reuses_revision_and_does_not_classify(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "store", Store(tmp_path / "db"))
    monkeypatch.setattr(api, "settings", replace(settings, api_key="test-placeholder"))
    async def classify(*args):
        raise AssertionError("Internal repair must not classify again")
    captured = []
    async def model(config, messages):
        captured.extend(messages)
        yield "source", "# 注意力\n<text>计算结果</text>"
    monkeypatch.setattr(api, "identify_intent", classify)
    monkeypatch.setattr(api, "completion", model)
    cid = api.store.create()["id"]
    rid = api.store.begin(cid, "演示注意力", {"temperature": .7}, "live")
    api.store.finish(rid, "<text>{missing}</text>", "complete")
    response = TestClient(api.app).post(f"/api/conversations/{cid}/generate", json={
        "prompt": "演示注意力", "revision_id": rid, "state": {"temperature": .7},
        "repair_issues": ["missing is not defined"],
    })
    assert 'event: done' in response.text
    revisions = api.store.get(cid)["revisions"]
    assert len(revisions) == 1 and revisions[0]["id"] == rid
    assert revisions[0]["prompt"] == "演示注意力"
    assert revisions[0]["state"] == {"temperature": .7}
    assert "Never mention repairs" in captured[1]["content"]
