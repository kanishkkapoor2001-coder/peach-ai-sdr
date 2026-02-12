import { db } from "./index";
import { users, workspaces, workspaceMembers } from "./schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

// Admin account credentials (full access, uses your API keys)
const ADMIN_EMAIL = "kanishk@peach.study";
const ADMIN_PASSWORD = "Peach2024!";

// Sample account credentials (limited usage)
const SAMPLE_EMAIL = "demo@aisdr.app";
const SAMPLE_PASSWORD = "demo123";

export async function seedAccounts() {
  console.log("Seeding accounts...");

  // Check if admin already exists
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL.toLowerCase()))
    .limit(1);

  if (!existingAdmin) {
    console.log("Creating admin account...");

    // Create admin user
    const adminPasswordHash = await hash(ADMIN_PASSWORD, 12);
    const [adminUser] = await db.insert(users).values({
      email: ADMIN_EMAIL.toLowerCase(),
      name: "Kanishk",
      passwordHash: adminPasswordHash,
      role: "admin",
    }).returning();

    // Create admin workspace with full access
    const [adminWorkspace] = await db.insert(workspaces).values({
      name: "Peach Study",
      slug: `peach-study-${Date.now()}`,
      accountType: "full",
      usageLimitPerDay: 1000, // High limit for admin
    }).returning();

    // Link admin to workspace
    await db.insert(workspaceMembers).values({
      workspaceId: adminWorkspace.id,
      userId: adminUser.id,
      role: "owner",
    });

    // Set as current workspace
    await db.update(users).set({ currentWorkspaceId: adminWorkspace.id }).where(eq(users.id, adminUser.id));

    console.log("Admin account created:", ADMIN_EMAIL);
  } else {
    console.log("Admin account already exists");
  }

  // Check if sample already exists
  const [existingSample] = await db
    .select()
    .from(users)
    .where(eq(users.email, SAMPLE_EMAIL.toLowerCase()))
    .limit(1);

  if (!existingSample) {
    console.log("Creating sample account...");

    // Create sample user
    const samplePasswordHash = await hash(SAMPLE_PASSWORD, 12);
    const [sampleUser] = await db.insert(users).values({
      email: SAMPLE_EMAIL.toLowerCase(),
      name: "Demo User",
      passwordHash: samplePasswordHash,
      role: "user",
    }).returning();

    // Create sample workspace with limited access
    const [sampleWorkspace] = await db.insert(workspaces).values({
      name: "Demo Workspace",
      slug: `demo-workspace-${Date.now()}`,
      accountType: "sample",
      usageLimitPerDay: 10, // Limited to 10 AI calls per day
    }).returning();

    // Link sample user to workspace
    await db.insert(workspaceMembers).values({
      workspaceId: sampleWorkspace.id,
      userId: sampleUser.id,
      role: "owner",
    });

    // Set as current workspace
    await db.update(users).set({ currentWorkspaceId: sampleWorkspace.id }).where(eq(users.id, sampleUser.id));

    console.log("Sample account created:", SAMPLE_EMAIL);
  } else {
    console.log("Sample account already exists");
  }

  console.log("Seeding complete!");
  console.log("\nAccount credentials:");
  console.log(`Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Sample: ${SAMPLE_EMAIL} / ${SAMPLE_PASSWORD}`);
}

// Run if executed directly
seedAccounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
