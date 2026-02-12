import { NextRequest, NextResponse } from "next/server";
import { db, sendingDomains } from "@/lib/db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { Resend } from "resend";

/**
 * POST /api/domains/test-send
 *
 * Send a test email to verify domain configuration
 *
 * Body:
 * - domainId: string (optional - if not provided, tests all active domains)
 * - testEmail: string - email address to send test to
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domainId, testEmail } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: "testEmail is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get domain(s) to test
    let domainsToTest;
    if (domainId) {
      domainsToTest = await db
        .select()
        .from(sendingDomains)
        .where(eq(sendingDomains.id, domainId));

      if (domainsToTest.length === 0) {
        return NextResponse.json(
          { error: "Domain not found" },
          { status: 404 }
        );
      }
    } else {
      domainsToTest = await db
        .select()
        .from(sendingDomains)
        .where(eq(sendingDomains.isActive, true));

      if (domainsToTest.length === 0) {
        return NextResponse.json(
          { error: "No active domains found" },
          { status: 400 }
        );
      }
    }

    const results: Array<{
      domain: string;
      method: string;
      success: boolean;
      messageId?: string;
      error?: string;
      configurationStatus: string;
    }> = [];

    for (const domain of domainsToTest) {
      const result: typeof results[0] = {
        domain: domain.domain,
        method: domain.sendingMethod || "resend",
        success: false,
        configurationStatus: "unknown",
      };

      try {
        // Check configuration first
        if (domain.sendingMethod === "smtp") {
          if (!domain.smtpHost) {
            result.configurationStatus = "SMTP host not configured";
            result.error = "SMTP host not configured";
            results.push(result);
            continue;
          }
          if (!domain.smtpPassword) {
            result.configurationStatus = "SMTP password not configured";
            result.error = "SMTP password (App Password) not configured. For Gmail, get one at myaccount.google.com/apppasswords";
            results.push(result);
            continue;
          }
          result.configurationStatus = "SMTP configured";
        } else {
          const apiKey = process.env.RESEND_API_KEY;
          if (!apiKey || !apiKey.startsWith("re_")) {
            result.configurationStatus = "Resend API key not configured";
            result.error = "RESEND_API_KEY not configured in .env.local";
            results.push(result);
            continue;
          }
          result.configurationStatus = "Resend configured";
        }

        // Try to send test email
        const subject = `[Test] Email from ${domain.domain}`;
        const text = `This is a test email from your Peach AI SDR system.

Domain: ${domain.domain}
From: ${domain.fromName} <${domain.fromEmail}>
Method: ${domain.sendingMethod || "resend"}
Time: ${new Date().toISOString()}

If you received this email, your configuration is working correctly!`;

        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f97316;">✅ Test Email Successful</h2>
            <p>This is a test email from your <strong>Peach AI SDR</strong> system.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Domain</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${domain.domain}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">From</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${domain.fromName} &lt;${domain.fromEmail}&gt;</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Method</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${domain.sendingMethod || "resend"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Sent At</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date().toISOString()}</td>
              </tr>
            </table>
            <p style="color: #16a34a;">If you received this email, your configuration is working correctly!</p>
          </div>
        `;

        if (domain.sendingMethod === "smtp") {
          // Send via SMTP
          const transportOptions: SMTPTransport.Options = {
            host: domain.smtpHost || "smtp.gmail.com",
            port: domain.smtpPort || 587,
            secure: domain.smtpSecure || false,
            auth: {
              user: domain.smtpUser || domain.fromEmail,
              pass: domain.smtpPassword || "",
            },
          };

          const transporter = nodemailer.createTransport(transportOptions);

          // Verify connection first
          await transporter.verify();

          const sendResult = await transporter.sendMail({
            from: `${domain.fromName} <${domain.fromEmail}>`,
            to: testEmail,
            subject,
            text,
            html,
          });

          result.success = true;
          result.messageId = sendResult.messageId;
        } else {
          // Send via Resend
          const resend = new Resend(process.env.RESEND_API_KEY);

          const { data, error } = await resend.emails.send({
            from: `${domain.fromName} <${domain.fromEmail}>`,
            to: [testEmail],
            subject,
            text,
            html,
          });

          if (error) {
            throw new Error(error.message);
          }

          result.success = true;
          result.messageId = data?.id;
        }
      } catch (error) {
        result.success = false;
        result.error = error instanceof Error ? error.message : "Unknown error";
      }

      results.push(result);
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      summary: {
        tested: results.length,
        success: successCount,
        failed: failCount,
      },
      testEmail,
      results,
    });
  } catch (error) {
    console.error("[Test Send] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
