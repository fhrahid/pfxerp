"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { useAction, useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";

/** Role-aware action buttons for a task, honouring the state machine. */
export function TaskActions({ task: t, onChanged }: { task: any; onChanged?: () => void }) {
  const me = useMe();
  const action = useAction();
  const role = me.data?.role || "";
  const isAssignee = t.assignedToId === me.data?.id;
  const canStart = isAssignee || ["PM", "CEO", "CTO", "CPO"].includes(role);

  const run = async (method: string, path: string, body?: unknown, idem?: boolean) => {
    await action(method, path, body, idem);
    onChanged?.();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {t.status === "TODO" && canStart ? (
        <Button size="sm" onClick={() => run("POST", `/tasks/${t.id}/start`)}>
          Start work
        </Button>
      ) : null}

      {t.status === "IN_PROGRESS" && isAssignee ? (
        <FormDialog
          trigger={<Button size="sm">Flag complete</Button>}
          title="Flag complete — git proof required"
          description="The PM gate opens once you attach a PR or commit."
          fields={[
            { name: "gitPrUrl", label: "Pull request URL", placeholder: "https://github.com/pointfex/squad-repo/pull/1" },
            { name: "gitCommitHash", label: "Commit hash", placeholder: "40-character SHA-1 commit hash", hint: "mono" },
          ]}
          submitLabel="Flag complete"
          onSubmit={(d) => run("POST", `/tasks/${t.id}/flag-complete`, d)}
        />
      ) : null}

      {t.status === "FLAGGED_COMPLETE" && (role === "PM" || role === "CEO") ? (
        <>
          <FormDialog
            trigger={<Button size="sm" variant="success">PM verify</Button>}
            title="PM verification"
            fields={[{ name: "comment", label: "Comment", type: "textarea", value: "Acceptance criteria met, commits verified." }]}
            submitLabel="Verify"
            onSubmit={(d) => run("POST", `/tasks/${t.id}/pm-verify`, d)}
          />
          <FormDialog
            trigger={<Button size="sm" variant="destructive">PM reject</Button>}
            title="PM rejection — premature flag"
            fields={[
              { name: "isPremature", label: "Premature flag (applies DPI penalty)", type: "checkbox", value: true },
              { name: "penaltyPoints", label: "Penalty points (15-50)", type: "number", value: 25, min: 15, max: 50 },
              { name: "feedback", label: "Feedback", type: "textarea", required: true, value: "PR contains empty stub functions; tests commented out." },
            ]}
            submitLabel="Reject"
            onSubmit={(d) => run("POST", `/tasks/${t.id}/pm-reject`, { ...d, isPremature: !!d.isPremature, penaltyPoints: Number(d.penaltyPoints) })}
          />
        </>
      ) : null}

      {t.status === "PM_VERIFIED" && role === "CTO" ? (
        <>
          <FormDialog
            trigger={<Button size="sm" variant="success">CTO pass</Button>}
            title="CTO verification pass"
            fields={[{ name: "critique", label: "Critique", type: "textarea", value: "Clean architecture, coverage verified." }]}
            submitLabel="Pass"
            onSubmit={(d) => run("POST", `/tasks/${t.id}/cto-verify`, d)}
          />
          <FormDialog
            trigger={<Button size="sm" variant="destructive">CTO reject & fine</Button>}
            title="CTO rejection — fine + PMHI demerit"
            fields={[
              {
                name: "citationType",
                label: "Citation type",
                type: "select",
                options: ["CODE_SMELL", "BAD_MERGE_REQUEST", "SECURITY_VULNERABILITY"].map((v) => ({ value: v, label: v })),
              },
              { name: "critique", label: "Critique (min 20 chars)", type: "textarea", required: true, value: "Unit tests are trivially mocked; business logic leaks into controllers." },
            ]}
            submitLabel="Reject & fine"
            onSubmit={(d) => run("POST", `/tasks/${t.id}/cto-reject`, d)}
          />
        </>
      ) : null}

      {t.status === "CTO_VERIFIED" && (ROLES_PM(role) || role === "CTO" || role === "CEO") ? (
        <Button size="sm" onClick={() => run("POST", `/tasks/${t.id}/close`)}>
          Close
        </Button>
      ) : null}
    </div>
  );
}

const ROLES_PM = (r: string) => r === "PM";
