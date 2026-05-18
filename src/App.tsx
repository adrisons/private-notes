import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Welcome } from "./screens/Welcome";

export function App() {
  return (
    <AppShell header={<Logo />}>
      <Welcome />
    </AppShell>
  );
}
