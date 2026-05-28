"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api(`/leads/${leadId}/notes`, { method: "POST", body: { body: trimmed } });
      setBody("");
      router.refresh();
    } catch (e) {
      const msg = e instanceof ClientApiError ? e.message : "Failed to add note";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note — what was said on the call, what to follow up on, etc."
        rows={3}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
          {submitting ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
