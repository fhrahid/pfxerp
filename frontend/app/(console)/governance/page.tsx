"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GovernancePage() {
  const me = useMe();
  const action = useAction();
  const role = me.data?.role || "";

  const decisions = useQuery({ queryKey: ["decisions"], queryFn: () => api<any[]>("GET", "/governance/decisions") });
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => api<any[]>("GET", "/loans"),
    enabled: ROLES.isCFO(role) || ROLES.isCEO(role),
  });
  const pendingLoans = (loans.data || []).filter((l: any) => !l.disbursedAt && l.status === "ACTIVE");
  const loanOptions = pendingLoans.map((l: any) => ({
    value: l.id,
    label: `Loan ${l.borrowerSquad?.name || ""} — ৳${Number(l.principalAmount).toLocaleString()}`,
  }));

  if (decisions.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {!ROLES.isCEO(role) && ROLES.isExec(role) ? (
        <FormDialog
          trigger={<Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Propose decision</Button>}
          title="Propose board decision"
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "description", label: "Description", type: "textarea", required: true },
            {
              name: "category",
              label: "Category",
              type: "select",
              options: ["LOAN_APPROVAL", "SWAP_REQUEST", "POLICY_CHANGE", "EMERGENCY_ACTION"].map((c) => ({ value: c, label: c })),
            },
            {
              name: "referenceId",
              label: "Linked loan (LOAN_APPROVAL)",
              type: "select",
              options: [{ value: "", label: "— none —" }, ...loanOptions],
              value: "",
            },
          ]}
          submitLabel="Propose"
          onSubmit={(d) => api("POST", "/governance/decisions", { ...d, referenceId: d.referenceId || undefined })}
        />
      ) : null}

      {decisions.data?.length ? (
        <div className="space-y-3">
          {decisions.data.map((d) => {
            const myVote = (d.votes || []).find((v: any) => v.voterId === me.data?.id);
            const canVote = ["CFO", "CTO", "CPO"].includes(role) && d.proposedById !== me.data?.id && !myVote && d.status === "PROPOSED";
            const canDecide = ROLES.isCEO(role) && ["PROPOSED", "APPROVED"].includes(d.status);
            return (
              <Card key={d.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{d.title}</span>
                        <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                        <Badge variant="info">{d.category}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {canVote ? (
                        <>
                          <Button size="sm" variant="success" onClick={() => action("POST", `/governance/decisions/${d.id}/vote`, { vote: "APPROVE" })}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => action("POST", `/governance/decisions/${d.id}/vote`, { vote: "REJECT" })}>Reject</Button>
                        </>
                      ) : null}
                      {canDecide ? (
                        <>
                          <Button size="sm" variant="success" onClick={() => action("POST", `/governance/decisions/${d.id}/ceo-decide`, { approve: true })}>CEO sign-off</Button>
                          <Button size="sm" variant="destructive" onClick={() => action("POST", `/governance/decisions/${d.id}/ceo-decide`, { approve: false })}>CEO veto</Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {(d.votes || []).map((v: any) => (
                      <div key={v.id} className="text-xs">
                        <b>{v.voter?.role}</b> {v.voter?.fullName} —{" "}
                        <b className={v.vote === "APPROVE" ? "text-emerald-700" : "text-destructive"}>{v.vote}</b>
                      </div>
                    ))}
                    {!(d.votes || []).length ? <div className="text-xs text-muted-foreground">No votes yet</div> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No decisions</div>
      )}
    </div>
  );
}
