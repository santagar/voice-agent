import ChatClientPage from "./Client";
import { getInitialUserPreferences } from "@/lib/server/userPreferences";

export default async function ChatPage() {
  const { sidebarCollapsed: initialSidebarCollapsed } =
    await getInitialUserPreferences();

  return <ChatClientPage initialSidebarCollapsed={initialSidebarCollapsed} />;
}
