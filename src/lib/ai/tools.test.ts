import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { closestMatches } from "@/lib/fuzzy";
import { initDatabase } from "@/lib/games/database";
import { createCatalogToolHandlers, getCatalogStatsInput, getGamesByTitleInput, searchGamesInput } from "./tools";

let tools: ReturnType<typeof createCatalogToolHandlers>;

beforeEach(() => {
  tools = createCatalogToolHandlers(initDatabase(new Database(":memory:")));
});

describe("catalog tools (seeded data)", () => {
  it("searchGames ranks by revenue desc by default and reports the total", () => {
    const result = tools.searchGames({ limit: 1 });
    expect(result.total_matching).toBe(18);
    expect(result.games).toEqual([expect.objectContaining({ title: "Stardew Valley" })]);
    expect(result.games[0]).not.toHaveProperty("id"); // compact projection only
  });

  it("getCatalogStats treats 'above 4' as exclusive", () => {
    expect(tools.getCatalogStats({ rating: { gt: 4 } }).overall.count).toBe(14);
    expect(tools.getCatalogStats({ rating: { gte: 4 } }).overall.count).toBe(15);
  });

  it("getCatalogStats can group by genre", () => {
    const { groups, total_groups } = tools.getCatalogStats({ groupBy: "genre" });
    expect(groups?.[0]).toMatchObject({ group: "Roguelike", count: 4 });
    expect(total_groups).toBe(9);
  });

  it("hints known genres only when the genre itself is unknown", () => {
    const unknown = tools.searchGames({ genre: "Roguelikes" });
    expect(unknown.total_matching).toBe(0);
    expect(unknown.hint).toContain("Known genres:");

    // Valid genre, but another filter empties the result → no misleading hint.
    const filtered = tools.searchGames({ genre: "roguelike", rating: { gt: 4.95 } });
    expect(filtered.total_matching).toBe(0);
    expect(filtered).not.toHaveProperty("hint");
  });

  it("getGamesByTitle reports found / ambiguous / not_found with suggestions", () => {
    const { results } = tools.getGamesByTitle({ titles: ["hades", "s", "cuphed", "Minecraft"] });
    expect(results.map((r) => r.status)).toEqual(["found", "ambiguous", "not_found", "not_found"]);
    expect(results[2]).toMatchObject({ didYouMean: ["Cuphead"] });
    expect(results[3]).not.toHaveProperty("didYouMean");
  });

  it("getGamesByTitle precomputes comparison maths, including ties", () => {
    const { comparison } = tools.getGamesByTitle({ titles: ["Stardew Valley", "Balatro", "Among Us"] });
    expect(comparison?.monthly_downloads).toMatchObject({
      leaders: ["Among Us"],
      others: expect.arrayContaining([
        // (410,000 − 98,000) / 98,000 = 318.4% — the figure the model once miscalculated.
        { title: "Balatro", value: 98000, leader_ahead_by: 312000, leader_ahead_by_pct: 318.4 },
      ]),
    });
    expect(comparison?.average_rating.leaders).toEqual(["Stardew Valley", "Balatro"]);
    expect(tools.getGamesByTitle({ titles: ["Hades"] })).not.toHaveProperty("comparison");
  });

  it("tool input schemas reject out-of-range limits and unknown range keys", () => {
    expect(searchGamesInput.safeParse({ limit: 500 }).success).toBe(false);
    expect(getCatalogStatsInput.safeParse({ rating: { above: 4 } }).success).toBe(false);
    expect(getGamesByTitleInput.safeParse({ titles: ["   "] }).success).toBe(false);
  });
});

describe("closestMatches", () => {
  it("finds typos and ignores unrelated titles", () => {
    expect(closestMatches("celest", ["Celeste", "Cuphead", "Hades"])).toEqual(["Celeste"]);
    expect(closestMatches("Minecraft", ["Celeste", "Cuphead", "Hades"])).toEqual([]);
  });
});
