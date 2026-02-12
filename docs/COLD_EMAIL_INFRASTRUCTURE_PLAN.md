# Cold Email Infrastructure Implementation Plan

## Executive Summary

Building a Lemlist-quality cold email infrastructure with domain warmup, deliverability management, sender rotation, and comprehensive monitoring. This plan is based on the Lemlist infrastructure document and what already exists in Peach AI SDR.

---

## Current State Analysis

### What Already Exists ✅
1. **Database Schema**: Comprehensive tables for domains, sequences, touchpoints, inbox messages
2. **Email Sending**: Dual-method (SMTP + Resend) via nodemailer
3. **Basic Warmup**: Simple daily limits (10→25→50→75→100 over 28 days)
4. **IMAP Sync**: Incoming email fetching for SMTP domains
5. **Reply Processing**: AI-powered reply handling with auto-stop sequences
6. **Email Verification**: MX checks, disposable detection, syntax validation
7. **Campaign Stats**: Denormalized tracking (sent, opened, replies)

### What Needs to Be Built 🔨
1. **Domain Health Monitoring**: SPF/DKIM/DMARC checks, blacklist monitoring
2. **Email Tracking**: Open pixels, click tracking with custom domain
3. **Advanced Warmup**: Gradual ramp-up, engagement simulation
4. **Deliverability Dashboard**: Score calculation, alerts, recommendations
5. **Sender Rotation**: Intelligent distribution across mailboxes
6. **Throttling Algorithm**: Dynamic rate adjustment based on signals
7. **Bounce/Complaint Handling**: Proper webhook processing

---

## Implementation Phases

### Phase 1: Domain Health & DNS Monitoring (Days 1-2)
**Cost: FREE (DNS queries)**

#### 1.1 DNS Record Validation Service
```typescript
// lib/services/domain-health.ts
- checkSPF(domain): Promise<SPFResult>
- checkDKIM(domain, selector): Promise<DKIMResult>
- checkDMARC(domain): Promise<DMARCResult>
- checkMX(domain): Promise<MXResult>
- getFullDomainHealth(domain): Promise<DomainHealthReport>
```

**Implementation Notes:**
- Use Node's `dns` module (FREE)
- SPF: Query TXT records, parse `v=spf1`
- DKIM: Query TXT at `selector._domainkey.domain`
- DMARC: Query TXT at `_dmarc.domain`
- Cache results for 1 hour

#### 1.2 Blacklist Monitoring
```typescript
- checkBlacklists(domain): Promise<BlacklistResult[]>
```
- Check against major RBLs (Spamhaus, Barracuda, etc.)
- Use DNS-based queries (FREE)
- Alert if domain appears on any list

#### 1.3 Database Updates
```sql
ALTER TABLE sending_domains ADD COLUMN
  spf_status TEXT, -- valid, invalid, missing
  dkim_status TEXT,
  dmarc_status TEXT,
  blacklist_status JSONB, -- {spamhaus: false, barracuda: false, ...}
  last_health_check TIMESTAMP,
  health_score INTEGER; -- 0-100
```

#### 1.4 API Endpoints
- `GET /api/domains/[id]/health` - Full health check
- `GET /api/domains/health-summary` - All domains summary
- `POST /api/domains/[id]/check-now` - Force recheck

---

### Phase 2: Email Open & Click Tracking (Days 3-4)
**Cost: FREE (self-hosted)**

#### 2.1 Tracking Pixel Service
```typescript
// lib/services/email-tracking.ts

// Generate unique tracking ID per email
generateTrackingId(touchpointId): string

// Embed invisible pixel in email HTML
embedTrackingPixel(htmlContent, trackingId): string

// Process open event
recordOpen(trackingId): Promise<void>
```

#### 2.2 Click Tracking Service
```typescript
// Rewrite links in email
rewriteLinks(htmlContent, trackingId): string
// e.g., https://example.com → /api/track/click/[id]?url=encoded

// Process click event
recordClick(trackingId, url): Promise<{ redirectUrl: string }>
```

