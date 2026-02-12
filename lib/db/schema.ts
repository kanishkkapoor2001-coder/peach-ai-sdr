import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "approved",
  "researching",
  "emails_generated",
  "emailing",
  "replied",
  "meeting_booked",
  "won",
  "lost",
]);

export const sequenceStatusEnum = pgEnum("sequence_status", [
  "draft",
  "pending_review",
  "approved",
  "active",
  "paused",
  "completed",
  "stopped",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "generating",
  "ready",
  "active",
  "paused",
  "completed",
]);

// Channel types for multi-channel sequences
export const channelTypeEnum = pgEnum("channel_type", [
  "email",
  "linkedin_message",
  "linkedin_connection",
  "sms",
  "whatsapp",
  "phone_call",
]);

// Touchpoint status
export const touchpointStatusEnum = pgEnum("touchpoint_status", [
  "pending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "failed",
  "bounced",     // Email bounced (soft or hard)
  "complained",  // Marked as spam
  "skipped",
  "cancelled",   // When lead replies, remaining touchpoints are cancelled
]);

// ============================================
// USERS TABLE (for authentication)
// ============================================
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  image: text("image"),

  // Email verification
  emailVerified: timestamp("email_verified"),
  verificationToken: text("verification_token"),

  // Account settings
  role: text("role").default("user"), // "user", "admin"

  // Current workspace
  currentWorkspaceId: text("current_workspace_id"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
}, (table) => [
  index("users_email_idx").on(table.email),
]);

// ============================================
// WORKSPACE MEMBERS TABLE (users in workspaces)
// ============================================
export const workspaceMembers = pgTable("workspace_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),

  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  role: text("role").default("member"), // "owner", "admin", "member"

  // Timestamps
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("workspace_members_workspace_id_idx").on(table.workspaceId),
  index("workspace_members_user_id_idx").on(table.userId),
]);

// ============================================
// WORKSPACES TABLE (for multi-tenancy)
// ============================================
export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),

  // Branding
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#f97316"),

  // Settings
  defaultFromName: text("default_from_name"),
  defaultFromEmail: text("default_from_email"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// CAMPAIGNS TABLE
// ============================================
export const campaigns = pgTable("campaigns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  description: text("description"),

  // Source of leads
  source: text("source"), // "csv", "ai_search", "manual", "notion"
  sourceQuery: text("source_query"), // For AI search, store the query used

  // Status
  status: campaignStatusEnum("status").default("draft"),

  // Stats (denormalized for quick access)
  totalLeads: integer("total_leads").default(0),
  emailsGenerated: integer("emails_generated").default(0),
  emailsApproved: integer("emails_approved").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  replies: integer("replies").default(0),
  positiveReplies: integer("positive_replies").default(0),
  meetings: integer("meetings").default(0),

  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Sequence configuration
  sequenceType: text("sequence_type").default("ai"), // "ai" or "manual"

  // Sender rotation configuration
  senderRotation: text("sender_rotation").default("auto"), // "auto", "fixed", "round_robin"
  preferredDomainIds: jsonb("preferred_domain_ids").$type<string[]>().default([]), // IDs of preferred domains for this campaign

  // For AI sequences - criteria used
  aiCriteria: jsonb("ai_criteria").$type<{
    considerSeniority: boolean;
    considerIndustry: boolean;
    considerEngagement: boolean;
    preferredChannels: string[];
    sequenceLength: number;
    notes?: string;
  }>(),
}, (table) => [
  index("campaigns_workspace_id_idx").on(table.workspaceId),
  index("campaigns_status_idx").on(table.status),
  index("campaigns_created_at_idx").on(table.createdAt),
]);

// ============================================
// SEQUENCE TEMPLATES TABLE (campaign-level sequence definition)
// ============================================
export const sequenceTemplates = pgTable("sequence_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  campaignId: text("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),

  name: text("name").notNull(),
  description: text("description"),

  // Whether this was AI-generated or manually created
  generationType: text("generation_type").default("manual"), // "ai" or "manual"

  // AI generation metadata
  aiReasoning: text("ai_reasoning"), // Why AI chose this structure

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("sequence_templates_campaign_id_idx").on(table.campaignId),
]);

