# Peach AI SDR

An AI-powered Sales Development Representative system that automates outreach to school decision makers - from finding leads to booking meetings.

## Features

- **Lead Sourcing**: AI-powered search via Saarthi API + CSV import (EXA, BETT lists, etc.)
- **Email Verification**: Free DNS-based verification (no paid API needed)
- **AI Email Generation**: Personalized 5-email sequences using Claude
- **Email Sending**: Resend integration with domain rotation & warmup schedules
- **Unified Inbox**: All replies in one place with AI draft responses
- **Notion CRM Sync**: Auto-sync leads with smart scoring (Company → CRM → Tasks)
- **Meeting Booking**: Calendly integration with AI meeting prep docs

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/peach-ai-sdr.git
cd peach-ai-sdr
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#environment-variables) below).

### 3. Set up the database

```bash
npm run db:generate
npm run db:push
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Create a `.env.local` file with these values:

```env
# ============================================
# REQUIRED
# ============================================

# Database - Get free DB at https://neon.tech
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# AI - Get API key at https://console.anthropic.com
ANTHROPIC_API_KEY="sk-ant-..."

# ============================================
# OPTIONAL (for full functionality)
# ============================================

# Email Sending - Get at https://resend.com (free 3000/month)
RESEND_API_KEY="re_..."

# Notion CRM - Get at https://www.notion.so/my-integrations
NOTION_API_KEY="secret_..."
NOTION_COMPANY_DB_ID="..."
NOTION_CRM_DB_ID="..."
NOTION_TASKS_DB_ID="..."

# Calendly - Get at https://calendly.com/integrations
CALENDLY_API_KEY="..."
CALENDLY_USER_URI="..."
CALENDLY_EVENT_TYPE_URI="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Getting API Keys

### Required (to run the app)

| Service | Cost | Get it at |
|---------|------|-----------|
| **Neon PostgreSQL** | FREE | [neon.tech](https://neon.tech) |
| **Anthropic Claude** | ~$5-20/mo | [console.anthropic.com](https://console.anthropic.com) |

### Optional (for specific features)

| Service | Cost | Get it at | Used for |
|---------|------|-----------|----------|
| **Resend** | FREE (3k/mo) | [resend.com](https://resend.com) | Sending emails |
| **Notion** | FREE | [notion.so/my-integrations](https://notion.so/my-integrations) | CRM sync |
| **Calendly** | FREE | [calendly.com/integrations](https://calendly.com/integrations) | Meeting booking |

---

## Notion CRM Setup (Optional)

If you want to use Notion CRM sync, create these three databases:

### 1. Company Database
| Property | Type |
|----------|------|
| Name | Title |
| Website | URL |
| Country | Select |
| Curriculum | Multi-select |
| Fees | Number |
| Student Count | Number |
| Device Access | Select |

### 2. CRM Database
| Property | Type |
|----------|------|
| Contact Name | Title |
| Email | Email |
| Role | Select |
| Company | Relation → Company DB |
| Lead Score | Number |
| Why Good Fit | Rich text |
| Status | Select |
| Source | Select |

### 3. Tasks Database
| Property | Type |
|----------|------|
| Task | Title |
| Contact | Relation → CRM DB |
| Due Date | Date |
| Channel | Select |
| Notes | Rich text |
| Status | Select |

**Important**: Share all three databases with your Notion integration!

---

## Usage

### 1. Import Leads
Go to **Leads** page:
- Click **AI Search** for natural language queries (e.g., "IB school principals in Singapore")
- Click **Import CSV** to upload spreadsheets from EXA, BETT, etc.

### 2. Verify Emails
Select leads and click **Verify Emails** to check validity (free, uses DNS lookups).

### 3. Generate Email Sequences
Select verified leads and click **Generate Emails**. AI creates personalized 5-email sequences.

### 4. Review & Approve
Go to **Sequences** to review AI-generated emails. Edit if needed, then approve.

### 5. Start Sending
Approved sequences start sending automatically with:
- Domain rotation (avoids spam filters)
- Warmup schedule (10→25→50→100 emails/day)
- Smart cadence (3→4→5→7 days between emails)

### 6. Handle Replies
All replies appear in **Inbox**:
- AI generates draft responses
- Edit and send with one click
- Meeting-ready leads are flagged

### 7. CRM Sync
When leads reply, they auto-sync to Notion with:
- Company record (if new)
- Contact linked to company
- Lead score (0-10)
- Follow-up task

---

## Project Structure

```
peach-ai-sdr/
├── app/                      # Next.js App Router pages
│   ├── api/                  # API routes
│   │   ├── leads/           # Lead management
│   │   ├── sequences/       # Email sequences
│   │   ├── inbox/           # Inbox operations
│   │   ├── domains/         # Sending domains
│   │   ├── notion/          # CRM sync
│   │   ├── calendly/        # Meeting booking
│   │   └── webhooks/        # Inbound webhooks
│   ├── leads/               # Leads page
│   ├── sequences/           # Sequences page
│   ├── inbox/               # Inbox page
│   └── crm/                 # CRM settings page
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   └── leads/               # Lead-specific components
├── lib/
│   ├── ai/                  # AI generation
│   │   ├── generate-emails.ts
│   │   ├── draft-reply.ts
│   │   └── meeting-prep.ts
│   ├── db/                  # Database
│   │   ├── schema.ts        # Drizzle schema
│   │   └── index.ts         # DB client
│   ├── services/            # External integrations
│   │   ├── saarthi-client.ts
│   │   ├── email-sender.ts
│   │   ├── email-verify.ts
│   │   ├── notion-client.ts
│   │   ├── calendly-client.ts
│   │   └── lead-scorer.ts
│   └── utils/               # Utilities
│       └── csv-parser.ts
└── public/                  # Static assets
```

---

## Tech Stack

- **Framework**: Next.js 15 (App Router + Turbopack)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: Anthropic Claude via Vercel AI SDK
- **Email**: Resend
- **Styling**: Tailwind CSS
- **UI**: shadcn/ui + Radix primitives

---

## Monthly Costs

| Service | Cost |
|---------|------|
| Neon PostgreSQL | FREE |
| Vercel Hosting | FREE |
| Resend (3000 emails) | FREE |
| Notion | FREE |
| Calendly Basic | FREE |
| Anthropic Claude | ~$5-20 |
| **Total** | **~$5-20/month** |

---

## Troubleshooting

### npm install fails with EACCES error
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### Database connection fails
Make sure your `DATABASE_URL` includes `?sslmode=require` for Neon.

### Emails not sending
1. Check `RESEND_API_KEY` is set
2. Verify your domain in Resend dashboard
3. Add a sending domain in Settings → Domains

---

## License

MIT
