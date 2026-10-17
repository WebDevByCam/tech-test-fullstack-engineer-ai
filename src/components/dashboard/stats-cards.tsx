import { DollarSignIcon, DownloadIcon, Gamepad2Icon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact, formatInteger, formatRating, formatUsd, formatUsdCompact } from "@/lib/format";
import type { Game } from "@/lib/games/schema";

function StatCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: ReactNode }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function StatsCards({ games }: { games: Game[] }) {
  const revenue = games.reduce((sum, g) => sum + g.monthly_revenue_usd, 0);
  const downloads = games.reduce((sum, g) => sum + g.monthly_downloads, 0);
  const avgRating = games.length ? games.reduce((sum, g) => sum + g.average_rating, 0) / games.length : 0;
  const top = games.reduce<Game | undefined>(
    (best, g) => (!best || g.monthly_revenue_usd > best.monthly_revenue_usd ? g : best),
    undefined,
  );

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label="Games"
        value={formatInteger(games.length)}
        hint={`${new Set(games.map((g) => g.genre)).size} genres`}
        icon={<Gamepad2Icon />}
      />
      <StatCard
        label="Monthly revenue"
        value={formatUsdCompact(revenue)}
        hint={top && `Top: ${top.title} (${formatUsd(top.monthly_revenue_usd)})`}
        icon={<DollarSignIcon />}
      />
      <StatCard
        label="Monthly downloads"
        value={formatCompact(downloads)}
        hint={`${formatInteger(downloads)} total`}
        icon={<DownloadIcon />}
      />
      <StatCard
        label="Avg. rating"
        value={games.length ? formatRating(avgRating) : "—"}
        hint={`${games.filter((g) => g.average_rating > 4).length} rated above 4`}
        icon={<StarIcon />}
      />
    </div>
  );
}