// ============================================
// TOUCHPOINT TEMPLATES TABLE (defines each step in a sequence)
// ============================================
export const touchpointTemplates = pgTable("touchpoint_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  sequenceTemplateId: text("sequence_template_id")
    .references(() => sequenceTemplates.id, { onDelete: "cascade" })
    .notNull(),

  // Order in sequence (1, 2, 3...)
  stepNumber: integer("step_number").notNull(),

  // Channel for this touchpoint
  channel: channelTypeEnum("channel").notNull(),

  // Timing
  delayDays: integer("delay_days").default(0), // Days after previous step
  preferredTimeOfDay: text("preferred_time_of_day"), // "morning", "afternoon", "evening"

  // Content template
  subject: text("subject"), // For email
  body: text("body"),

  // For calls/LinkedIn
  talkingPoints: jsonb("talking_points").$type<string[]>().default([]),

  // AI personalization instructions
  personalizationNotes: text("personalization_notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("touchpoint_templates_sequence_id_idx").on(table.sequenceTemplateId),
  index("touchpoint_templates_step_idx").on(table.stepNumber),
]);

// ============================================
// LEAD TOUCHPOINTS TABLE (actual touchpoints for each lead)
// ============================================
export const leadTouchpoints = pgTable("lead_touchpoints", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  leadId: text("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),

  touchpointTemplateId: text("touchpoint_template_id")
    .references(() => touchpointTemplates.id, { onDelete: "cascade" }),

  // Step info (copied for easy access)
  stepNumber: integer("step_number").notNull(),
  channel: channelTypeEnum("channel").notNull(),

  // Personalized content (AI-generated from template)
  subject: text("subject"),
  body: text("body"),

  // Status tracking
  status: touchpointStatusEnum("status").default("pending"),

  // Timing
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),

  // Tracking
  trackingId: text("tracking_id"), // Unique ID for tracking pixel/links
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  clickedLinks: jsonb("clicked_links").$type<string[]>(), // URLs that were clicked

  // For confidence/quality scoring
  confidenceScore: integer("confidence_score"),
  confidenceReason: text("confidence_reason"),

  // Error tracking
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("lead_touchpoints_lead_id_idx").on(table.leadId),
  index("lead_touchpoints_status_idx").on(table.status),
  index("lead_touchpoints_scheduled_idx").on(table.scheduledAt),
]);

// ============================================
// LEADS TABLE
// ============================================
export const leads = pgTable("leads", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Person
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false),
  linkedinUrl: text("linkedin_url"),
  phone: text("phone"),
  jobTitle: text("job_title").notNull(),

  // School
  schoolName: text("school_name").notNull(),
  schoolWebsite: text("school_website"),
  schoolCountry: text("school_country"),
  schoolRegion: text("school_region"),

  // Enrichment
  curriculum: jsonb("curriculum").$type<string[]>().default([]),
  annualFeesUsd: integer("annual_fees_usd"),
  studentCount: integer("student_count"),
  deviceAccess: text("device_access"), // "1:1", "shared", "low"
  schoolType: text("school_type"), // "day", "boarding", "both"

  // Research
  recentNews: jsonb("recent_news").$type<string[]>().default([]),
  aiPolicy: text("ai_policy"),
  strategicPriorities: jsonb("strategic_priorities").$type<string[]>().default([]),
  researchSummary: text("research_summary"),
  personInsights: jsonb("person_insights").$type<Record<string, unknown>>(),
  schoolInsights: jsonb("school_insights").$type<Record<string, unknown>>(),

  // Scoring
  leadScore: integer("lead_score"),
  scoreReasons: jsonb("score_reasons").$type<string[]>().default([]),

  // Status
  status: leadStatusEnum("status").default("new"),

  // Notion sync
  notionCompanyId: text("notion_company_id"),
  notionContactId: text("notion_contact_id"),

  // Campaign association
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("leads_email_idx").on(table.email),
  index("leads_status_idx").on(table.status),
  index("leads_campaign_id_idx").on(table.campaignId),
  index("leads_workspace_id_idx").on(table.workspaceId),
]);

