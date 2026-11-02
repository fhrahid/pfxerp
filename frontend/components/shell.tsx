"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  UserCog,
  Wallet,
  Landmark,
  Scale,
  Store,
  MessageSquareCode,
  ShieldCheck,
  Bug,
  Briefcase,
  Bell,
  Zap,
  Trophy,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, taka } from "@/lib/utils";
import { api, logout, ROLES } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FormDialog } from "@/components/form-dialog";

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: string;
  walletBalance: number;
  squadMemberships: { squad: { id: string; name: string } }[];
}

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, roles: null },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare, roles: null },
  { href: "/squads", label: "Squads", icon: Users, roles: null },
  { href: "/people", label: "People", icon: UserCog, roles: ["CEO", "CFO", "CTO", "CPO"] },
  { href: "/payroll", label: "Payroll", icon: Wallet, roles: ["PM", "CPO", "CEO"] },
  { href: "/finance", label: "Finance", icon: Landmark, roles: ["CEO", "CFO", "CTO", "CPO", "PM"] },
  { href: "/governance", label: "Governance", icon: Scale, roles: ["CEO", "CFO", "CTO", "CPO"] },
  { href: "/marketplace", label: "Marketplace", icon: Store, roles: null },
  { href: "/consultancy", label: "Consultancy", icon: MessageSquareCode, roles: null },
  { href: "/quality", label: "Quality & Certs", icon: ShieldCheck, roles: null },
  { href: "/bounty", label: "Bug Bounty", icon: Bug, roles: null },
  { href: "/clients", label: "Clients", icon: Briefcase, roles: ["CEO", "CFO", "CTO", "CPO", "PM"] },
  { href: "/notices", label: "Notices", icon: Bell, roles: null },
  { href: "/chaos", label: "Chaos", icon: Zap, roles: ["CEO", "PM"] },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, roles: null },
  { href: "/audit-logs", label: "Audit Logs", icon: FileText, roles: ["CEO", "CFO", "CTO", "CPO"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["CEO"] },
];

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("GET", "/auth/me"),
    staleTime: 30_000,
  });
}

export function useSquads() {
  return useQuery({
    queryKey: ["squads"],
    queryFn: () => api<any[]>("GET", "/squads"),
  });
}

export function useSprint() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["sprint"],
    queryFn: () => api<{ sprintNumber: number }>("GET", "/settings/current-sprint"),
    staleTime: 60_000,
  });
  return {
    ...query,
    setSprint: async (n: number) => {
      await api("POST", "/settings/current-sprint", { sprintNumber: n });
      await qc.invalidateQueries({ queryKey: ["sprint"] });
      toast.success(`Active sprint set to ${n}`);
    },
  };
}

export function useAction() {
  const qc = useQueryClient();
  return async (method: string, path: string, body?: unknown, idempotency?: boolean, message?: string) => {
    try {
      await api(method, path, body, { idempotency });
      toast.success(message || "Done");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message || "Failed");
      throw e;
    }
  };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const sprint = useSprint();
  const role = me.data?.role || "";
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const menuButton = React.useRef<HTMLButtonElement>(null);
  const closeButton = React.useRef<HTMLButtonElement>(null);
  const mobileNavigation = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      } else if (event.key === "Tab") {
        const controls = mobileNavigation.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const closeMenu = () => {
    setMobileOpen(false);
    menuButton.current?.focus();
  };

  const items = NAV.filter((n) => !n.roles || n.roles.includes(role));
  const initials = (me.data?.fullName || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const userFooter = (
    <div className="border-t p-3">
      <div className="flex items-center gap-2.5">
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">{me.data?.fullName}</div>
          <div className="text-[11px] font-medium text-primary">{role}</div>
          <div className="text-xs font-bold text-emerald-700">{taka(me.data?.walletBalance)}</div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start text-muted-foreground"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
      >
        <LogOut className="h-4 w-4" /> Log out
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        ref={mobileNavigation}
        id="mobile-navigation"
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
        style={{ visibility: mobileOpen ? "visible" : "hidden" }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-card shadow-2xl transition-transform duration-200 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-primary-foreground">
              P
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">
                POINTFEX <span className="text-primary">ERP</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Venture Studio</div>
            </div>
          </div>
          <Button
            ref={closeButton}
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 thin-scroll">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
                tabIndex={mobileOpen ? 0 : -1}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {userFooter}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-primary-foreground">
            P
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">
              POINTFEX <span className="text-primary">ERP</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Venture Studio</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 thin-scroll">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {userFooter}
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2.5 border-b bg-background/90 px-3.5 sm:px-6 backdrop-blur">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              ref={menuButton}
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <PageTitle pathname={pathname} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ROLES.isExec(role) ? (
              <FormDialog
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5 font-semibold text-xs sm:text-sm px-2.5 sm:px-3">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Sprint {sprint.data?.sprintNumber ?? "—"}
                  </Button>
                }
                title="Set the active sprint"
                description="Only C-level can change this — every squad, task and payroll follows it."
                fields={[{ name: "sprintNumber", label: "Sprint number", type: "number", value: sprint.data?.sprintNumber ?? 1, required: true, min: 1 }]}
                submitLabel="Set sprint"
                onSubmit={(d) => sprint.setSprint(Number(d.sprintNumber))}
              />
            ) : (
              <Badge variant="warning" className="px-2.5 sm:px-3 py-1 text-xs">
                Sprint {sprint.data?.sprintNumber ?? "—"}
              </Badge>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const titles: Record<string, [string, string]> = {
    "/overview": ["Overview", "Your studio snapshot"],
    "/tasks": ["Task Board", "Git proof, PM gate, CTO gate"],
    "/squads": ["Squads", "Dynamic roster and repositories"],
    "/people": ["People", "Profiles, roles and passwords"],
    "/payroll": ["Weekly Lab Payroll", "PM proposes · CHRO audits & disburses"],
    "/finance": ["Finance", "Sprint pool, loans, equity and the ledger"],
    "/governance": ["Governance", "2-of-3 board vote → CEO sign-off"],
    "/marketplace": ["Marketplace", "Boilerplate store for squads"],
    "/consultancy": ["Consultancy", "15-minute architecture office hours"],
    "/quality": ["Quality & Certifications", "Code audit citations and the certification gate"],
    "/bounty": ["Bug Bounty Arena", "Cross-squad adversarial QA"],
    "/clients": ["Real Clients", "Escrow funding and revenue waterfalls"],
    "/notices": ["Secure Notices", "End-to-end encrypted, zero-knowledge"],
    "/chaos": ["Chaos Console", "Live incidents and automated penalties"],
    "/leaderboard": ["Leaderboard", "50% squad valuation + 50% wallet"],
    "/settings": ["System Settings", "Economic constants"],
  };
  const key = Object.keys(titles)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  const [title, subtitle] = titles[key] || ["Pointfex ERP", ""];
  return (
    <div className="min-w-0">
      <h1 className="text-base sm:text-lg font-bold leading-tight truncate">{title}</h1>
      <p className="hidden sm:block text-xs text-muted-foreground truncate">{subtitle}</p>
    </div>
  );
}
