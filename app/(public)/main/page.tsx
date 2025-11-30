import ChatClientPage from "./Client";
import { getInitialUserPreferences } from "@/lib/server/userPreferences";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export default async function ChatPage() {
  const { sidebarCollapsed: initialSidebarCollapsed } =
    await getInitialUserPreferences();
  const session = await getServerSession(authOptions);

  let workspaceId: string | null = null;
  let assistantId: string | null = null;
  let assistantOptions: { id: string; name: string; description?: string | null }[] = [];
  const userId = (session?.user as any)?.id as string | undefined;
  const email = session?.user?.email?.toLowerCase() ?? null;

  if (userId && email) {
    // Ensure the AuthJS user exists in our Prisma DB. After schema resets,
    // an existing session cookie may refer to a user id that is no longer
    // present, which would break foreign keys when creating memberships.
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
      const realtimeModel =
        process.env.REALTIME_MODEL ?? "gpt-4o-mini-realtime-preview";
      const voice = process.env.REALTIME_VOICE ?? "verse";
      const embeddingModel =
        process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

      // Find or create a default assistant template as the single
      // source of truth for profile, sanitize rules and tools.
      let template = await prisma.assistantTemplate.findFirst({
        where: {
          name: "Default voice assistant",
          status: "active",
        },
      });

      if (!template) {
        // Load current JSON config snapshots from the config/ folder
        // and store them in reusable templates.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const profileJson = require("@/config/profile.json");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sanitizeJson = require("@/config/sanitize.json");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const toolsJson = require("@/config/tools.json");

        const profileTemplate = await prisma.profileTemplate.create({
          data: {
            name: "Default voice assistant profile",
            description: "Default persona and tone configuration.",
            status: "active",
            profileJson,
          },
        });

        const sanitizerTemplate = await prisma.sanitizerTemplate.create({
          data: {
            name: "Default sanitization rules",
            description: "Default redaction rules for sensitive data.",
            status: "active",
            sanitizeJson,
          },
        });

        // Tools JSON is loaded for future use; wiring ToolTemplate +
        // AssistantTemplateTool can be added when needed.
        void toolsJson;

        template = await prisma.assistantTemplate.create({
          data: {
            name: "Default voice assistant",
            description:
              "Default realtime assistant persona, tools and sanitize rules.",
            status: "active",
            profiles: {
              create: [
                {
                  profileTemplate: {
                    connect: { id: profileTemplate.id },
                  },
                  enabled: true,
                },
              ],
            },
            sanitizers: {
              create: [
                {
                  sanitizerTemplate: {
                    connect: { id: sanitizerTemplate.id },
                  },
                  enabled: true,
                },
              ],
            },
          },
        });
      }

      assistant = await prisma.assistant.create({
        data: {
          name: "Default voice assistant",
          description:
            "Default realtime assistant for voice and chat interactions.",
          slug: `default-assistant-${workspace.id.slice(0, 8)}`,
          status: "active",
          realtimeModel,
          realtimeModelPremium:
            process.env.REALTIME_MODEL_PREMIUM ?? null,
          voice,
          embeddingModel,
          workspaceId: workspace.id,
          ownerId: userId,
          templateId: template.id,
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
    assistantOptions = assistants.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
    }));
  }

  // Preload conversation summaries so the sidebar renders without
  // a visible "jump" while the client fetches /api/conversations.
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
    <ChatClientPage
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
    />
  );
}