// ============================================
// EMAIL SEQUENCES TABLE
// ============================================
export const emailSequences = pgTable("email_sequences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  leadId: text("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),

  // Angles used
  primaryAngle: text("primary_angle"),
  secondaryAngle: text("secondary_angle"),
  tertiaryAngle: text("tertiary_angle"),

  // Email 1
  email1Subject: text("email_1_subject"),
  email1Body: text("email_1_body"),
  email1SentAt: timestamp("email_1_sent_at"),

  // Email 2
  email2Subject: text("email_2_subject"),
  email2Body: text("email_2_body"),
  email2SentAt: timestamp("email_2_sent_at"),

  // Email 3
  email3Subject: text("email_3_subject"),
  email3Body: text("email_3_body"),
  email3SentAt: timestamp("email_3_sent_at"),

  // Email 4
  email4Subject: text("email_4_subject"),
  email4Body: text("email_4_body"),
  email4SentAt: timestamp("email_4_sent_at"),

  // Email 5
  email5Subject: text("email_5_subject"),
  email5Body: text("email_5_body"),
  email5SentAt: timestamp("email_5_sent_at"),

  // Status
  status: sequenceStatusEnum("status").default("draft"),
  currentEmail: integer("current_email").default(1),
  nextSendAt: timestamp("next_send_at"),
  stopReason: text("stop_reason"),

  // Confidence scoring (1-10, used for auto-approval)
  confidenceScore: integer("confidence_score"),
  confidenceReason: text("confidence_reason"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("sequences_lead_id_idx").on(table.leadId),
  index("sequences_status_idx").on(table.status),
  index("sequences_confidence_idx").on(table.confidenceScore),
]);

