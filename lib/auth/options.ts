import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

async function ensureUser(email: string, name?: string | null, image?: string | null) {
  const normalized = email.trim().toLowerCase();
  return prisma.user.upsert({
    where: { email: normalized },
    update: {
      name: name ?? undefined,
      image: image ?? undefined,
    },
    create: {
      email: normalized,
      name: name ?? null,
      image: image ?? null,
    },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email.trim().toLowerCase();
        if (!email) return null;

        const user = await ensureUser(email);

        // Registrar cuenta "credentials" en AuthAccount
        await prisma.authAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: "credentials",
              providerAccountId: email,
            },
          },
          update: {
            userId: user.id,
            type: "credentials",
          },
          create: {
            userId: user.id,
            provider: "credentials",
            providerAccountId: email,
            type: "credentials",
          },
        });

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return true;

      const email = (user.email || "").toLowerCase();
      if (!email) return false;

      const dbUser = await ensureUser(email, user.name, (user as any).image);

      // Registrar cuenta OAuth (por ejemplo, Google)
      await prisma.authAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId ?? email,
          },
        },
        update: {
          userId: dbUser.id,
          type: account.type ?? "oauth",
        },
        create: {
          userId: dbUser.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId ?? email,
          type: account.type ?? "oauth",
        },
      });

      (user as any).dbId = dbUser.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbId = (user as any).dbId || (user as any).id;
        if (dbId) {
          token.sub = dbId as string;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
