import { Badge } from "@/components/ui/badge";

export function GitSummary({ data: s }: { data: any }) {
  const kb = (n: number) =>
    n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
  const stack = (s.stack || []).slice(0, 6);

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      {s.description ? <p className="mb-2 text-sm text-muted-foreground">{s.description}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="warning">★ {s.stars}</Badge>
        <Badge variant="info">{s.forks} forks</Badge>
        <Badge variant={s.openIssues > 10 ? "warning" : "muted"}>{s.openIssues} issues</Badge>
        <Badge variant="success">code ~{kb(s.codeSizeBytes)}</Badge>
        <Badge variant="info">{s.contributorCount} contributors</Badge>
      </div>
      {stack.length ? (
        <div className="mt-3 flex h-7 overflow-hidden rounded-lg text-[10px] font-bold text-white">
          {stack.map((l: any) => (
            <div
              key={l.language}
              className="flex min-w-0 items-center justify-center whitespace-nowrap px-1.5"
              style={{ flex: Math.max(l.share, 2), background: LANG_COLORS[l.language] || "#64748b" }}
              title={`${l.language} ${l.share}%`}
            >
              <span className="truncate">{l.language} {l.share}%</span>
            </div>
          ))}
        </div>
      ) : null}
      {s.contributors?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.contributors.slice(0, 12).map((c: any) => (
            <span key={c.login} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt={c.login} className="h-5 w-5 rounded-full" />
              {c.login} <b className="text-emerald-700">{c.contributions}</b>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 text-[11px] text-muted-foreground">
        branch {s.defaultBranch || "—"} · last push {s.lastPushAt ? new Date(s.lastPushAt).toLocaleDateString() : "—"}
      </div>
    </div>
  );
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Java: "#b07219",
  Go: "#00ADD8", Rust: "#dea584", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
  Ruby: "#701516", PHP: "#4F5D95", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c",
  Dart: "#00B4AB", Kotlin: "#A97BFF", Swift: "#F05138", Vue: "#41b883",
};
