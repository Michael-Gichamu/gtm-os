"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X, Loader2 } from "lucide-react";

/**
 * EditableField — click-to-edit primitive used across the CRM.
 *
 *   <EditableField value={lead.email} onSave={async (v) => patch({ email: v })} />
 *
 * UX rules:
 *   - Read state shows the value (or an italic "Add ___" placeholder) and a
 *     pencil glyph on hover.
 *   - Clicking the value swaps to an input/textarea.
 *   - Enter saves (Shift+Enter inserts a newline in textarea).
 *   - Escape cancels.
 *   - Blur saves IF the value changed; otherwise just exits edit mode.
 *   - During save: a small spinner replaces the value, and the field is
 *     non-interactive. On error we roll back and surface a toast (parent's
 *     responsibility via onSave throwing).
 *
 * `validate(value)` optionally returns a string error message; the field
 * stays in edit mode and shows the message until it's fixed.
 */
interface Props {
  value: string | null | undefined;
  onSave: (next: string | null) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  /** Optional client-side validation. Return string = error message, undefined = ok. */
  validate?: (value: string) => string | undefined;
  /** Inline (display:inline) rendering — useful inside a flowing detail row. */
  inline?: boolean;
  /** Disable editing entirely. */
  disabled?: boolean;
  /** Restrict the input type (only meaningful when !multiline). */
  type?: "text" | "email" | "url" | "tel" | "number";
  className?: string;
  /** Renders the value differently in read mode (e.g. as a link). */
  renderValue?: (value: string) => React.ReactNode;
}

export function EditableField({
  value,
  onSave,
  placeholder = "Add value",
  multiline = false,
  validate,
  inline = false,
  disabled = false,
  type = "text",
  className,
  renderValue,
}: Props) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Sync external value changes back into draft when not editing.
  React.useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function startEditing() {
    if (disabled || saving) return;
    setDraft(value ?? "");
    setError(undefined);
    setEditing(true);
    // Focus + caret-end on next tick so the new input is mounted.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* type="number" etc. don't support setSelectionRange */
        }
      }
    });
  }

  function cancel() {
    setDraft(value ?? "");
    setError(undefined);
    setEditing(false);
  }

  async function commit() {
    const trimmed = draft.trim();
    // No-op if value didn't actually change.
    const originalTrimmed = (value ?? "").trim();
    if (trimmed === originalTrimmed) {
      setEditing(false);
      return;
    }
    if (validate) {
      const v = validate(trimmed);
      if (v) {
        setError(v);
        return;
      }
    }
    setSaving(true);
    setError(undefined);
    try {
      await onSave(trimmed === "" ? null : trimmed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      // Stay in edit mode so the operator can retry without losing input.
    } finally {
      setSaving(false);
    }
  }

  // ----- Read mode -----
  if (!editing) {
    const isEmpty = value == null || value === "";
    const content = isEmpty
      ? <span className="italic text-muted-foreground">{placeholder}</span>
      : renderValue
        ? renderValue(value!)
        : <span>{value}</span>;

    const Wrapper: React.ElementType = inline ? "span" : "div";
    return (
      <Wrapper
        role={disabled ? undefined : "button"}
        tabIndex={disabled ? -1 : 0}
        onClick={startEditing}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded px-1 -mx-1 py-0.5 text-sm transition-colors",
          !disabled && "cursor-text hover:bg-accent/40",
          isEmpty && "text-muted-foreground",
          inline && "inline",
          className,
        )}
        title={disabled ? undefined : "Click to edit"}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        <span className="truncate">{content}</span>
        {!disabled && !saving && (
          <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
        )}
      </Wrapper>
    );
  }

  // ----- Edit mode -----
  const sharedInputProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        if (multiline && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          void commit();
        } else if (!multiline) {
          e.preventDefault();
          void commit();
        }
      }
    },
    onBlur: () => void commit(),
    disabled: saving,
    placeholder,
    className: "text-sm",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={3}
            {...sharedInputProps}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            {...sharedInputProps}
          />
        )}
        {saving && <Loader2 className="mt-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>
      {error ? (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <X className="h-3 w-3" />
          {error}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground">
          Enter to save · Esc to cancel{multiline ? " · Shift+Enter for newline" : ""}
        </div>
      )}
    </div>
  );
}
