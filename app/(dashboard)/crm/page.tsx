"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  RefreshCw,
  Sparkles,
  Mail,
  Phone,
  ExternalLink,
  MoreHorizontal,
  ChevronDown,
  ArrowUpDown,
  Eye,
  Trash2,
  Settings,
  Link2,
  CheckCircle,
  Clock,
  X,
  Loader2,
  Zap,
  Globe,
  Linkedin,
  Target,
  TrendingUp,
  MessageSquare,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react";

// Types
interface CrmContact {
  id: string;
  leadId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  companyName?: string;
  companyWebsite?: string;
  companyCountry?: string;
  companyRegion?: string;
  industry?: string;
  stage: string;
  stageChangedAt?: string;
  totalEmailsSent: number;
  totalEmailsOpened: number;
  totalEmailsClicked: number;
  totalReplies: number;
  lastContactedAt?: string;
  lastRepliedAt?: string;
  linkedinUrl?: string;
  linkedinHeadline?: string;
  companySize?: string;
  companyDescription?: string;
  techStack?: string[];
  buyingSignals?: string[];
  leadScore?: number;
  scoreReasons?: string[];
  notes?: string;
  tags?: string[];
  dealValue?: number;
  enrichmentStatus?: string;
  enrichedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CrmSettings {
  crmMode: string;
  visibleColumns: string[];
  autoAddOnReply: boolean;
  autoAddOnMeeting: boolean;
}

const STAGES = [
  { id: "lead", name: "Lead", color: "#8b5cf6", bgColor: "bg-violet-50", textColor: "text-violet-700", borderColor: "border-violet-200" },
  { id: "contacted", name: "Contacted", color: "#3b82f6", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-200" },
  { id: "qualified", name: "Qualified", color: "#06b6d4", bgColor: "bg-cyan-50", textColor: "text-cyan-700", borderColor: "border-cyan-200" },
  { id: "meeting_scheduled", name: "Meeting", color: "#f59e0b", bgColor: "bg-amber-50", textColor: "text-amber-700", borderColor: "border-amber-200" },
  { id: "proposal_sent", name: "Proposal", color: "#ec4899", bgColor: "bg-pink-50", textColor: "text-pink-700", borderColor: "border-pink-200" },
  { id: "negotiation", name: "Negotiation", color: "#8b5cf6", bgColor: "bg-purple-50", textColor: "text-purple-700", borderColor: "border-purple-200" },
  { id: "won", name: "Won", color: "#10b981", bgColor: "bg-emerald-50", textColor: "text-emerald-700", borderColor: "border-emerald-200" },
  { id: "lost", name: "Lost", color: "#ef4444", bgColor: "bg-red-50", textColor: "text-red-700", borderColor: "border-red-200" },
];

const COLUMN_OPTIONS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "jobTitle", label: "Job Title" },
  { key: "companyName", label: "Company" },
  { key: "companyCountry", label: "Country" },
  { key: "industry", label: "Industry" },
  { key: "stage", label: "Stage" },
  { key: "leadScore", label: "Lead Score" },
  { key: "totalEmailsSent", label: "Emails Sent" },
  { key: "totalReplies", label: "Replies" },
  { key: "lastContactedAt", label: "Last Contacted" },
  { key: "lastRepliedAt", label: "Last Replied" },
  { key: "companySize", label: "Company Size" },
  { key: "dealValue", label: "Deal Value" },
  { key: "enrichmentStatus", label: "Enriched" },
  { key: "createdAt", label: "Created" },
];

