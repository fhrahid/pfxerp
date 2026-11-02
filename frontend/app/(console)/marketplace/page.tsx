"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, ShoppingCart } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useMe, useSquads } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { taka } from "@/lib/utils";

export default function MarketplacePage() {
  const me = useMe();
  const squads = useSquads();
  const role = me.data?.role || "";

  const listings = useQuery({ queryKey: ["listings"], queryFn: () => api<any[]>("GET", "/cto/marketplace/listings") });
  const myCerts = useQuery({ queryKey: ["my-certs"], queryFn: () => api<any[]>("GET", "/cto/certifications/me") });
  const canAuthor = ROLES.isCTO(role) || (myCerts.data || []).some((c: any) => c.certificationType === "MARKETPLACE_AUTHOR" && c.isPreapproved);
  const mySquadOptions = (me.data?.squadMemberships || []).map((m: any) => ({ value: m.squad.id, label: m.squad.name }));

  if (listings.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {canAuthor ? (
        <FormDialog
          trigger={<Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Publish listing</Button>}
          title="Publish marketplace listing"
          description="100% of every sale goes straight to your wallet."
          fields={[
            { name: "title", label: "Title", required: true, placeholder: "Enterprise BullMQ Event Bus Starter" },
            { name: "price", label: "Price (৳)", type: "number", value: 8000, required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "repositoryUrl", label: "Repository URL", value: "https://github.com/pointfex/starter" },
          ]}
          submitLabel="Publish"
          onSubmit={(d) => api("POST", "/cto/marketplace/listings", { ...d, price: Number(d.price) })}
        />
      ) : (
        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          Want to sell here? Apply for the <b>MARKETPLACE_AUTHOR</b> certification under Quality &amp; Certs (CTO-reviewed, score ≥ 80).
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(listings.data || []).map((l) => (
          <Card key={l.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold leading-snug">{l.title}</div>
                {l.isCtoVerified ? <Badge variant="success">CTO ✓</Badge> : null}
              </div>
              <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">{l.description || "—"}</p>
              <div className="mt-1 text-[11px] text-muted-foreground">by {l.authorName} · {l.purchaseCount} sold</div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xl font-extrabold tabular-nums text-emerald-700">{taka(l.price)}</span>
                {ROLES.isPM(role) ? (
                  <FormDialog
                    trigger={<Button size="sm" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Buy</Button>}
                    title={`Purchase ${l.title}`}
                    description="Paid from the squad treasury — one license per squad."
                    fields={[{ name: "buyerSquadId", label: "Squad", type: "select", options: mySquadOptions }]}
                    submitLabel="Purchase"
                    onSubmit={(d) => api("POST", `/cto/marketplace/listings/${l.id}/purchase`, d, { idempotency: true })}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
        {!(listings.data || []).length ? (
          <div className="col-span-full rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            No listings yet
          </div>
        ) : null}
      </div>
    </div>
  );
}
