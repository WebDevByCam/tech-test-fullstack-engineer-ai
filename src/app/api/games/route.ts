import { connection, type NextRequest } from "next/server";
import { getGamesRepo } from "@/lib/db";
import { DuplicateTitleError } from "@/lib/games/repository";
import {
  gameInputSchema,
  listQuerySchema,
  listQueryToOptions,
} from "@/lib/games/schema";
import { duplicateTitleResponse, parseBody, validationError } from "@/lib/http";

/** GET /api/games — list games with optional filters, sorting and pagination. */
export async function GET(request: NextRequest) {
  await connection();
  const query = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) return validationError(query.error);

  const repo = getGamesRepo();
  const options = listQueryToOptions(query.data);
  return Response.json({
    data: repo.list(options),
    total: repo.count(options),
  });
}

/** POST /api/games — create a game. */
export async function POST(request: Request) {
  const body = await parseBody(request, gameInputSchema);
  if (body.response) return body.response;

  try {
    return Response.json(
      { data: getGamesRepo().create(body.data) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DuplicateTitleError) return duplicateTitleResponse(error);
    throw error;
  }
}
