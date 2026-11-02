"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, taka } from "@/lib/utils";

export default function QualityPage() {
  const me = useMe();
  const role = me.data?.role || "";

  const citations = useQuery({ queryKey: ["citations"], queryFn: () => api("GET", "/cto/citations?limit=10"), enabled: ROLES.isCTO(role) });
  const queue = useQuery({ queryKey: ["cert-queue"], queryFn: () => api("GET", "/cto/certifications/queue"), enabled: ROLES.isCTO(role) });
  const myCerts = useQuery({ queryKey: ["my-certs"], queryFn: () => api<any[]>("GET", "/cto/certifications/me") });
  const squads = useQuery({ queryKey: ["squads"], queryFn: () => api<any[]>("GET", "/squads"), enabled: ROLES.isCTO(role) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <FormDialog
          trigger={<Button size="sm" variant="outline">Apply for certification</Button>}
          title="Apply for provider certification"
          description="CTO-reviewed · score ≥ 80 approves · valid 90 days"
          fields={[
            {
              name: "certificationType",
              label: "Type",
              type: "select",
              options: ["CONSULTANT", "MARKETPLACE_AUTHOR", "SECURITY_RESEARCHER"].map((t) => ({ value: t, label: t })),
            },
            { name: "portfolioUrl", label: "Portfolio URL", value: "https://github.com/your-handle" },
            { name: "applicationNotes", label: "Application notes", type: "textarea", value: "Enterprise microservice experience; authored studio libraries." },
          ]}
          submitLabel="Apply"
          onSubmit={(d) => api("POST", "/cto/certifications/apply", d)}
        />
        {ROLES.isCTO(role) ? (
          <FormDialog
            trigger={<Button size="sm" variant="destructive" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Issue citation</Button>}
            title="Issue code audit citation (৳2,000 → ৳1,000 CTO + ৳1,000 reserve)"
            fields={[
              { name: "squadId", label: "Squad", type: "select", options: (squads.data || []).map((s: any) => ({ value: s.id, label: s.name })) },
              {
                name: "type",
                label: "Type",
                type: "select",
                options: ["CODE_SMELL", "BAD_MERGE_REQUEST", "SECURITY_VULNERABILITY"].map((t) => ({ value: t, label: t })),
              },
              { name: "description", label: "Description (min 15 chars)", type: "textarea", required: true, value: "God class with 14 responsibilities detected in UserService." },
            ]}
            submitLabel="Issue fine"
            onSubmit={(d) => api("POST", "/cto/citations", d, { idempotency: true })}
          />
        ) : null}
      </div>

      {ROLES.isCTO(role) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Certification queue ({queue.data?.pendingCount ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {queue.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : queue.data?.queue?.length ? (
              queue.data.queue.map((c: any) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{c.applicantName} — {c.certificationType}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.portfolioUrl} {c.applicationNotes}</div>
                  </div>
                  <FormDialog
                    trigger={<Button size="sm">Review & score</Button>}
                    title={`Review ${c.applicantName}`}
                    description="≥80 approves · <80 = 7-day cooldown"
                    fields={[
                      { name: "qualityScore", label: "Score (0-100)", type: "number", value: 86, required: true, min: 0, max: 100 },
                      { name: "action", label: "Action", type: "select", options: [{ value: "APPROVE", label: "APPROVE (needs ≥80)" }, { value: "REJECT", label: "REJECT (<80)" }] },
                      { name: "notes", label: "Review notes", type: "textarea", value: "Strong grasp of distributed locking and defensive indexing." },
                    ]}
                    submitLabel="Submit review"
                    onSubmit={(d) => api("POST", `/cto/certifications/${c.id}/review`, { ...d, qualityScore: Number(d.qualityScore) })}
                  />
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Queue is empty.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {ROLES.isCTO(role) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent code audit citations</CardTitle></CardHeader>
          <CardContent className="p-0">
            {citations.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : citations.data?.items?.length ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Squad</TableHead><TableHead>Type</TableHead><TableHead>Fine</TableHead><TableHead>When</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {citations.data.items.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.squad?.name}</TableCell>
                      <TableCell><Badge variant="warning">{c.type}</Badge></TableCell>
                      <TableCell className="tabular-nums text-emerald-700">{taka(c.fineAmount)}</TableCell>
                      <TableCell className="text-muted-foreground">{dt(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No citations issued.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">My certifications</CardTitle></CardHeader>
        <CardContent>
          {myCerts.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {myCerts.data.map((c: any) => (
                <Badge key={c.id} variant={c.isPreapproved ? "success" : "warning"} className="px-3 py-1">
                  {c.certificationType} {c.isPreapproved ? "✓" : "pending"}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              None yet — apply for CONSULTANT, MARKETPLACE_AUTHOR or SECURITY_RESEARCHER above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
