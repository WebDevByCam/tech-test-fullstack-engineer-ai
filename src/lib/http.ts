import { z } from "zod";

export type ApiError = {
  error: { message: string; fieldErrors?: Record<string, string[]> };
};

export function errorResponse(
  status: number,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return Response.json({ error: { message, fieldErrors } } satisfies ApiError, {
    status,
  });
}

export function validationError(error: z.ZodError) {
  const { formErrors, fieldErrors } = z.flattenError(error);
  return errorResponse(
    400,
    formErrors[0] ?? "Validation failed",
    fieldErrors as Record<string, string[]>,
  );
}

/** Parses and validates a JSON body; returns either the data or a ready-made 400 response. */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; response?: never } | { data?: never; response: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { response: errorResponse(400, "Request body must be valid JSON") };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { data: result.data }
    : { response: validationError(result.error) };
}

export function duplicateTitleResponse(error: Error) {
  return errorResponse(409, error.message, { title: [error.message] });
}

export const idParamSchema = z.coerce.number().int().positive();
