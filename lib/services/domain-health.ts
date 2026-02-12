/**
 * Domain Health & DNS Monitoring Service
 *
 * Checks SPF, DKIM, DMARC, MX records and blacklist status for sending domains.
 * Calculates a deliverability health score (0-100).
 */

import dns from "dns";
import { promisify } from "util";

const resolveTxt = promisify(dns.resolveTxt);
const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);

// ============================================
// TYPES
// ============================================

export interface SPFResult {
  valid: boolean;
  record: string | null;
  includes: string[];
  mechanisms: string[];
  error?: string;
}

export interface DKIMResult {
  valid: boolean;
  selector: string;
  record: string | null;
  error?: string;
}

export interface DMARCResult {
  valid: boolean;
  record: string | null;
  policy: "none" | "quarantine" | "reject" | null;
  percentage: number;
  error?: string;
}

export interface MXResult {
  valid: boolean;
  records: Array<{ exchange: string; priority: number }>;
  error?: string;
}

export interface BlacklistResult {
  name: string;
  listed: boolean;
  error?: string;
}

export interface DomainHealthReport {
  domain: string;
  checkedAt: Date;

  // DNS Records
  spf: SPFResult;
  dkim: DKIMResult;
  dmarc: DMARCResult;
  mx: MXResult;

  // Blacklist Status
  blacklists: BlacklistResult[];
  isBlacklisted: boolean;

  // Overall Score
  score: number;
  status: "excellent" | "good" | "warning" | "critical";
  recommendations: string[];
}

// ============================================
// MAJOR BLACKLISTS (DNS-based queries - FREE)
// ============================================

const BLACKLISTS = [
  { name: "Spamhaus ZEN", zone: "zen.spamhaus.org" },
  { name: "Spamcop", zone: "bl.spamcop.net" },
  { name: "Barracuda", zone: "b.barracudacentral.org" },
  { name: "SORBS", zone: "dnsbl.sorbs.net" },
  { name: "UCEPROTECT L1", zone: "dnsbl-1.uceprotect.net" },
  { name: "SpamRats", zone: "noptr.spamrats.com" },
  { name: "Invaluement", zone: "dnsbl.invaluement.com" },
];

// Common DKIM selectors to check
const DKIM_SELECTORS = [
  "default",
  "google",
  "selector1", // Microsoft
  "selector2", // Microsoft
  "k1", // Mailchimp
  "s1", // SendGrid
  "resend", // Resend
  "mail",
  "dkim",
];

// ============================================
// DNS CHECKING FUNCTIONS
// ============================================

/**
 * Check SPF record for a domain
 */
export async function checkSPF(domain: string): Promise<SPFResult> {
  try {
    const records = await resolveTxt(domain);
    const flatRecords = records.map(r => r.join(""));
    const spfRecord = flatRecords.find(r => r.startsWith("v=spf1"));

    if (!spfRecord) {
      return {
        valid: false,
        record: null,
        includes: [],
        mechanisms: [],
        error: "No SPF record found",
      };
    }

    // Parse SPF record
    const parts = spfRecord.split(" ");
    const includes = parts
      .filter(p => p.startsWith("include:"))
      .map(p => p.replace("include:", ""));
    const mechanisms = parts.filter(p =>
      p.startsWith("a") ||
      p.startsWith("mx") ||
      p.startsWith("ip4:") ||
      p.startsWith("ip6:")
    );

    // Check for common issues
    const hasAll = parts.some(p => p === "-all" || p === "~all" || p === "?all");

    return {
      valid: hasAll, // SPF should end with -all, ~all, or ?all
      record: spfRecord,
      includes,
      mechanisms,
      error: hasAll ? undefined : "SPF record should end with -all, ~all, or ?all",
    };
  } catch (error: any) {
    if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
      return {
        valid: false,
        record: null,
        includes: [],
        mechanisms: [],
        error: "No SPF record found",
      };
    }
    return {
      valid: false,
      record: null,
      includes: [],
      mechanisms: [],
      error: error.message,
    };
  }
}

/**
 * Check DKIM record for a domain (tries multiple selectors)
 */
