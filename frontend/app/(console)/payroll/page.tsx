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
import { Skeleton } from "@/components/ui/skeleton";
import { taka } from "@/lib/utils";

const TIER_CAPS: Record<string, number> = { STAR_PERFORMER: 3500, REGULAR: 2000, UNDERPERFORMER: 1000, SLACKER: 0 };

export default function PayrollPage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";
  const isChro = ROLES.isCPO(role) || ROLES.isCEO(role);
  const [status, setStatus] = React.useState("SUBMITTED");

  const proposals = useQuery({
    queryKey: ["payroll", isChro ? status : "mine"],
    queryFn: () => api<any[]>("GET", isChro ? `/payroll?status=${status}` : "/payroll"),
  });

  const mySquadOptions = (me.data?.squadMemberships || []).map((m: any) => ({ value: m.squad.id, label: m.squad.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isChro
          ? ["SUBMITTED", "APPROVED", "REJECTED"].map((s) => (
              <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))
          : null}
        <div className="flex-1" />
        {ROLES.isPM(role) ? <CreateProposalButton squadOptions={mySquadOptions} /> : null}
        {ROLES.isCPO(role) ? (
          <FormDialog
            trigger={<Button size="sm" variant="destructive">Slacker fine</Button>}
            title="Slacker fine (৳2,000 — ৳500 CPO / ৳1,500 reserve)"
            fields={[
              { name: "targetUserId", label: "Target user ID (from People)", required: true, hint: "mono" },
              { name: "targetSquadId", label: "Squad", type: "select", options: (squads.data || []).map((s: any) => ({ value: s.id, label: s.name })) },
              { name: "reason", label: "Reason", type: "textarea", required: true, value: "Zero commits and missed standup this lab." },
            ]}
            submitLabel="Issue fine"
            onSubmit={(d) => api("POST", "/fines/slacker", d, { idempotency: true })}
          />
        ) : null}
      </div>

      {proposals.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : proposals.data?.length ? (
        <div className="space-y-3">
          {proposals.data.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3">
                <CardTitle className="text-sm">
                  {p.squad?.name} · Lab {p.labNumber} · <span className="text-emerald-700">{taka(p.totalProposed)}</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  {(ROLES.isCEO(role) || (ROLES.isPM(role) && (me.data?.squadMemberships || []).some((m: any) => m.squad.id === p.squadId && m.role === "PM"))) && p.status === "SUBMITTED" ? (
                    <>
                      <Button size="sm" variant="success" onClick={() => action("POST", `/payroll/${p.id}/approve`, undefined, true, ROLES.isPM(role) ? "Salary disbursed" : "Approved & disbursed")}>
                        {ROLES.isPM(role) ? "Disburse salary" : "CEO override: disburse"}
                      </Button>
                      {isChro ? <FormDialog
                        trigger={<Button size="sm" variant="destructive">Reject</Button>}
                        title="Reject payroll proposal"
                        fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
                        submitLabel="Reject"
                        onSubmit={(d) => api("POST", `/payroll/${p.id}/reject`, d)}
                      /> : null}
                    </>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {p.lineItems.map((li: any) => (
                  <div key={li.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{li.user?.fullName || li.userId.slice(0, 8)}</span>
                    <Badge variant="muted">{li.tier}</Badge>
                    <span className="tabular-nums text-emerald-700">{taka(li.amount)}</span>
                    {li.justification ? <span className="truncate text-xs italic text-muted-foreground">{li.justification}</span> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No proposals</div>
      )}
    </div>
  );
}

function CreateProposalButton({ squadOptions }: { squadOptions: { value: string; label: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [squadId, setSquadId] = React.useState(squadOptions[0]?.value || "");
  const [lab, setLab] = React.useState(1);
  const [rows, setRows] = React.useState<{ userId: string; name: string; tier: string; amount: number }[]>([]);
  const [busy, setBusy] = React.useState(false);

  const total = rows.reduce((a, r) => a + (r.amount || 0), 0);

  async function openDialog() {
    setOpen(true);
    if (!squadId || !rows.length) {
      try {
        const detail = await api<any>("GET", `/squads/${squadId || squadOptions[0]?.value}`);
        setSquadId(detail.id);
        setRows(detail.members.map((m: any) => ({ userId: m.userId, name: m.fullName, tier: "REGULAR", amount: TIER_CAPS.REGULAR })));
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await api("POST", "/payroll", {
        squadId,
        labNumber: lab,
        lineItems: rows.map((r) => ({ userId: r.userId, tier: r.tier, amount: r.amount, justification: "via console" })),
      });
      toast.success("Proposal submitted");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={openDialog}>+ New proposal</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-4 sm:p-6 shadow-xl thin-scroll">
            <h3 className="text-lg font-bold">Distribute lab payroll (budget ৳10,000)</h3>
            <div className="mt-1 text-xs text-muted-foreground">Lab number</div>
            <input
              type="number"
              min={1}
              value={lab}
              onChange={(e) => setLab(Number(e.target.value))}
              className="mt-1 w-24 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
            />
            <div className="mt-4 space-y-3">
              {rows.map((r, i) => (
                <div key={r.userId} className="flex flex-col sm:grid sm:grid-cols-[1fr_150px_90px] sm:items-center gap-1.5 sm:gap-2 rounded-lg border sm:border-0 p-2.5 sm:p-0 bg-muted/20 sm:bg-transparent">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="grid grid-cols-2 sm:contents gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                      value={r.tier}
                      onChange={(e) => {
                        const tier = e.target.value;
                        setRows((prev) => prev.map((row, j) => (j === i ? { ...row, tier, amount: TIER_CAPS[tier] } : row)));
                      }}
                    >
                      {Object.keys(TIER_CAPS).map((t) => (
                        <option key={t} value={t}>{t} (≤ ৳{TIER_CAPS[t]})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={3500}
                      value={r.amount}
                      onChange={(e) => setRows((prev) => prev.map((row, j) => (j === i ? { ...row, amount: Number(e.target.value) } : row)))}
                      className="h-9 rounded-md border border-input bg-card px-2 text-sm tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-base font-bold">
              Total: <span className={total > 10000 ? "text-destructive" : "text-emerald-700"}>{taka(total)}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={total > 10000 || busy} onClick={submit}>{busy ? "Submitting…" : "Submit proposal"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
