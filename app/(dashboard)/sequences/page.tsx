/**
 * SEQUENCES PAGE
 * ==============
 *
 * Shows email sequences grouped by campaign.
 * All leads MUST be in a campaign - no standalone sequences.
 * Sequences start empty and are generated on demand.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Play,
  Loader2,
  Check,
  AlertCircle,
  CheckSquare,
  Send,
  Users,
  ChevronRight,
  Clock,
  FileText,
  Zap,
  SendHorizontal,
  Sparkles,
  TrendingUp,
  Eye,
  MousePointerClick,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";

interface CampaignWithSequences {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalLeads: number;
  emailsGenerated: number;
  emailsApproved: number;
  emailsSent: number;
  createdAt: string;
  sequences: {
    pending: number;
    approved: number;
    active: number;
    completed: number;
    total: number;
  };
}

type TabType = "pending" | "approved" | "sent" | "all";

// Animated number component
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 800;
    const steps = 20;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span className="tabular-nums">{displayValue.toLocaleString()}</span>;
}

export default function SequencesPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignWithSequences[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("pending");

  // Sending state
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [sendingStatus, setSendingStatus] = useState<string | null>(null);
  const [sendingError, setSendingError] = useState<string | null>(null);

  // Generation state
  const [generatingCampaignId, setGeneratingCampaignId] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaignsWithSequences();
  }, []);

  const fetchCampaignsWithSequences = async () => {
    setIsLoading(true);
    try {
      // Fetch campaigns
      const campaignsRes = await fetch("/api/campaigns");
      const campaignsData = await campaignsRes.json();
      const allCampaigns = campaignsData.campaigns || [];

      // Fetch all sequences to count by campaign
      const sequencesRes = await fetch("/api/sequences");
      const sequencesData = await sequencesRes.json();
      const allSequences = sequencesData.sequences || [];

      // Fetch leads to get campaignId mapping
      const leadsRes = await fetch("/api/leads");
      const leadsData = await leadsRes.json();
      const allLeads = leadsData.leads || [];

      // Create lead -> campaign mapping
      const leadToCampaign: Record<string, string> = {};
      for (const lead of allLeads) {
        if (lead.campaignId) {
          leadToCampaign[lead.id] = lead.campaignId;
        }
      }

      // Group sequences by campaign
      const campaignSequences: Record<string, {
        pending: number;
        approved: number;
        active: number;
        completed: number;
        total: number;
      }> = {};

      for (const seq of allSequences) {
        const campaignId = leadToCampaign[seq.leadId];
        if (!campaignId) continue; // Skip orphaned sequences

        if (!campaignSequences[campaignId]) {
          campaignSequences[campaignId] = { pending: 0, approved: 0, active: 0, completed: 0, total: 0 };
        }

        campaignSequences[campaignId].total++;

        if (seq.status === "pending_review" || seq.status === "draft") {
          campaignSequences[campaignId].pending++;
        } else if (seq.status === "approved") {
          campaignSequences[campaignId].approved++;
        } else if (seq.status === "active") {
          campaignSequences[campaignId].active++;
        } else if (seq.status === "completed") {
          campaignSequences[campaignId].completed++;
        }
      }

      // Include ALL campaigns (even those without sequences yet)
      const campaignsWithSeqs: CampaignWithSequences[] = allCampaigns.map((c: any) => ({
        ...c,
        sequences: campaignSequences[c.id] || { pending: 0, approved: 0, active: 0, completed: 0, total: 0 },
      }));

      setCampaigns(campaignsWithSeqs);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter campaigns by tab
  const getFilteredCampaigns = () => {
    switch (activeTab) {
      case "pending":
        return campaigns.filter(c => c.sequences.pending > 0);
      case "approved":
        return campaigns.filter(c => c.sequences.approved > 0);
      case "sent":
        return campaigns.filter(c => c.sequences.active > 0 || c.sequences.completed > 0);
      case "all":
      default:
        return campaigns;
    }
  };

  const filteredCampaigns = getFilteredCampaigns();

  // Calculate stats
  const stats = {
    pending: campaigns.reduce((sum, c) => sum + c.sequences.pending, 0),
    approved: campaigns.reduce((sum, c) => sum + c.sequences.approved, 0),
    sent: campaigns.reduce((sum, c) => sum + c.sequences.active + c.sequences.completed, 0),
    all: campaigns.reduce((sum, c) => sum + c.sequences.total, 0),
  };

  // Generate sequences for a campaign
  const handleGenerateSequences = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGeneratingCampaignId(campaignId);
    setSendingStatus("Generating email sequences...");
    setSendingError(null);

    try {
      // Get leads for this campaign
      const leadsRes = await fetch(`/api/leads?campaignId=${campaignId}`);
      const leadsData = await leadsRes.json();
      const campaignLeads = leadsData.leads || [];

      if (campaignLeads.length === 0) {
        throw new Error("No leads in this campaign. Add leads first.");
      }

      const leadIds = campaignLeads.map((l: any) => l.id);

      const response = await fetch("/api/sequences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate sequences");
      }

      setSendingStatus(data.message || `Generated sequences for ${leadIds.length} leads`);
      await fetchCampaignsWithSequences();

      setTimeout(() => {
        setSendingStatus(null);
        setSendingError(null);
      }, 5000);
    } catch (error) {
      console.error("Failed to generate:", error);
      setSendingError(error instanceof Error ? error.message : "Failed to generate sequences");
      setSendingStatus(null);
    } finally {
      setGeneratingCampaignId(null);
    }
  };

  // Send approved sequences for a campaign
  const handleSendCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSendingCampaignId(campaignId);
    setSendingStatus("Sending emails...");
    setSendingError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send emails");
      }

      setSendingStatus(data.message || "Emails sent!");
      await fetchCampaignsWithSequences();

      setTimeout(() => {
        setSendingStatus(null);
        setSendingError(null);
      }, 5000);
    } catch (error) {
      console.error("Failed to send:", error);
      setSendingError(error instanceof Error ? error.message : "Failed to send emails");
      setSendingStatus(null);
    } finally {
      setSendingCampaignId(null);
    }
  };

  // Send all approved sequences across all campaigns
  const handleSendAllApproved = async () => {
    const campaignsWithApproved = campaigns.filter(c => c.sequences.approved > 0);
    if (campaignsWithApproved.length === 0) return;

    setSendingCampaignId("all");
    setSendingStatus(`Sending to ${campaignsWithApproved.length} campaign(s)...`);
    setSendingError(null);

    let totalSent = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (const campaign of campaignsWithApproved) {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/send`, {
          method: "POST",
        });

        const data = await response.json();

        if (response.ok) {
          totalSent += data.sent || 0;
          totalFailed += data.failed || 0;
          if (data.errors) {
            errors.push(...data.errors);
          }
        } else {
          totalFailed += campaign.sequences.approved;
          errors.push(`${campaign.name}: ${data.error}`);
        }
      } catch (error) {
        totalFailed += campaign.sequences.approved;
        errors.push(`${campaign.name}: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }

    await fetchCampaignsWithSequences();

    if (totalFailed > 0) {
      setSendingError(`${totalFailed} failed: ${errors.slice(0, 3).join(", ")}`);
    }
    setSendingStatus(`Sent ${totalSent} email(s)`);

    setTimeout(() => {
      setSendingStatus(null);
      setSendingError(null);
    }, 5000);

    setSendingCampaignId(null);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25">
            <Mail className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-500 font-medium">Loading sequences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sequences</h1>
          </div>
          <p className="text-gray-500">
            Review, edit, and manage your outreach campaigns
          </p>
        </div>
        <Button
          disabled={stats.approved === 0 || sendingCampaignId !== null}
          onClick={handleSendAllApproved}
          className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
        >
          {sendingCampaignId === "all" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send All Approved ({stats.approved})
        </Button>
      </div>

      {/* Sending Status/Error */}
      {(sendingStatus || sendingError) && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${
          sendingError
            ? "bg-red-50 border border-red-200"
            : "bg-emerald-50 border border-emerald-200"
        }`}>
          {sendingCampaignId || generatingCampaignId ? (
            <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
          ) : sendingError ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Check className="h-5 w-5 text-emerald-500" />
          )}
          <div className="flex-1">
            {sendingStatus && (
              <span className={sendingError ? "text-gray-700" : "text-emerald-700 font-medium"}>
                {sendingStatus}
              </span>
            )}
            {sendingError && (
              <p className="text-red-600 text-sm mt-1">{sendingError}</p>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Pending Review</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats.pending} />
          </p>
          <p className="text-sm text-gray-500 mt-1">sequences to review</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Approved</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/25">
              <CheckSquare className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats.approved} />
          </p>
          <p className="text-sm text-gray-500 mt-1">ready to send</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Sent</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
              <Send className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats.sent} />
          </p>
          <p className="text-sm text-gray-500 mt-1">sequences active/completed</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Total</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 shadow-lg shadow-violet-500/25">
              <Mail className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats.all} />
          </p>
          <p className="text-sm text-gray-500 mt-1">total sequences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "pending", label: "Pending", count: stats.pending, icon: Clock },
          { key: "approved", label: "Approved", count: stats.approved, icon: CheckSquare },
          { key: "sent", label: "Sent", count: stats.sent, icon: Send },
          { key: "all", label: "All", count: stats.all, icon: Mail },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === tab.key
                ? "bg-violet-100 text-violet-700"
                : "bg-gray-200 text-gray-600"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        {filteredCampaigns.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              {activeTab === "sent" ? (
                <SendHorizontal className="h-8 w-8 text-violet-500" />
              ) : activeTab === "pending" ? (
                <Clock className="h-8 w-8 text-violet-500" />
              ) : (
                <Mail className="h-8 w-8 text-violet-500" />
              )}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {activeTab === "sent" ? "No sent sequences yet" :
               activeTab === "approved" ? "No approved sequences" :
               activeTab === "pending" ? "No pending sequences" : "No campaigns yet"}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {campaigns.length === 0
                ? "Create a campaign and add leads to get started."
                : activeTab === "pending"
                ? "Generate email sequences for your campaigns."
                : activeTab === "approved"
                ? "Approve pending sequences to send them."
                : "Approved emails will appear here after sending."}
            </p>
            {campaigns.length === 0 && (
              <Button
                onClick={() => router.push("/campaigns")}
                className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-5 hover:bg-gray-50/50 transition-all duration-200 cursor-pointer group"
                onClick={() => router.push(`/campaigns/${campaign.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {campaign.name}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          {campaign.totalLeads} leads
                        </span>
                        <span className="text-gray-300">•</span>
                        <span>{campaign.sequences.total} sequences</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Sequence Status Breakdown */}
                    <div className="flex items-center gap-4 text-sm">
                      {campaign.sequences.pending > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-amber-700 font-medium">
                            {campaign.sequences.pending} pending
                          </span>
                        </div>
                      )}
                      {campaign.sequences.approved > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-blue-700 font-medium">
                            {campaign.sequences.approved} approved
                          </span>
                        </div>
                      )}
                      {(campaign.sequences.active > 0 || campaign.sequences.completed > 0) && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-emerald-700 font-medium">
                            {campaign.sequences.active + campaign.sequences.completed} sent
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {/* Show Generate button if no sequences yet */}
                      {campaign.sequences.total === 0 && campaign.totalLeads > 0 && (
                        <Button
                          size="sm"
                          onClick={(e) => handleGenerateSequences(campaign.id, e)}
                          disabled={generatingCampaignId === campaign.id}
                          className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-1.5"
                        >
                          {generatingCampaignId === campaign.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      )}
                      {campaign.sequences.approved > 0 && (
                        <Button
                          size="sm"
                          onClick={(e) => handleSendCampaign(campaign.id, e)}
                          disabled={sendingCampaignId === campaign.id}
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                        >
                          {sendingCampaignId === campaign.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1.5" />
                              Send ({campaign.sequences.approved})
                            </>
                          )}
                        </Button>
                      )}
                      {campaign.sequences.pending > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/campaigns/${campaign.id}`)}
                          className="gap-1.5"
                        >
                          <CheckSquare className="h-4 w-4" />
                          Review ({campaign.sequences.pending})
                        </Button>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-violet-500 transition-colors" />
                  </div>
                </div>

                {/* Progress Bar - only show if there are sequences */}
                {campaign.sequences.total > 0 && (
                  <div className="mt-4 ml-16">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                      {campaign.sequences.completed > 0 && (
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ width: `${(campaign.sequences.completed / campaign.sequences.total) * 100}%` }}
                        />
                      )}
                      {campaign.sequences.active > 0 && (
                        <div
                          className="bg-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${(campaign.sequences.active / campaign.sequences.total) * 100}%` }}
                        />
                      )}
                      {campaign.sequences.approved > 0 && (
                        <div
                          className="bg-blue-400 h-full transition-all duration-500"
                          style={{ width: `${(campaign.sequences.approved / campaign.sequences.total) * 100}%` }}
                        />
                      )}
                      {campaign.sequences.pending > 0 && (
                        <div
                          className="bg-amber-400 h-full transition-all duration-500"
                          style={{ width: `${(campaign.sequences.pending / campaign.sequences.total) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>
                        {campaign.sequences.completed + campaign.sequences.active} of {campaign.sequences.total} sent
                      </span>
                      {campaign.sequences.approved > 0 && (
                        <span className="text-blue-600 font-medium">
                          {campaign.sequences.approved} ready to send
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* No sequences yet message */}
                {campaign.sequences.total === 0 && (
                  <div className="mt-4 ml-16 text-sm text-gray-500">
                    {campaign.totalLeads > 0 ? (
                      <span>No emails generated yet. Click "Generate" to create personalized sequences.</span>
                    ) : (
                      <span>No leads in this campaign. <a href="/leads" className="text-violet-600 hover:underline font-medium">Add leads first</a>.</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      {campaigns.length > 0 && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">Pro tip:</span> Click a campaign to review individual sequences, edit emails, and approve them for sending.
          </p>
        </div>
      )}
    </div>
  );
}