export async function checkDKIM(domain: string, selector?: string): Promise<DKIMResult> {
  const selectorsToTry = selector ? [selector] : DKIM_SELECTORS;

  for (const sel of selectorsToTry) {
    try {
      const dkimDomain = `${sel}._domainkey.${domain}`;
      const records = await resolveTxt(dkimDomain);
      const flatRecord = records.map(r => r.join("")).join("");

      if (flatRecord && flatRecord.includes("v=DKIM1")) {
        return {
          valid: true,
          selector: sel,
          record: flatRecord,
        };
      }
    } catch {
      // Try next selector
      continue;
    }
  }

  return {
    valid: false,
    selector: selector || "not_found",
    record: null,
    error: "No DKIM record found (tried common selectors)",
  };
}

/**
 * Check DMARC record for a domain
 */
export async function checkDMARC(domain: string): Promise<DMARCResult> {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const records = await resolveTxt(dmarcDomain);
    const flatRecords = records.map(r => r.join(""));
    const dmarcRecord = flatRecords.find(r => r.startsWith("v=DMARC1"));

    if (!dmarcRecord) {
      return {
        valid: false,
        record: null,
        policy: null,
        percentage: 0,
        error: "No DMARC record found",
      };
    }

    // Parse DMARC record
    const policyMatch = dmarcRecord.match(/p=(\w+)/);
    const percentMatch = dmarcRecord.match(/pct=(\d+)/);

    const policy = policyMatch?.[1] as "none" | "quarantine" | "reject" | null;
    const percentage = percentMatch ? parseInt(percentMatch[1]) : 100;

    return {
      valid: true,
      record: dmarcRecord,
      policy,
      percentage,
    };
  } catch (error: any) {
    if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
      return {
        valid: false,
        record: null,
        policy: null,
        percentage: 0,
        error: "No DMARC record found",
      };
    }
    return {
      valid: false,
      record: null,
      policy: null,
      percentage: 0,
      error: error.message,
    };
  }
}

/**
 * Check MX records for a domain
 */
export async function checkMX(domain: string): Promise<MXResult> {
  try {
    const records = await resolveMx(domain);

    if (!records || records.length === 0) {
      return {
        valid: false,
        records: [],
        error: "No MX records found",
      };
    }

    return {
      valid: true,
      records: records.map(r => ({
        exchange: r.exchange,
        priority: r.priority,
      })).sort((a, b) => a.priority - b.priority),
    };
  } catch (error: any) {
    return {
      valid: false,
      records: [],
      error: error.message,
    };
  }
}

/**
 * Check if an IP is on a specific blacklist
 */
async function checkIPOnBlacklist(ip: string, blacklistZone: string): Promise<boolean> {
  try {
    // Reverse IP for DNS lookup
    const reversedIP = ip.split(".").reverse().join(".");
    const lookupDomain = `${reversedIP}.${blacklistZone}`;

    await resolve4(lookupDomain);
    // If resolve succeeds, IP is listed
    return true;
  } catch {
    // If resolve fails (NXDOMAIN), IP is NOT listed
    return false;
  }
}

/**
 * Get IP addresses for a domain's MX servers
 */
async function getDomainIPs(domain: string): Promise<string[]> {
  const ips: string[] = [];

  try {
    // Get MX records
    const mxRecords = await resolveMx(domain);

    // Resolve each MX to IPs
    for (const mx of mxRecords.slice(0, 3)) { // Check top 3 MX servers
      try {
        const mxIPs = await resolve4(mx.exchange);
        ips.push(...mxIPs);
      } catch {
        // Skip if can't resolve
      }
    }

    // Also try direct A record
    try {
      const directIPs = await resolve4(domain);
      ips.push(...directIPs);
    } catch {
      // Skip
    }
  } catch {
    // Skip
  }

  return [...new Set(ips)]; // Remove duplicates
}

/**
 * Check if domain is on any blacklists
 */
export async function checkBlacklists(domain: string): Promise<BlacklistResult[]> {
  const results: BlacklistResult[] = [];
  const ips = await getDomainIPs(domain);

  if (ips.length === 0) {
    // Can't check without IPs, return unknown
    return BLACKLISTS.map(bl => ({
      name: bl.name,
      listed: false,
      error: "Could not resolve domain IPs",
    }));
  }

  // Check each blacklist
  for (const blacklist of BLACKLISTS) {
    let isListed = false;

    // Check all IPs against this blacklist
    for (const ip of ips) {
      try {
        const listed = await checkIPOnBlacklist(ip, blacklist.zone);
        if (listed) {
          isListed = true;
          break;
        }
      } catch {
        // Skip on error
      }
    }

    results.push({
      name: blacklist.name,
      listed: isListed,
    });
  }

  return results;
}

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Calculate deliverability score (0-100)
 */
