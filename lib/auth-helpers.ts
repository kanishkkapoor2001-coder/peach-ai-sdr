import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Get the current session in API routes
export async function getSession() {
  return await auth();
}

// Get current user ID from session
export async function getCurrentUserId() {
  const session = await auth();
  return session?.user?.id;
}

// Get current workspace ID from session
export async function getCurrentWorkspaceId() {
  const session = await auth();
  return session?.user?.currentWorkspaceId;
}

// Verify user has access to a workspace
export async function hasWorkspaceAccess(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

  return !!membership;
}

// Get user's workspaces
export async function getUserWorkspaces(userId: string) {
  const memberships = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));

  return memberships;
}

// Require authentication - throws if not authenticated
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// Require workspace - throws if no workspace selected
export async function requireWorkspace() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  if (!session.user.currentWorkspaceId) {
    throw new Error("No workspace selected");
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.currentWorkspaceId,
  };
}
