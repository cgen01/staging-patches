import { TEAMS, saveTeam } from "@/lib/teams";

export function TeamSelect({ onSelect }: { onSelect: (slug: string) => void }) {
  function handleSelect(slug: string) {
    saveTeam(slug);
    onSelect(slug);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-2 flex flex-col items-center gap-3">
          <img src="/icon-gradient.svg" alt="" className="h-10 w-10" />
          <h1 className="text-xl font-semibold">Staging Patches</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground text-center">
          Select a team to view
        </p>
        <div className="space-y-2">
          <button
            onClick={() => handleSelect("all")}
            className="w-full rounded-md border border-border px-4 py-3 text-left hover:bg-secondary cursor-pointer"
          >
            <span className="font-medium">🌐 All Teams</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Combined view across all teams
            </span>
          </button>
          {TEAMS.map((team) => (
            <button
              key={team.slug}
              onClick={() => handleSelect(team.slug)}
              className="w-full rounded-md border border-border px-4 py-3 text-left hover:bg-secondary cursor-pointer"
            >
              <span className="font-medium">{team.emoji} {team.name} Team</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {team.githubSlug}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
