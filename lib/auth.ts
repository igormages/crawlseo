import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Provider } from "next-auth/providers";
import { z } from "zod";
import { db } from "./db";
import { verifyPassword } from "./password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const email = parsed.data.email.toLowerCase().trim();
      const user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          passwordHash: true,
        },
      });

      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/webmasters.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Allow existing users always; block new OAuth sign-ups when registration is disabled
      if (
        process.env.DISABLE_REGISTRATION === "true" &&
        account?.provider !== "credentials"
      ) {
        if (!user.email) return false;
        const existing = await db.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        });
        if (!existing) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.access_token && user?.email) {
        try {
          await db.user.update({
            where: { email: user.email },
            data: {
              googleTokens: {
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at
                  ? account.expires_at * 1000
                  : undefined,
                tokenType: account.token_type,
                scope: account.scope,
              },
            },
          });
        } catch (error) {
          console.error("Failed to save Google tokens:", error);
        }
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Credentials provider requires JWT sessions (Auth.js)
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
