import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/porra");

  const { callbackUrl } = await searchParams;
  return (
    <div className="py-8">
      <AuthForm mode="login" callbackUrl={callbackUrl} />
    </div>
  );
}
