export const SKILL_PROMPT = `# Peach Cold Email Skill

Write personalised cold email sequences for Peach.Study targeting school leaders.

## Workflow Overview

When given a list of targets:

1. **Research each target deeply** (use web search)
2. **Select value propositions** based on research
3. **Write 5-email sequence** for each target
4. **Output to spreadsheet** with all emails

## Step 1: Research Each Target

For each target, research:

**About the person:**
- Role and responsibilities
- Public statements, interviews, articles
- Recent achievements or awards
- Topics they care about (check LinkedIn, conference talks, publications)

**About the school:**
- Curriculum: IB, A-levels, IGCSE, AP, national curriculum
- Type: day/boarding, international, local, multilingual
- Size and student demographics
- Recent news, inspection reports, strategic plans
- AI/technology stance or initiatives

**Key research questions:**
- What problems does this person publicly care about solving?
- Has their school recently won awards or been in the news?
- Do they have a published AI policy or digital strategy?
- What are their stated priorities for the coming year?

## Step 2: Select Value Propositions

**Selection criteria:**
- Prefer HIGH value angles unless research strongly suggests otherwise
- Match triggers from research to angle triggers
- Consider the person's role when selecting angles

**For each target, select:**
- Primary angle for Email 2
- Secondary angle for Email 3
- Tertiary angle for Email 4

## Step 3: Write 5-Email Sequence

### Email 1: Introduction

**Structure (3 paragraphs, ~125 words max):**

**Para 1 - Personalised hook:**
- One specific detail from research (curriculum, recent news, achievement, context)
- If they've achieved something recently, be complimentary
- Frame from their world, not yours

**Para 2 - Value proposition:**
- Default: Peach improves student learning via personalisation
- Alternative safe angle: Peach reduces teacher workload (~15h/week)
- One sentence on how Peach diagnoses + personalises
- Brief reassurance on data safety/GDPR alignment

**Para 3 - CTA:**
> Would you be open to taking a look at a short 2m video that shows-off what you can do with Peach — or is there someone leading instructional technology/AI adoption whom I should get in touch with instead?

### Email 2: Value Prop #1 (Highest Match)

**Structure (3 paragraphs, ~125 words max):**

- Brief follow-up opener
- Present chosen value proposition
- Keep language neutral and international

**CTA:**
> Would you be open to briefly reviewing some material that details how Peach achieves [claim from email] — or is there someone leading instructional technology/AI adoption whom I should get in touch with instead?

### Email 3: Value Prop #2 (Second Match)

**Structure (3 paragraphs, ~125 words max):**

- Brief opener referencing previous email
- Present second value proposition
- Different angle than Email 2

**CTA:**
> Would you be open to having a quick chat so that I may demonstrate how Peach can [claim from email]?

### Email 4: Value Prop #3 (Third Match)

**Structure (3 paragraphs, ~125 words max):**

- Brief opener
- Present third value proposition
- Final substantive pitch

**CTA:**
> May I send you a 2-minute video demo of Peach or, if you prefer, could we schedule a short call to demo?

### Email 5: Break-up

**Structure (2-3 short paragraphs, ~75 words max):**

- Acknowledge they're busy
- Leave door open for future
- No pressure, respectful close

**Example closing:**
> If this isn't a priority for this term, no problem at all—just wanted to put Peach on your radar as you consider the role of AI in teaching and learning.

## Writing Rules

**ALWAYS:**
- Keep emails under 125 words (break-up under 75)
- Use 3 short paragraphs max
- Use neutral, international English
- Be peer-to-peer, professional
- Frame from their world first
- Include one personalised detail per email

**NEVER:**
- Use "edtech bro" language (disrupt, 10x, revolutionise, game-changer)
- Use heavy US idioms or "districts"
- Write walls of text
- Include multiple links
- Be pushy or salesy
- Make unsubstantiated claims

## Output Format

Output as JSON with these fields:
- email1Subject, email1Body
- email2Subject, email2Body
- email3Subject, email3Body
- email4Subject, email4Body
- email5Subject, email5Body
- anglesUsed (array of angle names)
`;
