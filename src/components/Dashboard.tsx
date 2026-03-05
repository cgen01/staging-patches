import { useEffect, useState } from "react";
import { fetchPRs, clearToken } from "@/lib/api";
import { groupByTertile, accumulateByMonthMultiYear, type PR, type TertileData, type CumulativeRow } from "@/lib/tertiles";
import { TertileChart, CumulativeAreaChart, UserPieChart } from "./TertileChart";
import { cn } from "@/lib/cn";

type ViewMode = "tertile" | "user" | "cumulative";

const START_YEAR = 2025;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

export function Dashboard() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [view, setView] = useState<ViewMode>("tertile");
  const [prs, setPrs] = useState<PR[]>([]);
  const [cumulativeData, setCumulativeData] = useState<CumulativeRow[]>([]);
  const [cumulativeYears, setCumulativeYears] = useState<[number, number]>([CURRENT_YEAR - 1, CURRENT_YEAR]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prevYearT3Count, setPrevYearT3Count] = useState<number | null>(null);
  const [prevYearTotal, setPrevYearTotal] = useState<number | null>(null);
  const [prevYearPrs, setPrevYearPrs] = useState<PR[]>([]);

  // Fetch current year + previous year for tertile/user view
  useEffect(() => {
    if (view !== "tertile" && view !== "user") return;
    setLoading(true);
    setError("");
    const prevYear = year - 1;
    Promise.all([
      fetchPRs(year).then((data) => data.items as PR[]),
      fetchPRs(prevYear).then((data) => data.items as PR[]),
    ])
      .then(([items, prevItems]) => {
        setPrs(items);
        setPrevYearPrs(prevItems);
        const grouped = groupByTertile(prevItems, prevYear);
        setPrevYearT3Count(grouped.find((t) => t.key === "T3")?.count ?? 0);
        setPrevYearTotal(grouped.reduce((sum, t) => sum + t.count, 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year, view]);

  // Fetch current year + previous year for cumulative view
  useEffect(() => {
    if (view !== "cumulative") return;
    const prevYear = year - 1;
    setLoading(true);
    setError("");
    Promise.all([
      fetchPRs(prevYear).then((data) => ({ year: prevYear, prs: data.items as PR[] })),
      fetchPRs(year).then((data) => ({ year, prs: data.items as PR[] })),
    ])
      .then((results) => {
        setCumulativeData(accumulateByMonthMultiYear(results));
        setCumulativeYears([prevYear, year]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year, view]);

  const tertiles = groupByTertile(prs, year);

  function handleLogout() {
    clearToken();
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staging Patches</h1>
        <button
          onClick={handleLogout}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Logout
        </button>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="flex rounded-md border border-border">
          <button
            onClick={() => setView("tertile")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-l-md cursor-pointer",
              view === "tertile"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            )}
          >
            By Tertile
          </button>
          <button
            onClick={() => setView("user")}
            className={cn(
              "px-3 py-1.5 text-sm cursor-pointer",
              view === "user"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            )}
          >
            By User
          </button>
          <button
            onClick={() => setView("cumulative")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-r-md cursor-pointer",
              view === "cumulative"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            )}
          >
            Cumulative
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <svg className="h-8 w-8 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : error ? (
        <div className="py-20 text-center text-destructive">{error}</div>
      ) : (
        <>
          {/* Chart */}
          {view !== "user" && (
            <div className="mb-8 rounded-xl border border-border bg-card p-4">
              {view === "tertile" ? (
                <TertileChart data={tertiles} />
              ) : (
                <CumulativeAreaChart data={cumulativeData} years={cumulativeYears} />
              )}
            </div>
          )}

          {/* Stats Cards */}
          {view === "tertile" && (
            <>
              <div className="mb-4 rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-sm text-muted-foreground">{year} Total</p>
                <p className="text-3xl font-bold mt-1">
                  {tertiles.reduce((sum, t) => sum + t.count, 0)}
                </p>
                {prevYearTotal != null && prevYearTotal > 0 && (() => {
                  const currTotal = tertiles.reduce((sum, t) => sum + t.count, 0);
                  const change = ((currTotal - prevYearTotal) / prevYearTotal) * 100;
                  return (
                    <p className={cn(
                      "text-sm mt-1 font-medium",
                      change > 0 ? "text-red-500" : change < 0 ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {change > 0 ? "+" : ""}{change.toFixed(0)}% vs {year - 1}
                    </p>
                  );
                })()}
              </div>
              <PRList tertiles={tertiles} prevYearT3Count={prevYearT3Count} prevYear={year - 1} />
            </>
          )}
          {view === "user" && <UserView prs={prs} prevYearPrs={prevYearPrs} prevYear={year - 1} />}
          {view === "cumulative" && (
            <CumulativeCards data={cumulativeData} years={cumulativeYears} />
          )}
        </>
      )}
    </div>
  );
}

function CumulativeCards({ data, years }: { data: CumulativeRow[]; years: [number, number] }) {
  if (data.length === 0) return null;
  const lastMonth = data[data.length - 1];
  const prevTotal = (lastMonth[String(years[0])] as number) ?? 0;
  const currTotal = (lastMonth[String(years[1])] as number) ?? 0;
  const change = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">{years[0]}</p>
        <p className="text-3xl font-bold mt-1">{prevTotal}</p>
        <p className="text-sm text-muted-foreground mt-0.5">staging patches</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">{years[1]}</p>
        <p className="text-3xl font-bold mt-1">{currTotal}</p>
        <p className="text-sm text-muted-foreground mt-0.5">staging patches</p>
        {change !== null && (
          <p
            className={cn(
              "text-sm mt-1 font-medium",
              change > 0 ? "text-red-500" : change < 0 ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(0)}% vs {years[0]}
          </p>
        )}
      </div>
    </div>
  );
}

function UserView({ prs, prevYearPrs, prevYear }: { prs: PR[]; prevYearPrs: PR[]; prevYear: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const byUser: Record<string, PR[]> = {};
  for (const pr of prs) {
    (byUser[pr.author] ??= []).push(pr);
  }

  const prevByUser: Record<string, number> = {};
  for (const pr of prevYearPrs) {
    prevByUser[pr.author] = (prevByUser[pr.author] ?? 0) + 1;
  }

  const users = Object.entries(byUser)
    .map(([author, userPrs]) => ({ author, prs: userPrs }))
    .sort((a, b) => b.prs.length - a.prs.length);

  const pieData = users.map((u) => ({ name: u.author, count: u.prs.length }));

  return (
    <div className="space-y-4">
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <UserPieChart data={pieData} />
      </div>
      <div className="mb-4 rounded-xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="text-3xl font-bold mt-1">{prs.length}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          across {users.length} contributors
        </p>
      </div>
      {users.map((u) => {
        const prevCount = prevByUser[u.author] ?? 0;
        const change = prevCount > 0 ? ((u.prs.length - prevCount) / prevCount) * 100 : null;

        return (
        <div key={u.author}>
          <button
            onClick={() => setExpanded(expanded === u.author ? null : u.author)}
            className="w-full text-left rounded-lg border border-border bg-card px-4 py-3 hover:bg-secondary flex justify-between items-center cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">
                {u.author} — {u.prs.length} PRs
              </span>
              {change !== null && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    change > 0 ? "text-red-500" : change < 0 ? "text-green-600" : "text-muted-foreground"
                  )}
                >
                  ({change > 0 ? "+" : ""}{change.toFixed(0)}% vs {prevYear})
                </span>
              )}
              {change === null && prevCount === 0 && (
                <span className="text-xs text-muted-foreground">
                  (new in {prevYear + 1})
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-sm">
              {expanded === u.author ? "Hide" : "Show"}
            </span>
          </button>
          {expanded === u.author && (
            <div className="mt-1 divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
              {u.prs.map((pr) => (
                <PRRow key={pr.number} pr={pr} />
              ))}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function PRList({ tertiles, prevYearT3Count, prevYear }: { tertiles: TertileData[]; prevYearT3Count: number | null; prevYear: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="mt-8 space-y-4">
      {tertiles.map((t, i) => {
        let change: number | null = null;
        let compLabel = "";

        if (i === 0 && prevYearT3Count != null && prevYearT3Count > 0) {
          change = ((t.count - prevYearT3Count) / prevYearT3Count) * 100;
          compLabel = `${prevYear} T3`;
        } else if (i > 0 && tertiles[i - 1].count > 0) {
          change = ((t.count - tertiles[i - 1].count) / tertiles[i - 1].count) * 100;
          compLabel = tertiles[i - 1].key;
        }

        return (
        <div key={t.key}>
          <button
            onClick={() => setExpanded(expanded === t.key ? null : t.key)}
            className="w-full text-left rounded-lg border border-border bg-card px-4 py-3 hover:bg-secondary flex justify-between items-center cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">
                {t.label} — {t.count} PRs
              </span>
              {change !== null && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    change > 0 ? "text-red-500" : change < 0 ? "text-green-600" : "text-muted-foreground"
                  )}
                >
                  ({change > 0 ? "+" : ""}{change.toFixed(0)}% vs {compLabel})
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-sm">
              {expanded === t.key ? "Hide" : "Show"}
            </span>
          </button>
          {expanded === t.key && t.prs.length > 0 && (
            <div className="mt-1 divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
              {t.prs.map((pr) => (
                <PRRow key={pr.number} pr={pr} />
              ))}
            </div>
          )}
          {expanded === t.key && t.prs.length === 0 && (
            <p className="mt-2 ml-4 text-sm text-muted-foreground">
              No PRs in this tertile.
            </p>
          )}
        </div>
        );
      })}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function PRRow({ pr }: { pr: PR }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50">
      <div className="mt-0.5">
        {pr.status === "merged" ? (
          <svg className="w-4 h-4 text-purple-600" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8-9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM4.25 5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-green-600" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm text-foreground hover:text-indigo-600 hover:underline"
          >
            {pr.title}
          </a>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              pr.status === "merged"
                ? "bg-purple-100 text-purple-700"
                : "bg-green-100 text-green-700"
            )}
          >
            {pr.status === "merged" ? "Merged" : "Open"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          #{pr.number} opened {timeAgo(pr.created_at)} by {pr.author}
        </p>
      </div>
    </div>
  );
}
