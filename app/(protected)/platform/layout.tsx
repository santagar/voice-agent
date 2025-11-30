import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PlatformShell } from "@/components/back/platform/PlatformShell";

const ADMIN_EMAIL = "santagar@gmail.com";

export default async function PlatformProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || email !== ADMIN_EMAIL) {
    redirect("/");
  }

  const userEmail = session?.user?.email ?? "user@example.com";
  const userName = session?.user?.name ?? null;
  const userImage = (session?.user as any)?.image ?? null;

  return (
    <PlatformShell
      userEmail={userEmail}
      userName={userName}
      userImage={userImage}
    >
      {children}
    </PlatformShell>
  );
}