// ============================================
// INBOX MESSAGES TABLE
// ============================================
export const inboxMessages = pgTable("inbox_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  leadId: text("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),

  sequenceId: text("sequence_id").references(() => emailSequences.id),

  // Email details
  direction: messageDirectionEnum("direction").notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  htmlBody: text("html_body"),

  // Threading
  threadId: text("thread_id"),
  inReplyTo: text("in_reply_to"),
  messageId: text("message_id"),

  // AI assistance
  aiDraftReply: text("ai_draft_reply"),
  aiDraftApproved: boolean("ai_draft_approved").default(false),

  // Status
  isRead: boolean("is_read").default(false),
  readBy: jsonb("read_by").$type<string[]>().default([]),
  assignedTo: text("assigned_to"),

  // Timestamps
  receivedAt: timestamp("received_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// SENDING DOMAINS TABLE
// ============================================
export const sendingDomains = pgTable("sending_domains", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  domain: text("domain").notNull().unique(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),

  // Sending method: "resend" (default) or "smtp"
  sendingMethod: text("sending_method").default("resend"),

  // SMTP Configuration (for Gmail, Outlook, custom SMTP)
  smtpHost: text("smtp_host"), // e.g., smtp.gmail.com, smtp.office365.com
  smtpPort: integer("smtp_port"), // 587 for TLS, 465 for SSL
  smtpUser: text("smtp_user"), // Usually the email address
  smtpPassword: text("smtp_password"), // App password for Gmail/Outlook
  smtpSecure: boolean("smtp_secure").default(false), // true for port 465 (SSL)

  // IMAP Configuration (for receiving replies)
  imapHost: text("imap_host"), // e.g., imap.gmail.com, outlook.office365.com
  imapPort: integer("imap_port"), // 993 for SSL
  lastImapSync: timestamp("last_imap_sync"), // Last time we checked for new emails

  // Warmup tracking
  warmupStartDate: timestamp("warmup_start_date").defaultNow(),
  sentToday: integer("sent_today").default(0),
  lastResetDate: text("last_reset_date"),
  warmupSchedule: text("warmup_schedule").default("standard"), // conservative, standard, aggressive
  dailyLimit: integer("daily_limit").default(50),

  // Domain Health (DNS & Deliverability)
  spfStatus: text("spf_status"), // valid, invalid, missing
  dkimStatus: text("dkim_status"), // valid, invalid, missing
  dkimSelector: text("dkim_selector"), // The DKIM selector found (e.g., "google", "selector1")
  dmarcStatus: text("dmarc_status"), // valid, invalid, missing
  dmarcPolicy: text("dmarc_policy"), // none, quarantine, reject
  mxStatus: text("mx_status"), // valid, invalid
  blacklistStatus: jsonb("blacklist_status").$type<Record<string, boolean>>(), // {spamhaus: false, barracuda: false, ...}
  isBlacklisted: boolean("is_blacklisted").default(false),
  healthScore: integer("health_score"), // 0-100
  healthStatus: text("health_status"), // excellent, good, warning, critical
  lastHealthCheck: timestamp("last_health_check"),
  healthRecommendations: jsonb("health_recommendations").$type<string[]>(),

  // Throttling & Rate Limiting
  currentDelayMs: integer("current_delay_ms").default(60000), // Delay between sends
  bounceCountToday: integer("bounce_count_today").default(0),
  complaintCountToday: integer("complaint_count_today").default(0),
  lastBounceAt: timestamp("last_bounce_at"),
  isPaused: boolean("is_paused").default(false),
  pauseReason: text("pause_reason"),
  pausedAt: timestamp("paused_at"),

  // Status
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// EMAIL HISTORY TABLE (for deduplication)
// ============================================
export const emailHistory = pgTable("email_history", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // The email address (normalized to lowercase)
  email: text("email").notNull().unique(),

  // Person info (if known)
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"),
  jobTitle: text("job_title"),
  schoolName: text("school_name"),

  // Source of this record
  source: text("source").notNull(), // "import", "search", "csv_history", "manual"

  // Status
  status: text("status").default("contacted"), // "contacted", "bounced", "unsubscribed", "do_not_contact"

  // If linked to a lead
  leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),

  // Timestamps
  firstContactedAt: timestamp("first_contacted_at"),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// EMAIL EVENTS TABLE (for detailed tracking)
// ============================================
export const emailEventTypeEnum = pgEnum("email_event_type", [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "replied",
]);

export const emailEvents = pgTable("email_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Reference to the touchpoint
  touchpointId: text("touchpoint_id")
    .references(() => leadTouchpoints.id, { onDelete: "cascade" })
    .notNull(),

  // Event type
  eventType: emailEventTypeEnum("event_type").notNull(),

  // Event metadata
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  clickedUrl: text("clicked_url"), // For click events
  bounceType: text("bounce_type"), // soft, hard
  bounceReason: text("bounce_reason"),

  // Geolocation (if available)
  country: text("country"),
  city: text("city"),

  // Timestamps
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_events_touchpoint_id_idx").on(table.touchpointId),
  index("email_events_event_type_idx").on(table.eventType),
  index("email_events_occurred_at_idx").on(table.occurredAt),
]);

// ============================================
// COMPANY CONTEXT TABLE (for white-label support)
// ============================================
export const companyContext = pgTable("company_context", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Basic company info
  companyName: text("company_name").notNull(),
  companyWebsite: text("company_website"),
  companyDescription: text("company_description"),
  industry: text("industry"),

  // Value propositions (AI-discovered or user-provided)
  valuePropositions: jsonb("value_propositions").$type<{
    title: string;
    description: string;
    targetAudience?: string;
    source: "ai_discovered" | "user_provided";
  }[]>().default([]),

  // Target markets
  targetMarkets: jsonb("target_markets").$type<{
    segment: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[]>().default([]),

  // Pain points the product solves
  painPoints: jsonb("pain_points").$type<string[]>().default([]),

  // Key differentiators
  differentiators: jsonb("differentiators").$type<string[]>().default([]),

  // Tone and style preferences
  emailTone: text("email_tone").default("professional"), // professional, casual, friendly, formal
  senderName: text("sender_name"),
  senderTitle: text("sender_title"),
  signatureBlock: text("signature_block"),

  // Uploaded documents (stored as JSON with metadata)
  uploadedDocuments: jsonb("uploaded_documents").$type<{
    id: string;
    filename: string;
    type: string;
    extractedContent: string;
    uploadedAt: string;
  }[]>().default([]),

  // AI-generated insights from website/docs
  aiInsights: jsonb("ai_insights").$type<{
    summary: string;
    keyFeatures: string[];
    competitiveAdvantages: string[];
    idealCustomerProfile: string;
    generatedAt: string;
  }>(),

  // Website scrape data
  websiteScrapedAt: timestamp("website_scraped_at"),
  websiteContent: text("website_content"),

  // Is this the active/default company context?
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// CRM CONTACTS TABLE (Built-in CRM)
// ============================================
export const crmStageEnum = pgEnum("crm_stage", [
  "lead",
  "contacted",
  "qualified",
  "meeting_scheduled",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
]);

export const crmContacts = pgTable("crm_contacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Link to original lead
  leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),

  // Basic Info (auto-populated from lead)
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  jobTitle: text("job_title"),

  // Company/School Info
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  companyCountry: text("company_country"),
  companyRegion: text("company_region"),
  industry: text("industry"),

  // CRM Stage
  stage: crmStageEnum("stage").default("lead"),
  stageChangedAt: timestamp("stage_changed_at").defaultNow(),

  // Engagement Metrics (auto-populated)
  totalEmailsSent: integer("total_emails_sent").default(0),
  totalEmailsOpened: integer("total_emails_opened").default(0),
  totalEmailsClicked: integer("total_emails_clicked").default(0),
  totalReplies: integer("total_replies").default(0),
  lastContactedAt: timestamp("last_contacted_at"),
  lastRepliedAt: timestamp("last_replied_at"),

  // AI Enriched Fields
  linkedinUrl: text("linkedin_url"),
  linkedinHeadline: text("linkedin_headline"),
  linkedinConnections: integer("linkedin_connections"),
  linkedinAbout: text("linkedin_about"),

  // Company Research
  companySize: text("company_size"),
  companyFunding: text("company_funding"),
  companyRevenue: text("company_revenue"),
  companyFoundedYear: integer("company_founded_year"),
  companyDescription: text("company_description"),
  techStack: jsonb("tech_stack").$type<string[]>().default([]),
  competitors: jsonb("competitors").$type<string[]>().default([]),

  // Recent News & Signals
  recentNews: jsonb("recent_news").$type<{
    title: string;
    url: string;
    date: string;
    summary: string;
  }[]>().default([]),
  buyingSignals: jsonb("buying_signals").$type<string[]>().default([]),

  // Decision Makers
  decisionMakers: jsonb("decision_makers").$type<{
    name: string;
    title: string;
    linkedinUrl?: string;
  }[]>().default([]),

  // Lead Scoring
  leadScore: integer("lead_score"),
  scoreReasons: jsonb("score_reasons").$type<string[]>().default([]),
  scoreUpdatedAt: timestamp("score_updated_at"),

  // Custom Fields (user-defined)
  customFields: jsonb("custom_fields").$type<Record<string, string | number | boolean>>().default({}),

  // Notes & Tags
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().default([]),

  // Deal Info
  dealValue: integer("deal_value"),
  dealCurrency: text("deal_currency").default("USD"),
  expectedCloseDate: timestamp("expected_close_date"),
  lostReason: text("lost_reason"),

  // Enrichment Status
  enrichedAt: timestamp("enriched_at"),
  enrichmentSource: text("enrichment_source"),
  enrichmentStatus: text("enrichment_status").default("pending"),

  // Source Info
  source: text("source"),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("crm_contacts_email_idx").on(table.email),
  index("crm_contacts_stage_idx").on(table.stage),
  index("crm_contacts_lead_id_idx").on(table.leadId),
  index("crm_contacts_score_idx").on(table.leadScore),
]);

// ============================================
// CRM ACTIVITY LOG TABLE
// ============================================
export const crmActivityTypeEnum = pgEnum("crm_activity_type", [
  "email_sent",
  "email_opened",
  "email_clicked",
  "email_replied",
  "meeting_scheduled",
  "meeting_completed",
  "call_made",
  "note_added",
  "stage_changed",
  "enriched",
  "task_created",
  "task_completed",
]);

export const crmActivities = pgTable("crm_activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  contactId: text("contact_id")
    .references(() => crmContacts.id, { onDelete: "cascade" })
    .notNull(),

  activityType: crmActivityTypeEnum("activity_type").notNull(),

  // Activity Details
  subject: text("subject"),
  body: text("body"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  // For stage changes
  fromStage: text("from_stage"),
  toStage: text("to_stage"),

  // Timestamps
  occurredAt: timestamp("occurred_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("crm_activities_contact_id_idx").on(table.contactId),
  index("crm_activities_type_idx").on(table.activityType),
  index("crm_activities_occurred_at_idx").on(table.occurredAt),
]);

// ============================================
// CRM SETTINGS TABLE
// ============================================
export const crmSettings = pgTable("crm_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // CRM Mode: "builtin" or "notion" or "both"
  crmMode: text("crm_mode").default("builtin"),

  // Visible columns (user can customize)
  visibleColumns: jsonb("visible_columns").$type<string[]>().default([
    "firstName", "lastName", "email", "companyName", "jobTitle",
    "stage", "leadScore", "lastContactedAt", "totalReplies"
  ]),

  // Custom field definitions
  customFieldDefinitions: jsonb("custom_field_definitions").$type<{
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "date" | "select";
    options?: string[];
    aiResearchable?: boolean;
  }[]>().default([]),

  // Auto-add to CRM settings
  autoAddOnReply: boolean("auto_add_on_reply").default(true),
  autoAddOnMeeting: boolean("auto_add_on_meeting").default(true),

  // Default stage for new contacts
  defaultStage: text("default_stage").default("lead"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// MEETINGS TABLE
// ============================================
export const meetings = pgTable("meetings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  leadId: text("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),

  // Scheduling
  scheduledAt: timestamp("scheduled_at").notNull(),
  endTime: timestamp("end_time"),
  eventName: text("event_name"),
  meetingUrl: text("meeting_url"),

  // Prep document (stored as JSON)
  prepDocument: jsonb("prep_document").$type<{
    prospectSummary: string;
    talkingPoints: string[];
    objections: { objection: string; response: string }[];
    quickFacts: { label: string; value: string }[];
  }>(),

  // Calendly tracking
  calendlyEventUri: text("calendly_event_uri"),
  calendlyInviteeUri: text("calendly_invitee_uri"),

  // Status
  status: text("status").default("scheduled"), // scheduled, completed, canceled, no_show

  // Notes
  notes: text("notes"),
  outcome: text("outcome"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// MEETING PREPS TABLE (legacy, keeping for compatibility)
// ============================================
export const meetingPreps = pgTable("meeting_preps", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  leadId: text("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),

  // Content
  rundown: text("rundown"),
  talkingPoints: jsonb("talking_points").$type<string[]>().default([]),
  questionsToAsk: jsonb("questions_to_ask").$type<string[]>().default([]),
  potentialObjections: jsonb("potential_objections").$type<
    { objection: string; response: string }[]
  >().default([]),

  // Meeting details
  calendlyEventUri: text("calendly_event_uri"),
  meetingScheduledAt: timestamp("meeting_scheduled_at"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// APP SETTINGS TABLE
// ============================================
export const appSettings = pgTable("app_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  key: text("key").notNull().unique(),
  value: text("value"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// RELATIONS
// ============================================
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  campaigns: many(campaigns),
  leads: many(leads),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [campaigns.workspaceId],
    references: [workspaces.id],
  }),
  leads: many(leads),
  sequenceTemplates: many(sequenceTemplates),
}));

export const sequenceTemplatesRelations = relations(sequenceTemplates, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [sequenceTemplates.campaignId],
    references: [campaigns.id],
  }),
  touchpoints: many(touchpointTemplates),
}));

export const touchpointTemplatesRelations = relations(touchpointTemplates, ({ one, many }) => ({
  sequenceTemplate: one(sequenceTemplates, {
    fields: [touchpointTemplates.sequenceTemplateId],
    references: [sequenceTemplates.id],
  }),
  leadTouchpoints: many(leadTouchpoints),
}));

export const leadTouchpointsRelations = relations(leadTouchpoints, ({ one }) => ({
  lead: one(leads, {
    fields: [leadTouchpoints.leadId],
    references: [leads.id],
  }),
  touchpointTemplate: one(touchpointTemplates, {
    fields: [leadTouchpoints.touchpointTemplateId],
    references: [touchpointTemplates.id],
  }),
}));

export const leadsRelations = relations(leads, ({ many, one }) => ({
  emailSequence: one(emailSequences),
  messages: many(inboxMessages),
  meetings: many(meetings),
  meetingPrep: one(meetingPreps),
  touchpoints: many(leadTouchpoints),
  campaign: one(campaigns, {
    fields: [leads.campaignId],
    references: [campaigns.id],
  }),
  workspace: one(workspaces, {
    fields: [leads.workspaceId],
    references: [workspaces.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ one }) => ({
  lead: one(leads, {
    fields: [meetings.leadId],
    references: [leads.id],
  }),
}));

export const emailSequencesRelations = relations(emailSequences, ({ one, many }) => ({
  lead: one(leads, {
    fields: [emailSequences.leadId],
    references: [leads.id],
  }),
  messages: many(inboxMessages),
}));

export const inboxMessagesRelations = relations(inboxMessages, ({ one }) => ({
  lead: one(leads, {
    fields: [inboxMessages.leadId],
    references: [leads.id],
  }),
  sequence: one(emailSequences, {
    fields: [inboxMessages.sequenceId],
    references: [emailSequences.id],
  }),
}));

export const meetingPrepsRelations = relations(meetingPreps, ({ one }) => ({
  lead: one(leads, {
    fields: [meetingPreps.leadId],
    references: [leads.id],
  }),
}));

export const crmContactsRelations = relations(crmContacts, ({ one, many }) => ({
  lead: one(leads, {
    fields: [crmContacts.leadId],
    references: [leads.id],
  }),
  campaign: one(campaigns, {
    fields: [crmContacts.campaignId],
    references: [campaigns.id],
  }),
  activities: many(crmActivities),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmActivities.contactId],
    references: [crmContacts.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  workspaceMembers: many(workspaceMembers),
  currentWorkspace: one(workspaces, {
    fields: [users.currentWorkspaceId],
    references: [workspaces.id],
  }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

// ============================================
// TYPES
// ============================================
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

export type EmailSequence = typeof emailSequences.$inferSelect;
export type NewEmailSequence = typeof emailSequences.$inferInsert;

export type InboxMessage = typeof inboxMessages.$inferSelect;
export type NewInboxMessage = typeof inboxMessages.$inferInsert;

export type SendingDomain = typeof sendingDomains.$inferSelect;
export type NewSendingDomain = typeof sendingDomains.$inferInsert;

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;

export type MeetingPrep = typeof meetingPreps.$inferSelect;
export type NewMeetingPrep = typeof meetingPreps.$inferInsert;

export type EmailHistory = typeof emailHistory.$inferSelect;
export type NewEmailHistory = typeof emailHistory.$inferInsert;

export type CompanyContext = typeof companyContext.$inferSelect;
export type NewCompanyContext = typeof companyContext.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

export type SequenceTemplate = typeof sequenceTemplates.$inferSelect;
export type NewSequenceTemplate = typeof sequenceTemplates.$inferInsert;

export type TouchpointTemplate = typeof touchpointTemplates.$inferSelect;
export type NewTouchpointTemplate = typeof touchpointTemplates.$inferInsert;

export type LeadTouchpoint = typeof leadTouchpoints.$inferSelect;
export type NewLeadTouchpoint = typeof leadTouchpoints.$inferInsert;

export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;

export type CrmContact = typeof crmContacts.$inferSelect;
export type NewCrmContact = typeof crmContacts.$inferInsert;

export type CrmActivity = typeof crmActivities.$inferSelect;
export type NewCrmActivity = typeof crmActivities.$inferInsert;

export type CrmSetting = typeof crmSettings.$inferSelect;
export type NewCrmSetting = typeof crmSettings.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
