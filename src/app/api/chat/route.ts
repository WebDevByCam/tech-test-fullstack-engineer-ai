import {
  APICallError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  RetryError,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { getGamesRepo } from "@/lib/db";
import {
  chatProviderOptions,
  getChatModel,
  MissingApiKeyError,
} from "@/lib/ai/model";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { createCatalogTools, type ChatMessage } from "@/lib/ai/tools";
import { errorResponse } from "@/lib/http";

// Allow a few tool round-trips (e.g. look up two games, then answer).
const MAX_STEPS = 5;

/** Maps provider errors to a message that is safe and useful to show in the chat UI. */
function toUserMessage(error: unknown): string {
  console.error("[chat] stream error", error);
  // After its built-in retries the SDK wraps the provider error in a RetryError.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === 429) {
      const seconds = cause.message.match(/retry in ([\d.]+)s/i)?.[1];
      const wait = seconds ? `about ${Math.ceil(Number(seconds))}s` : "a few seconds";
      return `The Gemini free-tier rate limit was reached. Please wait ${wait} and try again.`;
    }
    if (cause.statusCode === 503) {
      return "Gemini is overloaded right now. Please try again in a moment.";
    }
    if (cause.statusCode === 401 || cause.statusCode === 403) {
      return "The Gemini API key was rejected. Check GOOGLE_GENERATIVE_AI_API_KEY.";
    }
  }
  return "Something went wrong while generating the answer. Please try again.";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
  } | null;

  const tools = createCatalogTools(getGamesRepo());
  const validated = await safeValidateUIMessages<ChatMessage>({
    messages: body?.messages,
    tools,
  });
  if (!validated.success) return errorResponse(400, "Invalid chat messages");

  let model;
  try {
    model = getChatModel();
  } catch (error) {
    if (error instanceof MissingApiKeyError) return errorResponse(500, error.message);
    throw error;
  }

  const result = streamText({
    model,
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(validated.data),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    providerOptions: chatProviderOptions,
    // Free-tier quotas are per minute/day; blind retries just burn more quota.
    maxRetries: 1,
    // Stop/Clear in the UI disconnects the request — cancel remaining model steps too.
    abortSignal: request.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: validated.data,
      onError: toUserMessage,
    }),
  });
}
