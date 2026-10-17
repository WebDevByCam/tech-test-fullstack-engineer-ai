import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { initDatabase } from "./database";
import { DuplicateTitleError, type GameRepository } from "./repository";
import type { GameInput } from "./schema";

const game = (overrides: Partial<GameInput> = {}): GameInput => ({
  title: "Test Game",
  developer: "Test Studio",
  genre: "Puzzle",
  monthly_revenue_usd: 1000,
  monthly_downloads: 100,
  average_rating: 4,
  ...overrides,
});

let repo: GameRepository;

beforeEach(() => {
  repo = initDatabase(new Database(":memory:"), { seed: false });
  repo.create(game({ title: "Alpha", genre: "RPG", monthly_revenue_usd: 500, average_rating: 4.5 }));
  repo.create(game({ title: "Beta", genre: "Puzzle", monthly_revenue_usd: 2000, average_rating: 4 }));
  repo.create(game({ title: "Gamma", genre: "rpg", monthly_revenue_usd: 1500, average_rating: 3.2, developer: "Other Co" }));
});

describe("game repository", () => {
  it("creates, reads, updates and deletes a game", () => {
    const created = repo.create(game({ title: "Delta" }));
    expect(created).toMatchObject({ title: "Delta", developer: "Test Studio" });
    expect(repo.getById(created.id)?.title).toBe("Delta");

    const updated = repo.update(created.id, { average_rating: 4.9 });
    expect(updated?.average_rating).toBe(4.9);
    expect(updated?.title).toBe("Delta");

    expect(repo.remove(created.id)).toBe(true);
    expect(repo.getById(created.id)).toBeUndefined();
    expect(repo.remove(created.id)).toBe(false);
  });

  it("returns undefined when updating a missing game", () => {
    expect(repo.update(999, { title: "Nope" })).toBeUndefined();
  });

  it("rejects duplicate titles case-insensitively", () => {
    expect(() => repo.create(game({ title: "alpha" }))).toThrow(DuplicateTitleError);
    const beta = repo.findByTitle("Beta")[0];
    expect(() => repo.update(beta.id, { title: "ALPHA" })).toThrow(DuplicateTitleError);
  });

  it("distinguishes exclusive and inclusive rating bounds", () => {
    expect(repo.count({ rating: { gt: 4 } })).toBe(1);
    expect(repo.count({ rating: { gte: 4 } })).toBe(2);
  });

  it("sorts and limits", () => {
    const top = repo.list({ sortBy: "monthly_revenue_usd", order: "desc", limit: 1 });
    expect(top.map((g) => g.title)).toEqual(["Beta"]);
  });

  it("filters genre case-insensitively and searches title/developer", () => {
    expect(repo.list({ genre: "RPG" }).map((g) => g.title)).toEqual(["Alpha", "Gamma"]);
    expect(repo.list({ search: "other" }).map((g) => g.title)).toEqual(["Gamma"]);
  });

  it("prefers an exact title match, falling back to partial matches", () => {
    repo.create(game({ title: "Alpha Two" }));
    expect(repo.findByTitle("alpha").map((g) => g.title)).toEqual(["Alpha"]);
    expect(repo.findByTitle("alp").map((g) => g.title)).toEqual(["Alpha", "Alpha Two"]);
    expect(repo.findByTitle("zzz")).toEqual([]);
  });

  it("aggregates stats overall and per group", () => {
    expect(repo.stats()).toMatchObject({ count: 3, total_revenue_usd: 4000 });
    expect(repo.stats({ genre: "puzzle" }).count).toBe(1);
    // "RPG" and "rpg" collapse into one group; ties on revenue are ordered by name.
    const byGenre = repo.statsBy("genre");
    expect(byGenre.map((g) => [g.group.toLowerCase(), g.count, g.total_revenue_usd])).toEqual([
      ["puzzle", 1, 2000],
      ["rpg", 2, 2000],
    ]);
  });

  it("seeds only on first initialisation, not whenever the table is empty", () => {
    const db = new Database(":memory:");
    const seeded = initDatabase(db);
    expect(seeded.count()).toBeGreaterThan(10);
    seeded.list().forEach((g) => seeded.remove(g.id));
    expect(initDatabase(db).count()).toBe(0);
  });

  it("treats LIKE wildcards in search text literally", () => {
    repo.create(game({ title: "100% Orange Juice" }));
    expect(repo.list({ search: "100%" }).map((g) => g.title)).toEqual(["100% Orange Juice"]);
    // Unescaped, "_" would match any single character (i.e. every game).
    expect(repo.list({ search: "_" })).toEqual([]);
    expect(repo.findByTitle("_")).toEqual([]);
    expect(repo.findByTitle("%").map((g) => g.title)).toEqual(["100% Orange Juice"]);
  });

  it("reuses the existing spelling of a genre", () => {
    expect(repo.create(game({ title: "Delta", genre: "PUZZLE" })).genre).toBe("Puzzle");
    // Gamma was created as "rpg" after Alpha's "RPG", so it was stored as "RPG" too.
    expect(repo.genres()).toEqual(["Puzzle", "RPG"]);
    // A game can still change the casing of a genre only it uses.
    const solo = repo.create(game({ title: "Solo", genre: "Arcade" }));
    expect(repo.update(solo.id, { genre: "ARCADE" })?.genre).toBe("ARCADE");
  });

  it("caps grouped stats and reports the total number of groups", () => {
    expect(repo.statsBy("genre", {}, 1)).toHaveLength(1);
    expect(repo.countGroups("genre")).toBe(2);
  });
});
