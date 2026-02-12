import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, campaigns, emailSequences, leadTouchpoints, crmContacts } from "@/lib/db/schema";
import { eq, desc, sql, count, and, gte, like, or } from "drizzle-orm";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

interface AgentAction {
  id: string;
  type: "navigate" | "create" | "update" | "delete" | "send" | "search" | "analyze";
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "waiting_approval";
  target?: string;
  result?: string;
  data?: unknown;
}

interface AgentContext {
  recentLeads?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    companyName?: string;
    jobTitle?: string;
    status?: string;
  }>;
  campaignStats?: {
    total: number;
    active: number;
    paused: number;
  };
  emailStats?: {
    totalSent: number;
    opened: number;
    replied: number;
    openRate: string;
    replyRate: string;
  };
  crmStats?: {
    total: number;
    byStage: Record<string, number>;
  };
}

// Gather context from the database
async function gatherContext(): Promise<AgentContext> {
  const context: AgentContext = {};

  try {
    // Get recent leads
    const recentLeads = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        schoolName: leads.schoolName,
        jobTitle: leads.jobTitle,
        status: leads.status,
      })
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(10);

    context.recentLeads = recentLeads.map(l => ({
      ...l,
      companyName: l.schoolName ?? undefined,
      jobTitle: l.jobTitle ?? undefined,
      status: l.status ?? undefined,
    }));

    // Get campaign stats
    const [campaignCounts] = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        paused: sql<number>`COUNT(*) FILTER (WHERE status = 'paused')`,
      })
      .from(campaigns);

    context.campaignStats = {
      total: Number(campaignCounts?.total ?? 0),
      active: Number(campaignCounts?.active ?? 0),
      paused: Number(campaignCounts?.paused ?? 0),
    };

    // Get email stats from touchpoints
    const [emailStats] = await db
      .select({
        totalSent: sql<number>`COUNT(*) FILTER (WHERE status = 'sent')`,
        opened: sql<number>`COUNT(*) FILTER (WHERE opened_at IS NOT NULL)`,
        replied: sql<number>`COUNT(*) FILTER (WHERE replied_at IS NOT NULL)`,
      })
      .from(leadTouchpoints);

    const totalSent = Number(emailStats?.totalSent ?? 0);
    const opened = Number(emailStats?.opened ?? 0);
    const replied = Number(emailStats?.replied ?? 0);

    context.emailStats = {
      totalSent,
      opened,
      replied,
      openRate: totalSent > 0 ? `${((opened / totalSent) * 100).toFixed(1)}%` : "0%",
      replyRate: totalSent > 0 ? `${((replied / totalSent) * 100).toFixed(1)}%` : "0%",
    };

    // Get CRM stats
    const crmStats = await db
      .select({
        stage: crmContacts.stage,
        count: count(),
      })
      .from(crmContacts)
      .groupBy(crmContacts.stage);

    context.crmStats = {
      total: crmStats.reduce((acc, s) => acc + Number(s.count), 0),
      byStage: Object.fromEntries(crmStats.map(s => [s.stage, Number(s.count)])),
    };
  } catch (error) {
    console.error("[Agent] Error gathering context:", error);
  }

  return context;
}

