import type { Database } from "better-sqlite3";
import type {
  Game,
  GameFilters,
  GameInput,
  GameUpdate,
  ListOptions,
  Range,
} from "./schema";

export class DuplicateTitleError extends Error {
  constructor(title: string) {
    super(`A game titled "${title}" already exists`);
    this.name = "DuplicateTitleError";
  }
}

export type GroupBy = "genre" | "developer";

export type CatalogStats = {
  count: number;
  total_revenue_usd: number;
  avg_revenue_usd: number;
  total_downloads: number;
  avg_rating: number | null;
};

export type GroupedStats = CatalogStats & { group: string };

// Column names are interpolated into SQL, so they are whitelisted here — never from user input.
const SORT_COLUMNS = {
  title: "title",
  developer: "developer",
  genre: "genre",
  monthly_revenue_usd: "monthly_revenue_usd",
  monthly_downloads: "monthly_downloads",
  average_rating: "average_rating",
  updated_at: "updated_at",
} as const;

const EDITABLE_COLUMNS = [
  "title",
  "developer",
  "genre",
  "monthly_revenue_usd",
  "monthly_downloads",
  "average_rating",
] as const satisfies readonly (keyof GameInput)[];

const RANGE_COLUMNS = {
  rating: "average_rating",
  revenue: "monthly_revenue_usd",
  downloads: "monthly_downloads",
} as const;

