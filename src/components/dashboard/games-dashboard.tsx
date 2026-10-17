"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Game } from "@/lib/games/schema";
import { DeleteGameDialog } from "./delete-game-dialog";
import { GameFormDialog } from "./game-form-dialog";
import { GamesTable, type SortState } from "./games-table";
import { StatsCards } from "./stats-cards";

const ALL_GENRES = "__all__";

function compareGames(a: Game, b: Game, { field, order }: SortState) {
  const x = a[field];
  const y = b[field];
  const result =
    typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
  return order === "asc" ? result : -result;
}

export function GamesDashboard({ initialGames }: { initialGames: Game[] }) {
  const [games, setGames] = useState(initialGames);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState(ALL_GENRES);
  const [sort, setSort] = useState<SortState>({ field: "monthly_revenue_usd", order: "desc" });
  const [form, setForm] = useState<{ open: boolean; game?: Game; session: number }>({ open: false, session: 0 });
  const [deleting, setDeleting] = useState<{ open: boolean; game?: Game }>({ open: false });

  const genres = useMemo(
    () => [...new Set(games.map((g) => g.genre))].sort((a, b) => a.localeCompare(b)),
    [games],
  );
  // Derived so an edit/delete that removes the selected genre falls back to "All genres".
  const activeGenre = genres.includes(genre) ? genre : ALL_GENRES;

  const visibleGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games
      .filter((g) => activeGenre === ALL_GENRES || g.genre === activeGenre)
      .filter((g) => !query || g.title.toLowerCase().includes(query) || g.developer.toLowerCase().includes(query))
      .sort((a, b) => compareGames(a, b, sort));
  }, [games, search, activeGenre, sort]);

  /** Merge the row returned by the API (the database's version) into local state. */
  const upsert = (saved: Game) =>
    setGames((list) =>
      list.some((g) => g.id === saved.id) ? list.map((g) => (g.id === saved.id ? saved : g)) : [...list, saved],
    );

  const openForm = (game?: Game) => setForm((f) => ({ open: true, game, session: f.session + 1 }));

  return (
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-4">
      <StatsCards games={games} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <h2 id="catalog-heading" className="sr-only">
          Games catalog
        </h2>
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search title or developer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search games"
          />
        </InputGroup>
        <Select value={activeGenre} onValueChange={setGenre}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by genre">
            {/* Explicit label: Radix can't resolve an item's text until the menu has mounted. */}
            <SelectValue>{activeGenre === ALL_GENRES ? "All genres" : activeGenre}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GENRES}>All genres</SelectItem>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="whitespace-nowrap text-sm text-muted-foreground sm:ml-auto">
          {visibleGames.length} of {games.length}
        </span>
        <Button onClick={() => openForm()}>
          <PlusIcon />
          Add game
        </Button>
      </div>

      <GamesTable
        games={visibleGames}
        sort={sort}
        onSortChange={setSort}
        onEdit={openForm}
        onDelete={(game) => setDeleting({ open: true, game })}
      />

      <GameFormDialog
        {...form}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(saved) => {
          setForm((f) => ({ ...f, open: false }));
          upsert(saved);
        }}
      />
      <DeleteGameDialog
        {...deleting}
        onOpenChange={(open) => setDeleting((d) => ({ ...d, open }))}
        onDeleted={(game) => {
          setDeleting((d) => ({ ...d, open: false }));
          setGames((list) => list.filter((g) => g.id !== game.id));
        }}
      />
    </section>
  );
}
