"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { login } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const user = await login(String(data.get("email")), String(data.get("password")));
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}`);
      router.push("/overview");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-2xl font-extrabold text-primary-foreground shadow-lg shadow-primary/30">
            P
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide">
              POINTFEX <span className="text-primary">ERP</span>
            </h1>
            <p className="text-xs italic text-muted-foreground">&ldquo;From an idea to a greater impact&rdquo;</p>
          </div>
        </div>
        <Card className="shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Sign in to the studio</CardTitle>
            <CardDescription>Use the credentials issued by your CHRO or CEO.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="you@pointfex.com" autoComplete="username" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="mt-1 gap-2" disabled={busy}>
                <Rocket className="h-4 w-4" />
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Venture Studio Console · CSE474 · Southeast University
        </p>
      </div>
    </main>
  );
}
