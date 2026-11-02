"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { StatCard } from "@/components/blocks";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { dt } from "@/lib/utils";

export default function ConsultancyPage() {
  const me = useMe();
  const action = useAction();
  const role = me.data?.role || "";

  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => api<any[]>("GET", "/cto/consultancy/bookings") });
  const consultants = useQuery({ queryKey: ["consultants"], queryFn: () => api<any[]>("GET", "/cto/certifications/consultants") });
  const mySquadOptions = (me.data?.squadMemberships || []).map((m: any) => ({ value: m.squad.id, label: m.squad.name }));
  const consultantOptions = (consultants.data || []).map((c: any) => ({ value: c.id, label: `${c.fullName} (${c.role})` }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Session fee" value="৳4,000" sub="escrowed at booking" tone="money" icon={CalendarClock} />
        <StatCard label="Consultant receives" value="৳2,000" sub="50% · rest to reserve" />
        <StatCard label="Bookable consultants" value={consultants.data?.length ?? "…"} sub="weekly cap: 2 sessions" />
      </div>

      {ROLES.isPM(role) && consultantOptions.length ? (
        <FormDialog
          trigger={<Button size="sm">Book a session</Button>}
          title="Book consultancy (৳4,000 escrow)"
          fields={[
            { name: "consultantId", label: "Consultant", type: "select", options: consultantOptions },
            { name: "clientSquadId", label: "Client squad", type: "select", options: mySquadOptions },
            { name: "scheduledAt", label: "Scheduled at", type: "datetime", required: true, value: new Date(Date.now() + 864e5).toISOString().slice(0, 16) },
          ]}
          submitLabel="Book & escrow"
          onSubmit={(d) => api("POST", "/cto/consultancy/bookings", d, { idempotency: true })}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          {bookings.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : bookings.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead><TableHead>Client squad</TableHead><TableHead>Scheduled</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.consultant?.fullName}</TableCell>
                    <TableCell>{b.clientSquad?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{dt(b.scheduledAt)}</TableCell>
                    <TableCell><Badge variant={statusVariant(b.status)}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {b.status === "SCHEDULED" && b.consultantId === me.data?.id ? (
                        <FormDialog
                          trigger={<Button size="sm" variant="success" className="mr-1.5">Complete</Button>}
                          title="Complete session"
                          description="Min 50 words + at least one PR link."
                          fields={[
                            { name: "meetingNotes", label: "Meeting notes (min 50 words)", type: "textarea", required: true, value: "Fifteen minute architecture session covering domain boundaries, Prisma schema partitioning decisions, repository interfaces for payment adapters, and the migration order agreed with the whole squad for the next sprint together." },
                            { name: "prLinks", label: "PR links (one per line)", type: "textarea", required: true, value: "https://github.com/pointfex/squad-1/pull/104" },
                          ]}
                          submitLabel="Complete & settle"
                          onSubmit={(d) => api("POST", `/cto/consultancy/bookings/${b.id}/complete`, d)}
                        />
                      ) : null}
                      {b.status === "SCHEDULED" && ROLES.isPM(role) ? (
                        <Button size="sm" variant="destructive" onClick={() => action("POST", `/cto/consultancy/bookings/${b.id}/cancel`, undefined, false, "Cancelled & refunded")}>
                          Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No bookings.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
