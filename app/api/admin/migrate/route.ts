import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * POST /api/admin/migrate
 *
 * Run database migrations manually
 * This is a one-time use endpoint to add the 'cancelled' status to touchpoint_status enum
 */
export async function POST() {
  try {
    // Add 'cancelled' to the touchpoint_status enum if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'cancelled'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'touchpoint_status')
        ) THEN
          ALTER TYPE touchpoint_status ADD VALUE 'cancelled';
        END IF;
      END $$;
    `);

    return NextResponse.json({
      success: true,
      message: "Migration completed - 'cancelled' status added to touchpoint_status enum",
    });
  } catch (error) {
    console.error("[Migration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}
