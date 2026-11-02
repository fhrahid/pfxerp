"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api, ROLES } from "@/lib/api";
import { useMe } from "@/components/shell";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_OPTIONS = ["DEVELOPER", "PM", "CFO", "CTO", "CPO", "CEO"].map((r) => ({ value: r, label: r }));

export default function PeoplePage() {
  const me = useMe();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<any[]>("GET", "/users") });
  const manage = ROLES.canManage(me.data?.role || "");
  const [copied, setCopied] = React.useState("");

  if (users.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {manage ? (
        <FormDialog
          trigger={<Button size="sm" className="gap-1.5"><UserPlus className="h-4 w-4" /> New member</Button>}
          title="Create member profile"
          description="A personal wallet is provisioned automatically."
          fields={[
            { name: "fullName", label: "Full name", required: true, placeholder: "Ayesha Rahman" },
            { name: "email", label: "Email", type: "email", required: true, placeholder: "ayesha@pointfex.com" },
            { name: "password", label: "Temporary password (min 8)", required: true, value: `Pointfex-${Math.random().toString(36).slice(2, 8)}` },
            { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS },
            { name: "studentId", label: "Student ID (optional)", placeholder: "CSE034" },
          ]}
          submitLabel="Create profile"
          onSubmit={(d) => api("POST", "/users", { ...d, studentId: d.studentId || undefined })}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Squads</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users.data || []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-semibold">{u.fullName}</TableCell>
                  <TableCell><Badge variant={u.role === "CEO" ? "warning" : "info"}>{u.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs">{u.studentId || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(u.squadMemberships || []).map((m: any) => m.squad?.name).filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard?.writeText(u.id);
                          setCopied(u.id);
                          setTimeout(() => setCopied(""), 1500);
                        }}
                      >
                        {copied === u.id ? "Copied!" : "ID"}
                      </Button>
                      {manage ? (
                        <FormDialog
                          trigger={<Button size="sm" variant="outline">Edit</Button>}
                          title={`Edit ${u.fullName}`}
                          fields={[
                            { name: "fullName", label: "Full name", value: u.fullName, required: true },
                            { name: "email", label: "Email", type: "email", value: u.email, required: true },
                            { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, value: u.role },
                            { name: "studentId", label: "Student ID", value: u.studentId || "" },
                            { name: "password", label: "New password (blank = keep)", placeholder: "min 8 chars" },
                            { name: "isActive", label: "Active (uncheck to revoke sessions)", type: "checkbox", value: true },
                          ]}
                          submitLabel="Save changes"
                          onSubmit={(d) =>
                            api("PATCH", `/users/${u.id}`, {
                              fullName: d.fullName,
                              email: d.email,
                              role: d.role,
                              studentId: d.studentId || null,
                              isActive: !!d.isActive,
                              ...(d.password ? { password: d.password } : {}),
                            })
                          }
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
