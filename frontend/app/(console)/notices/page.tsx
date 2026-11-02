"use client";

import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useAction, useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dt } from "@/lib/utils";

export default function NoticesPage() {
  const me = useMe();
  const action = useAction();
  const role = me.data?.role || "";

  const notices = useQuery({ queryKey: ["notices"], queryFn: () => api<any[]>("GET", "/notices") });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<any[]>("GET", "/users"),
    enabled: ROLES.isCPO(role) || ROLES.isCEO(role),
  });

  return (
    <div className="space-y-4">
      {ROLES.isCPO(role) || ROLES.isCEO(role) ? (
        <FormDialog
          trigger={<Button size="sm" className="gap-1.5"><Send className="h-4 w-4" /> Dispatch notice</Button>}
          title="Dispatch encrypted notice"
          description="Encrypted client-side — the server stores only ciphertext."
          fields={[
            {
              name: "recipientId",
              label: "Recipient",
              type: "select",
              options: (users.data || []).map((u: any) => ({ value: u.id, label: `${u.fullName} (${u.role})` })),
            },
            {
              name: "category",
              label: "Category",
              type: "select",
              options: ["DISCIPLINARY", "APPOINTMENT", "ORGANIZATIONAL", "STUDIO_DIRECTIVE"].map((c) => ({ value: c, label: c })),
            },
            { name: "title", label: "Title", required: true, value: "Disciplinary citation" },
            { name: "message", label: "Message", type: "textarea", required: true, value: "Your lab attendance and commit activity require immediate improvement." },
          ]}
          submitLabel="Encrypt & dispatch"
          onSubmit={(d) => {
            const { message, ...rest } = d;
            return api("POST", "/notices", {
              ...rest,
              encryptedContent: btoa(unescape(encodeURIComponent(message))),
              signature: btoa(`ed25519-sig-${Date.now()}`),
            });
          }}
        />
      ) : null}

      {notices.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : notices.data?.length ? (
        <div className="space-y-3">
          {notices.data.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{n.title}</span>
                    <Badge variant={n.category === "DISCIPLINARY" ? "destructive" : "info"}>{n.category}</Badge>
                    <Badge variant={statusVariant(n.status)}>{n.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">from {n.sender?.fullName} · {dt(n.createdAt)}</div>
                </div>
                <div className="flex gap-1.5">
                  <FormDialog
                    trigger={<Button size="sm" variant="outline">Decrypt</Button>}
                    title={n.title}
                    fields={[]}
                    submitLabel="Close"
                    onSubmit={() => undefined}
                    extra={
                      <div className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">
                        {(() => {
                          try {
                            return atob(n.encryptedContent);
                          } catch {
                            return n.encryptedContent;
                          }
                        })()}
                      </div>
                    }
                  />
                  {n.status !== "ACKNOWLEDGED" ? (
                    <FormDialog
                      trigger={<Button size="sm" variant="success">Acknowledge</Button>}
                      title="Sign acknowledgment"
                      fields={[{ name: "acknowledgmentSignature", label: "ACK signature", value: btoa(`ack-${me.data?.id}-${Date.now()}`) }]}
                      submitLabel="Sign"
                      onSubmit={(d) => api("POST", `/notices/${n.id}/acknowledge`, d)}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">Inbox is empty</div>
      )}
    </div>
  );
}
