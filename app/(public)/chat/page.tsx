import ChatClientPage from "./Client";
import { getInitialUserPreferences } from "@/lib/server/userPreferences";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export default async function ChatPage() {
  const { sidebarCollapsed: initialSidebarCollapsed } =
    await getInitialUserPreferences();
  const session = await getServerSession(authOptions);

  return (
    <ChatClientPage
      initialSidebarCollapsed={initialSidebarCollapsed}
      initialLoggedIn={!!session}
      initialUserEmail={session?.user?.email ?? null}
    />
  );
}
