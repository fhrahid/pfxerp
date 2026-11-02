"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Filter, Search, Eye, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { dt } from "@/lib/utils";

interface AuditLogItem {
  id: string;
  executiveId: string;
  executiveRole: string;
  actionType: string;
  payloadSnapshot: any;
  riskSeverity: "INFO" | "WARNING" | "CRITICAL";
  generatedReportUrl?: string;
  createdAt: string;
  executive?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

interface AuditLogResponse {
  data: AuditLogItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AuditLogsPage() {
  const me = useMe();
  const [page, setPage] = React.useState(1);
  const [role, setRole] = React.useState("ALL");
  const [severity, setSeverity] = React.useState("ALL");
  const [searchAction, setSearchAction] = React.useState("");

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "25");
    if (role !== "ALL") params.set("role", role);
    if (severity !== "ALL") params.set("severity", severity);
    if (searchAction.trim()) params.set("actionType", searchAction.trim());
    return params.toString();
  }, [page, role, severity, searchAction]);

  const auditQuery = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => api<AuditLogResponse>("GET", `/audit/logs?${queryParams}`),
    enabled: Boolean(me.data?.role && ["CEO", "CFO", "CTO", "CPO"].includes(me.data.role)),
  });

  const logs = auditQuery.data?.data || [];
  const meta = auditQuery.data?.meta;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Executive & System Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable log of high-stakes executive operations, logins, citations, and profile mutations.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs"
          onClick={() => auditQuery.refetch()}
          disabled={auditQuery.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-3.5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Filter by action (e.g. USER_LOGIN, CITATION)..."
              value={searchAction}
              onChange={(e) => {
                setSearchAction(e.target.value);
                setPage(1);
              }}
              className="h-8 text-xs"
            />
          </div>

          <div className="w-36">
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="CEO">CEO</SelectItem>
                <SelectItem value="CFO">CFO</SelectItem>
                <SelectItem value="CTO">CTO</SelectItem>
                <SelectItem value="CPO">CPO</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
                <SelectItem value="DEVELOPER">Developer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={severity}
              onValueChange={(v) => {
                setSeverity(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severities</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {auditQuery.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No audit log entries matching the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {dt(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-foreground">
                        {log.executive?.fullName || log.executiveRole}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {log.executiveRole}
                        </Badge>
                        <span className="truncate max-w-[140px]">{log.executive?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {log.actionType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.riskSeverity === "CRITICAL"
                            ? "destructive"
                            : log.riskSeverity === "WARNING"
                            ? "warning"
                            : "muted"
                        }
                        className="text-[10px]"
                      >
                        {log.riskSeverity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <LogPayloadDialog log={log} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Footer */}
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
              <div>
                Showing page {meta.page} of {meta.totalPages} ({meta.total} total logs)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 gap-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 gap-1"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function LogPayloadDialog({ log }: { log: AuditLogItem }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
          <Eye className="h-3.5 w-3.5" /> Inspect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span>{log.actionType}</span>
            <Badge
              variant={
                log.riskSeverity === "CRITICAL"
                  ? "destructive"
                  : log.riskSeverity === "WARNING"
                  ? "warning"
                  : "muted"
              }
              className="text-[10px]"
            >
              {log.riskSeverity}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Executed by {log.executive?.fullName || log.executiveRole} on {dt(log.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Actor: </span>
            <span className="font-medium text-foreground">{log.executive?.fullName}</span> (
            <span className="text-muted-foreground">{log.executive?.email}</span>)
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Snapshot Payload
            </div>
            <pre className="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto max-h-60 thin-scroll border">
              {JSON.stringify(log.payloadSnapshot, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
