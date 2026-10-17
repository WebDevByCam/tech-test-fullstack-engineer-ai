import "server-only";
import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";

/**
 * Flash-Lite: the free tier for gemini-3.8-flash is only 20 requests/day (each tool step is a
 * request), while Flash-Lite has a far larger quota, answered every test question correctly
 * and is ~2x faster. Override with GEMINI_MODEL.
 */
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Catalog questions are simple lookups, so keep Gemini's built-in reasoning low (faster first token). */
export const chatProviderOptions = {
  google: {
    thinkingConfig: { thinkingLevel: "low" },
  } satisfies GoogleLanguageModelOptions,
};

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
    );
    this.name = "MissingApiKeyError";
  }
}

export function getChatModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new MissingApiKeyError();
  // `||` so a blank `GEMINI_MODEL=` line falls back to the default.
  return google(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
}
