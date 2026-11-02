"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<any[]>("GET", "/settings") });

  if (settings.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Key</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead className="text-right"></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {(settings.data || []).map((s) => (
              <SettingRow key={s.key} setting={s} onSaved={() => qc.invalidateQueries({ queryKey: ["settings"] })} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SettingRow({ setting: s, onSaved }: { setting: any; onSaved: () => void }) {
  const [value, setValue] = React.useState(s.value);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await api("PUT", "/settings", { key: s.key, value, type: s.type });
      toast.success(`${s.key} saved`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-semibold">{s.key}</TableCell>
      <TableCell><Badge variant="muted">{s.type}</Badge></TableCell>
      <TableCell>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-56 rounded-md border border-input bg-card px-2.5 text-sm"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={busy || value === s.value} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
