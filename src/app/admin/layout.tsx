import { getSession } from "@/src/backend/lib/session";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user || user.role !== "admin") redirect("/");
  return <>{children}</>;
}