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
  const dash = useQuery({ queryKey: ["dash-me"], queryFn: () => api("GET", "/dashboard/me") });
  const notices = useQuery({
    queryKey: ["notices"],
    queryFn: () => api<any[]>("GET", "/notices"),
    enabled: Boolean(me.data),
  });

  if (dash.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

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
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.category} · from {n.sender?.fullName} · {dt(n.createdAt)}
                  </div>
                </div>
                <Badge variant={statusVariant(n.status)}>{n.status}</Badge>
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
