"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { campaignCreateSchema, type CampaignCreateInput, type CampaignDto } from "@gtm/shared";
import { api, ClientApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function NewCampaignButton() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<CampaignCreateInput>({
    resolver: zodResolver(campaignCreateSchema),
    defaultValues: {
      dailyCap: 50,
      sendWindowStart: 9,
      sendWindowEnd: 17,
      jitterMinutes: 30,
      stopOnReply: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const c = await api<CampaignDto>("/campaigns", { method: "POST", body: values });
      toast.success("Campaign created");
      setOpen(false);
      form.reset();
      router.push(`/campaigns/${c.id}`);
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : "Failed to create campaign");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Defaults are sensible for local testing. You can tune the send window + daily cap later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name *</Label>
            <Input {...form.register("name")} placeholder="Dental clinics Q1 outreach" autoFocus />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              {...form.register("description")}
              rows={2}
              placeholder="Short note for your future self"
            />
          </div>
          <Field label="Daily cap" error={form.formState.errors.dailyCap?.message}>
            <Input type="number" min={1} max={2000} {...form.register("dailyCap")} />
          </Field>
          <Field label="Jitter (+/- min)" error={form.formState.errors.jitterMinutes?.message}>
            <Input type="number" min={0} max={180} {...form.register("jitterMinutes")} />
          </Field>
          <Field label="Window start (hour UTC)" error={form.formState.errors.sendWindowStart?.message}>
            <Input type="number" min={0} max={23} {...form.register("sendWindowStart")} />
          </Field>
          <Field label="Window end (hour UTC)" error={form.formState.errors.sendWindowEnd?.message}>
            <Input type="number" min={0} max={23} {...form.register("sendWindowEnd")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
