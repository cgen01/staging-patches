import type { Context } from "@netlify/functions";
import jwt from "jsonwebtoken";

function verifyToken(req: Request): boolean {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return false;

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  try {
    jwt.verify(auth.slice(7), jwtSecret);
    return true;
  } catch {
    return false;
  }
}

interface TeamConfig {
  githubSlug: string;
  excludeChildTeams?: string[];
}

const TEAM_SLUGS: Record<string, TeamConfig> = {
  mauve: { githubSlug: "simcapture-cloud-mauve-devs", excludeChildTeams: ["mauve-friends"] },
  mango: { githubSlug: "simcapture-cloud-mango-devs-all" },
  ambrosia: { githubSlug: "simcapture-cloud-ambrosia-devs" },
};

const GH_HEADERS = (token: string) => ({
  Authorization: `token ${token}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "staging-patches-dashboard",
});

// --- Cache layer 1: Team member caching (survives across requests in warm function instances) ---
const TEAM_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const teamMemberCache = new Map<string, { members: string[]; fetchedAt: number }>();

async function fetchTeamMemberLogins(githubSlug: string, githubToken: string): Promise<string[]> {
  const cached = teamMemberCache.get(githubSlug);
  if (cached && Date.now() - cached.fetchedAt < TEAM_CACHE_TTL) {
    return cached.members;
  }

  const res = await fetch(
    `https://api.github.com/orgs/blinemedical/teams/${githubSlug}/members?per_page=100`,
    { headers: GH_HEADERS(githubToken) }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch team ${githubSlug}: ${text}`);
  }

  const members: { login: string }[] = await res.json();
  const logins = members.map((m) => m.login);
  teamMemberCache.set(githubSlug, { members: logins, fetchedAt: Date.now() });
  return logins;
}

async function fetchTeamMembers(config: TeamConfig, githubToken: string): Promise<string[]> {
  const members = await fetchTeamMemberLogins(config.githubSlug, githubToken);

  if (!config.excludeChildTeams?.length) return members;

  const excludeResults = await Promise.all(
    config.excludeChildTeams.map((slug) => fetchTeamMemberLogins(slug, githubToken))
  );
  const excludeSet = new Set(excludeResults.flat());

  return members.filter((m) => !excludeSet.has(m));
}

interface GitHubSearchItem {
  number: number;
  title: string;
  created_at: string;
  html_url: string;
  state: string;
  user?: { login: string };
  pull_request?: { merged_at: string | null };
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubSearchItem[];
}

export default async (req: Request, _context: Context) => {
  if (!verifyToken(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return new Response(JSON.stringify({ error: "GitHub token not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || "2026", 10);
  const team = url.searchParams.get("team") || "all";

  // Resolve authors from team membership
  let authors: string[];
  try {
    if (team === "all") {
      const allConfigs = Object.values(TEAM_SLUGS);
      const results = await Promise.all(
        allConfigs.map((config) => fetchTeamMembers(config, githubToken))
      );
      authors = [...new Set(results.flat())];
    } else {
      const config = TEAM_SLUGS[team];
      if (!config) {
        return new Response(JSON.stringify({ error: `Unknown team: ${team}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      authors = await fetchTeamMembers(config, githubToken);
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch team members", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (authors.length === 0) {
    return new Response(JSON.stringify({ total_count: 0, items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authorQuery = authors.map((a) => `author:${a}`).join(" ");
  // Fetch Feb-Dec of the year + Jan of the next year (for T3 which spans Oct-Jan)
  const baseQuery = `repo:blinemedical/simcapture-cloud is:pr ${authorQuery} base:release- created:${year}-02-01..${year + 1}-01-31`;

  type PRItem = { number: number; title: string; created_at: string; html_url: string; status: "open" | "merged"; author: string };

  async function searchPRs(query: string, status: "open" | "merged"): Promise<PRItem[]> {
    const items: PRItem[] = [];
    let page = 1;
    let totalCount = 0;
    let fetchedCount = 0;

    do {
      const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
      const res = await fetch(searchUrl, { headers: GH_HEADERS(githubToken) });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data: GitHubSearchResponse = await res.json();
      totalCount = data.total_count;
      fetchedCount += data.items.length;

      items.push(
        ...data.items.map((item) => ({
          number: item.number,
          title: item.title,
          created_at: item.created_at,
          html_url: item.html_url,
          status,
          author: item.user?.login ?? "unknown",
        }))
      );
      page++;
    } while (fetchedCount < totalCount);

    return items;
  }

  let allItems: PRItem[];
  try {
    const [merged, open] = await Promise.all([
      searchPRs(`${baseQuery} is:merged`, "merged"),
      searchPRs(`${baseQuery} is:open`, "open"),
    ]);
    allItems = [...merged, ...open];
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "GitHub API error", details: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- Cache layer 2: HTTP Cache-Control headers ---
  const currentYear = new Date().getFullYear();
  const isPastYear = year < currentYear;
  const cacheMaxAge = isPastYear ? 86400 : 600; // past years: 24h, current year: 10min

  return new Response(JSON.stringify({ total_count: allItems.length, items: allItems }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheMaxAge}`,
    },
  });
};
