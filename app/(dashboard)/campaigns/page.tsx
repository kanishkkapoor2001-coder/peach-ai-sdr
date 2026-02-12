"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Star,
  BarChart3,
  MoreHorizontal,
  Trash2,
  Copy,
  Archive,
  Download,
  ChevronDown,
  Users,
  Loader2,
} from "lucide-react";

interface CampaignStats {
  totalLeads: number;
  emailsGenerated: number;
  emailsApproved: number;
  emailsSent: number;
  replies: number;
  meetings: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  source: string | null;
  status: string;
  createdAt: string;
  stats: CampaignStats;
}

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
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
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

// Campaign row skeleton
function CampaignRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
      <td className="px-4 py-3"><Skeleton className="h-6 w-11 rounded-full" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-48" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
      <td className="px-4 py-3"><Skeleton className="h-8 w-8 rounded-full" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-12" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
    </tr>
  );
}

// Format relative time
function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// Get emoji for campaign based on source
function getCampaignEmoji(source: string | null): string {
  switch (source) {
    case "csv": return "📁";
    case "ai_search": return "🔍";
    case "notion": return "📝";
    case "manual": return "✏️";
    default: return "📧";
  }
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    // Search filter
    if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Status filter
    if (statusFilter !== "all" && campaign.status !== statusFilter) {
      return false;
    }
    // Favorites filter
    if (favoritesOnly && !favorites.has(campaign.id)) {
      return false;
    }
    return true;
  });

  const toggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    setUpdatingStatus(campaign.id);

    try {
      await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaign.id,
          updates: { status: newStatus },
        }),
      });

      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaign.id ? { ...c, status: newStatus } : c
        )
      );
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign? Leads will be unassigned but not deleted.")) return;

    try {
      await fetch(`/api/campaigns?id=${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const duplicateCampaign = async (campaign: Campaign) => {
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${campaign.name} (Copy)`,
          description: campaign.description,
          source: campaign.source,
        }),
      });

      if (response.ok) {
        fetchCampaigns();
        setOpenMenuId(null);
      }
    } catch (error) {
      console.error("Failed to duplicate:", error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCampaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCampaigns.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <Button onClick={() => router.push("/campaigns/new")} className="bg-blue-500 hover:bg-blue-600">
          <Plus className="h-4 w-4 mr-2" />
          Create campaign
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border shadow-sm mb-6">
        <div className="p-4">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search a campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>

          {/* Filter Row - Lemlist style */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <span className="text-gray-500">Status:</span>
                <span className="font-medium">{statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[150px]">
                    {["all", "draft", "active", "paused", "completed"].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setShowFilters(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          statusFilter === status ? "bg-blue-50 text-blue-600" : ""
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          status === "active" ? "bg-green-500" :
                          status === "paused" ? "bg-amber-500" :
                          status === "draft" ? "bg-gray-400" :
                          status === "completed" ? "bg-blue-500" :
                          "bg-gray-300"
                        }`} />
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Source Filter (like Lemlist's Sender filter) */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <span className="text-gray-500">Source:</span>
                <span className="font-medium">All</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Tags Filter */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <span className="text-gray-500">Tags:</span>
                <span className="font-medium">All</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Favorites Toggle */}
            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                favoritesOnly ? "bg-amber-50 border-amber-200 text-amber-700" : "hover:bg-gray-50"
              }`}
            >
              <Star className={`h-4 w-4 ${favoritesOnly ? "fill-amber-400" : ""}`} />
              Favorites
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* View Toggle (could add list/grid view) */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button className="px-3 py-1 text-sm rounded bg-white shadow-sm font-medium">
                List
              </button>
              <button className="px-3 py-1 text-sm rounded text-gray-500 hover:text-gray-700">
                Grid
              </button>
            </div>

            {/* Campaign Count */}
            <span className="text-sm text-gray-500">
              {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-y text-left">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredCampaigns.length && filteredCampaigns.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign Name
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Leads
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Sender
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Replies
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Created at
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <CampaignRowSkeleton />
                  <CampaignRowSkeleton />
                  <CampaignRowSkeleton />
                  <CampaignRowSkeleton />
                </>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {searchQuery || statusFilter !== "all" ? "No campaigns found" : "Create your first campaign"}
                      </h3>
                      <p className="text-gray-500 mb-4 max-w-md">
                        {searchQuery || statusFilter !== "all"
                          ? "Try adjusting your filters or search query."
                          : "Start by creating a campaign to organize your outreach."}
                      </p>
                      {!searchQuery && statusFilter === "all" && (
                        <Button onClick={() => router.push("/campaigns/new")}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create campaign
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(campaign.id)}
                        onChange={(e) => toggleSelect(campaign.id, e as unknown as React.MouseEvent)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-3">
                      <StatusToggle
                        isActive={campaign.status === "active"}
                        onChange={() => toggleStatus(campaign)}
                        disabled={updatingStatus === campaign.id || campaign.status === "draft"}
                      />
                    </td>

                    {/* Campaign Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCampaignEmoji(campaign.source)}</span>
                        <span className="font-medium text-gray-900">{campaign.name}</span>
                        {campaign.status === "draft" && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            Draft
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Leads Progress */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{
                              width: `${
                                campaign.stats.totalLeads > 0
                                  ? Math.min(
                                      100,
                                      (campaign.stats.emailsSent / campaign.stats.totalLeads) * 100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {campaign.stats.emailsSent}/{campaign.stats.totalLeads}
                        </span>
                      </div>
                    </td>

                    {/* Sender */}
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        K
                      </div>
                    </td>

                    {/* Replies */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {campaign.stats.replies > 0 ? campaign.stats.replies : "-"}
                      </span>
                    </td>

                    {/* Created At */}
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatRelativeTime(campaign.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => toggleFavorite(campaign.id, e)}
                          className="p-1.5 rounded hover:bg-gray-100"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              favorites.has(campaign.id)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-400"
                            }`}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/campaigns/${campaign.id}?tab=overview`);
                          }}
                          className="p-1.5 rounded hover:bg-gray-100"
                        >
                          <BarChart3 className="h-4 w-4 text-gray-400" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === campaign.id ? null : campaign.id);
                            }}
                            className="p-1.5 rounded hover:bg-gray-100"
                          >
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </button>
                          {openMenuId === campaign.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                }}
                              />
                              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateCampaign(campaign);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Copy className="h-4 w-4" />
                                  Duplicate
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Archive functionality
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Export functionality
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  Export leads
                                </button>
                                <hr className="my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCampaign(campaign.id);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
