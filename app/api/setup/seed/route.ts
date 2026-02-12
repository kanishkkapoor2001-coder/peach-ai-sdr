import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workspaces, workspaceMembers } from "@/lib/db/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

// Admin account credentials (full access)
const ADMIN_EMAIL = "kanishk@peach.study";
const ADMIN_PASSWORD = "Peach2024!";

// Sample account credentials (limited usage)
const SAMPLE_EMAIL = "demo@aisdr.app";
const SAMPLE_PASSWORD = "demo123";

export async function POST(request: Request) {
  try {
    // Optional: Add a secret key check for production
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (process.env.NODE_ENV === "production" && secret !== process.env.AUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = {
      admin: { created: false, email: ADMIN_EMAIL },
      sample: { created: false, email: SAMPLE_EMAIL },
    };

    // Create admin account
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL.toLowerCase()))
      .limit(1);

    if (!existingAdmin) {
      const adminPasswordHash = await hash(ADMIN_PASSWORD, 12);
      const [adminUser] = await db.insert(users).values({
        email: ADMIN_EMAIL.toLowerCase(),
        name: "Kanishk",
        passwordHash: adminPasswordHash,
        role: "admin",
      }).returning();

      const [adminWorkspace] = await db.insert(workspaces).values({
        name: "Peach Study",
        slug: `peach-study-${Date.now()}`,
        accountType: "full",
        usageLimitPerDay: 1000,
      }).returning();

      await db.insert(workspaceMembers).values({
        workspaceId: adminWorkspace.id,
        userId: adminUser.id,
        role: "owner",
      });

      await db.update(users).set({ currentWorkspaceId: adminWorkspace.id }).where(eq(users.id, adminUser.id));

      results.admin.created = true;
    }

    // Create sample account
    const [existingSample] = await db
      .select()
      .from(users)
      .where(eq(users.email, SAMPLE_EMAIL.toLowerCase()))
      .limit(1);

    if (!existingSample) {
      const samplePasswordHash = await hash(SAMPLE_PASSWORD, 12);
      const [sampleUser] = await db.insert(users).values({
        email: SAMPLE_EMAIL.toLowerCase(),
        name: "Demo User",
        passwordHash: samplePasswordHash,
        role: "user",
      }).returning();

      const [sampleWorkspace] = await db.insert(workspaces).values({
        name: "Demo Workspace",
        slug: `demo-workspace-${Date.now()}`,
        accountType: "sample",
        usageLimitPerDay: 10,
      }).returning();

      await db.insert(workspaceMembers).values({
        workspaceId: sampleWorkspace.id,
        userId: sampleUser.id,
        role: "owner",
      });

      await db.update(users).set({ currentWorkspaceId: sampleWorkspace.id }).where(eq(users.id, sampleUser.id));

      results.sample.created = true;
    }

    return NextResponse.json({
      success: true,
      results,
      message: "Accounts seeded successfully",
      credentials: {
        admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        sample: { email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD },
      },
    });
  } catch (error) {
    console.error("Seeding error:", error);
    return NextResponse.json(
      { error: "Failed to seed accounts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to seed accounts",
    endpoint: "/api/setup/seed",
  });
}
