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

  const authors = ["cgen01", "jayli201", "cait-car", "aqnguyen97", "laurabrooks"];
  const authorQuery = authors.map((a) => `author:${a}`).join(" ");
  // Fetch Feb-Dec of the year + Jan of the next year (for T3 which spans Oct-Jan)
  const query = `repo:blinemedical/simcapture-cloud is:pr ${authorQuery} base:release- created:${year}-02-01..${year + 1}-01-31`;

  const allItems: { number: number; title: string; created_at: string; html_url: string; status: "open" | "merged"; author: string }[] = [];
  let page = 1;
  let totalCount = 0;
  let fetchedCount = 0;

  // GitHub search API returns max 100 per page, paginate to get all
  do {
    const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "staging-patches-dashboard",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({ error: "GitHub API error", details: text }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data: GitHubSearchResponse = await res.json();
    totalCount = data.total_count;
    fetchedCount += data.items.length;

    // Only include open or merged PRs (exclude closed-unmerged)
    const filtered = data.items.filter(
      (item) => item.state === "open" || item.pull_request?.merged_at != null
    );
    allItems.push(
      ...filtered.map((item) => ({
        number: item.number,
        title: item.title,
        created_at: item.created_at,
        html_url: item.html_url,
        status: (item.pull_request?.merged_at != null ? "merged" : "open") as "open" | "merged",
        author: item.user?.login ?? "unknown",
      }))
    );
    page++;
  } while (fetchedCount < totalCount);

  return new Response(JSON.stringify({ total_count: allItems.length, items: allItems }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
