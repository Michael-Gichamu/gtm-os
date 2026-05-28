"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { leadCreateSchema, type LeadCreateInput, type PipelineStageDto } from "@gtm/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NewLeadButton({ stages }: { stages: PipelineStageDto[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<LeadCreateInput>({
    resolver: zodResolver(leadCreateSchema),
    defaultValues: {
      pipelineStageId: stages[0]?.id,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await api("/leads", { method: "POST", body: values });
      toast.success("Lead created");
      setOpen(false);
      form.reset({ pipelineStageId: stages[0]?.id });
      router.refresh();
    } catch (e) {
      const msg = e instanceof ClientApiError ? e.message : "Failed to create lead";
      toast.error(msg);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>
            Universal schema — works for any industry. Only company name is required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name *" error={form.formState.errors.companyName?.message}>
            <Input {...form.register("companyName")} placeholder="Acme Industries" autoFocus />
          </Field>
          <Field label="Industry" error={form.formState.errors.industry?.message}>
            <Input {...form.register("industry")} placeholder="Dental, Automotive…" />
          </Field>
          <Field label="Contact name">
            <Input {...form.register("contactName")} placeholder="Jane Doe" />
          </Field>
          <Field label="Role">
            <Input {...form.register("role")} placeholder="Founder, CEO…" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} placeholder="jane@acme.com" />
          </Field>
          <Field label="Phone">
            <Input {...form.register("phone")} placeholder="+254…" />
          </Field>
          <Field label="Website" error={form.formState.errors.website?.message}>
            <Input {...form.register("website")} placeholder="https://acme.com" />
          </Field>
          <Field label="LinkedIn URL" error={form.formState.errors.linkedinUrl?.message}>
            <Input {...form.register("linkedinUrl")} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="City">
            <Input {...form.register("city")} placeholder="Nairobi" />
          </Field>
          <Field label="Country">
            <Input {...form.register("country")} placeholder="Kenya" />
          </Field>
          <Field label="Stage">
            <Select
              defaultValue={stages[0]?.id}
              onValueChange={(v) => form.setValue("pipelineStageId", v)}
            >
              <SelectTrigger><SelectValue placeholder="Pick stage" /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Confidence (0–100)" error={form.formState.errors.confidenceScore?.message}>
            <Input type="number" min={0} max={100} {...form.register("confidenceScore")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Personalization note">
              <Textarea
                {...form.register("personalization")}
                placeholder="One-line angle for outreach — e.g. opened new branch in Karen last month"
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Create lead"}
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
