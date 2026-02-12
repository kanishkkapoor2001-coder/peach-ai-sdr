"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Upload,
  Filter,
  Check,
  X,
  Loader2,
  RefreshCw,
  Mail,
  AlertCircle,
  Sparkles,
  Database,
  UserPlus,
  ChevronDown,
  Trash2,
  Building2,
  Users,
  GraduationCap,
  Globe2,
  MapPin,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Table2,
  LayoutGrid,
  SlidersHorizontal,
  Download,
  FileSpreadsheet,
  ExternalLink,
  MoreVertical,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportModal } from "@/components/leads/import-modal";
import { SearchResults, type SearchResult } from "@/components/leads/search-results";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  jobTitle: string;
  schoolName: string;
  schoolCountry: string | null;
  curriculum: string[];
  leadScore: number | null;
  status: string;
  createdAt: string;
  campaignId?: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
}

// Search templates - EXA style examples
const searchTemplates = [
  {
    id: "decision-makers-sea",
    category: "Decision Makers",
    icon: Users,
    title: "IB School Leaders in SE Asia",
    description: "Principals and Heads of IB schools with $5k+ fees",
    query: "Decision makers at IB schools in South East Asia where fees are greater than $5000 USD per year",
    tags: ["IB", "Asia", "Premium"],
  },
  {
    id: "tech-directors",
    category: "Tech Leaders",
    icon: GraduationCap,
    title: "Tech Directors at 1:1 Schools",
    description: "IT leaders at schools with device programs",
    query: "Technology directors and IT heads at international schools with 1:1 device programs",
    tags: ["Tech", "1:1", "IT"],
  },
  {
    id: "curriculum-heads",
    category: "Academics",
    icon: BookOpen,
    title: "Curriculum Coordinators",
    description: "Academic heads at A-Level and Cambridge schools",
    query: "Curriculum coordinators and academic directors at Cambridge and A-Level schools in Middle East",
    tags: ["Cambridge", "A-Level", "Middle East"],
  },
  {
    id: "uk-boarding",
    category: "Boarding",
    icon: Building2,
    title: "UK Boarding School Heads",
    description: "Leadership at premium British boarding schools",
    query: "Headmasters and principals at UK boarding schools with fees over £30,000 per year",
    tags: ["UK", "Boarding", "Premium"],
  },
  {
    id: "emerging-markets",
    category: "Growth Markets",
    icon: Globe2,
    title: "India & Africa Expansion",
    description: "Decision makers at growing schools in emerging markets",
    query: "School principals and education directors at international schools in India and Africa with English curriculum",
    tags: ["India", "Africa", "Growth"],
  },
  {
    id: "stem-focus",
    category: "STEM",
    icon: Lightbulb,
    title: "STEM Program Leaders",
    description: "Heads of STEM and innovation at progressive schools",
    query: "STEM directors and innovation leads at schools with robotics or coding programs in Asia Pacific",
    tags: ["STEM", "Innovation", "APAC"],
  },
];

// Category filters for the templates
const categories = [
  { id: "all", label: "All Examples", icon: Sparkles },
  { id: "Decision Makers", label: "Decision Makers", icon: Users },
  { id: "Tech Leaders", label: "Tech Leaders", icon: GraduationCap },
  { id: "Academics", label: "Academics", icon: BookOpen },
  { id: "Boarding", label: "Boarding", icon: Building2 },
  { id: "Growth Markets", label: "Growth", icon: Globe2 },
  { id: "STEM", label: "STEM", icon: Lightbulb },
];

