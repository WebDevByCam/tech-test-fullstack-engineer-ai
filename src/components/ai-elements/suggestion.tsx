"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { useCallback } from "react";

export type SuggestionsProps = ComponentProps<"div">;

/**
 * Adapted from AI Elements: a vertical, wrapping list instead of a single horizontally
 * scrolling row (which mouse users on desktop couldn't scroll).
 */
export const Suggestions = ({ className, ...props }: SuggestionsProps) => (
  <div className={cn("flex w-full flex-col gap-2", className)} {...props} />
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      className={cn(
        "h-auto min-h-8 w-full cursor-pointer justify-start whitespace-normal rounded-lg px-3 py-2 text-left",
        className
      )}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
