"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, taka } from "@/lib/utils";

export default function FinancePage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";
  const execFinance = ROLES.isCFO(role) || ROLES.isCEO(role);

  const payouts = useQuery({ queryKey: ["payouts"], queryFn: () => api<any[]>("GET", "/sprint-payouts"), enabled: execFinance });
  const loans = useQuery({ queryKey: ["loans"], queryFn: () => api<any[]>("GET", "/loans") });
  const equity = useQuery({ queryKey: ["equity"], queryFn: () => api("GET", "/equity"), enabled: ROLES.isCFO(role) });
  const ledger = useQuery({
    queryKey: ["ledger"],
    queryFn: () => api<any[]>("GET", "/ledger/transactions?limit=12"),
    enabled: execFinance,
  });

  const squadOptions = (squads.data || []).map((s: any) => ({ value: s.id, label: s.name }));
  const mySquadOptions = (me.data?.squadMemberships || []).map((m: any) => ({ value: m.squad.id, label: m.squad.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {ROLES.isCFO(role) ? (
          <>
            <NewPayoutButton />
            <FormDialog
              trigger={<Button size="sm" variant="outline">Invest equity</Button>}
              title="Venture investment (10% stake, max 2 squads/sprint)"
              fields={[
                { name: "squadId", label: "Squad", type: "select", options: squadOptions },
                { name: "investedAmount", label: "Amount (৳)", type: "number", value: 15000, required: true },
              ]}
              submitLabel="Invest"
              onSubmit={(d) => api("POST", "/equity", { ...d, investedAmount: Number(d.investedAmount) })}
            />
          </>
        ) : null}
        {ROLES.isPM(role) ? (
          <FormDialog
            trigger={<Button size="sm" variant="outline">Apply for loan</Button>}
            title="Emergency loan (treasury must be under ৳15,000)"
            fields={[
              { name: "squadId", label: "Squad", type: "select", options: mySquadOptions },
              { name: "principalAmount", label: "Principal (৳)", type: "number", value: 20000, required: true },
            ]}
            submitLabel="Apply"
            onSubmit={(d) => api("POST", "/loans", { ...d, principalAmount: Number(d.principalAmount) })}
          />
        ) : null}
      </div>

      {execFinance ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Sprint payouts</CardTitle></CardHeader>
          <CardContent className="p-0">
            {payouts.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : payouts.data?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sprint</TableHead><TableHead>Status</TableHead><TableHead>Pool</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">Sprint {p.sprintNumber}</TableCell>
                      <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                      <TableCell className="tabular-nums text-emerald-700">{taka(p.totalPool)}</TableCell>
                      <TableCell className="text-right">
                        {ROLES.isCEO(role) && p.status === "PROPOSED" ? (
                          <Button size="sm" variant="success" className="mr-1.5" onClick={() => action("POST", `/sprint-payouts/${p.id}/ceo-approve`, undefined, false, "CEO approved")}>CEO approve</Button>
                        ) : null}
                        {ROLES.isCFO(role) && p.status === "APPROVED" ? (
                          <Button size="sm" onClick={() => action("POST", `/sprint-payouts/${p.id}/execute`, undefined, true, "Pool executed")}>Execute</Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No payouts yet.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex flex-wrap items-center gap-1.5">
            Emergency loans <span className="text-xs font-normal text-muted-foreground">treasury &lt; ৳15,000 · 15% interest · 2-of-3 board + CEO</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loans.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : loans.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Squad</TableHead><TableHead>Principal</TableHead><TableHead>Total due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.borrowerSquad?.name}</TableCell>
                    <TableCell className="tabular-nums">{taka(l.principalAmount)}</TableCell>
                    <TableCell className="tabular-nums">{taka(l.totalDue)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                      {!l.disbursedAt && l.status === "ACTIVE" ? <Badge variant="warning" className="ml-1">awaiting governance</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {ROLES.isCFO(role) && !l.disbursedAt ? (
                        <Button size="sm" className="mr-1.5" onClick={() => action("POST", `/loans/${l.id}/approve`, undefined, true, "Disbursed")}>Disburse</Button>
                      ) : null}
                      {l.status === "ACTIVE" && l.disbursedAt && (ROLES.isPM(role) || ROLES.isCEO(role)) ? (
                        <Button size="sm" variant="success" onClick={() => action("POST", `/loans/${l.id}/repay`, undefined, true, "Repaid")}>Repay</Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No loans.</div>
          )}
        </CardContent>
      </Card>

      {ROLES.isCFO(role) && equity.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Venture equity <span className="ml-1 text-sm text-emerald-700">dividends {taka(equity.data.dividendsReceived)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {equity.data.stakes.length ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Squad</TableHead><TableHead>Stake</TableHead><TableHead>Invested</TableHead><TableHead>Sprint</TableHead><TableHead>Active</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {equity.data.stakes.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.squad?.name}</TableCell>
                      <TableCell>{Math.round(Number(s.stakePercent) * 100)}%</TableCell>
                      <TableCell className="tabular-nums">{taka(s.investedAmount)}</TableCell>
                      <TableCell>{s.sprintNumber}</TableCell>
                      <TableCell>{s.isActive ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No stakes yet.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {execFinance && ledger.data ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Ledger feed</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ledger.data.map((t) => {
              const amt = t.entries.filter((e: any) => e.direction === "DEBIT").reduce((a: number, e: any) => a + Number(e.amount), 0);
              return (
                <div key={t.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 text-sm rounded-lg border p-2.5 sm:p-0 sm:border-0">
                  <Badge variant="info" className="shrink-0">{t.referenceType}</Badge>
                  <span className="tabular-nums font-semibold text-emerald-700">{taka(amt)}</span>
                  <span className="truncate text-muted-foreground min-w-0 flex-1">{t.description}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{dt(t.createdAt)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function NewPayoutButton() {
  const squads = useSquads();
  const [open, setOpen] = React.useState(false);
  const [sprint, setSprint] = React.useState(1);
  const [ranks, setRanks] = React.useState<Record<string, number>>({});
  const [busy, setBusy] = React.useState(false);

  const sorted = React.useMemo(
    () => [...(squads.data || [])].sort((a, b) => b.balance - a.balance),
    [squads.data],
  );

  React.useEffect(() => {
    if (open && !Object.keys(ranks).length) {
      const initial: Record<string, number> = {};
      sorted.forEach((s, i) => (initial[s.id] = i + 1));
      setRanks(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    setBusy(true);
    try {
      await api("POST", "/sprint-payouts", {
        sprintNumber: sprint,
        rankings: sorted.map((s) => ({ squadId: s.id, rank: ranks[s.id] })),
      });
      toast.success("Payout proposed — awaiting CEO approval");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>New sprint payout</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border bg-background p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg font-bold">Rank the squads</h3>
            <p className="text-xs text-muted-foreground">Distribution: 50k / 35k / 25k / 20k / 15k / 5k — ranks must be unique.</p>
            <div className="mt-3 text-xs font-semibold text-muted-foreground">Sprint number</div>
            <input type="number" min={1} value={sprint} onChange={(e) => setSprint(Number(e.target.value))} className="mt-1 w-24 rounded-md border border-input bg-card px-3 py-1.5 text-sm" />
            <div className="mt-4 space-y-2">
              {sorted.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    <b>{s.name}</b> <span className="text-xs text-muted-foreground">({taka(s.balance)})</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={sorted.length}
                    value={ranks[s.id] ?? ""}
                    onChange={(e) => setRanks((p) => ({ ...p, [s.id]: Number(e.target.value) }))}
                    className="h-8 w-16 rounded-md border border-input bg-card px-2 text-center text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit for CEO approval"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
