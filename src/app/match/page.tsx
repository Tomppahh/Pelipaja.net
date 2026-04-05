import { getSession } from "@/src/backend/lib/session";
import { redirect } from "next/navigation";
import { ROLES, hasRole } from "@/src/lib/config/settings";
import { ServerCounter } from "@/src/app/components/user/serverCounter";

export default async function CreateMatchPage() {
  const user = await getSession();
  const { lobby } = ROLES;
  if (!user) redirect("/login");
  if (!hasRole(user.role, lobby)) redirect("/");
  return (
    <div>
      <h1>Create Match</h1>
      <ServerCounter />
      <p>Select a game</p>
      <a href="/match/new/cs2">
        <button>Counter-Strike 2</button>
      </a>
    </div>
  );
}