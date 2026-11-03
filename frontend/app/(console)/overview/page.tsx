"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, CircleDollarSign, ListTodo, Gauge } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useMe } from "@/components/shell";
import { StatCard, EmptyState } from "@/components/blocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, taka } from "@/lib/utils";

export default function OverviewPage() {
  const me = useMe();
  const isCeo = ROLES.isCEO(me.data?.role || "");
  const ceo = useQuery({ queryKey: ["dashboard-ceo"], queryFn: () => api<any>("GET", "/dashboard/ceo"), enabled: isCeo });
  const dash = useQuery({ queryKey: ["dash-me"], queryFn: () => api("GET", "/dashboard/me") });
  const notices = useQuery({
    queryKey: ["notices"],
    queryFn: () => api<any[]>("GET", "/notices"),
    enabled: Boolean(me.data),
  });

  if (dash.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  if (isCeo) {
    const d = ceo.data;
    if (ceo.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
    return <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Studio command center</h1><p className="text-sm text-muted-foreground">Financial health, delivery capacity, risk and decisions requiring executive attention.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Circulating cash" value={taka(d?.macro?.circulatingCash)} tone="money" icon={CircleDollarSign} />
        <StatCard label="Escrow" value={taka(d?.macro?.activeEscrow)} tone="money" />
        <StatCard label="Average runway" value={`${d?.macro?.avgRunwayPeriods ?? 0} periods`} />
        <StatCard label="Active contracts" value={d?.macro?.activeClientContracts ?? 0} />
        <StatCard label="Studio valuation" value={taka(d?.macro?.studioValuation)} tone="money" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Board decisions pending" value={d?.pendingDecisionsCount ?? 0} />
        <StatCard label="Unresolved incidents" value={d?.activeChaosIncidents ?? 0} />
      </div>
      <Card><CardHeader><CardTitle className="text-base">Squad health & delivery</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Squad</TableHead><TableHead>Health</TableHead><TableHead>Treasury</TableHead><TableHead>Runway</TableHead><TableHead>Delivery</TableHead><TableHead>Team signals</TableHead></TableRow></TableHeader><TableBody>
        {(d?.squads || []).map((s: any) => <TableRow key={s.id}><TableCell className="font-semibold">{s.name}</TableCell><TableCell><Badge variant={statusVariant(s.health)}>{s.health}</Badge></TableCell><TableCell className="tabular-nums">{taka(s.balance)}</TableCell><TableCell>{s.runwayPeriods} periods</TableCell><TableCell>{s.openTaskCount ?? s.taskCount} open · {s.overdueTaskCount ?? 0} overdue</TableCell><TableCell className="text-xs">DPI {s.dpiAvg ?? "—"} · PMHI {s.pmhi ?? "—"}</TableCell></TableRow>)}
      </TableBody></Table></CardContent></Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Recent ledger movements</CardTitle></CardHeader><CardContent className="space-y-2">{(d?.recentTransactions || []).slice(0, 8).map((t: any) => <div key={t.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{t.type} · {t.description || "—"}<span className="block text-xs text-muted-foreground">{t.by}</span></span><span className="shrink-0 font-semibold">{taka(t.amount)}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Executive actions & risk</CardTitle></CardHeader><CardContent className="space-y-2">{(d?.recentExecutiveActions || []).slice(0, 8).map((a: any) => <div key={a.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{a.executiveName} · {a.actionType}<span className="block text-xs text-muted-foreground">{dt(a.createdAt)}</span></span><Badge variant={a.riskSeverity === "CRITICAL" ? "destructive" : statusVariant(a.riskSeverity)}>{a.riskSeverity}</Badge></div>)}</CardContent></Card>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My wallet" value={taka(dash.data?.walletBalance)} tone="money" icon={CircleDollarSign} />
        <StatCard label="Open tasks" value={dash.data?.openTasks ?? 0} icon={ListTodo} />
        <StatCard label="Latest DPI" value={dash.data?.latestDpi ?? "—"} icon={Gauge} />
        <StatCard label="My squads" value={dash.data?.squads?.length ?? 0} icon={Bell} />
      </div>

      {dash.data?.squads?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My squads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Squad</TableHead>
                  <TableHead>Treasury</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.data.squads.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-semibold tabular-nums text-emerald-700">{taka(s.balance)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.health)}>{s.health}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent notices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notices.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : notices.data?.length ? (
            notices.data.slice(0, 5).map((n: any) => (
              <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{n.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {n.category} · from {n.sender?.fullName} · {dt(n.createdAt)}
                  </div>
                </div>
                <Badge variant={statusVariant(n.status)} className="shrink-0">{n.status}</Badge>
              </div>
            ))
          ) : (
            <EmptyState>Inbox is empty{ROLES.isExec(me.data?.role || "") ? " — dispatch one from the Notices tab" : ""}.</EmptyState>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
