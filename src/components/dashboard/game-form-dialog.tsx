"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, gamesApi } from "@/lib/games/api-client";
import { gameInputSchema, type Game, type GameInput } from "@/lib/games/schema";
import { z } from "zod";

type FieldName = keyof GameInput;
type FormValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string[]>>;

const FIELDS: {
  name: FieldName;
  label: string;
  type: "text" | "number";
  placeholder: string;
  step?: string;
  min?: number;
  max?: number;
}[] = [
  { name: "title", label: "Title", type: "text", placeholder: "Hollow Knight" },
  { name: "developer", label: "Developer", type: "text", placeholder: "Team Cherry" },
  { name: "genre", label: "Genre", type: "text", placeholder: "Metroidvania" },
  { name: "monthly_revenue_usd", label: "Monthly revenue (USD)", type: "number", placeholder: "250000", step: "any", min: 0 },
  { name: "monthly_downloads", label: "Monthly downloads", type: "number", placeholder: "40000", step: "1", min: 0 },
  { name: "average_rating", label: "Average rating (0–5)", type: "number", placeholder: "4.5", step: "0.1", min: 0, max: 5 },
];

const NUMERIC: FieldName[] = ["monthly_revenue_usd", "monthly_downloads", "average_rating"];

function toFormValues(game?: Game): FormValues {
  return Object.fromEntries(
    FIELDS.map(({ name }) => [name, game ? String(game[name]) : ""]),
  ) as FormValues;
}

function toInput(values: FormValues) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      NUMERIC.includes(key as FieldName) ? (value.trim() === "" ? undefined : Number(value)) : value,
    ]),
  );
}

type Props = {
  /** Game to edit; omit to create a new one. */
  game?: Game;
  open: boolean;
  /** Changes every time the dialog is opened, so the form state starts fresh. */
  session: number;
  onOpenChange: (open: boolean) => void;
  onSaved: (game: Game) => void;
};

export function GameFormDialog({ game, open, session, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <GameForm key={session} game={game} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function GameForm({ game, onCancel, onSaved }: { game?: Game; onCancel: () => void; onSaved: (game: Game) => void }) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(game));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = gameInputSchema.safeParse(toInput(values));
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setSaving(true);
    setFormError(undefined);
    try {
      const saved = game ? await gamesApi.update(game.id, parsed.data) : await gamesApi.create(parsed.data);
      toast.success(game ? `Updated “${saved.title}”` : `Added “${saved.title}”`);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        if (!Object.keys(error.fieldErrors).length) setFormError(error.message);
      } else {
        setFormError("Could not reach the server. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{game ? "Edit game" : "Add game"}</DialogTitle>
        <DialogDescription>Revenue and downloads are last month&apos;s figures.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ name, label, ...input }) => {
          const error = errors[name]?.[0];
          return (
            <div key={name} className={name === "title" ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"}>
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                inputMode={input.type === "number" ? "decimal" : undefined}
                value={values[name]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [name]: e.target.value }));
                  setErrors((errs) => ({ ...errs, [name]: undefined }));
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${name}-error` : undefined}
                autoFocus={name === "title"}
                {...input}
              />
              {error && (
                <p id={`${name}-error`} className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          {game ? "Save changes" : "Add game"}
        </Button>
      </DialogFooter>
    </form>
  );
}
