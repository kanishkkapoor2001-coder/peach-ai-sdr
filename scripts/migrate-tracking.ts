import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("Adding email tracking columns and tables...\n");

  // Add tracking columns to lead_touchpoints
  try {
    await sql`ALTER TABLE lead_touchpoints ADD COLUMN IF NOT EXISTS clicked_at timestamp`;
    console.log("✓ Added: lead_touchpoints.clicked_at");
  } catch (e) { console.log("✗ clicked_at:", (e as Error).message); }

  try {
    await sql`ALTER TABLE lead_touchpoints ADD COLUMN IF NOT EXISTS tracking_id text`;
    console.log("✓ Added: lead_touchpoints.tracking_id");
  } catch (e) { console.log("✗ tracking_id:", (e as Error).message); }

  try {
    await sql`ALTER TABLE lead_touchpoints ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0`;
    console.log("✓ Added: lead_touchpoints.open_count");
  } catch (e) { console.log("✗ open_count:", (e as Error).message); }

  try {
    await sql`ALTER TABLE lead_touchpoints ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0`;
    console.log("✓ Added: lead_touchpoints.click_count");
  } catch (e) { console.log("✗ click_count:", (e as Error).message); }

  try {
    await sql`ALTER TABLE lead_touchpoints ADD COLUMN IF NOT EXISTS clicked_links jsonb`;
    console.log("✓ Added: lead_touchpoints.clicked_links");
  } catch (e) { console.log("✗ clicked_links:", (e as Error).message); }

  // Add index on tracking_id
  try {
    await sql`CREATE INDEX IF NOT EXISTS lead_touchpoints_tracking_id_idx ON lead_touchpoints(tracking_id)`;
    console.log("✓ Added: index on tracking_id");
  } catch (e) { console.log("✗ tracking_id index:", (e as Error).message); }

  // Create email_event_type enum
  try {
    await sql`CREATE TYPE email_event_type AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'replied')`;
    console.log("✓ Created: email_event_type enum");
  } catch (e) {
    if ((e as Error).message.includes("already exists")) {
      console.log("• Skipped: email_event_type enum (already exists)");
    } else {
      console.log("✗ email_event_type enum:", (e as Error).message);
    }
  }

  // Create email_events table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS email_events (
        id text PRIMARY KEY,
        touchpoint_id text NOT NULL REFERENCES lead_touchpoints(id) ON DELETE CASCADE,
        event_type email_event_type NOT NULL,
        user_agent text,
        ip_address text,
        clicked_url text,
        bounce_type text,
        bounce_reason text,
        country text,
        city text,
        occurred_at timestamp NOT NULL DEFAULT NOW(),
        created_at timestamp DEFAULT NOW()
      )
    `;
    console.log("✓ Created: email_events table");
  } catch (e) { console.log("✗ email_events table:", (e as Error).message); }

  // Create indexes on email_events
  try {
    await sql`CREATE INDEX IF NOT EXISTS email_events_touchpoint_id_idx ON email_events(touchpoint_id)`;
    console.log("✓ Added: index on email_events.touchpoint_id");
  } catch (e) { console.log("✗ touchpoint_id index:", (e as Error).message); }

  try {
    await sql`CREATE INDEX IF NOT EXISTS email_events_event_type_idx ON email_events(event_type)`;
    console.log("✓ Added: index on email_events.event_type");
  } catch (e) { console.log("✗ event_type index:", (e as Error).message); }

  try {
    await sql`CREATE INDEX IF NOT EXISTS email_events_occurred_at_idx ON email_events(occurred_at)`;
    console.log("✓ Added: index on email_events.occurred_at");
  } catch (e) { console.log("✗ occurred_at index:", (e as Error).message); }

  console.log("\n✅ Migration complete!");
  await sql.end();
}

migrate().catch(console.error);
