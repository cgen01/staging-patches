export interface Team {
  slug: string;
  name: string;
  emoji: string;
  githubSlug: string;
}

export const TEAMS: Team[] = [
  { slug: "ambrosia", name: "Ambrosia", emoji: "🍯", githubSlug: "simcapture-cloud-ambrosia-devs" },
  { slug: "mango", name: "Mango", emoji: "🥭", githubSlug: "simcapture-cloud-mango-devs-all" },
  { slug: "mauve", name: "Mauve", emoji: "💜", githubSlug: "simcapture-cloud-mauve-devs" },
];

const TEAM_KEY = "staging-patches-team";

export function getSavedTeam(): string | null {
  return localStorage.getItem(TEAM_KEY);
}

export function saveTeam(slug: string) {
  localStorage.setItem(TEAM_KEY, slug);
}

export function clearSavedTeam() {
  localStorage.removeItem(TEAM_KEY);
}
