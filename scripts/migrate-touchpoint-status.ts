import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("Adding new touchpoint status values...\n");

  // Add 'bounced' to the enum
  try {
    await sql`ALTER TYPE touchpoint_status ADD VALUE IF NOT EXISTS 'bounced'`;
    console.log("✓ Added: touchpoint_status 'bounced'");
  } catch (e) {
    if ((e as Error).message.includes("already exists")) {
      console.log("• Skipped: 'bounced' (already exists)");
    } else {
      console.log("✗ bounced:", (e as Error).message);
    }
  }

  // Add 'complained' to the enum
  try {
    await sql`ALTER TYPE touchpoint_status ADD VALUE IF NOT EXISTS 'complained'`;
    console.log("✓ Added: touchpoint_status 'complained'");
  } catch (e) {
    if ((e as Error).message.includes("already exists")) {
      console.log("• Skipped: 'complained' (already exists)");
    } else {
      console.log("✗ complained:", (e as Error).message);
    }
  }

  console.log("\n✅ Migration complete!");
  await sql.end();
}

migrate().catch(console.error);
