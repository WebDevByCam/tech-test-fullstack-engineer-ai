"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { gamesApi } from "@/lib/games/api-client";
import type { Game } from "@/lib/games/schema";

type Props = {
  game?: Game;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (game: Game) => void;
};

export function DeleteGameDialog({ game, open, onOpenChange, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: React.MouseEvent) {
    if (!game) return;
    event.preventDefault(); // keep the dialog open until the request finishes
    setDeleting(true);
    try {
      await gamesApi.remove(game.id);
      toast.success(`Deleted “${game.title}”`);
      onDeleted(game);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the game");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{game?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the game from the catalog. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Spinner />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
