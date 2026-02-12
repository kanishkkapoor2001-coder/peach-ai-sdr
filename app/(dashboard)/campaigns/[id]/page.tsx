"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportModal } from "@/components/leads/import-modal";
import {
  X,
  Star,
  Settings,
  MoreHorizontal,
  Check,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  ChevronRight,
  Plus,
  Clock,
  Mail,
  Users,
  Rocket,
  BarChart3,
  Trash2,
  GripVertical,
  Pencil,
  Loader2,
  AlertCircle,
  Search,
  Upload,
  Sparkles,
  Database,
  Filter,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  MousePointer,
  MessageSquare,
  UserCheck,
  UserX,
  AlertTriangle,
  Calendar,
  Tag,
  Globe,
  ToggleLeft,
  ToggleRight,
  Zap,
  TrendingUp,
  Target,
  Download,
  FileSpreadsheet,
} from "lucide-react";

// Types
interface Campaign {
  id: string;
  name: string;
  description: string | null;
  source: string | null;
  status: string;
  totalLeads: number;
  emailsSent: number;
  replies: number;
  createdAt: string;
}

interface SequenceStep {
  id: string;
  stepNumber: number;
  channel: string;
  delayDays: number;
  subject: string | null;
  body: string | null;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  schoolName: string;
  status: string;
  leadScore: number | null;
}

// Tab definitions
const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "sequence", label: "Sequence", icon: Mail },
  { id: "leads", label: "Lead list", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "launch", label: "Launch", icon: Rocket },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Lead status options for filtering (Lemlist-style)
const LEAD_STATUSES = [
  { value: "all", label: "All Leads", color: "gray" },
  { value: "new", label: "New", color: "blue" },
  { value: "contacted", label: "Contacted", color: "indigo" },
  { value: "opened", label: "Opened", color: "purple" },
  { value: "clicked", label: "Clicked", color: "pink" },
  { value: "replied", label: "Replied", color: "green" },
  { value: "interested", label: "Interested", color: "emerald" },
  { value: "not_interested", label: "Not Interested", color: "orange" },
  { value: "bounced", label: "Bounced", color: "red" },
  { value: "unsubscribed", label: "Unsubscribed", color: "gray" },
] as const;

