import sqlite3, json, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Store:
    def __init__(self, path=None):
        self.path = path or ROOT / "data/runtime/hong_kong.db"
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as c:
            c.executescript(
                """
  CREATE TABLE IF NOT EXISTS journeys(id TEXT PRIMARY KEY, token TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS revisions(journey_id TEXT REFERENCES journeys(id) ON DELETE CASCADE, revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(journey_id,revision));
  CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, publisher TEXT,url TEXT,checked_at TEXT,status TEXT);
  CREATE TABLE IF NOT EXISTS builds(id TEXT PRIMARY KEY,city_id TEXT NOT NULL CHECK(city_id='hong_kong'),manifest_hash TEXT);
  CREATE TABLE IF NOT EXISTS external_id_map(provider TEXT,entity_type TEXT,external_id TEXT,internal_id TEXT,reviewed_by TEXT,PRIMARY KEY(provider,entity_type,external_id));
  CREATE TABLE IF NOT EXISTS scenarios(id TEXT PRIMARY KEY,body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY,kind TEXT,record_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  """
            )

    def connect(self):
        c = sqlite3.connect(self.path)
        c.execute("PRAGMA foreign_keys=ON")
        return c

    def save(self, body, token, id=None):
        id = id or str(uuid.uuid4())
        with self.connect() as c:
            owner = c.execute("SELECT token FROM journeys WHERE id=?", (id,)).fetchone()
            if owner and owner[0] != token:
                raise PermissionError("Not your journey")
            c.execute(
                "INSERT OR IGNORE INTO journeys(id,token) VALUES(?,?)", (id, token)
            )
            rev = c.execute(
                "SELECT COALESCE(MAX(revision),0)+1 FROM revisions WHERE journey_id=?",
                (id,),
            ).fetchone()[0]
            body = dict(body, id=id, revision=rev)
            c.execute(
                "INSERT INTO revisions VALUES(?,?,?)", (id, rev, json.dumps(body))
            )
            return body

    def read(self, id, token):
        with self.connect() as c:
            rows = c.execute(
                "SELECT body FROM revisions r JOIN journeys j ON j.id=r.journey_id WHERE j.id=? AND token=? ORDER BY revision",
                (id, token),
            ).fetchall()
            return [json.loads(r[0]) for r in rows]

    def delete(self, id, token):
        with self.connect() as c:
            return c.execute(
                "DELETE FROM journeys WHERE id=? AND token=?", (id, token)
            ).rowcount
