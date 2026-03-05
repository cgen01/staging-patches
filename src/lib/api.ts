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

export async function fetchPRs(year: number) {
  const token = getToken();
  const res = await fetch(`/api/github-prs?year=${year}`, {
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
  return data;
}
