import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, TextField } from "react-aria-components";
import { input as inputRecipe } from "../../lib/recipes/input";

interface InlineEditableProps {
  /** Current persisted value. */
  value: string;
  /** Called with the trimmed new value when the user confirms. */
  onSave: (next: string) => void | Promise<void>;
  /** Render the read-only display. Receives the current value. */
  children: (value: string) => ReactNode;
  /** Disable editing (e.g. while a save is in-flight). */
  isDisabled?: boolean;
  /** aria-label forwarded to the underlying TextField. */
  "aria-label"?: string;
  /** Extra className applied to the read-only trigger. */
  className?: string;
  /** Extra className applied to the Input when editing. */
  inputClassName?: string;
}

export function InlineEditable({
  value,
  onSave,
  children,
  isDisabled,
  "aria-label": ariaLabel,
  className,
  inputClassName,
}: InlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when the external value changes while not editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Auto-focus the input when entering edit mode.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const confirm = useCallback(() => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === value) return;
    void onSave(trimmed);
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <TextField
        value={draft}
        onChange={setDraft}
        isDisabled={isDisabled}
        aria-label={ariaLabel ?? "Rename"}
      >
        <Input
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") cancel();
          }}
          onBlur={confirm}
          className={inputRecipe({
            className: `max-w-xs !py-1 text-sm font-semibold ${inputClassName ?? ""}`,
          })}
        />
      </TextField>
    );
  }

  return (
    <Button
      isDisabled={isDisabled}
      onPress={() => setEditing(true)}
      aria-label={ariaLabel ?? "Rename"}
      className={({ isHovered, isPressed, isFocusVisible }) =>
        [
          "truncate text-left transition-colors rounded-sm px-1.5 py-0.5 -mx-1.5 -my-0.5 cursor-text",
          isPressed ? "bg-surface-selected" : isHovered ? "bg-surface-hover" : "",
          isFocusVisible ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      {children(value)}
    </Button>
  );
}
