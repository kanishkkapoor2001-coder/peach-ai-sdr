import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { db, sendingDomains, emailSequences, inboxMessages, leadTouchpoints } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import {
  generateTrackingId,
  addTrackingToEmail,
} from "@/lib/services/email-tracking";

// SMTP transporter - singleton
let smtpTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!smtpTransporter) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      throw new Error("SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in .env.local");
    }

    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return smtpTransporter;
}

function getSender(): { fromName: string; fromEmail: string } {
  return {
    fromName: process.env.SMTP_FROM_NAME || "Kanishk Kapoor",
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "",
  };
}

export const EMAIL_CADENCE = {
  1: 0,
  2: 3,
  3: 4,
  4: 5,
  5: 7,
};

export const WARMUP_SCHEDULE = [
  { days: 0, limit: 10 },
  { days: 7, limit: 25 },
  { days: 14, limit: 50 },
  { days: 21, limit: 75 },
  { days: 28, limit: 100 },
];

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  replyTo?: string;
  leadId: string;
  sequenceId: string;
  emailNumber: number;
  preferredDomain?: string;
  signatureName?: string;
  // Tracking options
  touchpointId?: string; // If sending via touchpoint system
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  domain?: string;
  trackingId?: string;
}

function calculateDailyLimit(warmupStartDate: Date): number {
  const daysSinceWarmup = Math.floor(
    (Date.now() - warmupStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let limit = WARMUP_SCHEDULE[0].limit;
  for (const tier of WARMUP_SCHEDULE) {
    if (daysSinceWarmup >= tier.days) {
      limit = tier.limit;
    }
  }

  return limit;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

async function resetDailyCountersIfNeeded(): Promise<boolean> {
  const today = getTodayString();

  const result = await db
    .update(sendingDomains)
    .set({ sentToday: 0, lastResetDate: today })
    .where(
      sql`${sendingDomains.lastResetDate} IS NULL OR ${sendingDomains.lastResetDate} != ${today}`
    );

  return (result as any).rowCount > 0;
}

let domainCache: { domains: (typeof sendingDomains.$inferSelect)[]; fetchedAt: number } | null = null;
const DOMAIN_CACHE_TTL = 30_000;

export async function selectDomain(
  signatureName?: string,
  preferredDomainId?: string
): Promise<{ domain: typeof sendingDomains.$inferSelect; remainingCapacity: number } | null> {
  const didReset = await resetDailyCountersIfNeeded();

  if (didReset) {
    domainCache = null;
  }

  let domains: (typeof sendingDomains.$inferSelect)[];
  if (domainCache && Date.now() - domainCache.fetchedAt < DOMAIN_CACHE_TTL) {
    domains = domainCache.domains;
  } else {
    domains = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.isActive, true));
    domainCache = { domains, fetchedAt: Date.now() };
  }

  if (domains.length === 0) {
    return null;
  }

  const domainsWithCapacity = domains.map((domain) => {
    const dailyLimit = calculateDailyLimit(domain.warmupStartDate || new Date());
    const remainingCapacity = dailyLimit - (domain.sentToday || 0);

    return {
      domain,
      dailyLimit,
      remainingCapacity,
      matchesSignature: signatureName
        ? domain.fromName?.toLowerCase().includes(signatureName.toLowerCase()) ||
          domain.fromEmail?.toLowerCase().includes(signatureName.toLowerCase())
        : false,
    };
  });

  const availableDomains = domainsWithCapacity.filter((d) => d.remainingCapacity > 0);

  if (availableDomains.length === 0) {
    return null;
  }

  if (signatureName) {
    const signatureMatch = availableDomains.find((d) => d.matchesSignature);
    if (signatureMatch) {
      return {
        domain: signatureMatch.domain,
        remainingCapacity: signatureMatch.remainingCapacity,
      };
    }
  }

  if (preferredDomainId) {
    const preferred = availableDomains.find((d) => d.domain.id === preferredDomainId);
    if (preferred) {
      return {
        domain: preferred.domain,
        remainingCapacity: preferred.remainingCapacity,
      };
    }
  }

  const sorted = availableDomains.sort((a, b) => b.remainingCapacity - a.remainingCapacity);
  return {
    domain: sorted[0].domain,
    remainingCapacity: sorted[0].remainingCapacity,
  };
}

function extractSignatureName(body: string): string | undefined {
  const patterns = [
    /(?:—|--|Best|Regards|Cheers|Thanks|Warm regards|Kind regards|Best regards),?\s*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\n([A-Z][a-z]+)\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Send email via SMTP (Gmail)
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    body,
    htmlBody,
    replyTo,
    leadId,
    sequenceId,
    emailNumber,
    preferredDomain,
    signatureName,
    touchpointId,
    trackOpens = true,
    trackClicks = true,
  } = options;

  try {
    const transporter = getTransporter();
    const sender = getSender();
    const detectedSignature = signatureName || extractSignatureName(body);
    const domainResult = await selectDomain(detectedSignature, preferredDomain);

    const fromName = sender.fromName;
    const fromEmail = sender.fromEmail;
    const fromAddress = `${fromName} <${fromEmail}>`;
    let htmlContent = htmlBody || body.replace(/\n/g, "<br>");

    // Generate tracking ID and add tracking to email
    const trackingId = generateTrackingId();
    if (trackOpens || trackClicks) {
      htmlContent = addTrackingToEmail(htmlContent, trackingId, {
        trackOpens,
        trackClicks,
      });
    }

    console.log(`[Email Send] Sending via SMTP from ${fromAddress} to ${to} (tracking: ${trackingId})`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: body,
      html: htmlContent,
      replyTo: replyTo || fromEmail,
    });

    const messageId = info.messageId;
    console.log(`[Email Send] Success! messageId: ${messageId}`);

    // Update domain sent count
    if (domainResult) {
      await db
        .update(sendingDomains)
        .set({
          sentToday: (domainResult.domain.sentToday || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(sendingDomains.id, domainResult.domain.id));
    }

    // Log the outbound message
    await db.insert(inboxMessages).values({
      leadId,
      sequenceId,
      direction: "outbound",
      fromEmail,
      toEmail: to,
      subject,
      body,
      htmlBody: htmlContent,
      messageId,
    });

    // Update sequence with sent timestamp
    const sentAtField = `email${emailNumber}SentAt` as keyof typeof emailSequences.$inferSelect;
    await db
      .update(emailSequences)
      .set({
        [sentAtField]: new Date(),
        currentEmail: emailNumber,
        updatedAt: new Date(),
      })
      .where(eq(emailSequences.id, sequenceId));

    // Update touchpoint with tracking ID if provided
    if (touchpointId) {
      await db
        .update(leadTouchpoints)
        .set({
          trackingId,
          sentAt: new Date(),
          status: "sent",
          updatedAt: new Date(),
        })
        .where(eq(leadTouchpoints.id, touchpointId));
    }

    console.log(`[Email Send] Sent email ${emailNumber} to ${to} from ${fromEmail} (tracking: ${trackingId})`);

    return {
      success: true,
      messageId,
      domain: domainResult?.domain.domain || fromEmail,
      trackingId,
    };
  } catch (error) {
    console.error("[Email Send] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send a reply email via SMTP
 */
export async function sendReply(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
  icsAttachment?: {
    filename: string;
    content: string;
    contentType: string;
  };
  icsAlternative?: {
    contentType: string;
    content: string;
  };
}): Promise<{ messageId?: string; error?: string }> {
  try {
    const transporter = getTransporter();

    const headers: Record<string, string> = {};
    if (options.inReplyTo) {
      headers["In-Reply-To"] = options.inReplyTo;
      headers["References"] = options.references || options.inReplyTo;
    }

    const mailOptions: Record<string, unknown> = {
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.text.replace(/\n/g, "<br>"),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };

    if (options.icsAttachment) {
      mailOptions.attachments = [
        {
          filename: options.icsAttachment.filename,
          content: options.icsAttachment.content,
          contentType: options.icsAttachment.contentType,
        },
      ];
    }

    if (options.icsAlternative) {
      mailOptions.alternatives = [
        {
          contentType: options.icsAlternative.contentType,
          content: options.icsAlternative.content,
        },
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Reply Send] Success! messageId: ${info.messageId}`);
    return { messageId: info.messageId };
  } catch (error) {
    console.error("[Reply Send] Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function scheduleNextEmail(sequenceId: string): Promise<Date | null> {
  const [sequence] = await db
    .select()
    .from(emailSequences)
    .where(eq(emailSequences.id, sequenceId));

  if (!sequence) {
    return null;
  }

  const currentEmail = sequence.currentEmail || 1;
  const nextEmail = currentEmail + 1;

  if (nextEmail > 5) {
    await db
      .update(emailSequences)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(emailSequences.id, sequenceId));

    return null;
  }

  const daysToWait = EMAIL_CADENCE[nextEmail as keyof typeof EMAIL_CADENCE] || 3;
  const nextSendDate = new Date();
  nextSendDate.setDate(nextSendDate.getDate() + daysToWait);

  await db
    .update(emailSequences)
    .set({
      nextSendAt: nextSendDate,
      updatedAt: new Date(),
    })
    .where(eq(emailSequences.id, sequenceId));

  return nextSendDate;
}

export async function getDomainStats(): Promise<
  Array<{
    id: string;
    domain: string;
    fromEmail: string;
    fromName: string;
    sentToday: number;
    dailyLimit: number;
    remainingCapacity: number;
    isActive: boolean;
    warmupDays: number;
  }>
> {
  await resetDailyCountersIfNeeded();

  const domains = await db.select().from(sendingDomains);

  return domains.map((domain) => {
    const warmupDays = Math.floor(
      (Date.now() - (domain.warmupStartDate?.getTime() || Date.now())) /
        (1000 * 60 * 60 * 24)
    );
    const dailyLimit = calculateDailyLimit(domain.warmupStartDate || new Date());

    return {
      id: domain.id,
      domain: domain.domain,
      fromEmail: domain.fromEmail,
      fromName: domain.fromName,
      sentToday: domain.sentToday || 0,
      dailyLimit,
      remainingCapacity: dailyLimit - (domain.sentToday || 0),
      isActive: domain.isActive ?? true,
      warmupDays,
    };
  });
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(
  domainId: string
): Promise<{ success: boolean; error?: string; provider?: string }> {
  try {
    const [domain] = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.id, domainId));

    if (!domain) {
      return { success: false, error: "Domain not found" };
    }

    const transporter = getTransporter();
    await transporter.verify();

    console.log(`[Email Test] SMTP verified for domain ${domain.domain}`);
    return { success: true, provider: "smtp" };
  } catch (error) {
    console.error("[Email Test] Connection error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
