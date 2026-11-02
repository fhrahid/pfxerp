"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Github, Pencil, Plus, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, taka } from "@/lib/utils";
import { GitSummary } from "./git-summary";

export default function SquadsPage() {
  const me = useMe();
  const squads = useSquads();
  const action = useAction();
  const role = me.data?.role || "";
  const manage = ROLES.canManage(role);

  if (squads.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {manage ? (
        <div className="flex flex-wrap gap-2">
          <FormDialog
            trigger={<Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New squad</Button>}
            title="Create squad"
            description="The treasury is funded automatically from the system reserve."
            fields={[
              { name: "name", label: "Squad name", required: true, placeholder: "Squad 7" },
              { name: "description", label: "Description", placeholder: "Product engineering squad" },
              { name: "initialBalance", label: "Initial treasury (৳)", type: "number", value: 100000, min: 0 },
            ]}
            submitLabel="Create squad"
            onSubmit={(d) => api("POST", "/squads", { ...d, initialBalance: Number(d.initialBalance) })}
          />
          <FormDialog
            trigger={<Button size="sm" variant="outline" className="gap-1.5"><UserPlus className="h-4 w-4" /> Transfer member</Button>}
            title="Transfer member (৳5,000 fee to destination squad)"
            fields={[
              { name: "userId", label: "User ID (copy from People)", required: true, hint: "mono", placeholder: "uuid" },
              { name: "fromSquadId", label: "From squad", type: "select", options: (squads.data || []).map((s: any) => ({ value: s.id, label: s.name })) },
              { name: "toSquadId", label: "To squad", type: "select", options: (squads.data || []).map((s: any) => ({ value: s.id, label: s.name })) },
            ]}
            submitLabel="Transfer"
            onSubmit={(d) => api("POST", "/squads/members/transfer", d, { idempotency: true })}
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Squad</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Treasury</TableHead>
                <TableHead>Valuation</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(squads.data || []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.name}</TableCell>
                  <TableCell>{s.memberCount}</TableCell>
                  <TableCell className="font-semibold tabular-nums text-emerald-700">{taka(s.balance)}</TableCell>
                  <TableCell className="tabular-nums">{taka(s.valuation)}</TableCell>
                  <TableCell><Badge variant={statusVariant(s.healthStatus)}>{s.healthStatus}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <SquadDetailButton squadId={s.id} />
                      <GitButton squadId={s.id} name={s.name} />
                      {manage ? (
                        <FormDialog
                          trigger={<Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>}
                          title={`Edit ${s.name}`}
                          fields={[
                            { name: "name", label: "Name", value: s.name, required: true },
                            { name: "description", label: "Description", value: s.description || "" },
                            { name: "isActive", label: "Active", type: "checkbox", value: true },
                          ]}
                          submitLabel="Save"
                          onSubmit={(d) => api("PATCH", `/squads/${s.id}`, { name: d.name, description: d.description, isActive: !!d.isActive })}
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

function SquadDetailButton({ squadId }: { squadId: string }) {
  const detail = useQuery({
    queryKey: ["squad", squadId],
    queryFn: () => api<any>("GET", `/squads/${squadId}`),
    enabled: false,
  });
  const [open, setOpen] = React.useState(false);
  const me = useMe();
  const action = useAction();
  const manage = ROLES.canManage(me.data?.role || "");
  const qc = useQueryClient();

  React.useEffect(() => {
    if (open) detail.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Open</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl thin-scroll">
            {detail.isLoading || !detail.data ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Squad · {detail.data.name}</h3>
                  <Badge variant={statusVariant(detail.data.healthStatus)}>{detail.data.healthStatus}</Badge>
                </div>
                <div className="mb-4 flex gap-2">
                  <Badge variant="success" className="px-3 py-1">{taka(detail.data.balance)} treasury</Badge>
                  <Badge variant="info" className="px-3 py-1">valuation {taka(detail.data.valuation)}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Allocation</TableHead>
                      {manage ? <TableHead /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data.members.map((m: any) => (
                      <TableRow key={m.membershipId}>
                        <TableCell>
                          <div className="font-medium">{m.fullName}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </TableCell>
                        <TableCell><Badge variant="muted">{m.role}</Badge></TableCell>
                        <TableCell>{Math.round(m.allocation * 100)}%</TableCell>
                        {manage ? (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={async () => {
                                if (!confirm(`Remove ${m.fullName}? A ৳5,000 fee is charged to the squad.`)) return;
                                try {
                                  await api("DELETE", `/squads/${squadId}/members/${m.userId}`, undefined, { idempotency: true });
                                  toast.success("Member removed");
                                  detail.refetch();
                                  qc.invalidateQueries({ queryKey: ["squads"] });
                                } catch (e) {
                                  toast.error((e as Error).message);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {manage ? (
                  <div className="mt-4">
                    <FormDialog
                      trigger={<Button size="sm" variant="outline" className="gap-1.5"><UserPlus className="h-4 w-4" /> Add member</Button>}
                      title={`Add member to ${detail.data.name}`}
                      fields={[
                        { name: "userId", label: "User ID (copy from People)", required: true, hint: "mono" },
                        { name: "role", label: "Squad role", type: "select", options: [{ value: "DEVELOPER", label: "DEVELOPER" }, { value: "PM", label: "PM (allocation 1.0)" }] },
                        { name: "allocation", label: "Allocation", type: "number", value: 1, step: 0.01, min: 0.01, max: 1 },
                      ]}
                      submitLabel="Add member"
                      onSubmit={async (d) => {
                        await api("POST", `/squads/${squadId}/members`, { userId: d.userId, role: d.role, allocation: Number(d.allocation) });
                        detail.refetch();
                        qc.invalidateQueries({ queryKey: ["squads"] });
                      }}
                    />
                  </div>
                ) : null}
              </>
            )}
            <div className="mt-4 text-right">
              <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ GitHub ------------------------------ */

function GitButton({ squadId, name }: { squadId: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Github className="h-4 w-4" /> Git
      </Button>
      {open ? <GitModal squadId={squadId} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GitModal({ squadId, name, onClose }: { squadId: string; name: string; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const role = me.data?.role || "";
  const canManage = ROLES.isExec(role) || (role === "PM" && (me.data?.squadMemberships || []).some((m: any) => m.squad.id === squadId));
  const [selected, setSelected] = React.useState<string>("");

  const repos = useQuery({
    queryKey: ["git-repos", squadId],
    queryFn: () => api<any[]>("GET", `/squads/${squadId}/github/repos`),
  });
  const activeId = selected && repos.data?.find((r: any) => r.id === selected) ? selected : repos.data?.[0]?.id;
  const summary = useQuery({
    queryKey: ["git-summary", activeId],
    queryFn: () => api("GET", `/squads/${squadId}/github/repos/${activeId}/summary`),
    enabled: Boolean(activeId),
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["git-activity", activeId],
    queryFn: () => api("GET", `/squads/${squadId}/github/repos/${activeId}/activity`),
    enabled: Boolean(activeId),
    retry: false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl thin-scroll">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold"><Github className="h-5 w-5" /> {name} repositories</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>

        {repos.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : repos.data?.length ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {repos.data.map((r: any) => (
                <Button
                  key={r.id}
                  size="sm"
                  variant={r.id === activeId ? "default" : "outline"}
                  onClick={() => setSelected(r.id)}
                >
                  {r.name}
                </Button>
              ))}
              {canManage ? (
                <>
                  <AddRepoButton squadId={squadId} onAdded={() => repos.refetch()} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!activeId || !confirm("Remove this repository?")) return;
                      try {
                        await api("DELETE", `/squads/${squadId}/github/repos/${activeId}`);
                        setSelected("");
                        repos.refetch();
                        toast.success("Repository removed");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => { summary.refetch(); activity.refetch(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {summary.isLoading ? (
              <Skeleton className="h-36 w-full rounded-xl" />
            ) : summary.data ? (
              <GitSummary data={summary.data} />
            ) : summary.error ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {(summary.error as Error).message}
              </div>
            ) : null}

            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent commits</div>
              {activity.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : activity.data?.commits?.length ? (
                <div className="space-y-1.5">
                  {activity.data.commits.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg border p-2.5">
                      <code className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">{c.sha}</code>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{c.message}</div>
                        <div className="text-[11px] text-muted-foreground">{c.author} · {dt(c.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {activity.error ? (activity.error as Error).message : "No commits"}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No repositories connected yet.
          </div>
        )}
        {canManage ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Only the squad PM and C-level can connect or remove repositories.
          </div>
        ) : null}
      </div>
    </div>
  );
}

const PAT_HELP = (
  <details className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
    <summary className="cursor-pointer font-semibold">🔒 How to get a Personal Access Token (private repos)</summary>
    <ol className="mt-2 list-decimal space-y-1 pl-4">
      <li>GitHub → avatar (top-right) → <b>Settings</b></li>
      <li>Left menu bottom → <b>Developer settings</b></li>
      <li><b>Personal access tokens → Tokens (classic)</b> → Generate new token (classic)</li>
      <li>Note &ldquo;Pointfex ERP&rdquo;, choose an expiry</li>
      <li>Scopes: tick <b>repo</b></li>
      <li>Generate → copy the <code className="font-mono">ghp_…</code> value (shown once)</li>
      <li>Paste it below — stored server-side, per repository</li>
    </ol>
  </details>
);

function AddRepoButton({ squadId, onAdded }: { squadId: string; onAdded: () => void }) {
  return (
    <FormDialog
      trigger={<Button size="sm" variant="success" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add repo</Button>}
      title="Connect GitHub repository"
      description="Squads can connect as many repositories as they run."
      extra={PAT_HELP}
      fields={[
        { name: "repoUrl", label: "Repository URL", required: true, placeholder: "https://github.com/org/project" },
        { name: "name", label: "Display name (optional)", placeholder: "pointfex.com" },
        { name: "token", label: "Personal Access Token (private repos)", placeholder: "ghp_…" },
      ]}
      submitLabel="Connect"
      onSubmit={async (d) => {
        await api("POST", `/squads/${squadId}/github/repos`, { repoUrl: d.repoUrl, name: d.name || undefined, token: d.token || undefined });
        onAdded();
      }}
    />
  );
}