// Status toggle component
function StatusToggle({
  isActive,
  onChange,
  disabled,
}: {
  isActive: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        isActive ? "bg-blue-500" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isActive ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Export dropdown component
function ExportDropdown({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: "leads" | "leads_with_emails" | "full") => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/export?type=${type}&format=csv`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get the blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campaignName.replace(/[^a-z0-9]/gi, "_")}_${type}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <p className="text-sm font-medium text-gray-900">Export Campaign Data</p>
              <p className="text-xs text-gray-500 mt-0.5">Choose what to include in your export</p>
            </div>

            <div className="p-2">
              <button
                onClick={() => handleExport("leads")}
                disabled={isExporting}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Leads Only</p>
                  <p className="text-xs text-gray-500">Export lead contact info and school details</p>
                </div>
                {isExporting && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </button>

              <button
                onClick={() => handleExport("leads_with_emails")}
                disabled={isExporting}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="p-2 bg-violet-100 rounded-lg group-hover:bg-violet-200 transition-colors">
                  <Mail className="h-4 w-4 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Leads + Emails</p>
                  <p className="text-xs text-gray-500">Include generated email sequences</p>
                </div>
                {isExporting && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </button>

              <button
                onClick={() => handleExport("full")}
                disabled={isExporting}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Full Export</p>
                  <p className="text-xs text-gray-500">All data including send status & tracking</p>
                </div>
                {isExporting && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;

  // State
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(
    (searchParams.get("tab") as TabId) || "sequence"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Sequence state
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(true);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Tab completion status
  const getTabStatus = (tabId: TabId): "complete" | "incomplete" | "none" => {
    if (!campaign) return "none";
    switch (tabId) {
      case "sequence":
        return steps.length > 0 ? "complete" : "incomplete";
      case "leads":
        return campaign.totalLeads > 0 ? "complete" : "incomplete";
      case "launch":
        return campaign.status === "active" ? "complete" : "incomplete";
      default:
        return "none";
    }
  };

  // Fetch campaign
  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (response.ok) {
        const data = await response.json();
        setCampaign(data.campaign);
        setEditName(data.campaign.name);
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Fetch sequence steps
  const fetchSequence = useCallback(async () => {
    setLoadingSteps(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/sequence`);
      if (response.ok) {
        const data = await response.json();
        setSteps(data.steps || []);
        if (data.steps?.length > 0 && !selectedStepId) {
          setSelectedStepId(data.steps[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch sequence:", error);
    } finally {
      setLoadingSteps(false);
    }
  }, [campaignId, selectedStepId]);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoadingLeads(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
    fetchSequence();
    fetchLeads();
  }, [fetchCampaign, fetchSequence, fetchLeads]);

  // Update URL when tab changes
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  // Toggle campaign status
  const toggleStatus = async () => {
    if (!campaign) return;
    const newStatus = campaign.status === "active" ? "paused" : "active";
    setUpdatingStatus(true);

    try {
      await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaign.id,
          updates: { status: newStatus },
        }),
      });
      setCampaign({ ...campaign, status: newStatus });
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Save campaign name
  const saveName = async () => {
    if (!campaign || !editName.trim()) return;

    try {
      await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaign.id,
          updates: { name: editName.trim() },
        }),
      });
      setCampaign({ ...campaign, name: editName.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save name:", error);
    }
  };

  // Add a new sequence step
  const addStep = async (type: "email" | "wait") => {
    const newStep: Partial<SequenceStep> = {
      stepNumber: steps.length + 1,
      channel: type === "email" ? "email" : "email", // wait is still "email" channel, just with delay
      delayDays: type === "wait" ? 2 : 0,
      subject: type === "email" ? "" : null,
      body: type === "email" ? "" : null,
    };

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStep),
      });

      if (response.ok) {
        const data = await response.json();
        setSteps([...steps, data.step]);
        setSelectedStepId(data.step.id);
      }
    } catch (error) {
      console.error("Failed to add step:", error);
    }
  };

  // Delete a step
  const deleteStep = async (stepId: string) => {
    try {
      await fetch(`/api/campaigns/${campaignId}/sequence/${stepId}`, {
        method: "DELETE",
      });
      setSteps(steps.filter((s) => s.id !== stepId));
      if (selectedStepId === stepId) {
        setSelectedStepId(steps[0]?.id || null);
      }
    } catch (error) {
      console.error("Failed to delete step:", error);
    }
  };

  // Update a step
  const updateStep = async (stepId: string, updates: Partial<SequenceStep>) => {
    try {
      await fetch(`/api/campaigns/${campaignId}/sequence/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
    } catch (error) {
      console.error("Failed to update step:", error);
    }
  };

  const selectedStep = steps.find((s) => s.id === selectedStepId);

  // Check if all required steps are complete
  const allSet = steps.length > 0 && campaign && campaign.totalLeads > 0;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Campaign not found</h2>
          <Button onClick={() => router.push("/campaigns")}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        {/* Close button */}
        <button
          onClick={() => router.push("/campaigns")}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        {/* Campaign name */}
        <div className="flex items-center gap-2 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-64"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditName(campaign.name);
                  }
                }}
              />
              <Button size="sm" onClick={saveName}>
                Save
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded"
            >
              <span className="font-semibold text-gray-900">{campaign.name}</span>
              <Pencil className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Status toggle */}
        <StatusToggle
          isActive={campaign.status === "active"}
          onChange={toggleStatus}
          disabled={updatingStatus || campaign.status === "draft"}
        />

        {/* Favorite */}
        <button
          onClick={() => setIsFavorite(!isFavorite)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Star
            className={`h-5 w-5 ${
              isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
            }`}
          />
        </button>

        {/* Export Dropdown */}
        <ExportDropdown campaignId={campaignId} campaignName={campaign.name} />

        {/* Settings */}
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Settings className="h-5 w-5 text-gray-400" />
        </button>

        {/* More options */}
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <MoreHorizontal className="h-5 w-5 text-gray-400" />
        </button>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 ml-auto bg-gray-100 rounded-lg p-1">
          {TABS.map((tab) => {
            const status = getTabStatus(tab.id);
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {status === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : status === "incomplete" ? (
                  <Circle className="h-4 w-4 text-gray-300" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {tab.label}
              </button>
            );
          })}

          {/* All Set indicator */}
          {allSet && (
            <div className="flex items-center gap-1 px-3 py-2 text-green-600 text-sm font-medium">
              <Check className="h-4 w-4" />
              All set
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "overview" && (
          <OverviewTab campaign={campaign} steps={steps} leads={leads} />
        )}

        {activeTab === "sequence" && (
          <SequenceTab
            campaignId={campaignId}
            steps={steps}
            selectedStepId={selectedStepId}
            setSelectedStepId={setSelectedStepId}
            selectedStep={selectedStep}
            onAddStep={addStep}
            onDeleteStep={deleteStep}
            onUpdateStep={updateStep}
            loadingSteps={loadingSteps}
            onRefresh={fetchSequence}
          />
        )}

        {activeTab === "leads" && (
          <LeadsTab
            campaignId={campaignId}
            leads={leads}
            loadingLeads={loadingLeads}
            selectedLeadIds={selectedLeadIds}
            setSelectedLeadIds={setSelectedLeadIds}
            onRefresh={fetchLeads}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            campaign={campaign}
            onUpdate={(updates) => {
              setCampaign({ ...campaign, ...updates });
            }}
          />
        )}

        {activeTab === "launch" && (
          <LaunchTab
            campaign={campaign}
            leads={leads}
            steps={steps}
            onRefresh={() => {
              fetchCampaign();
              fetchLeads();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// OVERVIEW TAB (Lemlist-style analytics)
// ============================================
function OverviewTab({
  campaign,
  steps,
  leads,
}: {
  campaign: Campaign;
  steps: SequenceStep[];
  leads: Lead[];
}) {
  // Calculate funnel metrics
  const sent = campaign.emailsSent || 0;
  const delivered = Math.floor(sent * 0.95); // Assuming 95% delivery rate
  const opened = Math.floor(sent * 0.45); // Simulated open rate
  const clicked = Math.floor(sent * 0.12); // Simulated click rate
  const replied = campaign.replies || 0;
  const interested = Math.floor(replied * 0.6); // Simulated interested rate

  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0";
  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0";
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0";

  // Funnel data for visualization
  const funnelSteps = [
    { label: "Sent", value: sent, color: "bg-blue-500", icon: Mail },
    { label: "Delivered", value: delivered, color: "bg-indigo-500", icon: CheckCircle2 },
    { label: "Opened", value: opened, color: "bg-purple-500", icon: Eye },
    { label: "Clicked", value: clicked, color: "bg-pink-500", icon: MousePointer },
    { label: "Replied", value: replied, color: "bg-green-500", icon: MessageSquare },
    { label: "Interested", value: interested, color: "bg-emerald-500", icon: UserCheck },
  ];

  const maxValue = Math.max(...funnelSteps.map((s) => s.value), 1);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Leads</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{campaign.totalLeads}</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm">Emails Sent</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{sent}</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Eye className="h-4 w-4" />
              <span className="text-sm">Open Rate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{openRate}%</span>
              {parseFloat(openRate) > 40 && (
                <span className="flex items-center text-green-500 text-sm">
                  <ArrowUpRight className="h-3 w-3" />
                  Good
                </span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <MousePointer className="h-4 w-4" />
              <span className="text-sm">Click Rate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{clickRate}%</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Reply Rate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{replyRate}%</span>
              {parseFloat(replyRate) > 5 && (
                <span className="flex items-center text-green-500 text-sm">
                  <ArrowUpRight className="h-3 w-3" />
                  Great
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Engagement Funnel */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            Engagement Funnel
          </h3>

          {sent === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Launch your campaign to see engagement metrics</p>
            </div>
          ) : (
            <div className="space-y-4">
              {funnelSteps.map((step, index) => {
                const Icon = step.icon;
                const widthPercent = (step.value / maxValue) * 100;
                const prevValue = index > 0 ? funnelSteps[index - 1].value : step.value;
                const dropOff = prevValue > 0 ? (((prevValue - step.value) / prevValue) * 100).toFixed(0) : "0";

                return (
                  <div key={step.label} className="flex items-center gap-4">
                    <div className="w-24 flex items-center gap-2 text-sm text-gray-600">
                      <Icon className="h-4 w-4" />
                      {step.label}
                    </div>
                    <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${widthPercent}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                        {step.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-20 text-right">
                      {index > 0 && prevValue > 0 && (
                        <span className="text-xs text-gray-400">
                          -{dropOff}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Sequence Progress */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-400" />
              Sequence Progress
            </h3>
            {steps.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">No sequence steps defined</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => {
                  // Simulate step metrics
                  const stepSent = Math.floor(sent / (index + 1));
                  const stepOpened = Math.floor(stepSent * 0.4);
                  return (
                    <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {step.subject || `Email ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {index === 0 ? "Day 0" : `Day ${step.delayDays}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{stepSent}</p>
                        <p className="text-xs text-gray-500">sent</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lead Status Distribution */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              Lead Status
            </h3>
            {leads.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">No leads in this campaign</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { status: "new", label: "New", color: "bg-blue-500", count: leads.filter((l) => l.status === "new").length },
                  { status: "contacted", label: "Contacted", color: "bg-indigo-500", count: leads.filter((l) => l.status === "contacted").length },
                  { status: "replied", label: "Replied", color: "bg-green-500", count: leads.filter((l) => l.status === "replied").length },
                  { status: "meeting_booked", label: "Meeting Booked", color: "bg-emerald-500", count: leads.filter((l) => l.status === "meeting_booked").length },
                ].filter((s) => s.count > 0).map((statusItem) => (
                  <div key={statusItem.status} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusItem.color}`} />
                    <span className="flex-1 text-sm text-gray-600">{statusItem.label}</span>
                    <span className="font-medium text-gray-900">{statusItem.count}</span>
                    <span className="text-xs text-gray-400">
                      ({((statusItem.count / leads.length) * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Performance Tips */}
        {sent > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Performance Insights
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {parseFloat(openRate) < 30 && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Low open rate</p>
                    <p className="text-xs text-gray-500">
                      Try improving your subject lines or sending at different times
                    </p>
                  </div>
                </div>
              )}
              {parseFloat(replyRate) > 5 && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Great reply rate!</p>
                    <p className="text-xs text-gray-500">
                      Your messaging is resonating well with prospects
                    </p>
                  </div>
                </div>
              )}
              {parseFloat(openRate) > 40 && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Strong open rate</p>
                    <p className="text-xs text-gray-500">
                      Your subject lines are working well
                    </p>
                  </div>
                </div>
              )}
              {parseFloat(clickRate) < 5 && clicked > 0 && (
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Low click rate</p>
                    <p className="text-xs text-gray-500">
                      Consider adding more compelling CTAs
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SEQUENCE TAB
// ============================================
function SequenceTab({
  campaignId,
  steps,
  selectedStepId,
  setSelectedStepId,
  selectedStep,
  onAddStep,
  onDeleteStep,
  onUpdateStep,
  loadingSteps,
  onRefresh,
}: {
  campaignId: string;
  steps: SequenceStep[];
  selectedStepId: string | null;
  setSelectedStepId: (id: string | null) => void;
  selectedStep: SequenceStep | undefined;
  onAddStep: (type: "email" | "wait") => void;
  onDeleteStep: (id: string) => void;
  onUpdateStep: (id: string, updates: Partial<SequenceStep>) => void;
  loadingSteps: boolean;
  onRefresh: () => void;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleGenerateWithAI = async () => {
    if (steps.length === 0) {
      setGenerateMessage({ type: "error", text: "Add at least one email step first" });
      return;
    }

    setGenerating(true);
    setGenerateMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "sequence" }),
      });

      const data = await response.json();

      if (response.ok) {
        setGenerateMessage({
          type: "success",
          text: `Generated content for ${data.generated} email steps!`
        });
        onRefresh();
      } else {
        setGenerateMessage({ type: "error", text: data.error || "Failed to generate" });
      }
    } catch (error) {
      console.error("Failed to generate:", error);
      setGenerateMessage({ type: "error", text: "Failed to generate content" });
    } finally {
      setGenerating(false);
    }
  };

  const [abTestEnabled, setAbTestEnabled] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* A/B Test Banner - Lemlist style */}
      {abTestEnabled && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">A/B Testing Active</p>
              <p className="text-sm text-white/80">Testing 2 variations • Traffic split: 50/50</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={() => setAbTestEnabled(false)}
          >
            <X className="h-4 w-4 mr-1" />
            End Test
          </Button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Step List */}
        <div className="w-96 border-r bg-white overflow-auto">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900">Sequence Steps</h3>
              <div className="flex items-center gap-2">
                {!abTestEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAbTestEnabled(true)}
                    className="text-purple-600 hover:bg-purple-50"
                    title="Create A/B test"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateWithAI}
                  disabled={generating || steps.length === 0}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Define the email sequence for this campaign
            </p>
            {generateMessage && (
              <div className={`mt-2 p-2 rounded text-sm ${
                generateMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {generateMessage.text}
              </div>
            )}
          </div>

        {loadingSteps ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : steps.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">No steps yet. Add your first email.</p>
            <Button onClick={() => onAddStep("email")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Email
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {steps.map((step, index) => (
              <div key={step.id}>
                {/* Wait indicator between steps */}
                {index > 0 && step.delayDays > 0 && (
                  <div className="flex items-center gap-2 py-2 px-3 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    Wait for {step.delayDays} day{step.delayDays !== 1 ? "s" : ""}
                  </div>
                )}

                {/* Step card */}
                <div
                  onClick={() => setSelectedStepId(step.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedStepId === step.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                      <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                        <Mail className="h-3 w-3 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">Email {step.stepNumber}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteStep(step.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {step.subject || "No subject"}
                      </p>
                      {index === 0 && (
                        <span className="text-xs text-blue-600">Send immediately</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Condition Branch Option (Lemlist-style) */}
                {index < steps.length - 1 && (
                  <div className="ml-4 pl-4 border-l-2 border-dashed border-gray-200 py-2">
                    <button className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-600 transition-colors group">
                      <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 group-hover:border-blue-400 flex items-center justify-center">
                        <Plus className="h-3 w-3" />
                      </div>
                      <span>Add condition</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add Step Button */}
            <div className="relative pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddMenu(!showAddMenu)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => {
                        onAddStep("email");
                        setShowAddMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4 text-blue-500" />
                      Email
                    </button>
                    <button
                      onClick={() => {
                        onAddStep("wait");
                        setShowAddMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Clock className="h-4 w-4 text-gray-500" />
                      Wait
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

        {/* Right Panel - Step Editor */}
        <div className="flex-1 bg-gray-50 overflow-auto">
          {selectedStep ? (
            <StepEditor step={selectedStep} onUpdate={onUpdateStep} abTestEnabled={abTestEnabled} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a step to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP EDITOR (with A/B testing support)
// ============================================
function StepEditor({
  step,
  onUpdate,
  abTestEnabled = false,
}: {
  step: SequenceStep;
  onUpdate: (id: string, updates: Partial<SequenceStep>) => void;
  abTestEnabled?: boolean;
}) {
  const [subject, setSubject] = useState(step.subject || "");
  const [body, setBody] = useState(step.body || "");
  const [delayDays, setDelayDays] = useState(step.delayDays);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // A/B Test variations
  const [activeVariation, setActiveVariation] = useState<"A" | "B">("A");
  const [variationB, setVariationB] = useState({ subject: "", body: "" });

  // Reset when step changes
  useEffect(() => {
    setSubject(step.subject || "");
    setBody(step.body || "");
    setDelayDays(step.delayDays);
    setHasChanges(false);
    setActiveVariation("A");
    setVariationB({ subject: "", body: "" });
  }, [step.id, step.subject, step.body, step.delayDays]);

  // Track changes
  useEffect(() => {
    const changed =
      subject !== (step.subject || "") ||
      body !== (step.body || "") ||
      delayDays !== step.delayDays;
    setHasChanges(changed);
  }, [subject, body, delayDays, step]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(step.id, { subject, body, delayDays });
    setHasChanges(false);
    setSaving(false);
  };

  // Insert placeholder at cursor
  const insertPlaceholder = (placeholder: string, field: "subject" | "body") => {
    if (field === "subject") {
      setSubject(subject + placeholder);
    } else {
      setBody(body + placeholder);
    }
  };

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > 150;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Email {step.stepNumber}</h3>
              <p className="text-sm text-gray-500">Edit content below</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : hasChanges ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              ) : (
                "Saved"
              )}
            </Button>
          </div>
        </div>

        {/* A/B Test Variation Tabs */}
        {abTestEnabled && (
          <div className="border-b px-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveVariation("A")}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeVariation === "A"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeVariation === "A" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                }`}>
                  A
                </div>
                Variation A
                <span className="text-xs text-gray-400">(50%)</span>
              </button>
              <button
                onClick={() => setActiveVariation("B")}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeVariation === "B"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeVariation === "B" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                }`}>
                  B
                </div>
                Variation B
                <span className="text-xs text-gray-400">(50%)</span>
              </button>
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
                <TrendingUp className="h-3 w-3" />
                Compare performance after sending
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Delay */}
          {step.stepNumber > 1 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Wait before sending
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={delayDays}
                  onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                  className="w-20"
                  min={0}
                />
                <span className="text-gray-500">days after previous step</span>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Subject Line</label>
              <div className="flex gap-1">
                {["{{firstName}}", "{{schoolName}}"].map((p) => (
                  <button
                    key={p}
                    onClick={() => insertPlaceholder(p, "subject")}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    + {p.replace(/\{|\}/g, "")}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject line..."
              className="text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              Keep under 50 characters. Current: {subject.length} chars
            </p>
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Email Body</label>
              <div className="flex gap-1">
                {["{{firstName}}", "{{lastName}}", "{{schoolName}}", "{{jobTitle}}"].map((p) => (
                  <button
                    key={p}
                    onClick={() => insertPlaceholder(p, "body")}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    + {p.replace(/\{|\}/g, "")}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here..."
              className="w-full h-80 p-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-base leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Tip: Keep emails under 150 words for best response rates
              </p>
              <span className={`text-xs font-medium ${isOverLimit ? "text-red-500" : "text-gray-500"}`}>
                {wordCount} / 150 words {isOverLimit && "(over limit)"}
              </span>
            </div>
          </div>

          {/* Quick tips */}
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="text-sm font-medium text-amber-800 mb-2">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Writing Tips
            </h4>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• Be specific about what you offer - avoid vague language</li>
              <li>• Personalize using placeholders like {"{{firstName}}"} and {"{{schoolName}}"}</li>
              <li>• One clear call-to-action per email (usually asking for a quick call)</li>
              <li>• No buzzwords, exclamation marks, or ALL CAPS</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LEADS TAB (Lemlist-style with status filtering)
// ============================================
function LeadsTab({
  campaignId,
  leads,
  loadingLeads,
  selectedLeadIds,
  setSelectedLeadIds,
  onRefresh,
}: {
  campaignId: string;
  leads: Lead[];
  loadingLeads: boolean;
  selectedLeadIds: Set<string>;
  setSelectedLeadIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Count leads by status
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredLeads = leads.filter((lead) => {
    // Status filter
    if (statusFilter !== "all" && lead.status !== statusFilter) {
      return false;
    }
    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.firstName.toLowerCase().includes(query) ||
      lead.lastName.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.schoolName.toLowerCase().includes(query)
    );
  });

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    if (selectedLeadIds.size === 0) return;

    // In production, this would call the API
    console.log(`Bulk action: ${action} on ${selectedLeadIds.size} leads`);
    setSelectedLeadIds(new Set());
    setShowBulkActions(false);
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700";
      case "contacted": return "bg-indigo-100 text-indigo-700";
      case "opened": return "bg-purple-100 text-purple-700";
      case "clicked": return "bg-pink-100 text-pink-700";
      case "replied": return "bg-green-100 text-green-700";
      case "interested": return "bg-emerald-100 text-emerald-700";
      case "not_interested": return "bg-orange-100 text-orange-700";
      case "bounced": return "bg-red-100 text-red-700";
      case "meeting_booked": return "bg-teal-100 text-teal-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-900">{leads.length} Leads</h3>

            {/* Status Filter Pills (Lemlist-style) */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {LEAD_STATUSES.slice(0, 6).map((status) => (
                <button
                  key={status.value}
                  onClick={() => setStatusFilter(status.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === status.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {status.label}
                  {status.value !== "all" && statusCounts[status.value] > 0 && (
                    <span className="ml-1 text-gray-400">({statusCounts[status.value]})</span>
                  )}
                </button>
              ))}

              {/* More statuses dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="px-2 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-900"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showStatusDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                      {LEAD_STATUSES.slice(6).map((status) => (
                        <button
                          key={status.value}
                          onClick={() => {
                            setStatusFilter(status.value);
                            setShowStatusDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                        >
                          {status.label}
                          {statusCounts[status.value] > 0 && (
                            <span className="text-gray-400">{statusCounts[status.value]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600">
              <Sparkles className="h-4 w-4 mr-2" />
              Enrich leads
            </Button>
          </div>
        </div>

        {/* Search and Bulk Actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by email, name, school, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Bulk Actions */}
          {selectedLeadIds.size > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
              <span className="text-sm text-blue-700 font-medium">
                {selectedLeadIds.size} selected
              </span>
              <div className="h-4 w-px bg-blue-200" />
              <button
                onClick={() => handleBulkAction("mark_interested")}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <UserCheck className="h-3 w-3" />
                Interested
              </button>
              <button
                onClick={() => handleBulkAction("mark_not_interested")}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <UserX className="h-3 w-3" />
                Not interested
              </button>
              <button
                onClick={() => handleBulkAction("pause")}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Pause className="h-3 w-3" />
                Pause
              </button>
              <button
                onClick={() => handleBulkAction("remove")}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Filter summary */}
        {statusFilter !== "all" && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">Showing:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(statusFilter)}`}>
              {LEAD_STATUSES.find((s) => s.value === statusFilter)?.label}
            </span>
            <button
              onClick={() => setStatusFilter("all")}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loadingLeads ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "No leads found" : "No leads yet"}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery
                ? "Try adjusting your search."
                : "Import leads from CSV, AI search, or manually add them."}
            </p>
            {!searchQuery && (
              <Button onClick={() => router.push(`/campaigns/new?addTo=${campaignId}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Leads
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Lead
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Activity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-gray-50 group">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => {
                        setSelectedLeadIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(lead.id)) {
                            next.delete(lead.id);
                          } else {
                            next.add(lead.id);
                          }
                          return next;
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {lead.firstName[0]}{lead.lastName?.[0] || ""}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{lead.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.schoolName}</p>
                    <p className="text-sm text-gray-500">{lead.jobTitle}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {lead.status === "new" ? (
                        <span className="text-sm text-gray-400">No activity yet</span>
                      ) : lead.status === "replied" ? (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          Replied
                        </span>
                      ) : lead.status === "contacted" ? (
                        <span className="text-sm text-indigo-600 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Email sent
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.leadScore ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          lead.leadScore >= 8 ? "bg-green-100 text-green-700" :
                          lead.leadScore >= 5 ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {lead.leadScore}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Mark as interested"
                      >
                        <UserCheck className="h-4 w-4 text-gray-400 hover:text-green-600" />
                      </button>
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Mark as not interested"
                      >
                        <UserX className="h-4 w-4 text-gray-400 hover:text-orange-600" />
                      </button>
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={(count) => {
          setShowImportModal(false);
          onRefresh();
        }}
        campaignId={campaignId}
      />
    </div>
  );
}

// ============================================
// LAUNCH TAB
// ============================================
function LaunchTab({
  campaign,
  leads,
  steps,
  onRefresh,
}: {
  campaign: Campaign;
  leads: Lead[];
  steps: SequenceStep[];
  onRefresh: () => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"to_launch" | "launched">("to_launch");
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Separate leads by status
  const leadsToLaunch = leads.filter((l) => l.status === "new");
  const launchedLeads = leads.filter((l) => l.status !== "new");

  // Get the current list based on active tab
  const currentLeads = activeSubTab === "to_launch" ? leadsToLaunch : launchedLeads;

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    currentLeads.length > 0 ? currentLeads[0].id : null
  );

  // Update selected lead when switching tabs
  useEffect(() => {
    const list = activeSubTab === "to_launch" ? leadsToLaunch : launchedLeads;
    if (list.length > 0 && (!selectedLeadId || !list.find(l => l.id === selectedLeadId))) {
      setSelectedLeadId(list[0].id);
    }
  }, [activeSubTab, leadsToLaunch, launchedLeads, selectedLeadId]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const handleLaunch = async (sendNow: boolean = true) => {
    setLaunching(true);
    setLaunchMessage(null);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: leadsToLaunch.map((l) => l.id),
          sendNow, // Send first email immediately if true
        }),
      });
      const data = await response.json();

      if (response.ok) {
        let message = `Successfully launched ${data.launchedLeads} leads with ${data.touchpointsScheduled} scheduled touchpoints!`;
        if (data.sendResult?.sent > 0) {
          message += ` ${data.sendResult.sent} email(s) sent.`;
        }
        setLaunchMessage({ type: "success", text: message });
        onRefresh();
        // Switch to launched tab after successful launch
        setActiveSubTab("launched");
      } else {
        setLaunchMessage({ type: "error", text: data.error || "Failed to launch" });
      }
    } catch (error) {
      console.error("Failed to launch:", error);
      setLaunchMessage({ type: "error", text: "Failed to launch campaign" });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Lead List */}
      <div className="w-96 border-r bg-white flex flex-col">
        {/* Sub-tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveSubTab("to_launch")}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeSubTab === "to_launch"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
          >
            To launch ({leadsToLaunch.length})
          </button>
          <button
            onClick={() => setActiveSubTab("launched")}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeSubTab === "launched"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
          >
            Launched ({launchedLeads.length})
          </button>
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-auto">
          {currentLeads.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">
                {activeSubTab === "to_launch"
                  ? "No leads ready to launch"
                  : "No launched leads yet"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {currentLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedLeadId === lead.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                      {lead.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {lead.firstName} {lead.lastName}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{lead.email}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lead.status === "new"
                        ? "bg-blue-100 text-blue-700"
                        : lead.status === "contacted"
                        ? "bg-green-100 text-green-700"
                        : lead.status === "replied"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Launch message */}
        {launchMessage && (
          <div className={`mx-4 mb-2 p-3 rounded-lg text-sm ${
            launchMessage.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {launchMessage.text}
          </div>
        )}

        {/* Launch button */}
        <div className="p-4 border-t">
          <Button
            className="w-full bg-green-500 hover:bg-green-600"
            disabled={leadsToLaunch.length === 0 || steps.length === 0 || launching}
            onClick={() => handleLaunch(true)}
          >
            {launching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Launch {leadsToLaunch.length} lead{leadsToLaunch.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
          {steps.length === 0 && (
            <p className="text-xs text-red-500 mt-2 text-center">
              Add sequence steps before launching
            </p>
          )}
          {leadsToLaunch.length === 0 && steps.length > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              All leads have been launched
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Sequence Preview */}
      <div className="flex-1 bg-gray-50 overflow-auto p-6">
        {selectedLead ? (
          <div className="max-w-2xl mx-auto">
            <h3 className="font-semibold text-gray-900 mb-4">
              Sequence preview for {selectedLead.firstName} {selectedLead.lastName}
            </h3>

            {steps.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No sequence steps defined yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id}>
                    {/* Wait indicator */}
                    {index > 0 && step.delayDays > 0 && (
                      <div className="flex items-center gap-2 py-2 text-sm text-gray-500 ml-6">
                        <div className="w-0.5 h-4 bg-gray-200" />
                        <Clock className="h-4 w-4" />
                        Wait for {step.delayDays} day{step.delayDays !== 1 ? "s" : ""}
                      </div>
                    )}

                    {/* Email preview */}
                    <div className="bg-white rounded-xl border p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-green-600">
                            {index === 0 ? "Send immediately" : `Day ${step.delayDays}`}
                          </span>
                        </div>
                      </div>

                      <div className="ml-11">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Email</span>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="font-medium text-gray-900 mb-2">
                            {(step.subject || "No subject")
                              .replace("{{firstName}}", selectedLead.firstName)
                              .replace("{{lastName}}", selectedLead.lastName)
                              .replace("{{schoolName}}", selectedLead.schoolName)}
                          </div>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap">
                            {(step.body || "No content")
                              .replace(/\{\{firstName\}\}/g, selectedLead.firstName)
                              .replace(/\{\{lastName\}\}/g, selectedLead.lastName)
                              .replace(/\{\{schoolName\}\}/g, selectedLead.schoolName)
                              .replace(/\{\{jobTitle\}\}/g, selectedLead.jobTitle)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select a lead to preview their sequence</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SETTINGS TAB (Lemlist-style)
// ============================================
function SettingsTab({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (updates: Partial<Campaign>) => void;
}) {
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnMeeting, setStopOnMeeting] = useState(true);
  const [sendingWindow, setSendingWindow] = useState({ start: "09:00", end: "18:00" });
  const [sendingDays, setSendingDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [dailyLimit, setDailyLimit] = useState(50);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate save - in production, this would call the API
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Tracking Settings */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-400" />
            Tracking
          </h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Track email opens</p>
                <p className="text-sm text-gray-500">Know when recipients open your emails</p>
              </div>
              <button
                onClick={() => setTrackOpens(!trackOpens)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  trackOpens ? "bg-blue-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    trackOpens ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Track link clicks</p>
                <p className="text-sm text-gray-500">See which links prospects click</p>
              </div>
              <button
                onClick={() => setTrackClicks(!trackClicks)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  trackClicks ? "bg-blue-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    trackClicks ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Stop Conditions */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-gray-400" />
            Stop Conditions
          </h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Stop sequence on reply</p>
                <p className="text-sm text-gray-500">Automatically stop when lead replies</p>
              </div>
              <button
                onClick={() => setStopOnReply(!stopOnReply)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  stopOnReply ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    stopOnReply ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Stop on meeting booked</p>
                <p className="text-sm text-gray-500">Stop when a meeting is scheduled</p>
              </div>
              <button
                onClick={() => setStopOnMeeting(!stopOnMeeting)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  stopOnMeeting ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    stopOnMeeting ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Sending Schedule */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            Sending Schedule
          </h3>

          <div className="space-y-6">
            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>

            {/* Sending Window */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sending window</label>
              <div className="flex items-center gap-3">
                <Input
                  type="time"
                  value={sendingWindow.start}
                  onChange={(e) => setSendingWindow({ ...sendingWindow, start: e.target.value })}
                  className="w-32"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="time"
                  value={sendingWindow.end}
                  onChange={(e) => setSendingWindow({ ...sendingWindow, end: e.target.value })}
                  className="w-32"
                />
              </div>
            </div>

            {/* Sending Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sending days</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(sendingDays).map(([day, enabled]) => (
                  <button
                    key={day}
                    onClick={() =>
                      setSendingDays({ ...sendingDays, [day]: !enabled })
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      enabled
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily sending limit
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
                  className="w-24"
                  min={1}
                  max={500}
                />
                <span className="text-sm text-gray-500">emails per day per sender</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Recommended: 50-100 for warmed-up domains, 10-25 for new domains
              </p>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-gray-400" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-blue-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTag();
              }}
            />
            <Button variant="outline" onClick={addTag}>
              Add
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CONDITION TYPES (for sequence branching)
// ============================================
const CONDITION_TYPES = [
  {
    id: "opened",
    label: "Email opened",
    description: "Lead opened the previous email",
    icon: Eye,
    color: "purple",
  },
  {
    id: "clicked",
    label: "Link clicked",
    description: "Lead clicked a link in the email",
    icon: MousePointer,
    color: "pink",
  },
  {
    id: "replied",
    label: "Replied",
    description: "Lead replied to the email",
    icon: MessageSquare,
    color: "green",
  },
  {
    id: "not_opened",
    label: "Email not opened",
    description: "Lead didn't open the previous email",
    icon: Eye,
    color: "gray",
  },
  {
    id: "custom",
    label: "Custom condition",
    description: "Based on lead data or custom fields",
    icon: Filter,
    color: "blue",
  },
];

// Note: Full condition branching would require:
// 1. Database schema updates for storing condition trees
// 2. Runtime engine to evaluate conditions when processing sequences
// 3. UI for building condition branches (if/then/else)
// The UI elements above are placeholders showing the pattern
