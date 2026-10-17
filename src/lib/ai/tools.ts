import { tool, type InferUITools, type UIMessage } from "ai";
import { z } from "zod";
import { closestMatches } from "@/lib/fuzzy";
import type { GameRepository } from "@/lib/games/repository";
import { GAME_SORT_FIELDS, rangeSchema, type Game } from "@/lib/games/schema";

const MAX_RESULTS = 25;

const filtersSchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Case-insensitive text matched against title or developer"),
  genre: z
    .string()
    .optional()
    .describe('Genre name, case-insensitive exact match (e.g. "Roguelike")'),
  developer: z
    .string()
    .optional()
    .describe("Developer/studio name, partial match"),
  rating: rangeSchema.optional().describe("Bounds on average_rating (0–5)"),
  revenue: rangeSchema
    .optional()
    .describe("Bounds on monthly_revenue_usd (last month's revenue in USD)"),
  downloads: rangeSchema
    .optional()
    .describe("Bounds on monthly_downloads (last month's downloads)"),
});

export const searchGamesInput = filtersSchema.extend({
  sortBy: z
    .enum(GAME_SORT_FIELDS)
    .optional()
    .describe("Field to sort by (default: monthly_revenue_usd)"),
  order: z.enum(["asc", "desc"]).optional().describe("Sort order (default: desc)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_RESULTS)
    .optional()
    .describe(`Max games to return (default 10, max ${MAX_RESULTS})`),
});

export const getGamesByTitleInput = z.object({
  titles: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(10)
    .describe("One or more game titles to look up (partial titles are fine)"),
});

export const getCatalogStatsInput = filtersSchema.extend({
  groupBy: z
    .enum(["genre", "developer"])
    .optional()
    .describe(
      `Also return the same stats per genre or developer (top ${MAX_RESULTS} groups by revenue; total_groups gives the full count)`,
    ),
});

/** Compact projection sent to the model — no timestamps/ids it doesn't need. */
function toSummary({ title, developer, genre, monthly_revenue_usd, monthly_downloads, average_rating }: Game) {
  return { title, developer, genre, monthly_revenue_usd, monthly_downloads, average_rating };
}

const round = (value: number | null, digits = 2) =>
  value === null ? null : Number(value.toFixed(digits));

/** Pre-rounded so the model reports figures as-is (ratings to 1 decimal, like the UI). */
function roundStats<T extends { avg_revenue_usd: number; avg_rating: number | null }>(stats: T) {
  return { ...stats, avg_revenue_usd: round(stats.avg_revenue_usd), avg_rating: round(stats.avg_rating, 1) };
}

const COMPARED_METRICS = ["monthly_revenue_usd", "monthly_downloads", "average_rating"] as const;

/**
 * Differences computed in code so the model never does arithmetic: per metric, the leader(s)
 * (several on a tie) and how far ahead they are of each other game, absolute and in %.
 */
export function compareGames(games: Game[]) {
  return Object.fromEntries(
    COMPARED_METRICS.map((metric) => {
      const top = Math.max(...games.map((g) => g[metric]));
      const leaders = games.filter((g) => g[metric] === top);
      return [
        metric,
        {
          leaders: leaders.map((g) => g.title),
          leader_value: top,
          others: games
            .filter((g) => g[metric] !== top)
            .map((g) => ({
              title: g.title,
              value: g[metric],
              leader_ahead_by: round(top - g[metric], metric === "average_rating" ? 1 : 2),
              leader_ahead_by_pct: g[metric] === 0 ? null : round(((top - g[metric]) / g[metric]) * 100, 1),
            })),
        },
      ];
    }),
  );
}

/** Plain functions behind each tool — unit-testable without an LLM. */
export function createCatalogToolHandlers(repo: GameRepository) {
  /** Only when the genre itself doesn't exist (not when other filters emptied the result). */
  const genreHint = (genre: string | undefined, matches: number) => {
    if (!genre || matches > 0) return {};
    const genres = repo.genres();
    if (genres.some((g) => g.toLowerCase() === genre.trim().toLowerCase())) return {};
    return { hint: `Unknown genre "${genre}". Known genres: ${genres.slice(0, MAX_RESULTS).join(", ")}` };
  };

  return {
    searchGames(input: z.infer<typeof searchGamesInput>) {
      const { sortBy = "monthly_revenue_usd", order = "desc", limit = 10, ...filters } = input;
      const total = repo.count(filters);
      const games = repo.list({ ...filters, sortBy, order, limit }).map(toSummary);
      return { total_matching: total, returned: games.length, games, ...genreHint(filters.genre, total) };
    },

    getGamesByTitle({ titles }: z.infer<typeof getGamesByTitleInput>) {
      let allTitles: string[] | undefined; // loaded once, only if something isn't found
      const found: Game[] = [];
      const results = titles.map((query) => {
        const matches = repo.findByTitle(query);
        if (matches.length === 1) {
          found.push(matches[0]);
          return { query, status: "found" as const, game: toSummary(matches[0]) };
        }
        if (matches.length > 1) {
          return { query, status: "ambiguous" as const, candidates: matches.map((g) => g.title) };
        }
        allTitles ??= repo.titles();
        const didYouMean = closestMatches(query, allTitles);
        return { query, status: "not_found" as const, ...(didYouMean.length && { didYouMean }) };
      });
      return { results, ...(found.length >= 2 && { comparison: compareGames(found) }) };
    },

    getCatalogStats({ groupBy, ...filters }: z.infer<typeof getCatalogStatsInput>) {
      const overall = roundStats(repo.stats(filters));
      return {
        overall,
        ...(groupBy && {
          groupBy,
          total_groups: repo.countGroups(groupBy, filters),
          groups: repo.statsBy(groupBy, filters, MAX_RESULTS).map(roundStats),
        }),
        ...genreHint(filters.genre, overall.count),
      };
    },
  };
}

/** Wraps a handler so a failure becomes a tool result the model can explain, not a crashed stream. */
function safely<I, O>(fn: (input: I) => O) {
  return async (input: I) => {
    try {
      return fn(input);
    } catch (error) {
      console.error("[chat tool] failed", error);
      return { error: "The catalog query failed. Tell the user to try again." };
    }
  };
}

export function createCatalogTools(repo: GameRepository) {
  const handlers = createCatalogToolHandlers(repo);
  return {
    searchGames: tool({
      description:
        "Find, filter and rank games in the catalog. Use for 'which game made the most revenue', 'top N', and filtered lists. Returns total_matching plus up to `limit` games.",
      inputSchema: searchGamesInput,
      execute: safely(handlers.searchGames),
    }),
    getGamesByTitle: tool({
      description:
        "Look up specific games by title, e.g. to show details or compare two or more games. Returns found / ambiguous (with candidates) / not_found per title, plus a precomputed `comparison` (leaders per metric and differences in absolute and %) when 2+ games are found.",
      inputSchema: getGamesByTitleInput,
      execute: safely(handlers.getGamesByTitle),
    }),
    getCatalogStats: tool({
      description:
        "Aggregate statistics over the (optionally filtered) catalog: count, total and average revenue, total downloads, average rating. Use for 'how many…', totals and averages; set groupBy for per-genre or per-developer breakdowns.",
      inputSchema: getCatalogStatsInput,
      execute: safely(handlers.getCatalogStats),
    }),
  };
}

export type CatalogTools = ReturnType<typeof createCatalogTools>;
export type ChatMessage = UIMessage<never, never, InferUITools<CatalogTools>>;