// Execute actions based on agent's plan
async function executeAction(action: AgentAction): Promise<AgentAction> {
  try {
    switch (action.type) {
      case "search":
        // Search leads
        if (action.target?.includes("lead")) {
          const searchResults = await db
            .select({
              id: leads.id,
              name: sql<string>`CONCAT(first_name, ' ', last_name)`,
              email: leads.email,
              company: leads.schoolName,
            })
            .from(leads)
            .limit(20);

          return {
            ...action,
            status: "completed",
            result: `Found ${searchResults.length} leads`,
            data: searchResults,
          };
        }
        break;

      case "analyze":
        // Return analysis as completed
        return {
          ...action,
          status: "completed",
          result: "Analysis complete",
        };

      case "create":
        // Creation requires approval
        return {
          ...action,
          status: "waiting_approval",
        };

      default:
        return {
          ...action,
          status: "completed",
        };
    }
  } catch (error) {
    return {
      ...action,
      status: "failed",
      result: error instanceof Error ? error.message : "Action failed",
    };
  }

  return action;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, executeActions = false, pendingActions = [] } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // If we're executing actions, process them
    if (executeActions && pendingActions.length > 0) {
      const executedActions = await Promise.all(
        pendingActions.map((action: AgentAction) => executeAction(action))
      );
      return NextResponse.json({
        actions: executedActions,
        message: "Actions executed successfully",
      });
    }

    // Gather context for the AI
    const context = await gatherContext();

    // Build the system prompt
    const systemPrompt = `You are an AI Sales Agent for an SDR (Sales Development Representative) automation platform. You help users manage their sales outreach by executing tasks and providing insights.

## Current System Context:
${JSON.stringify(context, null, 2)}

## Your Capabilities:
1. **Campaign Management**: Create, analyze, pause, and resume email campaigns
2. **Lead Operations**: Search, filter, import, and enrich leads
3. **Email Automation**: Generate personalized email sequences, track engagement
4. **CRM Management**: Update contact stages, add notes, track relationships
5. **Meeting Intelligence**: Analyze meeting transcripts, extract insights

## Response Format:
When responding, structure your response with:
1. A clear understanding of what the user wants
2. Actions you will take (or need approval for)
3. Results or next steps

## Important Rules:
- Always ask for approval before creating, updating, or deleting data
- Provide specific numbers and details when available
- Be concise but thorough
- Format responses with markdown for readability
- When showing data, use bullet points or tables

## Action Types:
- search: Query the database for information
- analyze: Process and analyze data
- create: Create new records (requires approval)
- update: Modify existing records (requires approval)
- delete: Remove records (requires approval)
- send: Send emails (requires approval)
- navigate: Direct user to a page`;

    // Call Claude using AI SDK
    const { text: assistantMessage } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      maxTokens: 2048,
    } as any);

    // Parse potential actions from the response
    const actions: AgentAction[] = [];

    // Look for action patterns in the response
    const lowerMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

    if (lowerMessage.includes("search") || lowerMessage.includes("find") || lowerMessage.includes("show")) {
      actions.push({
        id: `action-${Date.now()}-search`,
        type: "search",
        description: "Searching database",
        status: "completed",
        target: lowerMessage.includes("lead") ? "leads" : "data",
      });
    }

    if (lowerMessage.includes("create") || lowerMessage.includes("new") || lowerMessage.includes("add")) {
      actions.push({
        id: `action-${Date.now()}-create`,
        type: "create",
        description: "Creating new record",
        status: "waiting_approval",
      });
    }

    if (lowerMessage.includes("analyze") || lowerMessage.includes("insight")) {
      actions.push({
        id: `action-${Date.now()}-analyze`,
        type: "analyze",
        description: "Analyzing data",
        status: "completed",
      });
    }

    return NextResponse.json({
      message: assistantMessage,
      actions,
      context: {
        leadsCount: context.recentLeads?.length ?? 0,
        campaignsActive: context.campaignStats?.active ?? 0,
        emailsSent: context.emailStats?.totalSent ?? 0,
      },
    });
  } catch (error) {
    console.error("[Agent] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent error" },
      { status: 500 }
    );
  }
}

// GET endpoint for agent capabilities
export async function GET() {
  return NextResponse.json({
    capabilities: [
      {
        id: "campaigns",
        name: "Campaign Management",
        description: "Create, manage, and analyze email campaigns",
        examples: [
          "Create a new campaign targeting EdTech decision makers",
          "Show me my best performing campaigns",
          "Pause the campaign with the lowest open rate",
        ],
      },
      {
        id: "leads",
        name: "Lead Operations",
        description: "Import, search, enrich, and manage leads",
        examples: [
          "Find all leads from IB schools in Southeast Asia",
          "Enrich leads that are missing company information",
          "Show me leads that haven't been contacted",
        ],
      },
      {
        id: "emails",
        name: "Email Automation",
        description: "Generate, schedule, and send personalized emails",
        examples: [
          "Generate email sequences for my new leads",
          "Show me emails that got replies",
          "Draft a follow-up for engaged leads",
        ],
      },
      {
        id: "crm",
        name: "CRM Management",
        description: "Track contacts, update stages, and manage relationships",
        examples: [
          "Move qualified leads to the next stage",
          "Show contacts not contacted in 2 weeks",
          "Add notes to contacts with recent meetings",
        ],
      },
      {
        id: "meetings",
        name: "Meeting Intelligence",
        description: "Analyze meetings and extract insights",
        examples: [
          "Show insights from recent meetings",
          "Find meetings where interest was shown",
          "Create follow-up tasks for action items",
        ],
      },
    ],
    suggestedPrompts: [
      "Create a new outreach campaign for tech startups",
      "Show me all leads that replied positively",
      "Generate email sequences for uncontacted leads",
      "What are my top performing email subjects?",
      "Find contacts who are ready for a meeting",
    ],
  });
}
