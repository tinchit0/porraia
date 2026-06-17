import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { StatsNav } from "@/components/StatsNav";

export default async function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/stats");

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Stats</h1>
      <p className="mt-1 text-muted">Visualizaciones de la porra.</p>
      <StatsNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
