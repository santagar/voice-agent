import { prisma } from "../../lib/prisma";

export type Session = {
  id: string;
  userId: string | null;
  assistantId: string | null;
  conversationId: string | null;
};

export async function findSessionById(id: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true, userId: true, assistantId: true, conversationId: true },
  });
  return session ?? null;
}
