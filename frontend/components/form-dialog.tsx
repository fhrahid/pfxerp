"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "textarea" | "select" | "datetime" | "datetime-local" | "date" | "checkbox";
  options?: { value: string; label: string }[];
  value?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

interface FormDialogProps {
  trigger?: React.ReactNode;
  /** Controlled mode — enables opening the dialog programmatically (e.g. drag & drop). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel: string;
  onSubmit: (data: Record<string, any>) => Promise<unknown> | unknown;
  wide?: boolean;
  extra?: React.ReactNode;
}

/**
 * Generic form dialog: renders a configured field set, validates required
 * inputs client-side, and surfaces API errors as toasts.
 */
export function FormDialog({ trigger, open, onOpenChange, title, description, fields, submitLabel, onSubmit, wide, extra }: FormDialogProps) {
  const [innerOpen, setInnerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const isOpen = open !== undefined ? open : innerOpen;
  const setOpen = (v: boolean) => {
    setInnerOpen(v);
    onOpenChange?.(v);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, any> = {};
    for (const f of fields) {
      if (f.type === "checkbox") data[f.name] = form.get(f.name) === "on";
      else data[f.name] = form.get(f.name);
    }
    setBusy(true);
    try {
      await onSubmit(data);
      setOpen(false);
      toast.success("Done");
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={cn("sm:max-w-lg", wide && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {extra}
        <form onSubmit={handleSubmit} className="grid gap-4">
          {fields.map((f) => (
            <div key={f.name} className={cn("grid gap-2", f.type === "checkbox" && "flex items-center gap-2")}>
              {f.type === "checkbox" ? (
                <>
                  <Checkbox id={`fd-${f.name}`} name={f.name} defaultChecked={Boolean(f.value)} />
                  <Label htmlFor={`fd-${f.name}`}>{f.label}</Label>
                </>
              ) : (
                <>
                  <Label htmlFor={`fd-${f.name}`}>{f.label}</Label>
                  <FieldInput field={f} />
                </>
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field: f }: { field: FormField }) {
  const id = `fd-${f.name}`;
  if (f.type === "select") {
    return <SelectField id={id} field={f} />;
  }
  if (f.type === "textarea") {
    return <Textarea id={id} name={f.name} required={f.required} placeholder={f.placeholder} defaultValue={String(f.value ?? "")} />;
  }
  return (
    <Input
      id={id}
      name={f.name}
      type={f.type === "datetime" || f.type === "datetime-local" ? "datetime-local" : f.type || "text"}
      required={f.required}
      placeholder={f.placeholder}
      defaultValue={f.value === undefined || f.value === null || typeof f.value === "boolean" ? "" : f.value}
      min={f.min}
      max={f.max}
      step={f.step}
      className={f.hint === "mono" ? "font-mono text-xs" : undefined}
    />
  );
}

function SelectField({ id, field }: { id: string; field: FormField }) {
  const [value, setValue] = React.useState<string>(
    field.value !== undefined && field.value !== null ? String(field.value) : field.options?.[0]?.value ?? "",
  );
  return (
    <>
      <input type="hidden" name={field.name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={field.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
