"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, User, Clock, AlertTriangle, CheckCircle, TrendingUp, Calendar, ExternalLink } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taka, dt, cn } from "@/lib/utils";

const ROLE_OPTIONS = ["DEVELOPER", "PM", "CFO", "CTO", "CPO", "CEO"].map((r) => ({ value: r, label: r }));

export default function PeoplePage() {
  const me = useMe();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<any[]>("GET", "/users") });
  const manage = ROLES.canManage(me.data?.role || "");
  const [copied, setCopied] = React.useState("");

  if (users.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {manage ? (
        <FormDialog
          trigger={
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> New member
            </Button>
          }
          title="Create member profile"
          description="A personal wallet is provisioned automatically."
          fields={[
            { name: "fullName", label: "Full name", required: true, placeholder: "Ayesha Rahman" },
            { name: "email", label: "Email", type: "email", required: true, placeholder: "ayesha@pointfex.com" },
            {
              name: "password",
              label: "Temporary password (min 8)",
              required: true,
              value: `Pointfex-${Math.random().toString(36).slice(2, 8)}`,
            },
            { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS },
            { name: "studentId", label: "Student ID (optional)", placeholder: "CSE034" },
          ]}
          submitLabel="Create profile"
          onSubmit={(d) => api("POST", "/users", { ...d, studentId: d.studentId || undefined })}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Squads</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users.data || []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-semibold">
                    <MemberProfileModal
                      userId={u.id}
                      trigger={
                        <button className="text-left font-semibold hover:underline flex items-center gap-1.5 text-primary">
                          {u.fullName}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </button>
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "CEO" ? "warning" : u.role === "CTO" || u.role === "CFO" || u.role === "CPO" ? "info" : "muted"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs">{u.studentId || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(u.squadMemberships || []).map((m: any) => m.squad?.name).filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1.5">
                      <MemberProfileModal
                        userId={u.id}
                        trigger={
                          <Button size="sm" variant="secondary" className="h-8 text-xs">
                            Profile & Work
                          </Button>
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => {
                          navigator.clipboard?.writeText(u.id);
                          setCopied(u.id);
                          setTimeout(() => setCopied(""), 1500);
                        }}
                      >
                        {copied === u.id ? "Copied!" : "ID"}
                      </Button>
                      {manage ? (
                        <FormDialog
                          trigger={
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              Edit
                            </Button>
                          }
                          title={`Edit ${u.fullName}`}
                          fields={[
                            { name: "fullName", label: "Full name", value: u.fullName, required: true },
                            { name: "email", label: "Email", type: "email", value: u.email, required: true },
                            { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, value: u.role },
                            { name: "studentId", label: "Student ID", value: u.studentId || "" },
                            { name: "password", label: "New password (blank = keep)", placeholder: "min 8 chars" },
                            { name: "isActive", label: "Active (uncheck to revoke sessions)", type: "checkbox", value: true },
                          ]}
                          submitLabel="Save changes"
                          onSubmit={(d) =>
                            api("PATCH", `/users/${u.id}`, {
                              fullName: d.fullName,
                              email: d.email,
                              role: d.role,
                              studentId: d.studentId || null,
                              isActive: !!d.isActive,
                              ...(d.password ? { password: d.password } : {}),
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberProfileModal({ userId, trigger }: { userId: string; trigger: React.ReactNode }) {
  const profile = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => api<any>("GET", `/users/${userId}`),
    enabled: Boolean(userId),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="text-xl">Member Work & Performance Audit</DialogTitle>
          <DialogDescription>
            Comprehensive profile audit: task history, performance indices, and missed deadline tracking.
          </DialogDescription>
        </DialogHeader>

        {profile.isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ) : profile.isError || !profile.data ? (
          <div className="text-destructive py-6 text-center text-sm">Failed to load member profile details.</div>
        ) : (
          <MemberProfileDetail data={profile.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberProfileDetail({ data }: { data: any }) {
  const stats = data.stats || {};
  const missedCount = (data.missedDeadlineTasks || []).length;
  const isDev = data.role === "DEVELOPER";
  const isPm = data.role === "PM";

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-xl bg-muted/50 border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">{data.fullName}</h3>
            <Badge variant={data.role === "CEO" ? "warning" : "info"}>{data.role}</Badge>
            {data.isActive ? (
              <Badge variant="success" className="text-[10px]">
                Active
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">
                Deactivated
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{data.email}</span>
            {data.studentId ? <span>ID: <code className="font-mono">{data.studentId}</code></span> : null}
            <span>Joined: {dt(data.createdAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(data.squadMemberships || []).map((m: any) => (
              <Badge key={m.squadId} variant="outline" className="text-[11px]">
                {m.squad?.name} ({m.role || "MEMBER"} · {m.allocation ? `${m.allocation * 100}%` : "100%"})
              </Badge>
            ))}
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personal Wallet</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{taka(data.walletBalance || 0)}</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tasks & SP</div>
            <div className="mt-1 text-2xl font-bold">
              {stats.completedTasks || 0} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalAssigned || 0}</span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {stats.storyPointsCompleted || 0} / {stats.storyPointsAssigned || 0} SP completed
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On-Time Delivery</div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.onTimeRate ?? 100}%
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {stats.completedTasks > 0 ? "Based on deadlines" : "No completed tasks yet"}
            </div>
          </CardContent>
        </Card>

        <Card className={cn("bg-card", missedCount > 0 ? "border-rose-300 dark:border-rose-900 bg-rose-50/20" : "")}>
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Missed Deadlines</span>
              {missedCount > 0 ? <AlertTriangle className="h-4 w-4 text-rose-500" /> : <CheckCircle className="h-4 w-4 text-emerald-500" />}
            </div>
            <div className={cn("mt-1 text-2xl font-bold", missedCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600")}>
              {missedCount}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {missedCount > 0 ? "Overdue or finished late" : "100% on schedule"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isDev ? "DPI Score" : isPm ? "PMHI Score" : "Role Status"}
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">
              {isDev ? (stats.latestDpi ?? "—") : isPm ? (stats.latestPmhi ?? "—") : "Executive"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {isDev ? `Premature flags: ${stats.prematureFlagsCount || 0}` : isPm ? "Squad governance" : "Studio Management"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Tabs defaultValue={missedCount > 0 ? "missed" : "tasks"} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="missed" className="relative">
            Missed Deadlines
            {missedCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white">
                {missedCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="tasks">Assigned Tasks ({data.assignedTasks?.length || 0})</TabsTrigger>
          <TabsTrigger value="history">Performance History</TabsTrigger>
        </TabsList>

        {/* Tab 1: Missed Deadlines */}
        <TabsContent value="missed" className="mt-3 space-y-2">
          {missedCount === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <CheckCircle className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <div className="font-semibold text-foreground">No Missed Deadlines!</div>
              <div>This member has zero overdue tasks and met every assigned deadline.</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ The following {missedCount} tasks missed their due dates:
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Delay</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.missedDeadlineTasks.map((t: any) => (
                    <TableRow key={t.id} className="bg-rose-50/30 dark:bg-rose-950/20">
                      <TableCell className="font-semibold text-foreground">
                        <div>{t.title}</div>
                        <div className="text-[11px] font-normal text-muted-foreground">
                          Priority: {t.priority} · {t.storyPoints} SP
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{t.squadName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-rose-600 dark:text-rose-400">
                        {dt(t.dueDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">
                          {t.daysOverdue} days late
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.isCurrentlyOverdue ? (
                          <span className="font-semibold text-rose-600">Still Overdue</span>
                        ) : (
                          <span className="text-muted-foreground">Completed late on {dt(t.completionTime)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Assigned Tasks */}
        <TabsContent value="tasks" className="mt-3">
          {(data.assignedTasks || []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No tasks assigned to this user yet.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SP</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Git Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignedTasks.map((t: any) => {
                    const isOverdue =
                      t.dueDate &&
                      !["CTO_VERIFIED", "CLOSED"].includes(t.status) &&
                      new Date(t.dueDate) < new Date();
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-foreground">
                          <div>{t.title}</div>
                          <div className="text-[11px] text-muted-foreground">Priority: {t.priority}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.squad?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold">{t.storyPoints} SP</TableCell>
                        <TableCell className="text-xs">
                          {t.dueDate ? (
                            <span className={cn(isOverdue ? "font-bold text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                              {dt(t.dueDate)} {isOverdue ? "⚠️" : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[150px] truncate">
                          {t.gitPrUrl || t.gitCommitHash || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Performance History */}
        <TabsContent value="history" className="mt-3 space-y-3">
          {isDev ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Developer Performance Index (DPI) by Sprint
              </div>
              {(data.dpiSnapshots || []).length === 0 ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                  No sprint snapshots calculated yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sprint</TableHead>
                      <TableHead>DPI Score</TableHead>
                      <TableHead>SP Assigned/Done</TableHead>
                      <TableHead>On-Time Rate</TableHead>
                      <TableHead>CTO Pass Rate</TableHead>
                      <TableHead>Premature Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dpiSnapshots.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold">Sprint #{s.sprintNumber}</TableCell>
                        <TableCell className="font-bold text-primary">{Number(s.dpiScore)}</TableCell>
                        <TableCell className="text-xs">
                          {s.storyPointsCompleted} / {s.storyPointsAssigned} SP
                        </TableCell>
                        <TableCell className="text-xs">
                          {Math.round(Number(s.onTimeDeliveryRate || 1) * 100)}%
                        </TableCell>
                        <TableCell className="text-xs">
                          {Math.round(Number(s.ctoQualityPassRate || 1) * 100)}%
                        </TableCell>
                        <TableCell className="text-xs font-mono text-rose-500">
                          {s.prematureFlagsCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : isPm ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                PM Health Index (PMHI) by Sprint
              </div>
              {(data.pmhiSnapshots || []).length === 0 ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                  No sprint snapshots calculated yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sprint</TableHead>
                      <TableHead>PMHI Score</TableHead>
                      <TableHead>Velocity Accuracy</TableHead>
                      <TableHead>CTO Agreement</TableHead>
                      <TableHead>CTO Overrides</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pmhiSnapshots.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold">Sprint #{s.sprintNumber}</TableCell>
                        <TableCell className="font-bold text-primary">{Number(s.pmhiScore)}</TableCell>
                        <TableCell className="text-xs">
                          {Math.round(Number(s.velocityAccuracy || 1) * 100)}%
                        </TableCell>
                        <TableCell className="text-xs">
                          {Math.round(Number(s.ctoAgreementRate || 1) * 100)}%
                        </TableCell>
                        <TableCell className="text-xs font-mono text-rose-500">
                          {s.ctoOverrideCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
              Executive role — governed by Board Decisions and Financial Ledgers.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
