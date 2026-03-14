import { getSession } from "@/src/backend/lib/session";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["leader", "beta", "admin"];

export default async function CreateMatchPage() {
  const user = await getSession();

  if (!user) redirect("/login");
  if (!ALLOWED_ROLES.includes(user.role)) redirect("/");

  return (
    <div>
      <h1>Create Match</h1>
      <p>Select a game</p>
      <a href="/match/new/cs2">
        <button>Counter-Strike 2</button>
      </a>
      {/* Add more games here later */}
    </div>
  );
}