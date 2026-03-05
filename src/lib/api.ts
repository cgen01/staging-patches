const TOKEN_KEY = "staging-patches-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function parseJSON(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response: ${text.slice(0, 100)}`);
  }
}

export async function login(password: string): Promise<{ token: string }> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseJSON(res);
  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }
  return data;
}

// --- Cache layer 3: Frontend in-memory cache ---
// Caches responses and deduplicates in-flight requests
const prCache = new Map<string, { data: unknown; fetchedAt: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CURRENT_YEAR = new Date().getFullYear();
const CACHE_TTL_PAST = 24 * 60 * 60 * 1000; // 24h for past years
const CACHE_TTL_CURRENT = 10 * 60 * 1000;    // 10min for current year

export async function fetchPRs(year: number, team: string = "all") {
  const cacheKey = `${team}-${year}`;
  const ttl = year < CURRENT_YEAR ? CACHE_TTL_PAST : CACHE_TTL_CURRENT;

  // Return cached data if fresh
  const cached = prCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return cached.data;
  }

  // Deduplicate concurrent requests for the same key
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const token = getToken();
    const res = await fetch(`/api/github-prs?year=${year}&team=${encodeURIComponent(team)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      throw new Error("Unauthorized");
    }
    const data = await parseJSON(res);
    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch PRs");
    }
    prCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}
