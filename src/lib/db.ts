import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { initDatabase } from "./games/database";
import { createGameRepository, type GameRepository } from "./games/repository";

function openDatabase(): Database.Database {
  const file =
    process.env.DATABASE_PATH || path.join(process.cwd(), "data", "games.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  initDatabase(db);
  return db;
}

// Cache only the connection across dev hot reloads. The repository is rebuilt per call
// (it is just a set of closures) so code changes to it are picked up without a restart.
const globalForDb = globalThis as typeof globalThis & {
  gamesDb?: Database.Database;
};

export function getGamesRepo(): GameRepository {
  globalForDb.gamesDb ??= openDatabase();
  return createGameRepository(globalForDb.gamesDb);
}
