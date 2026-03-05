import { useState } from "react";
import { getToken } from "@/lib/api";
import { Login } from "@/components/Login";
import { Dashboard } from "@/components/Dashboard";

function App() {
  const [authenticated, setAuthenticated] = useState(!!getToken());

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return <Dashboard />;
}

export default App;
