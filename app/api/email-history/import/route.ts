import { NextRequest, NextResponse } from "next/server";
import { db, emailHistory } from "@/lib/db";
import { parseCSVContent, autoDetectMappings } from "@/lib/utils/csv-parser";

/**
 * POST /api/email-history/import
 *
 * Import past email history from CSV to prevent re-contacting people
 *
 * Expected CSV columns (flexible - will auto-detect):
 * - email (required)
 * - name / first_name / last_name (optional)
 * - job_title / title (optional)
 * - school_name / company (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Read file content
    const filename = file.name;
    let content: string | ArrayBuffer;

    if (filename.endsWith(".csv")) {
      content = await file.text();
    } else {
      content = await file.arrayBuffer();
    }

    // Parse CSV
    const parsed = parseCSVContent(content, filename);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "File is empty or could not be parsed" },
        { status: 400 }
      );
    }

    // Find email column
    const emailColumn = parsed.headers.find(h =>
      h.toLowerCase().includes("email") || h.toLowerCase() === "e-mail"
    );

    if (!emailColumn) {
      return NextResponse.json(
        { error: "Could not find email column in CSV. Please ensure your file has an 'email' column." },
        { status: 400 }
      );
    }

    // Find other columns
    const nameColumn = parsed.headers.find(h =>
      h.toLowerCase() === "name" || h.toLowerCase() === "full_name" || h.toLowerCase() === "fullname"
    );
    const firstNameColumn = parsed.headers.find(h =>
      h.toLowerCase().includes("first") && h.toLowerCase().includes("name")
    );
    const lastNameColumn = parsed.headers.find(h =>
      h.toLowerCase().includes("last") && h.toLowerCase().includes("name")
    );
    const titleColumn = parsed.headers.find(h =>
      h.toLowerCase().includes("title") || h.toLowerCase().includes("job") || h.toLowerCase() === "role"
    );
    const schoolColumn = parsed.headers.find(h =>
      h.toLowerCase().includes("school") || h.toLowerCase().includes("company") || h.toLowerCase().includes("organization")
    );

    // Transform rows
    const entries = parsed.rows
      .map(row => {
        const email = row[emailColumn]?.toString().trim().toLowerCase();
        if (!email || !email.includes("@")) return null;

        let firstName = firstNameColumn ? row[firstNameColumn]?.toString().trim() : undefined;
        let lastName = lastNameColumn ? row[lastNameColumn]?.toString().trim() : undefined;
        let fullName = nameColumn ? row[nameColumn]?.toString().trim() : undefined;

        // If we have full name but not first/last, split it
        if (fullName && !firstName && !lastName) {
          const parts = fullName.split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        }

        return {
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          fullName: fullName || (firstName && lastName ? `${firstName} ${lastName}` : null),
          jobTitle: titleColumn ? row[titleColumn]?.toString().trim() || null : null,
          schoolName: schoolColumn ? row[schoolColumn]?.toString().trim() || null : null,
          source: "csv_history" as const,
          status: "contacted" as const,
          firstContactedAt: new Date(),
          lastContactedAt: new Date(),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found in the file" },
        { status: 400 }
      );
    }

    // Batch insert (ignore duplicates)
    const BATCH_SIZE = 100;
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      try {
        const result = await db.insert(emailHistory).values(batch).onConflictDoNothing().returning({ id: emailHistory.id });
        imported += result.length;
        skipped += batch.length - result.length;
      } catch (e) {
        // Log but continue
        console.error("[Email History Import] Batch error:", e);
        skipped += batch.length;
      }
    }

    console.log(`[Email History Import] Imported ${imported} emails, skipped ${skipped} duplicates`);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: entries.length,
    });

  } catch (error) {
    console.error("[Email History Import] Error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email-history/import
 *
 * Get count of emails in history
 */
export async function GET() {
  try {
    const result = await db.select().from(emailHistory);
    return NextResponse.json({
      count: result.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get email history count" },
      { status: 500 }
    );
  }
}
