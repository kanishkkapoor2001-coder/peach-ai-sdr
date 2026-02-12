import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users, workspaces, workspaceMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) {
          return null;
        }

        // Verify password
        const isValid = await compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          currentWorkspaceId: user.currentWorkspaceId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.currentWorkspaceId = user.currentWorkspaceId;
      }

      // Handle session updates (e.g., workspace switch)
      if (trigger === "update" && session?.currentWorkspaceId) {
        token.currentWorkspaceId = session.currentWorkspaceId;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.currentWorkspaceId = token.currentWorkspaceId as string | null;
      }
      return session;
    },
  },
});

// Helper to get current user from session
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

// Helper to get current workspace ID
export async function getCurrentWorkspaceId() {
  const user = await getCurrentUser();
  return user?.currentWorkspaceId;
}

// Create a new workspace and add user as owner
export async function createWorkspace(userId: string, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const [workspace] = await db.insert(workspaces).values({
    name,
    slug: `${slug}-${Date.now()}`,
  }).returning();

  // Add user as owner
  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
  });

  // Set as current workspace
  await db.update(users).set({ currentWorkspaceId: workspace.id }).where(eq(users.id, userId));

  return workspace;
}