export default function CRMPage() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [crmMode, setCrmMode] = useState<"builtin" | "notion" | "both">("builtin");
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "firstName", "lastName", "email", "companyName", "jobTitle",
    "stage", "leadScore", "lastContactedAt", "totalReplies"
  ]);

  useEffect(() => {
    fetchContacts();
    fetchSettings();
  }, [selectedStage, sortBy, sortOrder]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStage !== "all") params.append("stage", selectedStage);
      if (searchQuery) params.append("search", searchQuery);
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);

      const res = await fetch(`/api/crm/contacts?${params}`);
      const data = await res.json();

      if (data.contacts) {
        setContacts(data.contacts);
        setStageCounts(data.stageCounts || {});
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/crm/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setCrmMode(data.settings.crmMode || "builtin");
        if (data.settings.visibleColumns) {
          setVisibleColumns(data.settings.visibleColumns);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const handleEnrichContact = async (contactId: string) => {
    setEnrichingIds(prev => new Set(prev).add(contactId));
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/enrich`, { method: "POST" });
      const data = await res.json();
      if (data.contact) {
        setContacts(prev => prev.map(c => c.id === contactId ? data.contact : c));
      }
    } catch (error) {
      console.error("Enrichment failed:", error);
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  const handleStageChange = async (contactId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (data.contact) {
        setContacts(prev => prev.map(c => c.id === contactId ? data.contact : c));
        // Update stage counts
        setStageCounts(prev => {
          const oldStage = contacts.find(c => c.id === contactId)?.stage;
          const newCounts = { ...prev };
          if (oldStage) newCounts[oldStage] = (newCounts[oldStage] || 1) - 1;
          newCounts[newStage] = (newCounts[newStage] || 0) + 1;
          return newCounts;
        });
      }
    } catch (error) {
      console.error("Failed to update stage:", error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      await fetch(`/api/crm/contacts/${contactId}`, { method: "DELETE" });
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (error) {
      console.error("Failed to delete contact:", error);
    }
  };

  const handleSaveColumns = async () => {
    try {
      await fetch("/api/crm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleColumns }),
      });
      setShowColumnSelector(false);
    } catch (error) {
      console.error("Failed to save columns:", error);
    }
  };

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.firstName?.toLowerCase().includes(query) ||
      c.lastName?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.companyName?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Group contacts by stage for Kanban
  const contactsByStage = useMemo(() => {
    const grouped: Record<string, CrmContact[]> = {};
    STAGES.forEach(s => { grouped[s.id] = []; });
    filteredContacts.forEach(c => {
      if (grouped[c.stage]) {
        grouped[c.stage].push(c);
      } else {
        grouped["lead"].push(c);
      }
    });
    return grouped;
  }, [filteredContacts]);

  const totalContacts = contacts.length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStageInfo = (stageId: string) => {
    return STAGES.find(s => s.id === stageId) || STAGES[0];
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Title + Stats */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">CRM</h1>
              <p className="text-sm text-gray-500">
                {totalContacts} contact{totalContacts !== 1 ? "s" : ""} in pipeline
              </p>
            </div>
          </div>

          {/* Center: View Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                view === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="h-4 w-4" />
              Table
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                view === "kanban"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Pipeline
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* CRM Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
              <span className="text-gray-500">Mode:</span>
              <select
                value={crmMode}
                onChange={(e) => setCrmMode(e.target.value as any)}
                className="bg-transparent font-medium text-gray-700 border-none focus:ring-0 cursor-pointer"
              >
                <option value="builtin">Built-in</option>
                <option value="notion">Notion</option>
                <option value="both">Both</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsPanel(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>

            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-4 mt-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Stages ({totalContacts})</option>
            {STAGES.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name} ({stageCounts[stage.id] || 0})
              </option>
            ))}
          </select>

          {/* Column Selector (Table View) */}
          {view === "table" && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Columns
                <ChevronDown className="h-3 w-3" />
              </Button>

              {showColumnSelector && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border shadow-lg z-50 p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Visible Columns</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {COLUMN_OPTIONS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(col.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleColumns([...visibleColumns, col.key]);
                            } else {
                              setVisibleColumns(visibleColumns.filter(c => c !== col.key));
                            }
                          }}
                          className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => setShowColumnSelector(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveColumns}>
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={fetchContacts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" />
              <p className="text-gray-500 mt-2">Loading contacts...</p>
            </div>
          </div>
        ) : view === "table" ? (
          <TableView
            contacts={filteredContacts}
            visibleColumns={visibleColumns}
            selectedContacts={selectedContacts}
            setSelectedContacts={setSelectedContacts}
            onStageChange={handleStageChange}
            onEnrich={handleEnrichContact}
            onDelete={handleDeleteContact}
            enrichingIds={enrichingIds}
            sortBy={sortBy}
            sortOrder={sortOrder}
            setSortBy={setSortBy}
            setSortOrder={setSortOrder}
            formatDate={formatDate}
            getStageInfo={getStageInfo}
            onSelectContact={setSelectedContact}
          />
        ) : (
          <KanbanView
            contactsByStage={contactsByStage}
            stages={STAGES}
            stageCounts={stageCounts}
            onStageChange={handleStageChange}
            onEnrich={handleEnrichContact}
            enrichingIds={enrichingIds}
            formatDate={formatDate}
            onSelectContact={setSelectedContact}
          />
        )}
      </div>

      {/* Contact Detail Slideout */}
      {selectedContact && (
        <ContactDetailPanel
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onStageChange={handleStageChange}
          onEnrich={handleEnrichContact}
          enriching={enrichingIds.has(selectedContact.id)}
          formatDate={formatDate}
          getStageInfo={getStageInfo}
        />
      )}
    </div>
  );
}

// Table View Component
function TableView({
  contacts,
  visibleColumns,
  selectedContacts,
  setSelectedContacts,
  onStageChange,
  onEnrich,
  onDelete,
  enrichingIds,
  sortBy,
  sortOrder,
  setSortBy,
  setSortOrder,
  formatDate,
  getStageInfo,
  onSelectContact,
}: {
  contacts: CrmContact[];
  visibleColumns: string[];
  selectedContacts: Set<string>;
  setSelectedContacts: (s: Set<string>) => void;
  onStageChange: (id: string, stage: string) => void;
  onEnrich: (id: string) => void;
  onDelete: (id: string) => void;
  enrichingIds: Set<string>;
  sortBy: string;
  sortOrder: "asc" | "desc";
  setSortBy: (s: string) => void;
  setSortOrder: (s: "asc" | "desc") => void;
  formatDate: (s?: string) => string;
  getStageInfo: (s: string) => typeof STAGES[0];
  onSelectContact: (c: CrmContact) => void;
}) {
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const renderCell = (contact: CrmContact, column: string) => {
    switch (column) {
      case "firstName":
        return contact.firstName;
      case "lastName":
        return contact.lastName;
      case "email":
        return (
          <a href={`mailto:${contact.email}`} className="text-violet-600 hover:underline">
            {contact.email}
          </a>
        );
      case "phone":
        return contact.phone || "-";
      case "jobTitle":
        return contact.jobTitle || "-";
      case "companyName":
        return (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span>{contact.companyName || "-"}</span>
          </div>
        );
      case "companyCountry":
        return contact.companyCountry || "-";
      case "industry":
        return contact.industry || "-";
      case "stage":
        const stageInfo = getStageInfo(contact.stage);
        return (
          <select
            value={contact.stage}
            onChange={(e) => onStageChange(contact.id, e.target.value)}
            className={`px-2 py-1 rounded-lg text-xs font-medium border-0 cursor-pointer ${stageInfo.bgColor} ${stageInfo.textColor}`}
          >
            {STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        );
      case "leadScore":
        if (!contact.leadScore) return "-";
        const scoreColor = contact.leadScore >= 7 ? "text-emerald-600" : contact.leadScore >= 4 ? "text-amber-600" : "text-red-600";
        return (
          <div className="flex items-center gap-1">
            <Target className={`h-4 w-4 ${scoreColor}`} />
            <span className={`font-semibold ${scoreColor}`}>{contact.leadScore}/10</span>
          </div>
        );
      case "totalEmailsSent":
        return contact.totalEmailsSent || 0;
      case "totalReplies":
        return (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <span>{contact.totalReplies || 0}</span>
          </div>
        );
      case "lastContactedAt":
        return formatDate(contact.lastContactedAt);
      case "lastRepliedAt":
        return formatDate(contact.lastRepliedAt);
      case "companySize":
        return contact.companySize || "-";
      case "dealValue":
        return contact.dealValue ? `$${contact.dealValue.toLocaleString()}` : "-";
      case "enrichmentStatus":
        if (contact.enrichmentStatus === "completed") {
          return <CheckCircle className="h-4 w-4 text-emerald-500" />;
        } else if (contact.enrichmentStatus === "in_progress" || enrichingIds.has(contact.id)) {
          return <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />;
        } else {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); onEnrich(contact.id); }}
              className="text-violet-600 hover:text-violet-700"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          );
        }
      case "createdAt":
        return formatDate(contact.createdAt);
      default:
        return "-";
    }
  };

  if (contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No contacts yet</h3>
          <p className="text-gray-500 mt-1">Contacts will appear here when leads reply or book meetings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedContacts.size === contacts.length && contacts.length > 0}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
            </th>
            {visibleColumns.map(col => {
              const colInfo = COLUMN_OPTIONS.find(c => c.key === col);
              return (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    {colInfo?.label || col}
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  </div>
                </th>
              );
            })}
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {contacts.map(contact => (
            <tr
              key={contact.id}
              onClick={() => onSelectContact(contact)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedContacts.has(contact.id)}
                  onChange={(e) => {
                    const next = new Set(selectedContacts);
                    if (e.target.checked) next.add(contact.id);
                    else next.delete(contact.id);
                    setSelectedContacts(next);
                  }}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
              </td>
              {visibleColumns.map(col => (
                <td key={col} className="px-4 py-3 text-sm text-gray-700">
                  {renderCell(contact, col)}
                </td>
              ))}
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  {contact.linkedinUrl && (
                    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {contact.companyWebsite && (
                    <a href={contact.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={() => onDelete(contact.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
        {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// Kanban View Component
function KanbanView({
  contactsByStage,
  stages,
  stageCounts,
  onStageChange,
  onEnrich,
  enrichingIds,
  formatDate,
  onSelectContact,
}: {
  contactsByStage: Record<string, CrmContact[]>;
  stages: typeof STAGES;
  stageCounts: Record<string, number>;
  onStageChange: (id: string, stage: string) => void;
  onEnrich: (id: string) => void;
  enrichingIds: Set<string>;
  formatDate: (s?: string) => string;
  onSelectContact: (c: CrmContact) => void;
}) {
  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    e.dataTransfer.setData("contactId", contactId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData("contactId");
    if (contactId) {
      onStageChange(contactId, stageId);
    }
  };

  return (
    <div className="flex gap-4 p-6 overflow-x-auto h-full">
      {stages.map(stage => (
        <div
          key={stage.id}
          className="flex-shrink-0 w-72 flex flex-col bg-gray-100/50 rounded-xl"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          {/* Column Header */}
          <div className="px-4 py-3 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-semibold text-gray-900">{stage.name}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${stage.bgColor} ${stage.textColor}`}>
                  {contactsByStage[stage.id]?.length || 0}
                </span>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {contactsByStage[stage.id]?.map(contact => (
              <div
                key={contact.id}
                draggable
                onDragStart={(e) => handleDragStart(e, contact.id)}
                onClick={() => onSelectContact(contact)}
                className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {contact.firstName} {contact.lastName}
                    </h4>
                    <p className="text-sm text-gray-500 truncate">{contact.jobTitle || contact.email}</p>
                  </div>
                  {contact.leadScore && (
                    <div className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      contact.leadScore >= 7 ? "bg-emerald-100 text-emerald-700" :
                      contact.leadScore >= 4 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {contact.leadScore}
                    </div>
                  )}
                </div>

                {contact.companyName && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{contact.companyName}</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {contact.totalReplies > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {contact.totalReplies}
                      </div>
                    )}
                    {contact.lastContactedAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(contact.lastContactedAt)}
                      </div>
                    )}
                  </div>
                  {contact.enrichmentStatus !== "completed" && !enrichingIds.has(contact.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEnrich(contact.id); }}
                      className="text-violet-500 hover:text-violet-700"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {enrichingIds.has(contact.id) && (
                    <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin" />
                  )}
                </div>
              </div>
            ))}

            {(!contactsByStage[stage.id] || contactsByStage[stage.id].length === 0) && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No contacts
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Contact Detail Panel Component
function ContactDetailPanel({
  contact,
  onClose,
  onStageChange,
  onEnrich,
  enriching,
  formatDate,
  getStageInfo,
}: {
  contact: CrmContact;
  onClose: () => void;
  onStageChange: (id: string, stage: string) => void;
  onEnrich: (id: string) => void;
  enriching: boolean;
  formatDate: (s?: string) => string;
  getStageInfo: (s: string) => typeof STAGES[0];
}) {
  const stageInfo = getStageInfo(contact.stage);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {contact.firstName} {contact.lastName}
            </h2>
            <p className="text-sm text-gray-500">{contact.jobTitle || contact.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stage & Score */}
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Stage</label>
              <select
                value={contact.stage}
                onChange={(e) => onStageChange(contact.id, e.target.value)}
                className={`mt-1 px-3 py-2 rounded-lg text-sm font-medium border-0 cursor-pointer ${stageInfo.bgColor} ${stageInfo.textColor}`}
              >
                {STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {contact.leadScore && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Lead Score</label>
                <div className={`mt-1 text-2xl font-bold ${
                  contact.leadScore >= 7 ? "text-emerald-600" :
                  contact.leadScore >= 4 ? "text-amber-600" : "text-red-600"
                }`}>
                  {contact.leadScore}/10
                </div>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <a href={`mailto:${contact.email}`} className="block text-sm text-violet-600 hover:underline">
                  {contact.email}
                </a>
              </div>
              {contact.phone && (
                <div>
                  <label className="text-xs text-gray-500">Phone</label>
                  <p className="text-sm text-gray-900">{contact.phone}</p>
                </div>
              )}
              {contact.linkedinUrl && (
                <div>
                  <label className="text-xs text-gray-500">LinkedIn</label>
                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Linkedin className="h-4 w-4" />
                    Profile
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Company Info */}
          {contact.companyName && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Company</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">{contact.companyName}</span>
                </div>
                {contact.companyDescription && (
                  <p className="text-sm text-gray-600">{contact.companyDescription}</p>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {contact.companySize && (
                    <div>
                      <label className="text-xs text-gray-500">Size</label>
                      <p className="text-gray-900">{contact.companySize}</p>
                    </div>
                  )}
                  {contact.industry && (
                    <div>
                      <label className="text-xs text-gray-500">Industry</label>
                      <p className="text-gray-900">{contact.industry}</p>
                    </div>
                  )}
                  {contact.companyCountry && (
                    <div>
                      <label className="text-xs text-gray-500">Location</label>
                      <p className="text-gray-900">{contact.companyCountry}</p>
                    </div>
                  )}
                </div>
                {contact.techStack && contact.techStack.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500">Tech Stack</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.techStack.map((tech, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buying Signals */}
          {contact.buyingSignals && contact.buyingSignals.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4">
              <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Buying Signals
              </h3>
              <ul className="space-y-2">
                {contact.buyingSignals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Engagement Stats */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Engagement</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{contact.totalEmailsSent || 0}</div>
                <div className="text-xs text-gray-500">Sent</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{contact.totalEmailsOpened || 0}</div>
                <div className="text-xs text-gray-500">Opened</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{contact.totalEmailsClicked || 0}</div>
                <div className="text-xs text-gray-500">Clicked</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-violet-600">{contact.totalReplies || 0}</div>
                <div className="text-xs text-gray-500">Replies</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Last contacted: {formatDate(contact.lastContactedAt)}
            </div>
          </div>

          {/* AI Enrich Button */}
          {contact.enrichmentStatus !== "completed" && (
            <Button
              onClick={() => onEnrich(contact.id)}
              disabled={enriching}
              className="w-full gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
            >
              {enriching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Enrich with AI
                </>
              )}
            </Button>
          )}

          {/* Score Reasons */}
          {contact.scoreReasons && contact.scoreReasons.length > 0 && (
            <div className="border rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Why this score?</h3>
              <ul className="space-y-2">
                {contact.scoreReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
