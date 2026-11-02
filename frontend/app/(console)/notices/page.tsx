"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { Send } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dt } from "@/lib/utils";
import { decryptNotice, encryptNotice, ensureNoticeKeys, noticeSignatureMessage, signNotice } from "@/lib/notice-crypto";
import { toast } from "sonner";

export default function NoticesPage() {
  const me = useMe();
  const role = me.data?.role || "";

  const notices = useQuery({ queryKey: ["notices"], queryFn: () => api<any[]>("GET", "/notices") });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<any[]>("GET", "/users"),
    enabled: ROLES.isCPO(role) || ROLES.isCEO(role),
  });

  React.useEffect(() => {
    if (!me.data?.id) return;
    ensureNoticeKeys(me.data.id).catch((error) => {
      toast.error((error as Error).message || "Secure notice keys could not be set up in this browser");
    });
  }, [me.data?.id]);

  return (
    <div className="space-y-4">
      {ROLES.isCPO(role) || ROLES.isCEO(role) ? (
        <FormDialog
          trigger={<Button size="sm" className="gap-1.5"><Send className="h-4 w-4" /> Dispatch notice</Button>}
          title="Dispatch encrypted notice"
          description="The message is encrypted and signed in this browser. Keep your local browser keys available to read notices later."
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
          onSubmit={async (d) => {
            if (!me.data?.id) throw new Error("Could not identify the signed-in user");
            const recipient = await api<{ publicKey: string | null }>("GET", `/notices/keys/${d.recipientId}`);
            if (!recipient.publicKey) throw new Error("Recipient must register notice keys before receiving an encrypted notice");
            await ensureNoticeKeys(me.data.id);
            const encryptedContent = await encryptNotice(d.message, recipient.publicKey);
            const signature = await signNotice(me.data.id, noticeSignatureMessage(d.recipientId, d.title, d.category, encryptedContent));
            const { message: _message, ...rest } = d;
            return api("POST", "/notices", { ...rest, encryptedContent, signature });
          }}
        />
      ) : null}

      {notices.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : notices.data?.length ? (
        <div className="space-y-3">
          {notices.data.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
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
                    extra={<DecryptedNotice userId={me.data?.id} encryptedContent={n.encryptedContent} />}
                  />
                  {n.status !== "ACKNOWLEDGED" ? (
                    <FormDialog
                      trigger={<Button size="sm" variant="success">Acknowledge</Button>}
                      title="Sign acknowledgment"
                      fields={[]}
                      submitLabel="Sign"
                      onSubmit={async () => {
                        if (!me.data?.id) throw new Error("Could not identify the signed-in user");
                        const acknowledgmentSignature = await signNotice(me.data.id, `ack:${n.id}`);
                        return api("POST", `/notices/${n.id}/acknowledge`, { acknowledgmentSignature });
                      }}
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

function DecryptedNotice({ userId, encryptedContent }: { userId?: string; encryptedContent: string }) {
  const [plaintext, setPlaintext] = React.useState("");
  const [error, setError] = React.useState("");

  async function decrypt() {
    try {
      if (!userId) throw new Error("Could not identify the signed-in user");
      setError("");
      setPlaintext(await decryptNotice(userId, encryptedContent));
    } catch (e) {
      setError((e as Error).message || "Unable to decrypt this notice in this browser");
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={decrypt}>Decrypt in this browser</Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {plaintext ? <div className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">{plaintext}</div> : null}
    </div>
  );
}