function calculateScore(report: Omit<DomainHealthReport, "score" | "status" | "recommendations">): {
  score: number;
  status: DomainHealthReport["status"];
  recommendations: string[];
} {
  let score = 0;
  const recommendations: string[] = [];

  // SPF (0-25 points)
  if (report.spf.valid) {
    score += 25;
  } else if (report.spf.record) {
    score += 10; // Partial credit for having a record
    recommendations.push("Fix your SPF record - it should end with -all or ~all");
  } else {
    recommendations.push("Add an SPF record to authorize your mail servers");
  }

  // DKIM (0-25 points)
  if (report.dkim.valid) {
    score += 25;
  } else {
    recommendations.push("Set up DKIM signing for your domain");
  }

  // DMARC (0-25 points)
  if (report.dmarc.valid) {
    if (report.dmarc.policy === "reject") {
      score += 25;
    } else if (report.dmarc.policy === "quarantine") {
      score += 20;
      recommendations.push("Consider upgrading DMARC policy from quarantine to reject");
    } else {
      score += 15;
      recommendations.push("Your DMARC policy is set to 'none' - consider 'quarantine' or 'reject'");
    }
  } else {
    recommendations.push("Add a DMARC record to protect against spoofing");
  }

  // MX Records (0-10 points)
  if (report.mx.valid) {
    score += 10;
  } else {
    recommendations.push("Ensure valid MX records are configured");
  }

  // Blacklist Status (0-15 points)
  if (!report.isBlacklisted) {
    score += 15;
  } else {
    const listedOn = report.blacklists.filter(b => b.listed).map(b => b.name);
    recommendations.push(`Domain is blacklisted on: ${listedOn.join(", ")}. Request delisting immediately.`);
  }

  // Determine status
  let status: DomainHealthReport["status"];
  if (score >= 90) {
    status = "excellent";
  } else if (score >= 70) {
    status = "good";
  } else if (score >= 50) {
    status = "warning";
  } else {
    status = "critical";
  }

  return { score, status, recommendations };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Get full domain health report
 */
export async function getFullDomainHealth(domain: string): Promise<DomainHealthReport> {
  // Run all checks in parallel for speed
  const [spf, dkim, dmarc, mx, blacklists] = await Promise.all([
    checkSPF(domain),
    checkDKIM(domain),
    checkDMARC(domain),
    checkMX(domain),
    checkBlacklists(domain),
  ]);

  const isBlacklisted = blacklists.some(b => b.listed);

  const partialReport = {
    domain,
    checkedAt: new Date(),
    spf,
    dkim,
    dmarc,
    mx,
    blacklists,
    isBlacklisted,
  };

  const { score, status, recommendations } = calculateScore(partialReport);

  return {
    ...partialReport,
    score,
    status,
    recommendations,
  };
}

/**
 * Quick health check (just DNS, no blacklists - faster)
 */
export async function getQuickDomainHealth(domain: string): Promise<{
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  mxValid: boolean;
  score: number;
}> {
  const [spf, dkim, dmarc, mx] = await Promise.all([
    checkSPF(domain),
    checkDKIM(domain),
    checkDMARC(domain),
    checkMX(domain),
  ]);

  // Quick score calculation (without blacklist points)
  let score = 0;
  if (spf.valid) score += 30;
  if (dkim.valid) score += 30;
  if (dmarc.valid) score += 25;
  if (mx.valid) score += 15;

  return {
    spfValid: spf.valid,
    dkimValid: dkim.valid,
    dmarcValid: dmarc.valid,
    mxValid: mx.valid,
    score,
  };
}

/**
 * Check a specific aspect of domain health
 */
export async function checkDomainDNS(domain: string): Promise<{
  spf: SPFResult;
  dkim: DKIMResult;
  dmarc: DMARCResult;
  mx: MXResult;
}> {
  const [spf, dkim, dmarc, mx] = await Promise.all([
    checkSPF(domain),
    checkDKIM(domain),
    checkDMARC(domain),
    checkMX(domain),
  ]);

  return { spf, dkim, dmarc, mx };
}
