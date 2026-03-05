import { useState } from "react";
import { getToken } from "@/lib/api";
import { getSavedTeam } from "@/lib/teams";
import { Login } from "@/components/Login";
import { TeamSelect } from "@/components/TeamSelect";
import { Dashboard } from "@/components/Dashboard";

function App() {
  const [authenticated, setAuthenticated] = useState(!!getToken());
  const [team, setTeam] = useState<string | null>(getSavedTeam());

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  if (!team) {
    return <TeamSelect onSelect={(slug) => setTeam(slug)} />;
  }

  return (
    <Dashboard
      team={team}
      onChangeTeam={() => setTeam(null)}
    />
  );
}

export default App;
