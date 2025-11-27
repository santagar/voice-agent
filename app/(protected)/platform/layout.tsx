import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

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

  return children;
}

