"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function DeleteLeadButton({ id, companyName }: { id: string; companyName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function onConfirm() {
    setSubmitting(true);
    try {
      await api(`/leads/${id}`, { method: "DELETE" });
      toast.success("Lead deleted");
      router.push("/leads");
      router.refresh();
    } catch (e) {
      const msg = e instanceof ClientApiError ? e.message : "Failed to delete lead";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete lead</DialogTitle>
          <DialogDescription>
            This will permanently remove <span className="font-medium">{companyName}</span> and all of
            its notes and activities. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={submitting}>
            {submitting ? "Deleting…" : "Delete lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
