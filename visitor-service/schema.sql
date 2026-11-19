CREATE TABLE IF NOT EXISTS visits (lat REAL NOT NULL, lon REAL NOT NULL, recorded INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS visits_recorded ON visits(recorded);
