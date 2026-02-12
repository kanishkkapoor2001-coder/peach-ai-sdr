# Campaign Feature PRD - Peach AI SDR

## Executive Summary

Complete rebuild of the campaigns feature to deliver a Lemlist-style, multi-channel sales engagement platform with rock-solid reliability and excellent UX.

---

## Goals & Success Metrics

### Primary Goals
1. **Automated outreach at scale** - Send personalized emails to many leads with minimal manual effort
2. **Full sales engagement** - Complete outreach suite with email, LinkedIn, calls, tasks

### Success Metrics
- Zero bugs in email sending/timing
- < 2 second page load times
- Campaign creation in < 5 minutes
- 95%+ email deliverability tracking accuracy

---

## User Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Visual sequence builder | **Must have** - Lemlist-style flow diagram |
| Lead import methods | CSV, AI search, CRM sync (Notion), Manual entry |
| Campaign list style | Lemlist-style (status toggle, name, leads ratio, sender, tags, date) |
| Analytics | Comprehensive - funnel, deliverability, and engagement metrics |
| Personalization | **Flexible** - Choose fully manual, fully AI, or hybrid (editable after generation) |
| Review flow | Bulk approve with spot-check (preview any lead's emails) |
| Scheduling | Send immediately, schedule for later, smart scheduling |
| Reply handling | Auto-pause on reply, smart detection, auto-categorize |
| Channels | Full multi-channel (Email, LinkedIn, Calls, Tasks) |
| Timeline | 1 week polished build |

---

## Information Architecture

### Campaign Structure

```
Campaign
├── Settings (name, description, senders, schedule)
├── Sequence (visual flow of steps)
│   ├── Step 1: Email
│   ├── Step 2: Wait X days
│   ├── Step 3: Email follow-up
│   ├── Step 4: LinkedIn connection
│   ├── Step 5: Wait X days
│   ├── Step 6: Call task
│   └── ...
├── Lead List
│   ├── Import history
│   ├── Lead table with custom columns
│   └── Enrichment options
└── Launch
    ├── To Launch (pending review)
    └── Launched (in progress/completed)
```

---

## Page-by-Page Specification

### 1. Campaign List Page (`/campaigns`)

**Layout:** Full-width table with filters

**Header:**
- Title: "Campaigns"
- Search bar: "Search a campaign..."
- Filters: Status (All/Active/Paused/Draft), Sender, Tags, Creators
- "Favorites only" toggle
- **"+ Create campaign"** button (primary CTA)

**Table Columns:**
| Column | Description |
|--------|-------------|
| Checkbox | Bulk selection |
| Status | Toggle switch (active/paused) |
| Campaign Name | With emoji/icon, clickable to open |
| Leads Completed | Progress indicator (e.g., "27/174") |
| Sender | Avatar of sender(s) |
| Tag | Optional categorization |
| Created at | Relative time (e.g., "4 days ago") |
| Actions | Star (favorite), Analytics, More menu |

**Row Actions (... menu):**
- Duplicate campaign
- Archive campaign
- Delete campaign
- Export leads

---

### 2. Campaign Detail - Tabs Navigation

**Top Bar:**
- Close button (X)
- Campaign name (editable inline)
- Status toggle (ON/OFF)
- Star (favorite)
- Settings gear
- More options (...)

**Tab Navigation (with completion checkmarks):**
1. **Overview** - Analytics dashboard
2. **Sequence** - Visual flow builder
3. **Lead list** - Manage campaign leads
4. **Launch** - Review and send

**"All set" indicator** when all required steps are complete

---

### 3. Overview Tab (`/campaigns/[id]/overview`)

**Left Sidebar:**
- View toggle: Overview | Step details
- Time period selector (date range)
- Senders filter dropdown
- Channels filter dropdown
- Export campaign button

**Main Content:**

#### Funnel Lead Process
Visual bar chart showing:
- Contacted (count + %)
- Opened (count + %)
- Interaction (count + %) - with info tooltip
- Answered (count + %)
- Interested (count + %)
- Interrupted (count + %) - with info tooltip

#### Campaign Statistics

**Lead stats:**
- Leads in campaign
- Leads launched (% + count)
- Leads reached (% + count)

**Deliverability stats:**
- Messages sent
- Messages not sent
- Delivered (% + count)

**Positive signal stats:**
- Open rate (% + count)
- Clicked rate (% + count)
- Replied rate (% + count)

---

### 4. Sequence Tab (`/campaigns/[id]/sequence`)

**Layout:** Two-panel view (list-based, not visual flow diagram)

**Left Panel - Step List:**
- Vertical list of sequence steps
- Each step is a card showing:
  - Step number
  - Step type icon (Email/Wait)
  - Brief preview (subject or delay)
  - Drag handle for reordering
  - Delete button
- "Add Step" button at bottom with dropdown (Email, Wait)
- Drag-and-drop to reorder steps

**Step Card Preview:**
```
┌─────────────────────────────────────────┐
│ 1  📧 Email                        ⋮  🗑 │
│    Subject: Follow up on our chat       │
│    Send immediately                     │
├─────────────────────────────────────────┤
│ 2  ⏱️ Wait                         ⋮  🗑 │
│    Wait for 2 days                      │
├─────────────────────────────────────────┤
│ 3  📧 Email                        ⋮  🗑 │
│    Subject: Quick check-in              │
└─────────────────────────────────────────┘
         [+ Add Step ▾]
```

**Right Panel - Step Editor:**
When a step is selected:

For **Email step:**
- Step type label: "Email - Send automatic email"
- Templates button
- "Mark as manual" toggle
- Sender selection (dropdown)
- Content section:
  - Subject line input (with variable insertion {{firstName}})
  - Email body editor (rich text with variables)
- Timing: "Send immediately" or "Wait X days after previous step"

For **Wait step:**
- Duration input (number + unit: days/hours)
- "Skip weekends" toggle

---

### 5. Lead List Tab (`/campaigns/[id]/leads`)

**Header:**
- "Import history" expandable section
- Lead count: "72 Leads imported"

**Toolbar:**
- Filter button
- Search: "Search by email, last name, first name, phone number"
- "Create AI Columns" dropdown
- "Actions" dropdown
- **"Enrich X leads"** button (primary, with AI sparkle icon)

**Table Columns:**
| Column | Type |
|--------|------|
| Checkbox | Selection |
| Full name | With avatar, clickable |
| First name | Text |
| Last name | Text |
| Email | Text, clickable |
| Status | Badge (In progress, Completed, Paused, etc.) |
| Del | Delete action |
| + Add | Add custom column |

**Column Features:**
- Sortable (click header)
- Resizable
- Reorderable (drag)
- Custom columns (AI-generated or manual)

**Bulk Actions:**
- Delete selected
- Pause selected
- Resume selected
- Export selected

**Import Options:**
- Upload CSV
- AI Search
- Import from CRM
- Add manually

---

### 6. Launch Tab (`/campaigns/[id]/launch`)

**Layout:** Two-panel view

**Sub-tabs:**
- **To launch** - Leads pending review
- **Launched** - Leads already in sequence

**Left Panel - Lead List:**
- Search bar
- Filter button
- More options
- "X leads selected" with bulk action button
- Lead cards showing:
  - Avatar
  - Name (with LinkedIn icon if available)
  - Email
  - "Find phone" button (if missing)
  - Status badge
  - More options (...)

**Right Panel - Sequence Preview:**
- Zoom controls
- Visual timeline for selected lead showing:
  - Each step with scheduled date
  - Personalized email content preview
  - Checkmarks for completed steps
  - Current step highlighted

**Email Preview Card:**
- "Send immediately" or scheduled time
- Step type: "Email - Send automatic email"
- Sender avatar
- Personalization label (e.g., "Personalisation for HTS Global athletes")
- Full email body preview
- "Wait for X days" indicator for next step

---

## Technical Architecture

### Database Schema Updates

```sql
-- Campaigns table (update existing)
campaigns
  id
  name
  description
  status (draft, active, paused, completed, archived)
  emoji (for visual identification)
  settings (JSONB: schedule, timezone, etc.)
  created_at
  updated_at

-- Sequences table (new)
sequences
  id
  campaign_id (FK)
  name
  created_at

-- Sequence Steps table (new)
sequence_steps
  id
  sequence_id (FK)
  step_type (email, wait, linkedin, call, task)
  step_order
  config (JSONB: content, delay, etc.)
  created_at

-- Campaign Leads table (update)
campaign_leads
  id
  campaign_id (FK)
  lead_id (FK)
  status (pending, in_progress, completed, paused, bounced, replied)
  current_step_id (FK to sequence_steps)
  launched_at
  completed_at

-- Scheduled Emails table (new/update)
scheduled_emails
  id
  campaign_lead_id (FK)
  sequence_step_id (FK)
  personalized_subject
  personalized_body
  scheduled_for
  sent_at
  status (pending, sent, failed, cancelled)

-- Email Events table (for tracking)
email_events
  id
  scheduled_email_id (FK)
  event_type (sent, delivered, opened, clicked, replied, bounced)
  event_data (JSONB)
  created_at
```

### API Endpoints

```
GET    /api/campaigns                    - List campaigns with stats
POST   /api/campaigns                    - Create campaign
GET    /api/campaigns/[id]               - Get campaign details
PATCH  /api/campaigns/[id]               - Update campaign
DELETE /api/campaigns/[id]               - Delete campaign

GET    /api/campaigns/[id]/sequence      - Get sequence steps
POST   /api/campaigns/[id]/sequence      - Create/update sequence
PUT    /api/campaigns/[id]/sequence/reorder - Reorder steps

GET    /api/campaigns/[id]/leads         - Get campaign leads
POST   /api/campaigns/[id]/leads         - Add leads to campaign
DELETE /api/campaigns/[id]/leads         - Remove leads

GET    /api/campaigns/[id]/overview      - Get analytics data
GET    /api/campaigns/[id]/launch        - Get launch status per lead
POST   /api/campaigns/[id]/launch        - Launch leads
POST   /api/campaigns/[id]/pause         - Pause campaign/leads

POST   /api/campaigns/[id]/generate      - AI generate emails for leads
```

### Component Structure

```
/app/campaigns/
  page.tsx                    - Campaign list
  new/page.tsx               - Create new campaign
  [id]/
    page.tsx                 - Campaign detail (tab router)
    overview/page.tsx        - Overview tab
    sequence/page.tsx        - Sequence builder
    leads/page.tsx           - Lead list
    launch/page.tsx          - Launch tab

/components/campaigns/
  CampaignList.tsx           - Table component
  CampaignCard.tsx           - Row component
  SequenceBuilder.tsx        - Visual flow editor
  SequenceNode.tsx           - Individual step node
  StepEditor.tsx             - Right panel editor
  LeadTable.tsx              - Lead list table
  LaunchPreview.tsx          - Email preview panel
  AnalyticsDashboard.tsx     - Overview charts
  FunnelChart.tsx            - Funnel visualization
```

---

## FAST TRACK: 2-Day Functional MVP

### Day 1: Foundation + Campaign List + Sequence Builder

**Morning (4 hours):**
1. Database schema updates (sequences, sequence_steps tables)
2. Campaign list page - Lemlist-style table UI
3. Campaign CRUD API endpoints

**Afternoon (4 hours):**
4. Campaign detail page with tab navigation
5. Sequence builder - **List-based steps** (not visual flow)
   - Vertical list of steps
   - Add/remove/reorder steps
   - Step types: Email, Wait
6. Step editor panel (subject, body, delay)

### Day 2: Lead List + Launch + Email Sending

**Morning (4 hours):**
1. Lead list tab with table
2. Import leads (use existing CSV/AI search)
3. Launch tab with lead list + preview panel

**Afternoon (4 hours):**
4. Email generation (AI or manual)
5. Email sending integration (immediate send)
6. Reply detection + auto-pause
7. Testing & bug fixes

---

## Phase 2: Analytics + Polish (Days 3-5)

### Add:
1. Overview analytics dashboard
2. Funnel visualization
3. Schedule for later option
4. Bulk approve/launch
5. Email personalization options (manual/AI/hybrid)

---

## Phase 3: Advanced Features (Days 6-7)

### Add:
1. Reply categorization (AI)
2. Custom columns in lead list
3. Campaign duplication
4. Export functionality
5. Tags and favorites
6. Smart scheduling
7. A/B testing (if time permits)

---

## DEFERRED (Not in initial scope):
- LinkedIn integration (skipped for now)
- Visual flow diagram (using list-based instead)
- Call tasks
- Team collaboration features

---

## Known Issues to Fix (from current system)

1. **Email sending issues** - Rebuild scheduler with proper error handling
2. **Data/state issues** - Single source of truth, proper status management
3. **UI/UX problems** - Complete redesign based on Lemlist

---

## Data Migration Strategy

**Approach:** Preserve leads, rebuild campaigns

1. Keep all lead data intact
2. Archive existing campaigns (don't delete)
3. New campaigns use new schema
4. Old campaigns remain viewable but read-only

---

## Open Questions

1. Should we integrate with actual LinkedIn API or just create manual tasks?
2. Do we need A/B testing for email variants?
3. Should there be team collaboration features (assign leads to team members)?
4. Do we need campaign templates/presets?

---

## Approval Checklist

- [ ] PRD reviewed and approved
- [ ] Database schema confirmed
- [ ] API structure confirmed
- [ ] UI/UX approach confirmed
- [ ] Timeline realistic
- [ ] Ready to begin implementation

---

*Document Version: 1.0*
*Created: Feb 9, 2026*
*Author: Claude + Kanishk*
