import MainClientPage from "../../main/Client";
import { getInitialUserPreferences } from "@/lib/server/userPreferences";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AssistantEditorPage() {
  const { sidebarCollapsed: initialSidebarCollapsed } =
    await getInitialUserPreferences();
  const session = await getServerSession(authOptions);

  // If there is no active session, the assistant editor should not be
  // accessible. Redirect back to the main chat landing page.
  if (!session) {
    redirect("/");
  }

  let workspaceId: string | null = null;
  let assistantId: string | null = null;
  let assistantOptions: {
    id: string;
    name: string;
    description?: string | null;
    createdAt?: string;
  }[] = [];
  const userId = (session.user as any)?.id as string | undefined;
  const email = session.user?.email?.toLowerCase() ?? null;

  if (userId && email) {
    let dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: userId,
          email,
          name: session?.user?.name ?? null,
          image: (session?.user as any)?.image ?? null,
          status: "active",
        },
      });
    }

    let workspace = await prisma.workspace.findFirst({
      where: {
        members: {
          some: { userId },
        },
      },
    });

    if (!workspace) {
      const slug = `default-${userId.slice(0, 8)}`;
      workspace = await prisma.workspace.create({
        data: {
          name: `${email}'s workspace`,
          slug,
          status: "active",
          members: {
            create: {
              userId,
              role: "owner",
            },
          },
        },
      });
    }

    workspaceId = workspace.id;

    const assistants = await prisma.assistant.findMany({
      where: { workspaceId: workspace.id, ownerId: userId },
      orderBy: { createdAt: "asc" },
    });

    assistantOptions = assistants.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    }));

    if (assistants[0]) {
      assistantId = assistants[0].id;
    }
  }

  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const initialChats = conversations.map((conv) => {
    const last = conv.messages[0];
    const lastFrom =
      last?.from === "user"
        ? ("user" as const)
        : last?.from === "assistant"
        ? ("assistant" as const)
        : null;
    return {
      id: conv.id,
      title: conv.title,
      mode: (conv.mode as any) ?? "unknown",
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      lastMessageFrom: lastFrom,
      lastMessageAt: last ? last.createdAt.toISOString() : null,
    };
  });

  return (
    <MainClientPage
      initialSidebarCollapsed={initialSidebarCollapsed}
      initialLoggedIn={!!session}
      initialUserEmail={session?.user?.email ?? null}
      initialUserName={session?.user?.name ?? null}
      initialUserImage={(session?.user as any)?.image ?? null}
      currentUserId={userId ?? null}
      workspaceId={workspaceId}
      assistantId={assistantId}
      initialAssistants={assistantOptions}
      initialChats={initialChats}
      initialViewMode="assistant-editor"
    />
  );
}
