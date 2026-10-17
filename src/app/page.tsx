import { Gamepad2Icon } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { GamesDashboard } from "@/components/dashboard/games-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getGamesRepo } from "@/lib/db";

/** Reads the catalog at request time (sync SQLite → `connection()` opts out of prerendering). */
async function Catalog() {
  await connection();
  const games = getGamesRepo().list({ sortBy: "monthly_revenue_usd", order: "desc" });
  return <GamesDashboard initialGames={games} />;
}

function CatalogSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading catalog">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-26 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-120 w-full rounded-lg" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gamepad2Icon className="size-4" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Indie Games Dashboard</h1>
            <p className="text-xs text-muted-foreground">Catalog management · monthly figures</p>
          </div>
        </div>
      </header>

      {/* minmax(0,1fr): an implicit `auto` track would grow to fit wide children (tables,
          code blocks) and make the page scroll horizontally on phones. */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <Suspense fallback={<CatalogSkeleton />}>
          <Catalog />
        </Suspense>
        {/* Sticky on desktop so the chat stays in view while scrolling the table. */}
        <aside className="h-[70svh] lg:sticky lg:top-6 lg:h-[calc(100svh-7.5rem)]">
          <ChatPanel />
        </aside>
      </main>
    </div>
  );
}
