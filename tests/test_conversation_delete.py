import sqlite3

import pytest
from fastapi.testclient import TestClient

import windgen.api as module
from windgen.store import Store


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(module, "store", Store(tmp_path / "delete.sqlite3"))
    module.running.clear()
    return TestClient(module.app)


def seed():
    conversations = [module.store.create() for _ in range(2)]
    revisions = []
    for c in conversations:
        for _ in range(2):
            rid = module.store.begin(c["id"], "lesson", {"step": 3}, "demo")
            module.store.finish(rid, "<text>lesson</text>", "complete")
            revisions.append(rid)
    return conversations, revisions


def test_delete_one_removes_versions_without_touching_other_conversations(client):
    conversations, revisions = seed()
    cid, other = [c["id"] for c in conversations]
    result = client.delete(f"/api/conversations/{cid}")
    assert result.status_code == 200 and result.json()["deleted"] == 1
    assert client.get(f"/api/conversations/{cid}").status_code == 404
    assert len(client.get(f"/api/conversations/{other}").json()["revisions"]) == 2
    assert module.store.revision(cid, revisions[0]) is None
    # A delayed state upload cannot recreate a deleted conversation.
    assert (
        client.put(
            f"/api/conversations/{cid}/revisions/{revisions[0]}/state", json={"state": {"step": 4}}
        ).status_code
        == 404
    )
    assert client.delete(f"/api/conversations/{cid}").json()["deleted"] == 0
    assert Store(module.store.path).get(cid) is None


def test_delete_all_clears_versions_and_new_conversations_still_work(client):
    seed()
    assert client.delete("/api/conversations").json()["deleted"] == 2
    assert client.get("/api/conversations").json() == []
    with module.store.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM revisions").fetchone()[0] == 0
    assert client.delete("/api/conversations").json()["deleted"] == 0
    cid = client.post("/api/conversations").json()["id"]
    assert client.get(f"/api/conversations/{cid}").status_code == 200


def test_deletion_is_blocked_for_running_and_cross_origin_requests(client):
    conversations, _ = seed()
    cid, other = [c["id"] for c in conversations]
    module.running.add(cid)
    assert client.delete(f"/api/conversations/{cid}").status_code == 409
    assert client.delete("/api/conversations").status_code == 409
    assert module.store.get(cid) is not None
    assert client.delete(f"/api/conversations/{other}").status_code == 200
    module.running.clear()
    assert (
        client.delete(
            f"/api/conversations/{cid}", headers={"Origin": "https://foreign.example.test"}
        ).status_code
        == 403
    )
    assert module.store.get(cid) is not None


@pytest.mark.parametrize("all_conversations", [False, True])
def test_conversation_and_revision_deletion_roll_back_together(client, all_conversations):
    conversations, _ = seed()
    with module.store.connect() as db:
        db.executescript(
            "CREATE TRIGGER prevent_deletion BEFORE DELETE ON conversations BEGIN SELECT RAISE(ABORT, 'blocked'); END;"
        )
    with pytest.raises(sqlite3.IntegrityError):
        if all_conversations:
            module.store.delete_all()
        else:
            module.store.delete(conversations[0]["id"])
    assert len(module.store.list()) == 2
    assert all(len(module.store.get(c["id"])["revisions"]) == 2 for c in conversations)
