"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { taka } from "@/lib/utils";

export default function BountyPage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";

  const targets = useQuery({ queryKey: ["bounty-targets"], queryFn: () => api<any[]>("GET", "/bounty/targets") });
  const reports = useQuery({ queryKey: ["bounty-reports"], queryFn: () => api<any[]>("GET", "/bounty/reports") });

  const mySquadOptions = (me.data?.squadMemberships || []).map((m: any) => ({ value: m.squad.id, label: m.squad.name }));
  const allSquadOptions = (squads.data || []).map((s: any) => ({ value: s.id, label: s.name }));
  const activeTargets = (targets.data || []).filter((t: any) => t.isActive);

  if (targets.isLoading || reports.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {ROLES.isDev(role) && activeTargets.length ? (
          <FormDialog
            trigger={<Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Submit bug report</Button>}
            title="Submit bug report (cross-squad only)"
            description="2-sprint cooldown applies to former squads · max 5 per sprint."
            fields={[
              {
                name: "bountyTargetId",
                label: "Target",
                type: "select",
                options: activeTargets.map((t: any) => ({ value: t.id, label: `${t.title} — ${t.targetSquadName}` })),
              },
              { name: "title", label: "Title", required: true },
              {
                name: "severity",
                label: "Severity",
                type: "select",
                options: [
                  { value: "CRITICAL", label: "CRITICAL (৳5,000)" },
                  { value: "MAJOR", label: "MAJOR (৳3,000)" },
                  { value: "MINOR", label: "MINOR (৳1,000)" },
                  { value: "LOW", label: "LOW (৳500)" },
                ],
              },
              { name: "description", label: "Description (min 20 chars)", type: "textarea", required: true },
              { name: "reproductionSteps", label: "Reproduction steps (min 30 chars)", type: "textarea", required: true, value: "1. Send GET to /api/search?q=' OR 1=1--\n2. Observe database dump in response." },
            ]}
            submitLabel="Submit"
            onSubmit={async (d) => {
              const target = activeTargets.find((t: any) => t.id === d.bountyTargetId);
              await api("POST", "/bounty/reports", { ...d, targetSquadId: target.targetSquadId });
            }}
          />
        ) : null}
        {(ROLES.isCTO(role) || ROLES.isPM(role)) ? (
          <FormDialog
            trigger={<Button size="sm" variant="outline">Fund target pool</Button>}
            title="Fund bounty target (escrow from squad treasury)"
            fields={[
              { name: "title", label: "Title", required: true, value: "Hardening target" },
              { name: "targetSquadId", label: "Target squad", type: "select", options: ROLES.isPM(role) ? mySquadOptions : allSquadOptions },
              { name: "totalBountyPool", label: "Pool (min 5000)", type: "number", value: 10000, required: true },
            ]}
            submitLabel="Fund"
            onSubmit={(d) => api("POST", "/bounty/targets", { ...d, totalBountyPool: Number(d.totalBountyPool) })}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Active targets</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Title</TableHead><TableHead>Target squad</TableHead><TableHead>Pool remaining</TableHead><TableHead>Open bugs</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {activeTargets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{t.targetSquadName}</TableCell>
                  <TableCell className="tabular-nums text-emerald-700">{taka(t.remainingPool)} / {taka(t.totalBountyPool)}</TableCell>
                  <TableCell>{t.openBugCount}</TableCell>
                </TableRow>
              ))}
              {!activeTargets.length ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No targets</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reports</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Hunter</TableHead><TableHead>Bounty</TableHead>
                {ROLES.isCTO(role) ? <TableHead className="text-right">Triage</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reports.data || []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.severity)}>{r.severity}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{r.reportingUser?.fullName} ({r.reportingSquad?.name})</TableCell>
                  <TableCell className="tabular-nums text-emerald-700">{r.bountyAmount ? taka(r.bountyAmount) : "—"}</TableCell>
                  {ROLES.isCTO(role) ? (
                    <TableCell className="text-right">
                      {r.status === "SUBMITTED" ? (
                        <>
                          <FormDialog
                            trigger={<Button size="sm" variant="success" className="mr-1.5">Verify</Button>}
                            title="Verify & pay bounty"
                            fields={[
                              {
                                name: "severity",
                                label: "Severity",
                                type: "select",
                                value: r.severity,
                                options: ["CRITICAL", "MAJOR", "MINOR", "LOW"].map((s) => ({ value: s, label: s })),
                              },
                              { name: "notes", label: "Notes", type: "textarea", value: "Verified in staging replica." },
                            ]}
                            submitLabel="Verify & pay"
                            onSubmit={(d) => api("POST", `/bounty/reports/${r.id}/triage`, { action: "VERIFY", severity: d.severity, notes: d.notes })}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => action("POST", `/bounty/reports/${r.id}/triage`, { action: "REJECT", notes: "Not reproducible" }, false, "Rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      ) : "—"}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {!(reports.data || []).length ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No reports</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
