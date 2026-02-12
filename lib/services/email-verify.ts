/**
 * Free Email Verification Service
 *
 * Verifies email addresses using:
 * 1. Syntax validation (regex)
 * 2. MX record lookup (DNS)
 * 3. Disposable email detection
 *
 * No paid API required!
 */

import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

// Common disposable email domains (free list)
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
  "temp-mail.org",
  "fakeinbox.com",
  "getnada.com",
  "mailcatch.com",
  "maildrop.cc",
  "discard.email",
  "sharklasers.com",
  "trashmail.com",
  "yopmail.com",
  "getairmail.com",
  "mohmal.com",
  "tempail.com",
  "burnermail.io",
  "33mail.com",
  "spam4.me",
  "mailnesia.com",
  "mintemail.com",
  "mt2009.com",
  "mytemp.email",
  "throwawaymail.com",
  "wegwerfmail.de",
  "emailondeck.com",
  "mailsac.com",
  "harakirimail.com",
  "tempr.email",
  "dispostable.com",
]);

// Common typos in email domains
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotnail.com": "hotmail.com",
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
};

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  reason: string;
  details: {
    syntaxValid: boolean;
    mxRecordExists: boolean;
    isDisposable: boolean;
    suggestedCorrection?: string;
  };
}

/**
 * Validate email syntax
 */
function validateSyntax(email: string): boolean {
  // RFC 5322 compliant regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Extract domain from email
 */
function getDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

/**
 * Check if domain has MX records
 */
async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch (error) {
    // DNS lookup failed - domain doesn't exist or no MX records
    return false;
  }
}

/**
 * Check if email is from a disposable domain
 */
function isDisposableEmail(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

/**
 * Check for common domain typos and suggest corrections
 */
function checkForTypos(email: string): string | undefined {
  const domain = getDomain(email);
  const correction = DOMAIN_TYPOS[domain];
  if (correction) {
    return email.replace(domain, correction);
  }
  return undefined;
}

/**
 * Verify a single email address
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = getDomain(normalizedEmail);

  // Initialize result
  const result: EmailVerificationResult = {
    email: normalizedEmail,
    isValid: false,
    reason: "",
    details: {
      syntaxValid: false,
      mxRecordExists: false,
      isDisposable: false,
    },
  };

  // Step 1: Syntax validation
  if (!validateSyntax(normalizedEmail)) {
    result.reason = "Invalid email format";
    return result;
  }
  result.details.syntaxValid = true;

  // Step 2: Check for typos
  const suggestedCorrection = checkForTypos(normalizedEmail);
  if (suggestedCorrection) {
    result.details.suggestedCorrection = suggestedCorrection;
  }

  // Step 3: Check for disposable domains
  if (isDisposableEmail(domain)) {
    result.details.isDisposable = true;
    result.reason = "Disposable email address";
    return result;
  }

  // Step 4: MX record lookup
  try {
    const hasMx = await checkMxRecord(domain);
    result.details.mxRecordExists = hasMx;

    if (!hasMx) {
      result.reason = "Domain does not accept emails (no MX records)";
      return result;
    }
  } catch (error) {
    result.reason = "Could not verify domain";
    return result;
  }

  // All checks passed
  result.isValid = true;
  result.reason = "Email appears valid";

  return result;
}

/**
 * Verify multiple emails (with rate limiting)
 */
export async function verifyEmails(
  emails: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<EmailVerificationResult[]> {
  const results: EmailVerificationResult[] = [];
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES = 500; // ms

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((email) => verifyEmail(email))
    );

    results.push(...batchResults);

    if (onProgress) {
      onProgress(results.length, emails.length);
    }

    // Small delay between batches to avoid overwhelming DNS servers
    if (i + BATCH_SIZE < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  return results;
}

/**
 * Quick check if email looks valid (no async operations)
 * Use this for instant UI feedback
 */
export function quickValidateEmail(email: string): {
  isValid: boolean;
  reason?: string;
  suggestion?: string;
} {
  const normalizedEmail = email.trim().toLowerCase();

  // Check syntax
  if (!validateSyntax(normalizedEmail)) {
    return { isValid: false, reason: "Invalid format" };
  }

  const domain = getDomain(normalizedEmail);

  // Check for disposable
  if (isDisposableEmail(domain)) {
    return { isValid: false, reason: "Disposable email" };
  }

  // Check for typos
  const suggestion = checkForTypos(normalizedEmail);
  if (suggestion) {
    return { isValid: true, suggestion };
  }

  return { isValid: true };
}

/**
 * Get verification stats from results
 */
export function getVerificationStats(results: EmailVerificationResult[]): {
  total: number;
  valid: number;
  invalid: number;
  disposable: number;
  noMxRecord: number;
  syntaxErrors: number;
} {
  return {
    total: results.length,
    valid: results.filter((r) => r.isValid).length,
    invalid: results.filter((r) => !r.isValid).length,
    disposable: results.filter((r) => r.details.isDisposable).length,
    noMxRecord: results.filter((r) => !r.details.mxRecordExists && r.details.syntaxValid).length,
    syntaxErrors: results.filter((r) => !r.details.syntaxValid).length,
  };
}
