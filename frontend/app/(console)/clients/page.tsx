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

export default function ClientsPage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";

  const contracts = useQuery({ queryKey: ["contracts"], queryFn: () => api<any[]>("GET", "/clients/contracts") });
  const squadOptions = (squads.data || []).map((s: any) => ({ value: s.id, label: s.name }));

  if (contracts.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      {ROLES.isExec(role) ? (
        <FormDialog
          trigger={<Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New client</Button>}
          title="New client"
          fields={[
            { name: "companyName", label: "Company", required: true, placeholder: "Acme Retail Ltd." },
            { name: "contactName", label: "Contact name", placeholder: "Jane Chowdhury" },
            { name: "contactEmail", label: "Contact email", type: "email", required: true, placeholder: "jane@acme.com" },
          ]}
          submitLabel="Continue to contract"
          onSubmit={async (d) => {
            const client = await api<any>("POST", "/clients", d);
            await api("POST", "/clients/contracts", { clientId: client.id, title: `${d.companyName} engagement`, contractType: "FIXED_BID", totalValue: 200000 });
          }}
        />
      ) : null}

      {(contracts.data || []).map((c) => (
        <Card key={c.id}>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3">
            <CardTitle className="text-base">
              {c.title} <span className="ml-1 text-xs font-normal text-muted-foreground">{c.client?.companyName}</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
              <Badge variant="success" className="px-3 py-1">{taka(c.escrowBalance)} escrow</Badge>
              <Badge variant="info" className="px-3 py-1">{taka(c.totalValue)} value</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead><TableHead>Squad</TableHead><TableHead>Payout</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.milestones.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.milestoneName}</TableCell>
                    <TableCell>{m.assignedSquad?.name || "—"}</TableCell>
                    <TableCell className="tabular-nums text-emerald-700">{taka(m.payoutAmount)}</TableCell>
                    <TableCell><Badge variant={statusVariant(m.status)}>{m.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {ROLES.isExec(role) && m.status === "PENDING" ? (
                          <>
                            <FormDialog
                              trigger={<Button size="sm" variant="outline">+ Milestone</Button>}
                              title={`Add milestone to ${c.title}`}
                              fields={[
                                { name: "contractId", label: "Contract", type: "select", value: c.id, options: [{ value: c.id, label: c.title }] },
                                { name: "milestoneName", label: "Milestone name", required: true, placeholder: "MVP checkout flow" },
                                { name: "payoutAmount", label: "Payout (৳)", type: "number", value: 80000, required: true },
                              ]}
                              submitLabel="Add"
                              onSubmit={(d) => api("POST", "/clients/milestones", { ...d, payoutAmount: Number(d.payoutAmount) })}
                            />
                            <FormDialog
                              trigger={<Button size="sm" variant="outline">Fund escrow</Button>}
                              title={`Fund escrow — ${m.milestoneName}`}
                              fields={[{ name: "amount", label: "Amount (৳)", type: "number", value: Number(m.payoutAmount), required: true }]}
                              submitLabel="Fund"
                              onSubmit={(d) => api("POST", `/clients/milestones/${m.id}/escrow`, { amount: Number(d.amount) }, { idempotency: true })}
                            />
                          </>
                        ) : null}
                        {(ROLES.isExec(role) || ROLES.isPM(role)) && m.status === "PENDING" ? (
                          <FormDialog
                            trigger={<Button size="sm" variant="outline">Assign squad</Button>}
                            title={`Assign ${m.milestoneName}`}
                            fields={[{ name: "squadId", label: "Squad", type: "select", options: squadOptions }]}
                            submitLabel="Assign"
                            onSubmit={(d) => api("POST", `/clients/milestones/${m.id}/assign`, d)}
                          />
                        ) : null}
                        {m.status === "IN_PROGRESS" && ROLES.isCTO(role) ? (
                          <>
                            <Button size="sm" variant="success" onClick={() => action("POST", `/clients/milestones/${m.id}/cto-audit`, { pass: true }, false, "CTO passed — client review open")}>CTO pass</Button>
                            <Button size="sm" variant="destructive" onClick={() => action("POST", `/clients/milestones/${m.id}/cto-audit`, { pass: false }, false, "Sent back to development")}>CTO fail</Button>
                          </>
                        ) : null}
                        {m.status === "CLIENT_REVIEW" && (ROLES.isPM(role) || ROLES.isExec(role)) ? (
                          <>
                            <Button size="sm" variant="success" onClick={() => action("POST", `/clients/milestones/${m.id}/client-accept`, { accepted: true }, true, "Waterfall executed")}>Client accepts</Button>
                            <Button size="sm" variant="destructive" onClick={() => action("POST", `/clients/milestones/${m.id}/client-accept`, { accepted: false }, false, "Disputed — escrow frozen")}>Dispute</Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!c.milestones.length ? <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No milestones</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      {!(contracts.data || []).length ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No contracts yet</div>
      ) : null}
    </div>
  );
}
