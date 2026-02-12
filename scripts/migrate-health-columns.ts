import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("Adding domain health columns to sending_domains table...\n");

  try {
    // Add warmup_schedule column
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS warmup_schedule text DEFAULT 'standard'`;
    console.log("✓ Added: warmup_schedule");
  } catch (e) { console.log("✗ warmup_schedule:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS spf_status text`;
    console.log("✓ Added: spf_status");
  } catch (e) { console.log("✗ spf_status:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS dkim_status text`;
    console.log("✓ Added: dkim_status");
  } catch (e) { console.log("✗ dkim_status:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS dkim_selector text`;
    console.log("✓ Added: dkim_selector");
  } catch (e) { console.log("✗ dkim_selector:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS dmarc_status text`;
    console.log("✓ Added: dmarc_status");
  } catch (e) { console.log("✗ dmarc_status:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS dmarc_policy text`;
    console.log("✓ Added: dmarc_policy");
  } catch (e) { console.log("✗ dmarc_policy:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS mx_status text`;
    console.log("✓ Added: mx_status");
  } catch (e) { console.log("✗ mx_status:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS blacklist_status jsonb`;
    console.log("✓ Added: blacklist_status");
  } catch (e) { console.log("✗ blacklist_status:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS is_blacklisted boolean DEFAULT false`;
    console.log("✓ Added: is_blacklisted");
  } catch (e) { console.log("✗ is_blacklisted:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS health_score integer`;
    console.log("✓ Added: health_score");
  } catch (e) { console.log("✗ health_score:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS health_status text`;
    console.log("✓ Added: health_status");
  } catch (e) { console.log("✗ health_status:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS last_health_check timestamp`;
    console.log("✓ Added: last_health_check");
  } catch (e) { console.log("✗ last_health_check:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS health_recommendations jsonb`;
    console.log("✓ Added: health_recommendations");
  } catch (e) { console.log("✗ health_recommendations:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS current_delay_ms integer DEFAULT 60000`;
    console.log("✓ Added: current_delay_ms");
  } catch (e) { console.log("✗ current_delay_ms:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS bounce_count_today integer DEFAULT 0`;
    console.log("✓ Added: bounce_count_today");
  } catch (e) { console.log("✗ bounce_count_today:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS complaint_count_today integer DEFAULT 0`;
    console.log("✓ Added: complaint_count_today");
  } catch (e) { console.log("✗ complaint_count_today:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS last_bounce_at timestamp`;
    console.log("✓ Added: last_bounce_at");
  } catch (e) { console.log("✗ last_bounce_at:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false`;
    console.log("✓ Added: is_paused");
  } catch (e) { console.log("✗ is_paused:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS pause_reason text`;
    console.log("✓ Added: pause_reason");
  } catch (e) { console.log("✗ pause_reason:", (e as Error).message); }

  try {
    await sql`ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS paused_at timestamp`;
    console.log("✓ Added: paused_at");
  } catch (e) { console.log("✗ paused_at:", (e as Error).message); }

  console.log("\n✅ Migration complete!");
  await sql.end();
}

migrate().catch(console.error);
