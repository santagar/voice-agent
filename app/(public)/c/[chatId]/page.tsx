import MainClient from "../../main/Client";
import { getInitialUserPreferences } from "@/lib/server/userPreferences";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { VoiceMessage } from "@/lib/realtime/useRealtimeSession";

type ChatByIdPageProps = {
  params: Promise<{
    chatId: string;
  }>;
};

export default async function ChatByIdPage({ params }: ChatByIdPageProps) {
  const { chatId } = await params;
  const { sidebarCollapsed: initialSidebarCollapsed } =
    await getInitialUserPreferences();
  const session = await getServerSession(authOptions);

  let workspaceId: string | null = null;
  let assistantId: string | null = null;
  let assistantOptions: { id: string; name: string; description?: string | null }[] = [];
  const userId = (session?.user as any)?.id as string | undefined;
  const email = session?.user?.email?.toLowerCase() ?? null;

  if (userId && email) {
    // Ensure the AuthJS user exists in our Prisma DB (see comment in main/page.tsx).
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

    // Find or create a default workspace for this user.
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

    // Find or create a default assistant for this workspace.
    let assistant = await prisma.assistant.findFirst({
      where: {
        workspaceId: workspace.id,
        ownerId: userId,
      },
    });

    if (!assistant) {
      assistant = await prisma.assistant.create({
        data: {
          name: "Default assistant",
          description:
            "Default realtime assistant for voice and chat interactions.",
          slug: `default-assistant-${workspace.id.slice(0, 8)}`,
          status: "active",
          workspaceId: workspace.id,
          ownerId: userId,
        },
      });
    }

    assistantId = assistant.id;

    // Load all assistants for this workspace/user so the header can
    // offer a selector.
    const assistants = await prisma.assistant.findMany({
      where: { workspaceId: workspace.id, ownerId: userId },
      orderBy: { createdAt: "asc" },
    });
    assistantOptions = assistants.map((a: (typeof assistants)[number]) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  // Preload the same conversation summaries used on / so that the
  // sidebar list does not jump when opening a specific chat id.
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const initialChats = conversations.map((conv: (typeof conversations)[number]) => {
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

  // Preload conversation messages to avoid a flash on client hydration.
  let initialMessages: VoiceMessage[] | null = null;
  try {
    const conversationWithMessages = await prisma.conversation.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (conversationWithMessages?.messages) {
      initialMessages = conversationWithMessages.messages.map((m) => {
        const rawMeta =
          (m as any).meta ?? (m as any).meta_json ?? (m as any).metaJson ?? null;
        let parsedMeta: Record<string, unknown> | string | null = null;
        if (typeof rawMeta === "string") {
          try {
            const asObj = JSON.parse(rawMeta);
            parsedMeta =
              asObj && typeof asObj === "object"
                ? (asObj as Record<string, unknown>)
                : rawMeta;
          } catch {
            parsedMeta = rawMeta;
          }
        } else if (rawMeta && typeof rawMeta === "object") {
          parsedMeta = rawMeta as Record<string, unknown>;
        }

        return {
          id: m.id,
          from:
            m.from === "assistant"
              ? "assistant"
              : m.from === "system"
              ? "system"
              : "user",
          text: m.text ?? "",
          meta: parsedMeta,
        };
      });
    }
  } catch {
    initialMessages = null;
  }

  return (
    <MainClient
      initialSidebarCollapsed={initialSidebarCollapsed}
      workspaceId={workspaceId}
      assistantId={assistantId}
      currentUserId={userId ?? null}
      initialAssistants={assistantOptions}
      initialLoggedIn={!!session}
      initialUserEmail={session?.user?.email ?? null}
      initialUserName={session?.user?.name ?? null}
      initialUserImage={(session?.user as any)?.image ?? null}
      initialChatId={chatId}
      initialChats={initialChats}
      initialMessages={initialMessages}
    />
  );
}
