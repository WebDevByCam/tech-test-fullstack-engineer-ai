"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, PencilIcon, StarIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatInteger, formatRating, formatUsd } from "@/lib/format";
import type { Game, GameSortField, SortOrder } from "@/lib/games/schema";

export type SortState = { field: GameSortField; order: SortOrder };

// Responsive columns, so the table never scrolls sideways:
// - phones: rating moves under the title (next to the developer);
// - from lg the chat panel takes a column, so the table is narrowest between lg and xl:
//   developer moves under the title there, and downloads only show when there is room.
const DEVELOPER_COLUMN = "hidden md:table-cell lg:hidden xl:table-cell";
const DEVELOPER_SUBTITLE = "md:hidden lg:inline xl:hidden";
const RATING_COLUMN = "hidden sm:table-cell";

const COLUMNS: {
  field: GameSortField;
  label: string;
  shortLabel?: string;
  numeric?: boolean;
  className?: string;
}[] = [
  { field: "title", label: "Title" },
  { field: "developer", label: "Developer", className: DEVELOPER_COLUMN },
  { field: "genre", label: "Genre", className: "hidden sm:table-cell" },
  { field: "monthly_revenue_usd", label: "Revenue / mo", shortLabel: "Revenue", numeric: true },
  { field: "monthly_downloads", label: "Downloads / mo", numeric: true, className: "hidden xl:table-cell" },
  { field: "average_rating", label: "Rating", numeric: true, className: RATING_COLUMN },
];

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {formatRating(value)}
    </span>
  );
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return <ArrowUpDownIcon className="size-3.5 opacity-40" />;
  return order === "asc" ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />;
}

type Props = {
  games: Game[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
};

export function GamesTable({ games, sort, onSortChange, onEdit, onDelete }: Props) {
  const toggleSort = (field: GameSortField, numeric?: boolean) =>
    onSortChange(
      sort.field === field
        ? { field, order: sort.order === "asc" ? "desc" : "asc" }
        : { field, order: numeric ? "desc" : "asc" },
    );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map(({ field, label, shortLabel, numeric, className }) => {
              const active = sort.field === field;
              return (
                <TableHead
                  key={field}
                  className={cn(numeric && "text-right", className)}
                  aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(field, numeric)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      numeric && "flex-row-reverse",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {shortLabel ? (
                      <>
                        <span className="sm:hidden">{shortLabel}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </>
                    ) : (
                      label
                    )}
                    <SortIcon active={active} order={sort.order} />
                  </button>
                </TableHead>
              );
            })}
            <TableHead className="w-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1} className="h-24 text-center text-muted-foreground">
                No games match your filters.
              </TableCell>
            </TableRow>
          ) : (
            games.map((game) => (
              <TableRow key={game.id}>
                <TableCell className="max-w-40 sm:max-w-56">
                  <div className="truncate font-medium">{game.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className={DEVELOPER_SUBTITLE}>{game.developer}</span>
                    <span className="sm:hidden">
                      {" · "}
                      <Rating value={game.average_rating} />
                    </span>
                  </div>
                </TableCell>
                <TableCell className={cn("max-w-44 truncate", DEVELOPER_COLUMN)}>{game.developer}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary">{game.genre}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(game.monthly_revenue_usd)}</TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">
                  {formatInteger(game.monthly_downloads)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", RATING_COLUMN)}>
                  <Rating value={game.average_rating} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(game)} aria-label={`Edit ${game.title}`}>
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(game)}
                      aria-label={`Delete ${game.title}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
