import { findSessionById, Session } from "./session.repository";

export async function getSessionById(id: string): Promise<Session | null> {
  return findSessionById(id);
}

export type { Session };