export default function LeadsPage() {
  // Data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campaign selection - REQUIRED for adding leads
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCampaignSelector, setShowCampaignSelector] = useState(false);

  // View state
  const [activeView, setActiveView] = useState<"search" | "leads">("search");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchDuration, setSearchDuration] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [leadLimit, setLeadLimit] = useState<number>(10);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState<number>(0);
  const [searchElapsed, setSearchElapsed] = useState<number>(0);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Manual add state
  const [manualLead, setManualLead] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    schoolName: "",
    schoolCountry: "",
    schoolWebsite: "",
  });
  const [isAddingLead, setIsAddingLead] = useState(false);

  // CRM Import state
  const [isImportingCRM, setIsImportingCRM] = useState(false);
  const [crmImportStatus, setCrmImportStatus] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState("");

  // Fetch campaigns on mount
  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
        // Auto-select first active campaign if none selected
        if (!selectedCampaignId && data.campaigns?.length > 0) {
          const activeCampaign = data.campaigns.find((c: Campaign) => c.status === "active");
          if (activeCampaign) {
            setSelectedCampaignId(activeCampaign.id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    }
  }, [selectedCampaignId]);

  // Fetch leads on mount
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/leads";
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (selectedCampaignId) params.append("campaignId", selectedCampaignId);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch leads");
      const data = await response.json();
      setLeads(data.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedCampaignId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // AI Search with progress timer
  const handleSearch = async () => {
    if (!selectedCampaignId) {
      setSearchError("Please select a campaign first");
      setShowCampaignSelector(true);
      return;
    }

    if (!searchQuery.trim() || searchQuery.length < 10) {
      setSearchError("Please enter a more detailed search query (at least 10 characters)");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchElapsed(0);
    setDuplicatesRemoved(0);

    // Start elapsed time counter
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      setSearchElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const response = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: leadLimit, campaignId: selectedCampaignId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setSearchResults(data.leads || []);
      setSearchDuration(data.duration || "");
      setDuplicatesRemoved(data.duplicatesRemoved || 0);
      setShowSearchResults(true);

    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      clearInterval(intervalId);
      setIsSearching(false);
    }
  };

  // Use template
  const useTemplate = (template: typeof searchTemplates[0]) => {
    setSearchQuery(template.query);
    setActiveView("search");
  };

  // Import from search results
  const handleImportFromSearch = async (selectedLeads: SearchResult[]) => {
    if (!selectedCampaignId) {
      throw new Error("Please select a campaign first");
    }

    const response = await fetch("/api/leads/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: selectedLeads.map((lead) => ({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          jobTitle: lead.jobTitle,
          schoolName: lead.schoolName,
          schoolWebsite: lead.schoolWebsite,
          schoolCountry: lead.schoolCountry,
          schoolRegion: lead.schoolRegion,
          researchSummary: lead.researchSummary,
          leadScore: lead.leadScore,
        })),
        source: "search",
        campaignId: selectedCampaignId,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Import failed");
    }

    // Refresh leads list and campaigns
    await fetchLeads();
    await fetchCampaigns();
  };

  // Import from CRM (Notion)
  const handleImportFromCRM = async () => {
    setIsImportingCRM(true);
    setCrmImportStatus("Connecting to Notion CRM...");

    try {
      const response = await fetch("/api/notion/import-leads", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "CRM import failed");
      }

      setCrmImportStatus(`Successfully imported ${data.imported} leads from Notion CRM`);
      await fetchLeads();

      setTimeout(() => setCrmImportStatus(null), 5000);
    } catch (err) {
      setCrmImportStatus(`Error: ${err instanceof Error ? err.message : "CRM import failed"}`);
      setTimeout(() => setCrmImportStatus(null), 5000);
    } finally {
      setIsImportingCRM(false);
    }
  };

  // Manually add lead
  const handleAddLead = async () => {
    if (!manualLead.firstName || !manualLead.email) {
      return;
    }

    if (!selectedCampaignId) {
      setShowCampaignSelector(true);
      return;
    }

    setIsAddingLead(true);
    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [manualLead],
          source: "manual",
          campaignId: selectedCampaignId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add lead");
      }

      setManualLead({
        firstName: "",
        lastName: "",
        email: "",
        jobTitle: "",
        schoolName: "",
        schoolCountry: "",
        schoolWebsite: "",
      });
      setShowAddLeadModal(false);
      await fetchLeads();
      await fetchCampaigns();
    } catch (err) {
      console.error("Failed to add lead:", err);
    } finally {
      setIsAddingLead(false);
    }
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Bulk actions
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          updates: { status: "approved" },
        }),
      });

      if (!response.ok) throw new Error("Failed to approve leads");

      await fetchLeads();
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Approve failed:", err);
    }
  };

  // Generate emails for selected leads
  const handleGenerateEmails = async () => {
    if (selectedIds.size === 0) return;

    setIsGenerating(true);
    setGenerationProgress(`Generating emails for ${selectedIds.size} leads...`);

    try {
      const response = await fetch("/api/sequences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate emails");
      }

      setGenerationProgress(data.message);
      await fetchLeads();
      setSelectedIds(new Set());

      setTimeout(() => setGenerationProgress(null), 5000);
    } catch (err) {
      console.error("Generation failed:", err);
      setGenerationProgress(
        `Error: ${err instanceof Error ? err.message : "Failed to generate emails"}`
      );
      setTimeout(() => setGenerationProgress(null), 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete single lead
  const handleDeleteLead = async (id: string) => {
    try {
      const response = await fetch(`/api/leads?ids=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete lead");
      }

      setDeleteConfirmId(null);
      await fetchLeads();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Delete selected leads (bulk delete)
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/leads?ids=${Array.from(selectedIds).join(",")}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete leads");
      }

      setSelectedIds(new Set());
      await fetchLeads();
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter leads by table search
  const filteredLeads = leads.filter((lead) => {
    if (!tableSearchQuery) return true;
    const search = tableSearchQuery.toLowerCase();
    return (
      lead.firstName.toLowerCase().includes(search) ||
      lead.lastName.toLowerCase().includes(search) ||
      lead.email.toLowerCase().includes(search) ||
      lead.schoolName.toLowerCase().includes(search) ||
      lead.jobTitle.toLowerCase().includes(search)
    );
  });

  // Filter templates by category
  const filteredTemplates = selectedCategory === "all"
    ? searchTemplates
    : searchTemplates.filter(t => t.category === selectedCategory);

  // Status colors
  const statusColors: Record<string, string> = {
    new: "bg-gray-100 text-gray-700",
    approved: "bg-blue-50 text-blue-700",
    researching: "bg-purple-50 text-purple-700",
    emails_generated: "bg-indigo-50 text-indigo-700",
    emailing: "bg-green-50 text-green-700",
    replied: "bg-peach-50 text-peach-700",
    meeting_booked: "bg-amber-50 text-amber-700",
    won: "bg-emerald-50 text-emerald-700",
    lost: "bg-red-50 text-red-700",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation Bar - Modern Style */}
      <div className="bg-white border-b px-6 py-5">
        <div className="flex items-center justify-between gap-8">
          {/* Left: Title + Icon */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Lead Sourcing</h1>
              <p className="text-sm text-gray-500">Find and manage your prospects</p>
            </div>
          </div>

          {/* Center: View Toggle - Properly spaced */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveView("search")}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeView === "search"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              AI Search
            </button>
            <button
              onClick={() => setActiveView("leads")}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeView === "leads"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users className="h-4 w-4" />
              My Leads
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                activeView === "leads" ? "bg-violet-100 text-violet-700" : "bg-gray-200 text-gray-600"
              }`}>
                {leads.length}
              </span>
            </button>
          </div>

          {/* Right: Campaign Selector + Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Campaign Selector - Required */}
            <div className="relative">
              <select
                value={selectedCampaignId || ""}
                onChange={(e) => setSelectedCampaignId(e.target.value || null)}
                className={`pl-3 pr-8 py-2.5 text-sm border rounded-xl bg-white font-medium appearance-none cursor-pointer min-w-[180px] ${
                  !selectedCampaignId ? "border-amber-300 bg-amber-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <option value="">Select Campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.totalLeads})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {!selectedCampaignId && (
              <a
                href="/campaigns"
                className="text-sm text-violet-600 hover:text-violet-700 font-medium whitespace-nowrap"
              >
                + New
              </a>
            )}

            <div className="w-px h-8 bg-gray-200" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!selectedCampaignId) {
                  setShowCampaignSelector(true);
                  return;
                }
                setShowImportModal(true);
              }}
              className="gap-2 h-10 px-4"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden xl:inline">Import</span> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportFromCRM}
              disabled={isImportingCRM}
              className="gap-2 h-10 px-4"
            >
              <Database className="h-4 w-4" />
              {isImportingCRM ? "..." : <span className="hidden xl:inline">Sync</span>} CRM
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!selectedCampaignId) {
                  setShowCampaignSelector(true);
                  return;
                }
                setShowAddLeadModal(true);
              }}
              className="gap-2 h-10 px-4 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>
      </div>

      {/* CRM Import Status */}
      {crmImportStatus && (
        <div className={`mx-6 mt-4 border rounded-lg p-4 flex items-center gap-3 ${
          crmImportStatus.startsWith("Error")
            ? "bg-red-50 border-red-200"
            : crmImportStatus.startsWith("Successfully")
            ? "bg-green-50 border-green-200"
            : "bg-blue-50 border-blue-200"
        }`}>
          {isImportingCRM ? (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          ) : crmImportStatus.startsWith("Error") ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Check className="h-5 w-5 text-green-500" />
          )}
          <span className={
            crmImportStatus.startsWith("Error")
              ? "text-red-700"
              : crmImportStatus.startsWith("Successfully")
              ? "text-green-700"
              : "text-blue-700"
          }>
            {crmImportStatus}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeView === "search" ? (
          /* AI Search View - EXA Style */
          <div className="max-w-5xl mx-auto py-8 px-6">
            {/* Hero Search Bar */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-peach-50 to-orange-50 rounded-full text-peach-600 text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                AI-Powered Lead Discovery
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Find your ideal prospects
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Describe who you&apos;re looking for in plain English. Our AI will search across schools and find decision makers that match your criteria.
              </p>
            </div>

            {/* Main Search Input */}
            <div className="relative mb-8">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Describe what you're looking for... e.g., 'Decision makers at IB schools in SE Asia with fees > $5000'"
                    className="pl-12 pr-4 py-6 text-base border-2 focus:border-peach-500 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isSearching) {
                        handleSearch();
                      }
                    }}
                  />
                </div>
                <select
                  value={leadLimit}
                  onChange={(e) => setLeadLimit(Number(e.target.value))}
                  className="px-4 py-3 border-2 rounded-xl text-sm bg-white font-medium"
                  disabled={isSearching}
                >
                  <option value={5}>5 leads</option>
                  <option value={10}>10 leads</option>
                  <option value={20}>20 leads</option>
                  <option value={50}>50 leads</option>
                  <option value={100}>100 leads</option>
                </select>
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching}
                  size="lg"
                  className="px-8 rounded-xl h-auto"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {searchElapsed}s
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {/* Search Status */}
              {isSearching && (
                <div className="absolute -bottom-8 left-0 flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-peach-500 rounded-full animate-pulse" />
                  Searching across schools... This can take 1-3 minutes.
                </div>
              )}
              {searchError && (
                <div className="absolute -bottom-8 left-0 flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {searchError}
                </div>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Examples Library - EXA Style Cards */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-gray-400" />
                Search Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => useTemplate(template)}
                    className="group text-left p-5 bg-white border-2 rounded-xl hover:border-peach-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2.5 rounded-lg bg-gradient-to-br from-peach-50 to-orange-50`}>
                        <template.icon className="h-5 w-5 text-peach-600" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-peach-500 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{template.title}</h4>
                    <p className="text-sm text-gray-500 mb-3">{template.description}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Other Import Options */}
            <div className="border-t pt-8 mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Other ways to add leads</h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-4 p-4 bg-white border-2 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-all group"
                >
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Upload className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">Upload CSV</h4>
                    <p className="text-sm text-gray-500">Import from EXA, BETT, or your own list</p>
                  </div>
                </button>
                <button
                  onClick={handleImportFromCRM}
                  disabled={isImportingCRM}
                  className="flex items-center gap-4 p-4 bg-white border-2 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">Import from CRM</h4>
                    <p className="text-sm text-gray-500">Sync contacts from Notion</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="flex items-center gap-4 p-4 bg-white border-2 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
                >
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <UserPlus className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">Add Manually</h4>
                    <p className="text-sm text-gray-500">Enter lead details yourself</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Leads Table View */
          <div className="p-6">
            {/* Table Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Table Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search leads..."
                    className="pl-9 w-64"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                  />
                </div>

                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>

                <span className="text-sm text-gray-500">
                  {filteredLeads.length} leads
                  {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-1.5 rounded ${viewMode === "table" ? "bg-white shadow-sm" : ""}`}
                  >
                    <Table2 className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`p-1.5 rounded ${viewMode === "cards" ? "bg-white shadow-sm" : ""}`}
                  >
                    <LayoutGrid className="h-4 w-4 text-gray-600" />
                  </button>
                </div>

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                  <>
                    <div className="w-px h-6 bg-gray-200" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApproveSelected}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isGenerating}
                      onClick={handleGenerateEmails}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      Generate Emails
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDeleting}
                      onClick={handleDeleteSelected}
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </>
                )}

                {/* Export Button */}
                {selectedCampaignId && filteredLeads.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/campaigns/${selectedCampaignId}/export?type=leads&format=csv`, "_blank");
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}

                <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Generation Progress */}
            {generationProgress && (
              <div className={`border rounded-lg p-4 mb-4 flex items-center gap-3 ${
                generationProgress.startsWith("Error")
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}>
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : generationProgress.startsWith("Error") ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Check className="h-5 w-5 text-green-500" />
                )}
                <span className={generationProgress.startsWith("Error") ? "text-red-700" : "text-blue-700"}>
                  {generationProgress}
                </span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-700">{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={fetchLeads}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Leads Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {loading ? (
                <div className="divide-y">
                  <div className="bg-gray-50 border-b px-4 py-3 flex items-center gap-4">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32 ml-20" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-4 py-4 flex items-center gap-4">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-40 ml-10" />
                      <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                    </div>
                  ))}
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-peach-100 to-orange-100 rounded-2xl flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-peach-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {tableSearchQuery ? "No matching leads" : "No leads yet"}
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                    {tableSearchQuery
                      ? "Try adjusting your search terms"
                      : "Use AI search to find prospects, import from your CRM, or add leads manually."}
                  </p>
                  {!tableSearchQuery && (
                    <Button onClick={() => setActiveView("search")}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start AI Search
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        School
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className={`hover:bg-gray-50 ${selectedIds.has(lead.id) ? "bg-peach-50/50" : ""}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleSelection(lead.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              {lead.email.includes("@placeholder") ? (
                                <span className="text-yellow-600 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  No email
                                </span>
                              ) : (
                                <>
                                  {lead.email}
                                  {lead.emailVerified && (
                                    <Check className="h-3 w-3 text-green-500" />
                                  )}
                                </>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-gray-900">{lead.schoolName}</p>
                            {lead.schoolCountry && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {lead.schoolCountry}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {lead.jobTitle}
                        </td>
                        <td className="px-4 py-3">
                          {lead.leadScore ? (
                            <div className="flex items-center gap-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-peach-100 to-orange-100 flex items-center justify-center">
                                <span className="text-sm font-bold text-peach-700">{lead.leadScore}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              statusColors[lead.status] || statusColors.new
                            }`}
                          >
                            {lead.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Approve lead"
                              onClick={() => {
                                fetch("/api/leads", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    ids: [lead.id],
                                    updates: { status: "approved" },
                                  }),
                                }).then(() => fetchLeads());
                              }}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            {deleteConfirmId === lead.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 bg-red-100"
                                  title="Confirm delete"
                                  onClick={() => handleDeleteLead(lead.id)}
                                >
                                  <Check className="h-4 w-4 text-red-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Cancel"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  <X className="h-4 w-4 text-gray-600" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Delete lead"
                                onClick={() => setDeleteConfirmId(lead.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Import Modal (CSV) */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          fetchLeads();
          fetchCampaigns();
        }}
        campaignId={selectedCampaignId || undefined}
      />

      {/* Search Results Modal */}
      <SearchResults
        results={searchResults}
        query={searchQuery}
        duration={searchDuration}
        open={showSearchResults}
        onClose={() => setShowSearchResults(false)}
        onImport={handleImportFromSearch}
      />

      {/* Campaign Required Modal */}
      {showCampaignSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Campaign Required</h2>
                <p className="text-sm text-gray-500">All leads must be part of a campaign</p>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Select an existing campaign or create a new one to add leads.
            </p>

            {campaigns.length > 0 ? (
              <div className="space-y-2 mb-4">
                {campaigns.slice(0, 5).map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => {
                      setSelectedCampaignId(campaign.id);
                      setShowCampaignSelector(false);
                    }}
                    className="w-full p-3 text-left border rounded-lg hover:border-peach-300 hover:bg-peach-50/50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    <div className="text-sm text-gray-500">{campaign.totalLeads} leads • {campaign.status}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
                <p className="text-gray-500 mb-2">No campaigns yet</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCampaignSelector(false)}
              >
                Cancel
              </Button>
              <a href="/campaigns" className="flex-1">
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Create Campaign
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Manually Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Add Lead Manually</h2>
                  <p className="text-sm text-gray-500">Enter the lead&apos;s details</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAddLeadModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <Input
                    value={manualLead.firstName}
                    onChange={(e) => setManualLead({ ...manualLead, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <Input
                    value={manualLead.lastName}
                    onChange={(e) => setManualLead({ ...manualLead, lastName: e.target.value })}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  value={manualLead.email}
                  onChange={(e) => setManualLead({ ...manualLead, email: e.target.value })}
                  placeholder="john@school.edu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <Input
                  value={manualLead.jobTitle}
                  onChange={(e) => setManualLead({ ...manualLead, jobTitle: e.target.value })}
                  placeholder="Head of School"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School Name
                </label>
                <Input
                  value={manualLead.schoolName}
                  onChange={(e) => setManualLead({ ...manualLead, schoolName: e.target.value })}
                  placeholder="International Academy"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <Input
                    value={manualLead.schoolCountry}
                    onChange={(e) => setManualLead({ ...manualLead, schoolCountry: e.target.value })}
                    placeholder="Singapore"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School Website
                  </label>
                  <Input
                    value={manualLead.schoolWebsite}
                    onChange={(e) => setManualLead({ ...manualLead, schoolWebsite: e.target.value })}
                    placeholder="https://school.edu"
                  />
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddLeadModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddLead}
                disabled={!manualLead.firstName || !manualLead.email || isAddingLead}
              >
                {isAddingLead ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Lead
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