const RANGE_OPERATORS: Record<keyof Range, string> = {
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

const STATS_SELECT = `
  COUNT(*)                              AS count,
  COALESCE(SUM(monthly_revenue_usd), 0) AS total_revenue_usd,
  COALESCE(AVG(monthly_revenue_usd), 0) AS avg_revenue_usd,
  COALESCE(SUM(monthly_downloads), 0)   AS total_downloads,
  AVG(average_rating)                   AS avg_rating`;

const LIKE_ESCAPE = "ESCAPE '\\'";

/** `%text%` with LIKE wildcards in the user's text escaped, so "100%" matches literally. */
function containsPattern(text: string) {
  return `%${text.trim().replace(/[\\%_]/g, "\\$&")}%`;
}

function buildWhere(filters: GameFilters) {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};

  if (filters.search) {
    clauses.push(
      `(title LIKE @search ${LIKE_ESCAPE} OR developer LIKE @search ${LIKE_ESCAPE})`,
    );
    params.search = containsPattern(filters.search);
  }
  if (filters.genre) {
    clauses.push("genre = @genre COLLATE NOCASE");
    params.genre = filters.genre;
  }
  if (filters.developer) {
    clauses.push(`developer LIKE @developer ${LIKE_ESCAPE}`);
    params.developer = containsPattern(filters.developer);
  }
  for (const [key, column] of Object.entries(RANGE_COLUMNS)) {
    const range = filters[key as keyof typeof RANGE_COLUMNS];
    if (!range) continue;
    for (const [op, sqlOp] of Object.entries(RANGE_OPERATORS)) {
      const value = range[op as keyof Range];
      if (value === undefined) continue;
      const name = `${key}_${op}`;
      clauses.push(`${column} ${sqlOp} @${name}`);
      params[name] = value;
    }
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

export function createGameRepository(db: Database) {
  /**
   * Genres match case-insensitively everywhere, so reuse an existing spelling
   * ("roguelike" → "Roguelike") to keep one canonical label per genre in the UI.
   */
  const canonicalGenre = (genre: string, excludeId = 0) =>
    (
      db
        .prepare(
          "SELECT genre FROM games WHERE genre = ? COLLATE NOCASE AND id != ? LIMIT 1",
        )
        .get(genre, excludeId) as { genre: string } | undefined
    )?.genre ?? genre;

  return {
    list(options: ListOptions = {}): Game[] {
      const { where, params } = buildWhere(options);
      const column = SORT_COLUMNS[options.sortBy ?? "title"];
      const order = options.order === "desc" ? "DESC" : "ASC";
      const tiebreak = column === "title" ? "" : ", title COLLATE NOCASE ASC";
      return db
        .prepare(
          `SELECT * FROM games ${where}
           ORDER BY ${column} COLLATE NOCASE ${order}${tiebreak}
           LIMIT @limit OFFSET @offset`,
        )
        .all({
          ...params,
          limit: options.limit ?? -1,
          offset: options.offset ?? 0,
        }) as Game[];
    },

    count(filters: GameFilters = {}): number {
      const { where, params } = buildWhere(filters);
      const row = db
        .prepare(`SELECT COUNT(*) AS n FROM games ${where}`)
        .get(params) as { n: number };
      return row.n;
    },

    getById(id: number): Game | undefined {
      return db.prepare("SELECT * FROM games WHERE id = ?").get(id) as
        | Game
        | undefined;
    },

    /** Exact (case-insensitive) title match first, otherwise up to `limit` partial matches. */
    findByTitle(query: string, limit = 5): Game[] {
      const exact = db
        .prepare("SELECT * FROM games WHERE title = ? COLLATE NOCASE")
        .get(query.trim()) as Game | undefined;
      if (exact) return [exact];
      return db
        .prepare(
          `SELECT * FROM games WHERE title LIKE ? ${LIKE_ESCAPE}
           ORDER BY length(title) ASC LIMIT ?`,
        )
        .all(containsPattern(query), limit) as Game[];
    },

    create(input: GameInput): Game {
      try {
        const { lastInsertRowid } = db
          .prepare(
            `INSERT INTO games (title, developer, genre, monthly_revenue_usd, monthly_downloads, average_rating)
             VALUES (@title, @developer, @genre, @monthly_revenue_usd, @monthly_downloads, @average_rating)`,
          )
          .run({ ...input, genre: canonicalGenre(input.genre) });
        return this.getById(Number(lastInsertRowid))!;
      } catch (error) {
        if (isUniqueViolation(error)) throw new DuplicateTitleError(input.title);
        throw error;
      }
    },

    update(id: number, patch: GameUpdate): Game | undefined {
      const fields = EDITABLE_COLUMNS.filter(
        (column) => patch[column] !== undefined,
      );
      if (fields.length === 0) return this.getById(id);
      const assignments = fields.map((field) => `${field} = @${field}`);
      try {
        const { changes } = db
          .prepare(
            `UPDATE games SET ${assignments.join(", ")}, updated_at = datetime('now')
             WHERE id = @id`,
          )
          .run({
            ...patch,
            ...(patch.genre && { genre: canonicalGenre(patch.genre, id) }),
            id,
          });
        return changes ? this.getById(id) : undefined;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DuplicateTitleError(patch.title ?? "");
        }
        throw error;
      }
    },

    remove(id: number): boolean {
      return db.prepare("DELETE FROM games WHERE id = ?").run(id).changes > 0;
    },

    stats(filters: GameFilters = {}): CatalogStats {
      const { where, params } = buildWhere(filters);
      return db
        .prepare(`SELECT ${STATS_SELECT} FROM games ${where}`)
        .get(params) as CatalogStats;
    },

    /** Stats per group, highest total revenue first (pass `limit` to cap the groups). */
    statsBy(
      groupBy: GroupBy,
      filters: GameFilters = {},
      limit = -1,
    ): GroupedStats[] {
      const column = groupBy === "genre" ? "genre" : "developer";
      const { where, params } = buildWhere(filters);
      return db
        .prepare(
          `SELECT ${column} AS "group", ${STATS_SELECT} FROM games ${where}
           GROUP BY ${column} COLLATE NOCASE
           ORDER BY total_revenue_usd DESC, "group" COLLATE NOCASE ASC
           LIMIT @limit`,
        )
        .all({ ...params, limit }) as GroupedStats[];
    },

    countGroups(groupBy: GroupBy, filters: GameFilters = {}): number {
      const column = groupBy === "genre" ? "genre" : "developer";
      const { where, params } = buildWhere(filters);
      return (
        db
          .prepare(
            `SELECT COUNT(DISTINCT ${column} COLLATE NOCASE) AS n FROM games ${where}`,
          )
          .get(params) as { n: number }
      ).n;
    },

    titles(): string[] {
      return (
        db.prepare("SELECT title FROM games").all() as { title: string }[]
      ).map((row) => row.title);
    },

    genres(): string[] {
      return (
        db
          .prepare(
            "SELECT DISTINCT genre FROM games ORDER BY genre COLLATE NOCASE",
          )
          .all() as { genre: string }[]
      ).map((row) => row.genre);
    },
  };
}

export type GameRepository = ReturnType<typeof createGameRepository>;
