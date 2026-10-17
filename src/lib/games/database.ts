import type { Database } from "better-sqlite3";
import { createGameRepository, type GameRepository } from "./repository";
import { SEED_GAMES } from "./seed";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    developer           TEXT    NOT NULL,
    genre               TEXT    NOT NULL,
    monthly_revenue_usd REAL    NOT NULL CHECK (monthly_revenue_usd >= 0),
    monthly_downloads   INTEGER NOT NULL CHECK (monthly_downloads >= 0),
    average_rating      REAL    NOT NULL CHECK (average_rating BETWEEN 0 AND 5),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

const SCHEMA_VERSION = 1;

/**
 * Creates the schema and seeds demo data on first initialisation only (tracked with
 * `PRAGMA user_version`), so deleting every game doesn't resurrect the seed on restart.
 */
export function initDatabase(
  db: Database,
  { seed = true }: { seed?: boolean } = {},
): GameRepository {
  db.pragma("journal_mode = WAL");
  const repo = createGameRepository(db);
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < SCHEMA_VERSION) {
    db.transaction(() => {
      db.exec(SCHEMA);
      // count() guard: databases created before versioning already hold data.
      if (seed && repo.count() === 0) SEED_GAMES.forEach((game) => repo.create(game));
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
    })();
  }
  return repo;
}
