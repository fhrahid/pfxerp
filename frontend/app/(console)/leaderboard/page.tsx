"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { taka } from "@/lib/utils";

export default function LeaderboardPage() {
  const lb = useQuery({ queryKey: ["leaderboard"], queryFn: () => api("GET", "/simulation-scores") });

  if (lb.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-500" /> Squad leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>Squad</TableHead><TableHead>Valuation</TableHead><TableHead>Health</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(lb.data?.squadLeaderboard || []).map((s: any) => (
                <TableRow key={s.squadId}>
                  <TableCell className="w-10 font-extrabold">{s.rank}</TableCell>
                  <TableCell className="font-semibold">{s.squadName}</TableCell>
                  <TableCell className="tabular-nums text-emerald-700">{taka(s.valuation)}</TableCell>
                  <TableCell><Badge variant={statusVariant(s.healthStatus)}>{s.healthStatus}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Student scores</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead><TableHead>Student</TableHead><TableHead>Role</TableHead><TableHead>Wallet</TableHead><TableHead>Squad valuation</TableHead><TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lb.data?.studentScores || []).slice(0, 20).map((s: any, i: number) => (
                <TableRow key={s.userId}>
                  <TableCell className="w-10 font-extrabold">{i + 1}</TableCell>
                  <TableCell className="font-semibold">{s.fullName}</TableCell>
                  <TableCell><Badge variant="muted">{s.role}</Badge></TableCell>
                  <TableCell className="tabular-nums text-emerald-700">{taka(s.walletBalance)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{taka(s.squadValuation)}</TableCell>
                  <TableCell className="text-right text-base font-extrabold">{s.simulationScore}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
