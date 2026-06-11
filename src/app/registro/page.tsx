import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export default async function RegistroPage() {
  const user = await getCurrentUser();
  if (user) redirect("/porra");

  return (
    <div className="py-8">
      <AuthForm mode="register" />
    </div>
  );
}
