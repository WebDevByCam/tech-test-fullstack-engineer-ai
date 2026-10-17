import { z } from "zod";

const GAME_NUMERIC_FIELDS = [
  "monthly_revenue_usd",
  "monthly_downloads",
  "average_rating",
] as const;

export const GAME_SORT_FIELDS = [
  "title",
  "developer",
  "genre",
  ...GAME_NUMERIC_FIELDS,
  "updated_at",
] as const;

export type GameSortField = (typeof GAME_SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

const text = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be at most 100 characters`);

const number = (label: string) =>
  z.number({
    error: (issue) =>
      issue.input === undefined ? `${label} is required` : `${label} must be a number`,
  });

export const gameInputSchema = z.object({
  title: text("Title"),
  developer: text("Developer"),
  genre: text("Genre"),
  monthly_revenue_usd: number("Revenue")
    .nonnegative("Revenue cannot be negative")
    .max(1e12, "Revenue is unrealistically large"),
  monthly_downloads: number("Downloads")
    .int("Downloads must be a whole number")
    .nonnegative("Downloads cannot be negative"),
  average_rating: number("Rating")
    .min(0, "Rating must be between 0 and 5")
    .max(5, "Rating must be between 0 and 5"),
});

export const gameUpdateSchema = gameInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to update",
  });

export type GameInput = z.infer<typeof gameInputSchema>;
export type GameUpdate = z.infer<typeof gameUpdateSchema>;

export type Game = GameInput & {
  id: number;
  created_at: string;
  updated_at: string;
};

/** Numeric range with explicit inclusive/exclusive bounds ("above 4" → { gt: 4 }). */
export const rangeSchema = z
  .object({
    gt: z.number().optional().describe("strictly greater than"),
    gte: z.number().optional().describe("greater than or equal to"),
    lt: z.number().optional().describe("strictly less than"),
    lte: z.number().optional().describe("less than or equal to"),
  })
  .strict();

export type Range = z.infer<typeof rangeSchema>;

export type GameFilters = {
  /** Case-insensitive substring match on title or developer. */
  search?: string;
  genre?: string;
  developer?: string;
  rating?: Range;
  revenue?: Range;
  downloads?: Range;
};

export type ListOptions = GameFilters & {
  sortBy?: GameSortField;
  order?: SortOrder;
  limit?: number;
  offset?: number;
};

/** Query-string schema for `GET /api/games` (flat, string-coerced params). */
export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  genre: z.string().trim().min(1).optional(),
  developer: z.string().trim().min(1).optional(),
  min_rating: z.coerce.number().optional(),
  max_rating: z.coerce.number().optional(),
  min_revenue: z.coerce.number().optional(),
  max_revenue: z.coerce.number().optional(),
  min_downloads: z.coerce.number().optional(),
  max_downloads: z.coerce.number().optional(),
  sort: z.enum(GAME_SORT_FIELDS).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

const range = (gte?: number, lte?: number): Range | undefined =>
  gte === undefined && lte === undefined ? undefined : { gte, lte };

export function listQueryToOptions(q: ListQuery): ListOptions {
  return {
    search: q.search,
    genre: q.genre,
    developer: q.developer,
    rating: range(q.min_rating, q.max_rating),
    revenue: range(q.min_revenue, q.max_revenue),
    downloads: range(q.min_downloads, q.max_downloads),
    sortBy: q.sort,
    order: q.order,
    limit: q.limit,
    offset: q.offset,
  };
}
