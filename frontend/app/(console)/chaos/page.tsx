"use client";

import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, taka } from "@/lib/utils";

export default function ChaosPage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";

  const events = useQuery({ queryKey: ["chaos"], queryFn: () => api<any[]>("GET", "/chaos/events?includeResolved=true") });
  const squadOptions = [{ value: "", label: "— studio-wide —" }, ...(squads.data || []).map((s: any) => ({ value: s.id, label: s.name }))];

  return (
    <div className="space-y-4">
      {ROLES.isCEO(role) ? (
        <FormDialog
          trigger={<Button size="sm" variant="destructive" className="gap-1.5"><Zap className="h-4 w-4" /> Trigger chaos</Button>}
          title="⚡ Inject chaos event"
          fields={[
            {
              name: "type",
              label: "Type",
              type: "select",
              options: [
                { value: "SERVER_OUTAGE", label: "SERVER_OUTAGE (timed penalty)" },
                { value: "SCOPE_CREEP", label: "SCOPE_CREEP" },
                { value: "LEAD_DEV_SICK_LEAVE", label: "LEAD_DEV_SICK_LEAVE (30-min lockout)" },
                { value: "CUSTOM", label: "CUSTOM" },
              ],
            },
            { name: "title", label: "Title", required: true, value: "Production database failure" },
            { name: "description", label: "Description", type: "textarea", required: true, value: "Primary PostgreSQL node crashed. Restore within 10 minutes or pay the fine." },
            { name: "targetSquadId", label: "Target squad", type: "select", options: squadOptions, value: "" },
            { name: "penaltyAmount", label: "Penalty (৳, optional)", type: "number", value: 5000 },
            { name: "timeLimitSeconds", label: "Time limit (seconds, min 10)", type: "number", value: 600 },
          ]}
          submitLabel="Trigger"
          onSubmit={(d) =>
            api("POST", "/chaos/events", {
              type: d.type,
              title: d.title,
              description: d.description,
              targetSquadId: d.targetSquadId || undefined,
              penaltyAmount: d.penaltyAmount ? Number(d.penaltyAmount) : undefined,
              timeLimitSeconds: d.timeLimitSeconds ? Number(d.timeLimitSeconds) : undefined,
            })
          }
        />
      ) : null}

      {events.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : events.data?.length ? (
        <div className="space-y-3">
          {events.data.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.title}</span>
                      <Badge variant="destructive">{e.type}</Badge>
                      {e.resolvedAt ? <Badge variant="success">RESOLVED</Badge> : <Badge variant="warning">OPEN</Badge>}
                      {e.penaltyAppliedAt ? <Badge variant="destructive">penalty applied</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      target {e.targetSquad?.name || e.targetUser?.fullName || "studio-wide"} ·{" "}
                      {e.penaltyAmount ? `penalty ${taka(e.penaltyAmount)}` : "no penalty"} · {dt(e.createdAt)}
                    </div>
                    {e.resolution ? <div className="mt-1.5 text-xs font-medium text-emerald-700">✔ {e.resolution}</div> : null}
                  </div>
                  {!e.resolvedAt ? (
                    <FormDialog
                      trigger={<Button size="sm" variant="success">Resolve</Button>}
                      title={`Resolve — ${e.title}`}
                      fields={[{ name: "resolution", label: "Resolution", type: "textarea", required: true, value: "Failed over to replica; service restored." }]}
                      submitLabel="Resolve"
                      onSubmit={(d) => api("POST", `/chaos/events/${e.id}/resolve`, d)}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No incidents — the studio is calm
        </div>
      )}
    </div>
  );
}
