"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, Wallet, CheckCircle2, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { api, logout } from "@/lib/api";
import { useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/blocks";
import { dt, taka } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const me = useMe();
  const router = useRouter();
  const profile = useQuery({
    queryKey: ["user-profile", me.data?.id],
    queryFn: () => api<any>("GET", `/users/${me.data!.id}/profile`),
    enabled: Boolean(me.data?.id),
  });

  if (profile.isLoading || !me.data) return <Skeleton className="h-96 w-full rounded-xl" />;
  const p = profile.data;
  const counts = new Map<string, number>((p?.activityHeatmap || []).map((d: any) => [d.date, d.count]));
  const days = Array.from({ length: 364 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (363 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, count: counts.get(key) || 0 };
  });
  const assigned = p?.assignedTasks || [];
  const logs = [...(p?.executiveAuditLogs || []), ...(p?.pmDetails?.recentVerifications || [])].slice(0, 12);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.fullName}</h1>
          <p className="text-sm text-muted-foreground">{p.email} · {p.role}</p>
        </div>
        <FormDialog
          trigger={<Button variant="outline" className="gap-2"><LockKeyhole className="h-4 w-4" /> Change password</Button>}
          title="Change password"
          description="Changing your password signs out other active sessions. Use at least 12 characters."
          fields={[
            { name: "currentPassword", label: "Current password", type: "password", required: true },
            { name: "newPassword", label: "New password (min 12 characters)", type: "password", required: true },
          ]}
          submitLabel="Change password"
          onSubmit={async (d) => {
            await api("POST", "/auth/change-password", d);
            toast.success("Password changed. Please sign in again.");
            await logout();
            router.replace("/");
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Personal wallet" value={taka(p.walletBalance || 0)} tone="money" icon={Wallet} />
        <StatCard label="Assigned tasks" value={p.stats?.totalAssigned || 0} icon={ListTodo} />
        <StatCard label="Completed" value={p.stats?.completedTasks || 0} icon={CheckCircle2} />
        <StatCard label="On-time delivery" value={`${p.stats?.onTimeRate ?? 100}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Activity · last 12 months</CardTitle></CardHeader>
        <CardContent>
          <div className="thin-scroll overflow-x-auto pb-2" role="img" aria-label="Daily task activity heatmap for the last year">
            <div className="grid min-w-[720px] grid-flow-col grid-rows-7 gap-1">
              {days.map((d) => (
                <span key={d.key} title={`${d.key}: ${d.count} task updates`} className="h-3 w-3 rounded-[3px] border border-border/60" style={{ backgroundColor: d.count ? `hsl(145 62% ${Math.max(28, 88 - Math.min(d.count, 6) * 10)}%)` : "hsl(var(--muted))" }} />
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Counts task status changes recorded in the audit trail; no activity content is exposed.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">My work</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {assigned.length ? assigned.map((t: any) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div><div className="font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{t.squad?.name || "—"}{t.dueDate ? ` · Due ${dt(t.dueDate)}` : ""}</div></div>
              <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
            </div>
          )) : <p className="text-sm text-muted-foreground">No assigned work yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent activity log</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(p?.recentActivity || []).slice(0, 20).map((e: any) => (
            <div key={e.id} className="flex justify-between gap-3 border-b py-2 text-sm">
              <span>{e.fromStatus} → {e.toStatus} · {e.task?.title || "Task update"}</span><span className="shrink-0 text-xs text-muted-foreground">{dt(e.createdAt)}</span>
            </div>
          ))}
          {logs.map((e: any, i: number) => (
            <div key={e.id || i} className="flex justify-between gap-3 border-b py-2 text-sm">
              <span>{e.actionType || e.title || "Review activity"}</span><span className="shrink-0 text-xs text-muted-foreground">{dt(e.createdAt || e.pmVerifiedAt)}</span>
            </div>
          ))}
          {!p?.recentActivity?.length && !logs.length ? <p className="text-sm text-muted-foreground">No recorded activity yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
