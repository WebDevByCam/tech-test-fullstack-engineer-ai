"use client";

import { useChat } from "@ai-sdk/react";
import { isStaticToolUIPart } from "ai";
import { AlertCircleIcon, RotateCcwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ChatMessage } from "@/lib/ai/tools";

const SUGGESTIONS = [
  "Which game made the most revenue last month?",
  "How many games are rated above 4?",
  "Compare revenue of Hades vs Balatro",
  "Which genre earns the most in total?",
];

const TOOL_TITLES: Record<string, string> = {
  "tool-searchGames": "Catalog search",
  "tool-getCatalogStats": "Catalog stats",
  "tool-getGamesByTitle": "Title lookup",
};

/** HTTP errors arrive as the raw response body; pull out our `{ error: { message } }` if present. */
function readableError(error: Error) {
  try {
    return (JSON.parse(error.message) as { error?: { message?: string } }).error?.message ?? error.message;
  } catch {
    return error.message;
  }
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } = useChat<ChatMessage>();
  const busy = status === "submitted" || status === "streaming";

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text });
    setInput("");
  };

  const lastMessage = messages.at(-1);
  const waitingForFirstToken =
    status === "submitted" || (status === "streaming" && lastMessage?.role === "assistant" && lastMessage.parts.length === 0);

  return (
    <section aria-labelledby="chat-heading" className="flex h-full min-h-0 flex-col rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 id="chat-heading" className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="size-4 text-primary" />
            Ask the catalog
          </h2>
          <p className="text-xs text-muted-foreground">Answers are computed live from the database via tool calls.</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stop();
              setMessages([]);
              clearError();
            }}
          >
            <Trash2Icon />
            Clear
          </Button>
        )}
      </header>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-6">
          {messages.length === 0 ? (
            <ConversationEmptyState className="justify-start p-2 sm:justify-center">
              <SparklesIcon className="size-7 text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Ask anything about the games</h3>
                <p className="text-sm text-muted-foreground">Rankings, counts, comparisons and per-genre breakdowns.</p>
              </div>
              <Suggestions className="mt-2 max-w-sm">
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion key={suggestion} suggestion={suggestion} onClick={ask} />
                ))}
              </Suggestions>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    const key = `${message.id}-${i}`;
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <MessageResponse key={key} isAnimating={busy && message.id === lastMessage?.id}>
                          {part.text}
                        </MessageResponse>
                      ) : (
                        <p key={key} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    if (isStaticToolUIPart(part)) {
                      return (
                        <Tool key={key} className="mb-0">
                          <ToolHeader type={part.type} state={part.state} title={TOOL_TITLES[part.type]} />
                          <ToolContent>
                            <ToolInput input={part.input} />
                            <ToolOutput output={part.output} errorText={part.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {waitingForFirstToken && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Spinner /> Thinking…
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="flex-1">{readableError(error)}</p>
              <Button size="sm" variant="outline" onClick={() => void regenerate()}>
                <RotateCcwIcon />
                Retry
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <PromptInput onSubmit={({ text }) => ask(text)}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="e.g. Top 3 roguelikes by downloads"
              aria-label="Ask a question about the catalog"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span className="px-2 text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</span>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