#### 2.3 Tracking API Endpoints
```
GET /api/track/open/[trackingId].png  → Returns 1x1 transparent pixel, records open
GET /api/track/click/[trackingId]     → Records click, redirects to actual URL
```

#### 2.4 Custom Tracking Domain (Optional Enhancement)
- Allow users to set up `track.theirdomain.com` CNAME
- Better deliverability vs. using Peach's domain
- Requires SSL certificate provisioning

#### 2.5 Database Updates
```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY,
  touchpoint_id UUID REFERENCES lead_touchpoints(id),
  event_type TEXT, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
  event_data JSONB, -- {url: '...', userAgent: '...', ip: '...'}
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_events_touchpoint ON email_events(touchpoint_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
```

---

### Phase 3: Warmup System Enhancement (Days 5-7)
**Cost: FREE (internal system)**

#### 3.1 Warmup Schedule Configuration
```typescript
// Lemlist-style gradual ramp-up
const WARMUP_SCHEDULES = {
  conservative: { // For brand new domains
    day0: 2, day7: 5, day14: 10, day21: 20, day28: 30, day35: 40
  },
  standard: { // For domains with some history
    day0: 5, day7: 15, day14: 30, day21: 50, day28: 75
  },
  aggressive: { // For established domains
    day0: 20, day7: 40, day14: 60, day21: 80, day28: 100
  }
};
```

#### 3.2 Warmup Engagement Simulation
**Strategy**: Use internal seed accounts to generate engagement

```typescript
// lib/services/warmup-engine.ts

interface WarmupConfig {
  domainId: string;
  schedule: 'conservative' | 'standard' | 'aggressive';
  dailyLimit: number;
  incrementPerDay: number;
}

// Send warmup emails to seed accounts
sendWarmupEmails(domain): Promise<void>

// Process warmup replies (seed accounts reply back)
processWarmupReplies(domain): Promise<void>

// Calculate warmup health score
getWarmupScore(domain): Promise<number>
```

#### 3.3 Seed Account Network (Self-Managed)
**FREE Alternative to Lemwarm:**
- Create 10-20 Gmail/Outlook accounts (manual one-time setup)
- Store in database as "warmup_seeds"
- Rotate warmup sends across these accounts
- Auto-reply with canned responses
- Mark as "not spam" if lands in spam

```sql
CREATE TABLE warmup_seeds (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  provider TEXT, -- gmail, outlook, yahoo
  imap_config JSONB,
  smtp_config JSONB,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP
);

CREATE TABLE warmup_emails (
  id UUID PRIMARY KEY,
  domain_id UUID REFERENCES sending_domains(id),
  seed_id UUID REFERENCES warmup_seeds(id),
  sent_at TIMESTAMP,
  landed_in TEXT, -- 'inbox', 'spam', 'promotions'
  replied_at TIMESTAMP,
  marked_not_spam BOOLEAN DEFAULT false
);
```

#### 3.4 Warmup Dashboard UI
- Current warmup day/stage
- Daily sends vs. limit
- Inbox placement rate (% landing in inbox)
- Recommended actions

---

### Phase 4: Deliverability Dashboard (Days 8-9)
**Cost: FREE**

#### 4.1 Deliverability Score Calculation
```typescript
// lib/services/deliverability-score.ts

interface DeliverabilityFactors {
  dnsScore: number;      // SPF + DKIM + DMARC (0-30)
  warmupScore: number;   // Warmup progress (0-20)
  engagementScore: number; // Open/click rates (0-25)
  bounceScore: number;   // Low bounce rate (0-15)
  blacklistScore: number; // Not on blacklists (0-10)
}

calculateDeliverabilityScore(domain): Promise<{
  score: number; // 0-100
  factors: DeliverabilityFactors;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
}>
```

