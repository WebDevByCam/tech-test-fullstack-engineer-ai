import { connection } from "next/server";
import { getGamesRepo } from "@/lib/db";
import { DuplicateTitleError } from "@/lib/games/repository";
import { gameUpdateSchema } from "@/lib/games/schema";
import {
  duplicateTitleResponse,
  errorResponse,
  idParamSchema,
  parseBody,
} from "@/lib/http";

type Context = RouteContext<"/api/games/[id]">;

async function parseId(ctx: Context) {
  const id = idParamSchema.safeParse((await ctx.params).id);
  return id.success ? id.data : undefined;
}

const notFound = () => errorResponse(404, "Game not found");

/** GET /api/games/:id */
export async function GET(_request: Request, ctx: Context) {
  await connection();
  const id = await parseId(ctx);
  const game = id && getGamesRepo().getById(id);
  return game ? Response.json({ data: game }) : notFound();
}

/** PATCH /api/games/:id — partial update. */
export async function PATCH(request: Request, ctx: Context) {
  const id = await parseId(ctx);
  if (!id) return notFound();

  const body = await parseBody(request, gameUpdateSchema);
  if (body.response) return body.response;

  try {
    const game = getGamesRepo().update(id, body.data);
    return game ? Response.json({ data: game }) : notFound();
  } catch (error) {
    if (error instanceof DuplicateTitleError) return duplicateTitleResponse(error);
    throw error;
  }
}

/** DELETE /api/games/:id */
export async function DELETE(_request: Request, ctx: Context) {
  const id = await parseId(ctx);
  if (!id || !getGamesRepo().remove(id)) return notFound();
  return new Response(null, { status: 204 });
}
