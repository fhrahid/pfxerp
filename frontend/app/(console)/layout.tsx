"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/api";
import { Shell, useMe } from "@/components/shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasSession = typeof window !== "undefined" && Boolean(loadSession());
  const me = useMe();

  React.useEffect(() => {
    if (!hasSession) router.replace("/");
  }, [hasSession, router]);

  if (!hasSession) return null;

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden md:block w-60 shrink-0 border-r bg-card p-4">
          <Skeleton className="h-10 w-full" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (me.isError) return null;

  return <Shell>{children}</Shell>;
}
