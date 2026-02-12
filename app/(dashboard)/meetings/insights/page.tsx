"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Video,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  Play,
  FileText,
  MessageSquare,
  CheckSquare,
  Building2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface MeetingInsight {
  id: string;
  meetingTitle: string;
  summary: string;
  occurredAt: string;
  contact: {
    id: string;
    name: string;
    email: string;
    company: string;
    stage: string;
  } | null;
  sentiment: string;
  hasInterest: boolean;
  duration: number;
  actionItemsCount: number;
  keyInsights: string[];
  nextSteps: string[];
  attendees: { name: string; email: string }[];
  recordingUrl: string | null;
  transcript: { speaker: string; text: string }[];
}

interface InsightStats {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  withInterest: number;
  avgDuration: number;
  totalActionItems: number;
}

const SENTIMENT_CONFIG = {
  positive: { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", label: "Positive" },
  neutral: { icon: Minus, color: "text-gray-600", bg: "bg-gray-50", label: "Neutral" },
  negative: { icon: TrendingDown, color: "text-red-600", bg: "bg-red-50", label: "Negative" },
  unclear: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Unclear" },
};

export default function MeetingInsightsPage() {
  const [insights, setInsights] = useState<MeetingInsight[]>([]);
  const [stats, setStats] = useState<InsightStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [interestFilter, setInterestFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedInsight, setSelectedInsight] = useState<MeetingInsight | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [sentimentFilter, interestFilter, dateFrom, dateTo]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sentimentFilter !== "all") params.append("sentiment", sentimentFilter);
      if (interestFilter) params.append("hasInterest", "true");
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/meetings/insights?${params}`);
      const data = await res.json();

      if (data.insights) {
        setInsights(data.insights);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/meetings" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </Link>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Meeting Insights</h1>
              <p className="text-sm text-gray-500">
                AI-analyzed meeting transcripts from Circleback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Circleback Sync Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <span className="text-sm text-gray-600">Circleback Sync</span>
              <button
                onClick={() => setSyncEnabled(!syncEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  syncEnabled ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    syncEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
              {syncEnabled && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active
                </span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchInsights}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchInsights()}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          {/* Sentiment Filter */}
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="unclear">Unclear</option>
          </select>

          {/* Interest Filter */}
          <label className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white cursor-pointer">
            <input
              type="checkbox"
              checked={interestFilter}
              onChange={(e) => setInterestFilter(e.target.checked)}
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <span>Shows Interest</span>
          </label>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="px-6 py-4 bg-white border-b">
          <div className="grid grid-cols-6 gap-4">
            <StatCard label="Total Meetings" value={stats.total} icon={Video} color="violet" />
            <StatCard label="Positive" value={stats.positive} icon={TrendingUp} color="emerald" />
            <StatCard label="Neutral" value={stats.neutral} icon={Minus} color="gray" />
            <StatCard label="Negative" value={stats.negative} icon={TrendingDown} color="red" />
            <StatCard label="With Interest" value={stats.withInterest} icon={Sparkles} color="amber" />
            <StatCard label="Action Items" value={stats.totalActionItems} icon={CheckSquare} color="blue" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : insights.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Video className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No meeting insights yet</h3>
              <p className="text-gray-500 mt-1">
                Meeting transcripts from Circleback will appear here
              </p>
              <div className="mt-4 p-4 bg-violet-50 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-violet-800">
                  <strong>Setup:</strong> Add your webhook URL to Circleback automations:
                </p>
                <code className="block mt-2 p-2 bg-white rounded text-xs break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/circleback
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {insights.map((insight) => (
              <MeetingCard
                key={insight.id}
                insight={insight}
                onClick={() => setSelectedInsight(insight)}
                formatDuration={formatDuration}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedInsight && (
        <InsightDetailPanel
          insight={selectedInsight}
          onClose={() => setSelectedInsight(null)}
          formatDuration={formatDuration}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    gray: "bg-gray-50 text-gray-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function MeetingCard({
  insight,
  onClick,
  formatDuration,
  formatDate,
}: {
  insight: MeetingInsight;
  onClick: () => void;
  formatDuration: (s: number) => string;
  formatDate: (s: string) => string;
}) {
  const sentimentConfig = SENTIMENT_CONFIG[insight.sentiment as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.unclear;
  const SentimentIcon = sentimentConfig.icon;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{insight.meetingTitle}</h3>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sentimentConfig.bg} ${sentimentConfig.color}`}>
              <SentimentIcon className="h-3 w-3" />
              {sentimentConfig.label}
            </div>
            {insight.hasInterest && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                <Sparkles className="h-3 w-3" />
                Interest Shown
              </div>
            )}
          </div>

          {insight.contact && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>{insight.contact.name}</span>
              {insight.contact.company && (
                <>
                  <span className="text-gray-300">•</span>
                  <Building2 className="h-4 w-4" />
                  <span>{insight.contact.company}</span>
                </>
              )}
            </div>
          )}

          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{insight.summary}</p>
        </div>

        <div className="flex flex-col items-end gap-2 ml-4">
          <div className="text-sm text-gray-500">{formatDate(insight.occurredAt)}</div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            {formatDuration(insight.duration)}
          </div>
          {insight.actionItemsCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs">
              <CheckSquare className="h-3 w-3" />
              {insight.actionItemsCount} action items
            </div>
          )}
        </div>
      </div>

      {insight.keyInsights.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
          {insight.keyInsights.slice(0, 3).map((point, i) => (
            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
              {point.slice(0, 50)}{point.length > 50 ? "..." : ""}
            </span>
          ))}
          {insight.keyInsights.length > 3 && (
            <span className="px-2 py-1 text-gray-400 text-xs">
              +{insight.keyInsights.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function InsightDetailPanel({
  insight,
  onClose,
  formatDuration,
  formatDate,
}: {
  insight: MeetingInsight;
  onClose: () => void;
  formatDuration: (s: number) => string;
  formatDate: (s: string) => string;
}) {
  const sentimentConfig = SENTIMENT_CONFIG[insight.sentiment as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.unclear;
  const SentimentIcon = sentimentConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{insight.meetingTitle}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{formatDate(insight.occurredAt)}</span>
              <span>•</span>
              <span>{formatDuration(insight.duration)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sentiment & Interest */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${sentimentConfig.bg} ${sentimentConfig.color}`}>
              <SentimentIcon className="h-4 w-4" />
              <span className="font-medium">{sentimentConfig.label} Sentiment</span>
            </div>
            {insight.hasInterest && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Interest Shown</span>
              </div>
            )}
          </div>

          {/* Contact */}
          {insight.contact && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                  <span className="text-violet-600 font-semibold">
                    {insight.contact.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{insight.contact.name}</div>
                  <div className="text-sm text-gray-500">{insight.contact.email}</div>
                  {insight.contact.company && (
                    <div className="text-sm text-gray-500">{insight.contact.company}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
            <p className="text-gray-600">{insight.summary}</p>
          </div>

          {/* Key Insights */}
          {insight.keyInsights.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Key Insights</h3>
              <ul className="space-y-2">
                {insight.keyInsights.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-600">
                    <CheckCircle className="h-4 w-4 mt-1 text-violet-500 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {insight.nextSteps.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Next Steps
              </h3>
              <ul className="space-y-2">
                {insight.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-blue-800">
                    <span className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Attendees */}
          {insight.attendees.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Attendees</h3>
              <div className="flex flex-wrap gap-2">
                {insight.attendees.map((attendee, i) => (
                  <div key={i} className="px-3 py-2 bg-gray-100 rounded-lg text-sm">
                    <div className="font-medium text-gray-900">{attendee.name}</div>
                    <div className="text-gray-500 text-xs">{attendee.email}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recording */}
          {insight.recordingUrl && (
            <a
              href={insight.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Play className="h-5 w-5" />
              <span className="font-medium">Watch Recording</span>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </a>
          )}

          {/* Transcript Preview */}
          {insight.transcript.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Transcript Preview</h3>
              <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto space-y-3">
                {insight.transcript.map((segment, i) => (
                  <div key={i}>
                    <span className="font-medium text-violet-600">{segment.speaker}:</span>
                    <span className="text-gray-600 ml-2">{segment.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
