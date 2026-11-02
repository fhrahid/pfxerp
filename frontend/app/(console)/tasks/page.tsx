"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, dt } from "@/lib/utils";
import { TaskActions } from "./task-actions";

const COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "FLAGGED_COMPLETE", "PM_VERIFIED", "CTO_VERIFIED", "CLOSED"];

export default function TasksPage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";
  const mySquadIds = (me.data?.squadMemberships || []).map((m: any) => m.squad.id);
  const options = ROLES.isExec(role) ? squads.data || [] : (squads.data || []).filter((s: any) => mySquadIds.includes(s.id));
  const [squadId, setSquadId] = React.useState<string>("");
  const activeSquad = squadId || options[0]?.id;

  const tasks = useQuery({
    queryKey: ["tasks", activeSquad],
    queryFn: () => api<any[]>("GET", `/tasks?squadId=${activeSquad}`),
    enabled: Boolean(activeSquad),
  });

  const byStatus = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    COLUMNS.forEach((c) => (map[c] = []));
    (tasks.data || []).forEach((t) => (map[t.status] || (map[t.status] = [])).push(t));
    return map;
  }, [tasks.data]);

  const canCreate = ROLES.isPM(role) || ROLES.isExec(role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <Select value={activeSquad || undefined} onValueChange={setSquadId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Select squad" />
          </SelectTrigger>
          <SelectContent>
            {options.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && activeSquad ? <CreateTaskButton squadId={activeSquad} /> : null}
      </div>

      {tasks.isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : (
        <div className="thin-scroll grid grid-flow-col auto-cols-[minmax(250px,1fr)] sm:auto-cols-[minmax(210px,1fr)] gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((col) => (
            <div key={col} className="rounded-xl border bg-muted/40 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {col.replace(/_/g, " ")}
                </span>
                <Badge variant="muted">{byStatus[col].length}</Badge>
              </div>
              <div className="space-y-2">
                {byStatus[col].map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
                {!byStatus[col].length ? (
                  <div className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">empty</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task: t }: { task: any }) {
  const isOverdue = t.isOverdue || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "CLOSED");
  const completedLate = Boolean(t.completedLate);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md">
          <div className="text-[13px] font-semibold leading-snug">{t.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={t.priority === "CRITICAL" ? "destructive" : "muted"} className="px-1.5 py-0 text-[10px]">
              {t.priority}
            </Badge>
            {isOverdue ? (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold">
                MISSED DEADLINE
              </Badge>
            ) : completedLate ? (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                Completed Late
              </Badge>
            ) : null}
            {t.dueDate ? (
              <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                Due: {new Date(t.dueDate).toLocaleDateString()}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{t.assignedTo?.fullName || "unassigned"}</div>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <TaskDetail id={t.id} />
      </DialogContent>
    </Dialog>
  );
}

function TaskDetail({ id }: { id: string }) {
  const task = useQuery({ queryKey: ["task", id], queryFn: () => api<any>("GET", `/tasks/${id}`) });
  if (task.isLoading) return <Skeleton className="h-40 w-full" />;
  const t = task.data;
  if (!t) return null;
  const isOverdue = t.isOverdue || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "CLOSED");
  const completedLate = Boolean(t.completedLate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
        <Badge variant={t.priority === "CRITICAL" ? "destructive" : "muted"}>{t.priority}</Badge>
        {isOverdue ? (
          <Badge variant="destructive">⚠️ Overdue (Missed Deadline)</Badge>
        ) : completedLate ? (
          <Badge variant="destructive">Completed Late</Badge>
        ) : null}
      </div>
      {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Assignee" value={t.assignedTo?.fullName || "—"} />
        <Row label="Squad" value={t.squad?.name || "—"} />
        <Row label="PR / commit" value={t.gitPrUrl || t.gitCommitHash || "—"} mono />
        {t.dueDate ? (
          <Row
            label="Due Date"
            value={`${dt(t.dueDate)}${isOverdue ? " — Overdue (Missed Deadline)" : completedLate ? " — Completed Late" : ""}`}
          />
        ) : null}
        {t.pmFeedback ? <Row label="PM feedback" value={t.pmFeedback} /> : null}
        {t.ctoCritique ? <Row label="CTO critique" value={t.ctoCritique} /> : null}
      </div>
      {t.auditEvents?.length ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audit trail</div>
          <div className="space-y-1">
            {t.auditEvents.slice(0, 8).map((a: any) => (
              <div key={a.id} className="text-xs text-muted-foreground">
                {dt(a.createdAt)} — <b className="text-foreground">{a.changedBy?.fullName}</b>: {a.fromStatus} → {a.toStatus}
                {a.comment ? ` · ${a.comment.slice(0, 80)}` : ""}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <TaskActions task={t} onChanged={() => task.refetch()} />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("truncate", mono && "font-mono text-xs")} title={value}>
        {value}
      </div>
    </div>
  );
}

function CreateTaskButton({ squadId }: { squadId: string }) {
  const squads = useSquads();
  const squad = (squads.data || []).find((s: any) => s.id === squadId);
  const detail = useQuery({
    queryKey: ["squad", squadId],
    queryFn: () => api<any>("GET", `/squads/${squadId}`),
    enabled: Boolean(squadId),
  });
  const devOptions = (detail.data?.members || [])
    .filter((m: any) => m.role === "DEVELOPER")
    .map((m: any) => ({ value: m.userId, label: m.fullName }));

  return (
    <FormDialog
      trigger={
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New task
        </Button>
      }
      title={`Create task — ${squad?.name || ""}`}
      description="The task joins the active sprint automatically."
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "description", label: "Description", type: "textarea" },
        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({ value: p, label: p })),
          value: "MEDIUM",
        },
        {
          name: "assignedToId",
          label: "Assignee (leave empty for backlog)",
          type: "select",
          options: [{ value: "", label: "— leave in backlog —" }, ...devOptions],
          value: "",
        },
        {
          name: "dueDate",
          label: "Due Date & Time",
          type: "datetime-local",
        },
      ]}
      submitLabel="Create task"
      onSubmit={(d) =>
        api("POST", "/tasks", {
          squadId,
          title: d.title,
          description: d.description,
          priority: d.priority,
          ...(d.assignedToId ? { assignedToId: d.assignedToId } : {}),
          dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : undefined,
        })
      }
    />
  );
}