#### 4.2 Scoring Thresholds
| Score Range | Status | Action |
|-------------|--------|--------|
| 90-100 | Excellent | Continue normal sending |
| 70-89 | Good | Monitor closely |
| 50-69 | Warning | Reduce volume, investigate |
| 0-49 | Critical | Pause sending, fix issues |

#### 4.3 Dashboard Components
```
/app/deliverability/page.tsx
├── Overall Score (large gauge)
├── Domain Health Cards (per domain)
│   ├── DNS Status (SPF ✓, DKIM ✓, DMARC ✓)
│   ├── Warmup Progress
│   ├── Engagement Metrics
│   └── Blacklist Status
├── Recommendations Panel
├── Historical Score Chart (last 30 days)
└── Alert Center
```

#### 4.4 Alerts System
```typescript
// lib/services/deliverability-alerts.ts

type AlertSeverity = 'info' | 'warning' | 'critical';

interface Alert {
  domain: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  recommendation: string;
}

// Check and generate alerts
checkDeliverabilityAlerts(): Promise<Alert[]>

// Alert triggers:
// - Bounce rate > 5%
// - Open rate < 20%
// - Domain on blacklist
// - DNS record missing/invalid
// - Warmup score dropping
```

---

### Phase 5: Sender Rotation & Throttling (Days 10-11)
**Cost: FREE**

#### 5.1 Smart Sender Selection Algorithm
```typescript
// lib/services/sender-rotation.ts

interface SenderSelectionCriteria {
  campaignId: string;
  recipientDomain?: string; // For domain matching
  preferredDomains?: string[];
  rotationStrategy: 'round_robin' | 'weighted' | 'smart';
}

selectSender(criteria): Promise<SendingDomain | null> {
  // 1. Filter domains with remaining daily capacity
  // 2. Filter domains with good health score (>70)
  // 3. Apply rotation strategy:
  //    - round_robin: Cycle through in order
  //    - weighted: Prefer higher-scored domains
  //    - smart: Match recipient domain type, time of day
  // 4. Return best available domain or null if none available
}
```

#### 5.2 Throttling Algorithm
```typescript
// lib/services/send-throttler.ts

interface ThrottleConfig {
  minDelayMs: number;      // Min time between sends (default: 30s)
  maxDelayMs: number;      // Max time between sends (default: 120s)
  burstLimit: number;      // Max sends per minute (default: 2)
  dailyLimit: number;      // Per-domain daily limit
  adaptiveThrottling: boolean; // Adjust based on signals
}

// Get next allowed send time
getNextSendTime(domainId): Promise<Date>

// Record send and update counters
recordSend(domainId): Promise<void>

// Adaptive: slow down if bounce rate increasing
adjustThrottle(domainId, signal: 'bounce' | 'complaint' | 'success'): void
```

#### 5.3 Send Scheduling Queue
```typescript
// lib/services/send-queue.ts

interface QueuedEmail {
  id: string;
  touchpointId: string;
  domainId: string;
  scheduledFor: Date;
  priority: number;
  retryCount: number;
}

// Add to queue
enqueue(email: QueuedEmail): Promise<void>

// Process queue (called by cron/worker)
processQueue(): Promise<ProcessResult>

// Pause all sends for domain
pauseDomain(domainId): Promise<void>

// Resume sends
resumeDomain(domainId): Promise<void>
```

#### 5.4 Database Updates
```sql
ALTER TABLE sending_domains ADD COLUMN
  current_delay_ms INTEGER DEFAULT 60000,
  last_bounce_at TIMESTAMP,
  bounce_count_today INTEGER DEFAULT 0,
  is_paused BOOLEAN DEFAULT false,
  pause_reason TEXT;

CREATE TABLE send_queue (
  id UUID PRIMARY KEY,
  touchpoint_id UUID REFERENCES lead_touchpoints(id),
  domain_id UUID REFERENCES sending_domains(id),
  scheduled_for TIMESTAMP NOT NULL,
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_send_queue_scheduled ON send_queue(scheduled_for) WHERE status = 'pending';
```

