"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Landmark, TriangleAlert } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { taka, dt } from "@/lib/utils";

export default function AccountingPage() {
  const me = useMe();
  const qc = useQueryClient();
  const action = useAction();
  const squads = useSquads();
  const role = me.data?.role || "";
  const isCeo = ROLES.isCEO(role);
  const isCfo = ROLES.isCFO(role);
  const accounts = useQuery({ queryKey: ["accounting-accounts"], queryFn: () => api<any[]>("GET", "/ledger/accounts") });
  const requests = useQuery({
    queryKey: ["pool-funding-requests"], queryFn: () => api<any[]>("GET", "/ledger/pool-funding/requests"),
    enabled: isCeo || isCfo,
  });
  const reconciliation = useQuery({
    queryKey: ["ledger-reconciliation"],
    queryFn: () => api<any>("POST", "/ledger/verify-chain"),
    enabled: isCeo,
    staleTime: 60_000,
  });
  const [selected, setSelected] = React.useState("");
  const activeId = (accounts.data || []).some((a) => a.id === selected) ? selected : accounts.data?.[0]?.id;
  const activeAccount = (accounts.data || []).find((a: any) => a.id === activeId);
  const entries = useQuery({
    queryKey: ["accounting-entries", activeId], queryFn: () => api<any[]>("GET", `/ledger/accounts/${activeId}/entries`), enabled: Boolean(activeId),
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["accounting-accounts"] });
    await qc.invalidateQueries({ queryKey: ["accounting-entries"] });
    await qc.invalidateQueries({ queryKey: ["pool-funding-requests"] });
  };

  if (accounts.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  const squadsWithTreasury = (squads.data || []).filter((s: any) => s.isActive);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Accounting</h1>
        <p className="text-sm text-muted-foreground">Immutable double-entry ledger · debits and credits are scoped by role.</p>
      </div>

      {isCeo && reconciliation.data?.totalBalanceDiscrepancies > 0 ? (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300"><TriangleAlert className="h-4 w-4" /> Opening-balance reconciliation needed</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{reconciliation.data.totalBalanceDiscrepancies} account(s) differ from available ledger history. Hash chain: {reconciliation.data.brokenEntriesCount ? "BROKEN" : "intact"}.</p>
            <p className="text-muted-foreground">This can indicate balances created before the ledger was enabled. No automatic adjustment was made. Confirm the opening date and source against bank records before recording an adjustment.</p>
            {reconciliation.data.balanceDiscrepancies.slice(0, 5).map((d: any) => <div key={d.accountId} className="flex justify-between gap-2 border-t pt-1 text-xs"><span>{d.type} · {d.squadId || d.ownerId || d.accountId}</span><span>book {taka(d.currentBalance)} · journal {taka(d.ledgerBalance)} · difference {taka(d.difference)}</span></div>)}
          </CardContent>
        </Card>
      ) : null}

      {(isCfo || isCeo) ? (
        <div className="flex flex-wrap gap-2">
          {isCfo ? <FormDialog
            trigger={<Button size="sm" className="gap-2"><Landmark className="h-4 w-4" /> Allocate reserve to squad</Button>}
            title="Allocate funds to squad treasury"
            description="Moves existing funds from SYSTEM_RESERVE. This does not create or mint money."
            fields={[
              { name: "squadId", label: "Active squad", type: "select", options: squadsWithTreasury.map((s: any) => ({ value: s.id, label: s.name })), required: true },
              { name: "amount", label: "Amount (BDT)", type: "number", min: 0.01, step: 0.01, required: true },
            ]}
            submitLabel="Allocate"
            onSubmit={async (d) => {
              await api("POST", "/ledger/allocate", { squadId: d.squadId, amount: Number(d.amount) }, { headers: { "X-Idempotency-Key": crypto.randomUUID() } });
              await refresh();
            }}
          /> : null}
          {isCfo ? <FormDialog
            trigger={<Button size="sm" variant="outline">Request pool funding</Button>}
            title="Request external pool funding"
            description="A CEO must approve. The pool is credited only after approval; no direct CFO funding."
            fields={[{ name: "amount", label: "Amount (BDT)", type: "number", min: 0.01, step: 0.01, required: true }, { name: "memo", label: "Source / reason", type: "textarea", required: true }]}
            submitLabel="Send for CEO approval"
            onSubmit={async (d) => { await api("POST", "/ledger/pool-funding/requests", { amount: Number(d.amount), memo: d.memo }); await refresh(); }}
          /> : null}
          {isCeo ? <FormDialog
            trigger={<Button size="sm" variant="outline">Add external pool capital</Button>}
            title="Add external capital to system reserve"
            description="Creates an auditable balanced capital-injection entry. Record the real funding source."
            fields={[{ name: "amount", label: "Amount (BDT)", type: "number", min: 0.01, step: 0.01, required: true }, { name: "memo", label: "Source / reference", type: "textarea", required: true }]}
            submitLabel="Record capital injection"
            onSubmit={async (d) => { await api("POST", "/ledger/pool-funding/direct", { amount: Number(d.amount), memo: d.memo }, { headers: { "X-Idempotency-Key": crypto.randomUUID() } }); await refresh(); }}
          /> : null}
        </div>
      ) : null}

      {(isCfo || isCeo) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">CFO pool funding requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(requests.data || []).map((r: any) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div><div className="font-medium">{taka(r.amount)} · {r.memo}</div><div className="text-xs text-muted-foreground">Requested by {r.requestedBy?.fullName} · {dt(r.createdAt)}</div></div>
              <div className="flex items-center gap-2"><Badge variant={r.status === "APPROVED" ? "success" : r.status === "PENDING" ? "warning" : "muted"}>{r.status}</Badge>
                {isCeo && r.status === "PENDING" ? <Button size="sm" onClick={async () => { await action("POST", `/ledger/pool-funding/requests/${r.id}/approve`); await refresh(); }}>Approve</Button> : null}
              </div>
            </div>)}
            {!requests.data?.length ? <p className="text-sm text-muted-foreground">No funding requests.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
        <Card><CardHeader><CardTitle className="text-base">Accounts in your scope</CardTitle></CardHeader><CardContent className="space-y-2">
          {(accounts.data || []).map((a: any) => <button key={a.id} onClick={() => setSelected(a.id)} className={`w-full rounded-lg border p-3 text-left ${activeId === a.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{a.type.replace(/_/g, " ")}</span><Badge variant={a.isFrozen ? "destructive" : "muted"}>{a.isFrozen ? "FROZEN" : "OPEN"}</Badge></div>
            <div className="mt-1 text-lg font-bold tabular-nums">{taka(a.balance)}</div>
          </button>)}
          {(isCfo || isCeo) && activeAccount?.type === "SQUAD_TREASURY" ? <Button size="sm" variant="outline" className="w-full" onClick={async () => {
            const squad = squadsWithTreasury.find((s: any) => s.id === activeAccount.squadId);
            if (!window.confirm(`Return ${taka(activeAccount.balance)} from ${squad?.name || "this squad"} to system reserve? This is a ledgered transfer and can be reallocated by the CFO.`)) return;
            await action("POST", `/ledger/squads/${activeAccount.squadId}/return-funds`, undefined, true, "Unspent funds returned to reserve");
            await refresh();
          }}>Return balance to reserve</Button> : null}
          {!accounts.data?.length ? <p className="text-sm text-muted-foreground">No accounts in scope.</p> : null}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Account activity · latest 100 entries</CardTitle></CardHeader><CardContent className="p-0">
          {entries.isLoading ? <Skeleton className="m-4 h-40" /> : <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>
            {(entries.data || []).map((e: any) => <TableRow key={e.id}><TableCell className="whitespace-nowrap text-xs">{dt(e.createdAt)}</TableCell><TableCell className="text-xs">{e.transaction.referenceType}</TableCell><TableCell className="max-w-[240px] truncate text-xs">{e.transaction.description || "—"}</TableCell><TableCell className="text-right tabular-nums">{e.direction === "DEBIT" ? taka(e.amount) : "—"}</TableCell><TableCell className="text-right tabular-nums">{e.direction === "CREDIT" ? taka(e.amount) : "—"}</TableCell></TableRow>)}
          </TableBody></Table>}
          {!entries.data?.length && !entries.isLoading ? <p className="p-5 text-sm text-muted-foreground">No ledger entries for this account.</p> : null}
        </CardContent></Card>
      </div>
      <div className="text-xs text-muted-foreground"><ArrowDownLeft className="mr-1 inline h-3 w-3" />Debit · <ArrowUpRight className="mr-1 inline h-3 w-3" />Credit. Personal wallets are visible only to their owner and CEO/CFO; PMs see their own squad treasury.</div>
    </div>
  );
}
