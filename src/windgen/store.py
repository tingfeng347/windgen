import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, updated REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS revisions (
                    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, prompt TEXT NOT NULL,
                    source TEXT NOT NULL, state TEXT NOT NULL, status TEXT NOT NULL,
                    created REAL NOT NULL, mode TEXT NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id));
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self):
        item = {"id": str(uuid.uuid4()), "title": "新教程", "updated": time.time()}
        with self.connect() as db:
            db.execute("INSERT INTO conversations VALUES (:id,:title,:updated)", item)
        return item

    def list(self):
        with self.connect() as db:
            return [
                dict(r) for r in db.execute("SELECT * FROM conversations ORDER BY updated DESC")
            ]

    def get(self, cid):
        with self.connect() as db:
            item = db.execute("SELECT * FROM conversations WHERE id=?", (cid,)).fetchone()
            if not item:
                return None
            rows = db.execute(
                "SELECT * FROM revisions WHERE conversation_id=? ORDER BY created", (cid,)
            ).fetchall()
            return dict(item) | {"revisions": [self.decode(r) for r in rows]}

    def delete(self, cid):
        with self.connect() as db:
            db.execute("DELETE FROM revisions WHERE conversation_id=?", (cid,))
            count = db.execute("DELETE FROM conversations WHERE id=?", (cid,)).rowcount
        return count

    def delete_all(self):
        with self.connect() as db:
            db.execute("DELETE FROM revisions")
            count = db.execute("DELETE FROM conversations").rowcount
        return count

    @staticmethod
    def decode(row):
        item = dict(row)
        item["state"] = json.loads(item["state"])
        return item

    def revision(self, cid, rid):
        with self.connect() as db:
            row = db.execute(
                "SELECT * FROM revisions WHERE id=? AND conversation_id=?", (rid, cid)
            ).fetchone()
        return self.decode(row) if row else None

    def begin(self, cid, prompt, state, mode):
        rid = str(uuid.uuid4())
        with self.connect() as db:
            db.execute(
                "UPDATE conversations SET title=?,updated=? WHERE id=?",
                (prompt[:48], time.time(), cid),
            )
            db.execute(
                "INSERT INTO revisions VALUES (?,?,?,?,?,?,?,?)",
                (rid, cid, prompt, "", json.dumps(state), "streaming", time.time(), mode),
            )
        return rid

    def finish(self, rid, source, status):
        with self.connect() as db:
            db.execute("UPDATE revisions SET source=?,status=? WHERE id=?", (source, status, rid))

    def save_state(self, cid, rid, state):
        with self.connect() as db:
            cur = db.execute(
                "UPDATE revisions SET state=? WHERE id=? AND conversation_id=?",
                (json.dumps(state, allow_nan=False), rid, cid),
            )
        return bool(cur.rowcount)
