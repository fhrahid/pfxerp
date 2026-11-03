"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
  const queryClient = useQueryClient();
  const role = me.data?.role || "";
  const myId = me.data?.id;
  const mySquadIds = (me.data?.squadMemberships || []).map((m: any) => m.squad.id);
  const options = ROLES.isExec(role) ? squads.data || [] : (squads.data || []).filter((s: any) => mySquadIds.includes(s.id));
  const [squadId, setSquadId] = React.useState<string>("");
  const activeSquad = squadId || options[0]?.id;
  const [dragTaskId, setDragTaskId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  /** drop-triggered dialog: payload-bearing transitions */
  const [dialog, setDialog] = React.useState<{ kind: "flag" | "pmReject" | "ctoReject" | "assign"; task: any } | null>(null);

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

  const squadDetail = useQuery({
    queryKey: ["squad", activeSquad],
    queryFn: () => api<any>("GET", `/squads/${activeSquad}`),
    enabled: Boolean(activeSquad),
  });
  const memberOptions = (squadDetail.data?.members || [])
    .filter((m: any) => m.role === "DEVELOPER" || m.role === "PM")
    .map((m: any) => ({ value: m.userId, label: `${m.fullName} (${m.role})` }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", activeSquad] });
    queryClient.invalidateQueries({ queryKey: ["task"] });
  };

  const runAction = async (method: string, path: string, body?: unknown) => {
    await action(method, path, body);
    refresh();
  };

  /** Drag & drop + card button transition resolver — mirrors the server state machine & RBAC. */
  const resolveMove = (t: any, to: string): { kind: string; ok: boolean; reason?: string } => {
    if (t.status === to) return { kind: "none", ok: false };
    const isAssignee = t.assignedToId === myId || (t.assigneeIds || []).includes(myId);
    const isPmOrCeo = role === "PM" || role === "CEO";
    const isCtoOrCeo = role === "CTO" || role === "CEO";
    const isPmCtoOrCeo = isPmOrCeo || role === "CTO";
    switch (`${t.status}->${to}`) {
      case "BACKLOG->TODO":
        return memberOptions.length
          ? { kind: "assign", ok: true }
          : { kind: "assign", ok: false, reason: "No members to assign" };
      case "TODO->BACKLOG":
        return { kind: "unassign", ok: isPmOrCeo || ROLES.isExec(role), reason: "Only squad leadership can unassign" };
      case "TODO->IN_PROGRESS":
        return { kind: "start", ok: isAssignee || isPmOrCeo || ROLES.isExec(role), reason: "Only the assignee or squad leadership can start work" };
      case "IN_PROGRESS->FLAGGED_COMPLETE":
        return { kind: "flag", ok: isAssignee, reason: "Only the assigned developer can flag completion" };
      case "FLAGGED_COMPLETE->PM_VERIFIED":
        return { kind: "pmVerify", ok: isPmOrCeo, reason: "PM verification is reserved for the squad PM (or CEO)" };
      case "FLAGGED_COMPLETE->IN_PROGRESS":
        return { kind: "pmReject", ok: isPmOrCeo, reason: "PM rejection is reserved for the squad PM (or CEO)" };
      case "PM_VERIFIED->CTO_VERIFIED":
        return { kind: "ctoVerify", ok: isCtoOrCeo, reason: "The quality audit is reserved for the CTO (or CEO)" };
      case "PM_VERIFIED->IN_PROGRESS":
        return { kind: "ctoReject", ok: isCtoOrCeo, reason: "CTO rejection is reserved for the CTO (or CEO)" };
      case "CTO_VERIFIED->CLOSED":
        return { kind: "close", ok: isPmCtoOrCeo, reason: "Only the PM or CTO can close a verified task" };
      default:
        return { kind: "none", ok: false, reason: `Invalid transition: ${t.status} → ${to}` };
    }
  };

  const handleMove = async (t: any, to: string) => {
    const move = resolveMove(t, to);
    if (!move.ok) {
      toast.error(move.reason || "You cannot perform this move");
      return;
    }
    try {
      switch (move.kind) {
        case "start":
          await runAction("POST", `/tasks/${t.id}/start`);
          break;
        case "pmVerify":
          await runAction("POST", `/tasks/${t.id}/pm-verify`, { comment: "Acceptance criteria met, commits verified." });
          break;
        case "ctoVerify":
          await runAction("POST", `/tasks/${t.id}/cto-verify`, { critique: "Clean architecture, coverage verified." });
          break;
        case "close":
          await runAction("POST", `/tasks/${t.id}/close`);
          break;
        case "unassign":
          await runAction("PATCH", `/tasks/${t.id}`, { assigneeIds: [] });
          break;
        case "assign":
        case "flag":
        case "pmReject":
        case "ctoReject":
          setDialog({ kind: move.kind as any, task: t });
          break;
      }
    } catch {
      /* action hook surfaces the error toast */
    }
  };

  /** Next forward action for a card button. */
  const primaryMove = (t: any): { label: string; to: string } | null => {
    const map: Record<string, { label: string; to: string }> = {
      BACKLOG: { label: "Assign", to: "TODO" },
      TODO: { label: "Start", to: "IN_PROGRESS" },
      IN_PROGRESS: { label: "Flag ✓", to: "FLAGGED_COMPLETE" },
      FLAGGED_COMPLETE: { label: "PM verify", to: "PM_VERIFIED" },
      PM_VERIFIED: { label: "CTO pass", to: "CTO_VERIFIED" },
      CTO_VERIFIED: { label: "Close", to: "CLOSED" },
    };
    const next = map[t.status];
    return next && resolveMove(t, next.to).ok ? next : null;
  };

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
            <div
              key={col}
              className={cn(
                "rounded-xl border bg-muted/40 p-2.5 transition-colors",
                dragOverCol === col && dragTaskId && "border-primary bg-primary/5",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragTaskId || e.dataTransfer.getData("text/task-id");
                setDragTaskId(null);
                setDragOverCol(null);
                const t = (tasks.data || []).find((x) => x.id === id);
                if (t) handleMove(t, col);
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {col.replace(/_/g, " ")}
                </span>
                <Badge variant="muted">{byStatus[col].length}</Badge>
              </div>
              <div className="space-y-2">
                {byStatus[col].map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    primary={primaryMove(t)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task-id", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragTaskId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragTaskId(null);
                      setDragOverCol(null);
                    }}
                    onMove={(to) => handleMove(t, to)}
                  />
                ))}
                {!byStatus[col].length ? (
                  <div className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">empty</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop-triggered payload dialogs */}
      {dialog ? (
        <DropDialogs
          dialog={dialog}
          members={memberOptions}
          onClose={() => setDialog(null)}
          onSubmit={async (kind, task, data) => {
            if (kind === "assign") await runAction("PATCH", `/tasks/${task.id}`, { assigneeIds: data.assigneeIds });
            else if (kind === "flag") await runAction("POST", `/tasks/${task.id}/flag-complete`, data);
            else if (kind === "pmReject")
              await runAction("POST", `/tasks/${task.id}/pm-reject`, {
                ...data,
                isPremature: !!data.isPremature,
                penaltyPoints: Number(data.penaltyPoints) || 25,
              });
            else if (kind === "ctoReject") await runAction("POST", `/tasks/${task.id}/cto-reject`, data);
          }}
        />
      ) : null}
    </div>
  );
}

function DropDialogs({
  dialog,
  members,
  onClose,
  onSubmit,
}: {
  dialog: { kind: string; task: any };
  members: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (kind: string, task: any, data: Record<string, any>) => Promise<void>;
}) {
  const { kind, task } = dialog;
  const common = { open: true, onOpenChange: (o: boolean) => !o && onClose() };

  if (kind === "assign")
    return (
      <FormDialog
        {...common}
        title={`Assign "${task.title}"`}
        description="Pick one or more collaborators — the task moves from BACKLOG into TODO."
        fields={[{ name: "assigneeIds", label: "Assignees (developers and the PM)", type: "checkboxes" as const, options: members }]}
        submitLabel="Assign"
        onSubmit={(d) => onSubmit(kind, task, { ...d, assigneeIds: d.assigneeIds || [] })}
      />
    );
  if (kind === "flag")
    return (
      <FormDialog
        {...common}
        title="Flag complete — git proof required"
        description="The PM gate opens once you attach a PR or commit."
        fields={[
          { name: "gitPrUrl", label: "Pull request URL", placeholder: "https://github.com/pointfex/squad-repo/pull/1" },
          { name: "gitCommitHash", label: "Commit hash", placeholder: "40-character SHA-1 commit hash" },
        ]}
        submitLabel="Flag complete"
        onSubmit={(d) => onSubmit(kind, task, d)}
      />
    );
  if (kind === "pmReject")
    return (
      <FormDialog
        {...common}
        title="PM rejection — premature flag"
        fields={[
          { name: "isPremature", label: "Premature flag (applies DPI penalty)", type: "checkbox" as const, value: true },
          { name: "penaltyPoints", label: "Penalty points (15-50)", type: "number" as const, value: 25, min: 15, max: 50 },
          { name: "feedback", label: "Feedback", type: "textarea" as const, required: true },
        ]}
        submitLabel="Reject"
        onSubmit={(d) => onSubmit(kind, task, d)}
      />
    );
  return (
    <FormDialog
      {...common}
      title="CTO rejection — fine + PMHI demerit"
      fields={[
        {
          name: "citationType",
          label: "Citation type",
          type: "select" as const,
          options: ["CODE_SMELL", "BAD_MERGE_REQUEST", "SECURITY_VULNERABILITY"].map((v) => ({ value: v, label: v })),
        },
        { name: "critique", label: "Critique (min 20 chars)", type: "textarea" as const, required: true },
      ]}
      submitLabel="Reject & fine"
      onSubmit={(d) => onSubmit(kind, task, d)}
    />
  );
}

function TaskCard({
  task: t,
  primary,
  draggable,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  task: any;
  primary: { label: string; to: string } | null;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onMove?: (to: string) => void;
}) {
  const isOverdue = t.isOverdue || (t.dueDate && new Date(t.dueDate) < new Date() && !["CTO_VERIFIED", "CLOSED"].includes(t.status));
  const completedLate = Boolean(t.completedLate);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
        >
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
          <div className="mt-1 text-[11px] text-muted-foreground">
            {(t.assigneeNames || []).length
              ? (t.assigneeNames || []).map((a: any) => a.fullName).join(", ")
              : t.assignedTo?.fullName || "unassigned"}
          </div>
          {primary ? (
            <div className="mt-2">
              <span
                role="button"
                tabIndex={0}
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove?.(primary.to);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onMove?.(primary.to);
                  }
                }}
                className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {primary.label} →
              </span>
            </div>
          ) : null}
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
  const isOverdue = t.isOverdue || (t.dueDate && new Date(t.dueDate) < new Date() && !["CTO_VERIFIED", "CLOSED"].includes(t.status));
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
  const memberOptions = (detail.data?.members || [])
    .filter((m: any) => m.role === "DEVELOPER" || m.role === "PM")
    .map((m: any) => ({ value: m.userId, label: `${m.fullName} (${m.role})` }));

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
          name: "assigneeIds",
          label: "Assignees — pick one or more (leave empty for backlog)",
          type: "checkboxes",
          options: memberOptions,
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
          assigneeIds: d.assigneeIds || [],
          dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : undefined,
        })
      }
    />
  );
}
