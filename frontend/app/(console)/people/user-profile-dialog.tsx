"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  Coins,
  Briefcase,
  AlertCircle,
  Clock,
  Award,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taka, dt, cn } from "@/lib/utils";

interface UserProfileDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ userId, open, onOpenChange }: UserProfileDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => api<any>("GET", `/users/${userId}/profile`),
    enabled: Boolean(userId && open),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Member Profile & Work Audit</DialogTitle>
          <DialogDescription>
            Comprehensive visibility into tasks, deadlines, performance metrics, and executive governance.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : isError || !data ? (
          <div className="text-destructive py-8 text-center text-sm">
            Failed to load member profile details.
          </div>
        ) : (
          <UserProfileDetail data={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserProfileDetail({ data }: { data: any }) {
  const stats = data.stats || {};
  const missedCount =
    stats.overdueTasksCount ??
    (data.missedDeadlineTasks?.length || 0);
  const isDev = data.role === "DEVELOPER";
  const isPm = data.role === "PM";
  const isExec = ["CFO", "CTO", "CPO", "CEO"].includes(data.role);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-muted/40 border">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">{data.fullName}</h3>
            <Badge variant={data.role === "CEO" ? "warning" : isExec ? "info" : "muted"}>
              {data.role}
            </Badge>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{data.email}</span>
            {data.studentId ? (
              <span>
                Student ID: <code className="font-mono text-foreground font-semibold">{data.studentId}</code>
              </span>
            ) : null}
            <span>Joined: {dt(data.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(data.squadMemberships || []).map((m: any) => (
              <Badge key={m.squadId || m.squad?.id} variant="outline" className="text-[11px] bg-background">
                {m.squad?.name || "Squad"} ({m.role || "MEMBER"} ·{" "}
                {m.allocation ? `${Math.round(m.allocation * 100)}%` : "100%"})
              </Badge>
            ))}
            {(!data.squadMemberships || data.squadMemberships.length === 0) && (
              <span className="text-xs text-muted-foreground">No squad memberships</span>
            )}
          </div>
        </div>

        {data.walletBalance !== undefined ? <div className="text-left sm:text-right shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Personal Wallet Balance
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {taka(data.walletBalance || 0)}
          </div>
        </div> : null}
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* 1. Total Assigned */}
        <Card className="bg-card">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Assigned
            </div>
            <div className="mt-1 text-2xl font-bold">
              {stats.totalAssigned ?? (data.assignedTasks?.length || 0)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.storyPointsAssigned || 0} total SP
            </div>
          </CardContent>
        </Card>

        {/* 2. Completed Tasks */}
        <Card className="bg-card">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Completed Tasks
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.completedTasks ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.storyPointsCompleted || 0} SP delivered
            </div>
          </CardContent>
        </Card>

        {/* 3. Overdue / Missed Deadlines */}
        <Card
          className={cn(
            "bg-card transition-colors",
            missedCount > 0 ? "border-rose-400 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20" : ""
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Missed Deadlines
              </span>
              {missedCount > 0 ? (
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
            </div>
            <div
              className={cn(
                "mt-1 text-2xl font-bold",
                missedCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {missedCount}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {missedCount > 0 ? "Overdue / Late" : "On schedule"}
            </div>
          </CardContent>
        </Card>

        {/* 4. On-Time Delivery Rate */}
        <Card className="bg-card">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              On-Time Rate
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {stats.onTimeRate !== undefined ? `${stats.onTimeRate}%` : "100%"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.completedTasks > 0 ? "Delivered before due" : "No completions yet"}
            </div>
          </CardContent>
        </Card>

        {/* 5. Latest DPI / PMHI Score */}
        <Card className="bg-card">
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isDev ? "Latest DPI" : isPm ? "Latest PMHI" : "Executive"}
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">
              {isDev
                ? stats.latestDpi !== null && stats.latestDpi !== undefined
                  ? Number(stats.latestDpi).toFixed(1)
                  : "—"
                : isPm
                ? stats.latestPmhi !== null && stats.latestPmhi !== undefined
                  ? Number(stats.latestPmhi).toFixed(1)
                  : "—"
                : data.role}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {isDev
                ? `Premature flags: ${stats.prematureFlagsCount || 0}`
                : isPm
                ? "PM Health Index"
                : "Executive Governance"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Details */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className={cn("grid w-full", isExec ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="tasks">
            Tasks & Deadlines ({(data.assignedTasks || []).length})
          </TabsTrigger>
          <TabsTrigger value="performance">Performance & Audits</TabsTrigger>
          {isExec && <TabsTrigger value="executive">Executive Actions</TabsTrigger>}
        </TabsList>

        {/* Tab 1: Tasks & Deadlines */}
        <TabsContent value="tasks" className="mt-3 space-y-3">
          {(!data.assignedTasks || data.assignedTasks.length === 0) ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No tasks assigned to this user yet.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>SP</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Git PR / Commit</TableHead>
                    <TableHead>Review / Critique</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignedTasks.map((t: any) => {
                    const isOverdue = Boolean(
                      t.isOverdue ||
                        (t.dueDate &&
                          !["CTO_VERIFIED", "CLOSED"].includes(t.status) &&
                          new Date(t.dueDate) < new Date())
                    );
                    const completedLate = Boolean(
                      t.completedLate ||
                        (t.dueDate &&
                          ["CTO_VERIFIED", "CLOSED"].includes(t.status) &&
                          ((t.ctoVerifiedAt && new Date(t.ctoVerifiedAt) > new Date(t.dueDate)) ||
                            (t.flaggedCompleteAt && new Date(t.flaggedCompleteAt) > new Date(t.dueDate))))
                    );
                    const missed = isOverdue || completedLate;

                    return (
                      <TableRow
                        key={t.id}
                        className={cn(missed && "bg-rose-50/20 dark:bg-rose-950/20")}
                      >
                        <TableCell className="font-medium">
                          <div className="font-semibold text-foreground">{t.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t.squad?.name || "No squad"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.priority === "CRITICAL" ? "destructive" : "muted"}
                            className="text-[10px]"
                          >
                            {t.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {t.storyPoints} SP
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.dueDate ? (
                            <div className="space-y-1">
                              <span className={cn(missed ? "font-bold text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                                {dt(t.dueDate)}
                              </span>
                              {missed ? (
                                <div>
                                  <Badge variant="destructive" className="text-[10px] font-bold py-0">
                                    MISSED DEADLINE
                                  </Badge>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.gitPrUrl ? (
                            <a
                              href={t.gitPrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline max-w-[140px] truncate"
                              title={t.gitPrUrl}
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {t.gitPrUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                              </span>
                            </a>
                          ) : t.gitCommitHash ? (
                            <code className="font-mono text-[11px] text-muted-foreground">
                              {t.gitCommitHash.slice(0, 8)}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[220px]">
                          <div className="space-y-1">
                            {t.pmFeedback ? (
                              <div className="text-[11px] text-muted-foreground leading-tight">
                                <span className="font-semibold text-foreground">PM:</span> {t.pmFeedback}
                              </div>
                            ) : null}
                            {t.ctoCritique ? (
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 leading-tight">
                                <span className="font-semibold">CTO:</span> {t.ctoCritique}
                              </div>
                            ) : null}
                            {!t.pmFeedback && !t.ctoCritique && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Performance & Audits */}
        <TabsContent value="performance" className="mt-3 space-y-6">
          {/* DPI or PMHI Snapshots */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {isDev ? "Developer Performance Index (DPI) Snapshots" : isPm ? "PM Health Index (PMHI) Snapshots" : "Performance Snapshots"}
            </h4>
            {isDev ? (
              (!data.dpiSnapshots || data.dpiSnapshots.length === 0) ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                  No sprint DPI snapshots calculated yet.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sprint</TableHead>
                        <TableHead>DPI Score</TableHead>
                        <TableHead>SP (Done/Assigned)</TableHead>
                        <TableHead>On-Time Delivery</TableHead>
                        <TableHead>CTO Quality Pass</TableHead>
                        <TableHead>Premature Flags</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.dpiSnapshots.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-semibold">Sprint #{s.sprintNumber}</TableCell>
                          <TableCell className="font-bold text-primary">
                            {Number(s.dpiScore).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {s.storyPointsCompleted} / {s.storyPointsAssigned} SP
                          </TableCell>
                          <TableCell className="text-xs">
                            {Math.round(Number(s.onTimeDeliveryRate || 1) * 100)}%
                          </TableCell>
                          <TableCell className="text-xs">
                            {Math.round(Number(s.ctoQualityPassRate || 1) * 100)}%
                          </TableCell>
                          <TableCell className="text-xs font-mono text-rose-500 font-semibold">
                            {s.prematureFlagsCount}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dt(s.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : isPm ? (
              (!data.pmhiSnapshots || data.pmhiSnapshots.length === 0) ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                  No sprint PMHI snapshots calculated yet.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sprint</TableHead>
                        <TableHead>PMHI Score</TableHead>
                        <TableHead>Velocity Accuracy</TableHead>
                        <TableHead>CTO Agreement</TableHead>
                        <TableHead>CTO Overrides</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pmhiSnapshots.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-semibold">Sprint #{s.sprintNumber}</TableCell>
                          <TableCell className="font-bold text-primary">
                            {Number(s.pmhiScore).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {Math.round(Number(s.velocityAccuracy || 1) * 100)}%
                          </TableCell>
                          <TableCell className="text-xs">
                            {Math.round(Number(s.ctoAgreementRate || 1) * 100)}%
                          </TableCell>
                          <TableCell className="text-xs font-mono text-rose-500 font-semibold">
                            {s.ctoOverrideCount}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dt(s.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                Executive role — performance evaluated through governance and audits.
              </div>
            )}
          </div>

          {/* CTO Citations */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
              Citations Received from CTO
            </h4>
            {(!data.citations || data.citations.length === 0) ? (
              <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                No code audit citations received from CTO.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Squad</TableHead>
                      <TableHead>Citation Type</TableHead>
                      <TableHead>Fine Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Issued At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.citations.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-xs">
                          {c.squad?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-[10px]">
                            {c.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                          {taka(c.fineAmount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs">
                          {c.description}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{dt(c.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Slacker Fines */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
              Slacker Fines
            </h4>
            {(!data.slackerFines || data.slackerFines.length === 0) ? (
              <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                No slacker fines on record.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date Recorded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slackerFines.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-xs font-medium text-foreground">
                          {f.description || "Slacker fine"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{dt(f.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Executive Actions */}
        {isExec && (
          <TabsContent value="executive" className="mt-3 space-y-6">
            {/* Recent Executive Actions Audit Log */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recent Executive Actions (Audit Trail)
              </h4>
              {(!data.executiveAuditLogs || data.executiveAuditLogs.length === 0) ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                  No executive actions recorded in audit logs.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Payload Snapshot</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.executiveAuditLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-semibold text-xs font-mono">
                            {log.actionType}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.riskSeverity === "CRITICAL" || log.riskSeverity === "HIGH"
                                  ? "destructive"
                                  : log.riskSeverity === "MEDIUM"
                                  ? "warning"
                                  : "muted"
                              }
                              className="text-[10px]"
                            >
                              {log.riskSeverity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <pre className="font-mono text-[10px] text-muted-foreground max-w-sm max-h-16 overflow-y-auto bg-muted/40 p-1.5 rounded">
                              {typeof log.payloadSnapshot === "string"
                                ? log.payloadSnapshot
                                : JSON.stringify(log.payloadSnapshot, null, 2)}
                            </pre>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {dt(log.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* CFO: Loans Approved & Equity Holdings */}
            {data.role === "CFO" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-emerald-500" />
                    Loans Approved
                  </h4>
                  {(!data.executiveDetails?.loansApproved || data.executiveDetails.loansApproved.length === 0) ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      No loans approved by this CFO.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Borrower Squad</TableHead>
                            <TableHead>Principal</TableHead>
                            <TableHead>Interest Rate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.executiveDetails.loansApproved.map((l: any) => (
                            <TableRow key={l.id}>
                              <TableCell className="text-xs font-medium">
                                {l.borrowerSquad?.name || "Squad"}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-bold text-emerald-600">
                                {taka(l.principal)}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {Math.round(Number(l.interestRate || 0) * 100)}%
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{dt(l.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Equity Holdings
                  </h4>
                  {(!data.executiveDetails?.equityHoldings || data.executiveDetails.equityHoldings.length === 0) ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      No equity stakes held.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Squad</TableHead>
                            <TableHead>Shares Percent</TableHead>
                            <TableHead>Valuation at Purchase</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.executiveDetails.equityHoldings.map((eq: any) => (
                            <TableRow key={eq.id}>
                              <TableCell className="text-xs font-medium">
                                {eq.squad?.name || "Squad"}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-bold">
                                {(Number(eq.sharesPercent || 0) * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {taka(eq.valuationAtPurchase)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(eq.status)}>{eq.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CTO: Citations Issued & Consultancy Bookings */}
            {data.role === "CTO" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                    Citations Issued to Squads
                  </h4>
                  {(!data.executiveDetails?.citationsIssued || data.executiveDetails.citationsIssued.length === 0) ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      No citations issued by this CTO.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Squad</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Fine Amount</TableHead>
                            <TableHead>CTO Cut</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.executiveDetails.citationsIssued.map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs font-medium">
                                {c.squad?.name || "Squad"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive" className="text-[10px]">
                                  {c.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-mono font-bold text-rose-600">
                                {taka(c.fineAmount)}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-emerald-600">
                                {taka(c.ctoCut)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs">
                                {c.description}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{dt(c.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-primary" />
                    Consultancy Bookings
                  </h4>
                  {(!data.executiveDetails?.consultancies || data.executiveDetails.consultancies.length === 0) ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      No consultancy sessions booked.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client Squad</TableHead>
                            <TableHead>Fee</TableHead>
                            <TableHead>Consultant Cut</TableHead>
                            <TableHead>Meeting Notes</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.executiveDetails.consultancies.map((cb: any) => (
                            <TableRow key={cb.id}>
                              <TableCell className="text-xs font-medium">
                                {cb.clientSquad?.name || "Squad"}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-bold">
                                {taka(cb.fee)}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-emerald-600">
                                {taka(cb.consultantCut)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs">
                                {cb.meetingNotes || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{dt(cb.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CPO: Payroll Proposals Approved & Notices Dispatched */}
            {data.role === "CPO" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Payroll Proposals Approved
                  </h4>
                  {(!data.executiveDetails?.approvedPayrolls || data.executiveDetails.approvedPayrolls.length === 0) ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      No payroll proposals approved.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Squad</TableHead>
                            <TableHead>Lab Number</TableHead>
                            <TableHead>Total Proposed</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.executiveDetails.approvedPayrolls.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs font-medium">
                                {p.squad?.name || "Squad"}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-semibold">
                                Lab #{p.labNumber}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-bold text-emerald-600">
                                {taka(p.totalProposed)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{dt(p.updatedAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Notices Dispatched
                  </h4>
                  {(!data.executiveDetails?.noticesDispatched || data.executiveDetails.noticesDispatched.length === 0) ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      No notices dispatched.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.executiveDetails.noticesDispatched.map((n: any) => (
                            <TableRow key={n.id}>
                              <TableCell className="text-xs font-medium">
                                {n.recipient?.fullName} ({n.recipient?.role})
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-foreground">
                                {n.title}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{n.type}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    n.severity === "CRITICAL"
                                      ? "destructive"
                                      : n.severity === "WARNING"
                                      ? "warning"
                                      : "muted"
                                  }
                                  className="text-[10px]"
                                >
                                  {n.severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{dt(n.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CEO: Chaos Events & Interventions */}
            {data.role === "CEO" && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  Chaos Events & Executive Interventions
                </h4>
                {(!data.executiveDetails?.chaosEvents || data.executiveDetails.chaosEvents.length === 0) ? (
                  <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                    No chaos events triggered by this CEO.
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Target User</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.executiveDetails.chaosEvents.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs font-mono font-semibold">
                              {c.type}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-sm">
                              {c.description}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{c.targetUserId || "Global"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{dt(c.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