---

### Phase 6: Bounce & Complaint Handling (Day 12)
**Cost: FREE**

#### 6.1 Enhanced Webhook Processing
```typescript
// app/api/webhooks/resend/route.ts - UPDATE EXISTING

// Handle bounce
async function handleBounce(event) {
  // 1. Mark touchpoint as failed
  // 2. Update lead status to 'bounced'
  // 3. Add to email_history as 'bounced'
  // 4. Increment domain bounce_count_today
  // 5. Check if bounce rate > 5%, pause domain if so
  // 6. Log bounce event
}

// Handle complaint (spam report)
async function handleComplaint(event) {
  // 1. Mark lead as 'do_not_contact'
  // 2. Stop all active sequences for lead
  // 3. Increment domain complaint count
  // 4. Check if complaint rate > 0.1%, alert if so
  // 5. Log complaint event
}
```

#### 6.2 Automatic Recovery
```typescript
// If domain gets paused due to high bounce rate:
// 1. Wait 24 hours
// 2. Check if source list was cleaned
// 3. Gradually resume at 50% capacity
// 4. Monitor closely for 48 hours
// 5. If stable, return to normal
```

---

## Testing Strategy

### Unit Tests
- DNS checking functions
- Score calculation
- Sender selection algorithm
- Throttling logic

### Integration Tests
- Full send flow with tracking
- Webhook processing
- Warmup email cycle

### E2E Tests
- Create domain → warmup → send campaign → track opens

---

## Cost Analysis

| Component | Cost | Notes |
|-----------|------|-------|
| DNS Queries | FREE | Node.js dns module |
| Tracking Server | FREE | Self-hosted on existing infra |
| Warmup Seeds | FREE | Manual Gmail/Outlook accounts |
| Blacklist Checks | FREE | DNS-based RBL queries |
| Database | Existing | Already using Neon Postgres |
| Email Sending | Existing | Already using Resend/SMTP |

**Total Additional Cost: $0/month**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Seed accounts get banned | Use real-looking accounts, vary behavior |
| Tracking blocked by privacy tools | Track at send level too, don't rely 100% on pixels |
| Blacklist monitoring incomplete | Check top 10 most important RBLs |
| DNS queries rate limited | Cache results, spread queries |

---

## Success Metrics

1. **Deliverability Score**: Average > 80 across all domains
2. **Bounce Rate**: < 5% on all campaigns
3. **Open Rate**: > 40% (indicating inbox placement)
4. **Warmup Completion**: 100% of new domains complete warmup
5. **Zero Blacklistings**: No domains on major blacklists

---

## Implementation Order

1. ✅ Phase 1: Domain Health (FOUNDATION - do first)
2. ✅ Phase 2: Email Tracking (USER VALUE - high impact)
3. ✅ Phase 3: Warmup Enhancement (PROTECTION - prevents issues)
4. ✅ Phase 4: Deliverability Dashboard (VISIBILITY - ties it together)
5. ✅ Phase 5: Sender Rotation (SCALE - needed for growth)
6. ✅ Phase 6: Bounce Handling (RESILIENCE - handles problems)

---

## Questions for User

1. **Seed Accounts**: Do you already have Gmail/Outlook accounts we can use for warmup, or should we plan to create them?

2. **Custom Tracking Domain**: Do you want users to set up their own tracking subdomains (better deliverability) or use a shared Peach domain initially?

3. **Warmup Priority**: Should warmup happen automatically for all new domains, or be opt-in?

4. **Alert Notifications**: Email alerts, in-app only, or both when issues are detected?

---

*Plan Version: 1.0*
*Created: Feb 9, 2026*
*Estimated Implementation: 12 days*
