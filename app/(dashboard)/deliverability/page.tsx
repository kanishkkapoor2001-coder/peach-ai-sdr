"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Mail,
  Server,
  Globe,
  TrendingUp,
  TrendingDown,
  Zap,
  ChevronRight,
  Info,
  AlertCircle,
  Loader2,
  Activity,
  Eye,
  MousePointerClick,
  MessageSquare,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// ============================================
// TYPES
// ============================================

interface DomainHealth {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  sendingMethod: string;
  isActive: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  health: {
    score: number | null;
    status: string | null;
    lastCheck: string | null;
    spf: string | null;
    dkim: string | null;
    dmarc: string | null;
    mx: string | null;
    isBlacklisted: boolean | null;
    recommendations: string[];
  };
  warmup: {
    startDate: string | null;
    schedule: string | null;
    sentToday: number;
    dailyLimit: number;
  };
  throttling: {
    currentDelayMs: number;
    bounceCountToday: number;
    complaintCountToday: number;
  };
}

interface HealthSummary {
  total: number;
  excellent: number;
  good: number;
  warning: number;
  critical: number;
  unchecked: number;
  averageScore: number;
}

interface TrackingStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  totalOpens: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  clickToOpenRate: number;
}

// ============================================
// ANIMATED NUMBER COMPONENT
// ============================================

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
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

  return (
    <span className="tabular-nums">
      {displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DeliverabilityPage() {
  const [domains, setDomains] = useState<DomainHealth[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainHealth | null>(null);
  const [checkingDomain, setCheckingDomain] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
    fetchTrackingStats();
  }, []);

  const fetchTrackingStats = async () => {
    try {
      const res = await fetch("/api/track/stats?period=7d");
      const data = await res.json();
      if (!data.error) {
        setTrackingStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch tracking stats:", error);
    }
  };

  const fetchHealthData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const url = forceRefresh
        ? "/api/domains/health-summary?refresh=true"
        : "/api/domains/health-summary";

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error("Error fetching health data:", data.error);
        return;
      }

      setDomains(data.domains || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkSingleDomain = async (domainId: string) => {
    setCheckingDomain(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}/health`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        await fetchHealthData();
      }
    } catch (error) {
      console.error("Failed to check domain:", error);
    } finally {
      setCheckingDomain(null);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 90) return "text-emerald-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreGradient = (score: number | null) => {
    if (score === null) return "from-gray-400 to-gray-500";
    if (score >= 90) return "from-emerald-400 to-emerald-600";
    if (score >= 70) return "from-blue-400 to-blue-600";
    if (score >= 50) return "from-amber-400 to-amber-600";
    return "from-red-400 to-red-600";
  };

  const getStatusBadge = (status: string | null) => {
    const styles: Record<string, string> = {
      excellent: "bg-emerald-100 text-emerald-700",
      good: "bg-blue-100 text-blue-700",
      warning: "bg-amber-100 text-amber-700",
      critical: "bg-red-100 text-red-700",
    };
    return styles[status || ""] || "bg-gray-100 text-gray-700";
  };

  const getDNSIcon = (status: string | null) => {
    if (status === "valid") return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (status === "invalid") return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  // Chart data for health distribution
  const healthDistribution = summary
    ? [
        { name: "Excellent", value: summary.excellent, color: "#10b981" },
        { name: "Good", value: summary.good, color: "#3b82f6" },
        { name: "Warning", value: summary.warning, color: "#f59e0b" },
        { name: "Critical", value: summary.critical, color: "#ef4444" },
      ].filter((item) => item.value > 0)
    : [];

  // Mock email activity data (would come from API)
  const emailActivityData = [
    { name: "Mon", sent: 120, delivered: 118, opened: 45, bounced: 2 },
    { name: "Tue", sent: 150, delivered: 148, opened: 62, bounced: 2 },
    { name: "Wed", sent: 180, delivered: 175, opened: 78, bounced: 5 },
    { name: "Thu", sent: 140, delivered: 138, opened: 55, bounced: 2 },
    { name: "Fri", sent: 200, delivered: 196, opened: 85, bounced: 4 },
    { name: "Sat", sent: 80, delivered: 79, opened: 32, bounced: 1 },
    { name: "Sun", sent: 60, delivered: 59, opened: 24, bounced: 1 },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25">
              <Shield className="h-8 w-8 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-gray-500 font-medium">Loading deliverability data...</p>
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
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Deliverability</h1>
          </div>
          <p className="text-gray-500">
            Monitor domain health, DNS configuration, and email performance
          </p>
        </div>
        <Button
          onClick={() => fetchHealthData(true)}
          disabled={refreshing}
          className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Checking..." : "Refresh All"}
        </Button>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* Health Score Card */}
        {summary && (
          <div className="col-span-1 stat-card group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Health Score</span>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${getScoreGradient(summary.averageScore)} shadow-lg`}>
                <Activity className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(summary.averageScore)}`}>
              <AnimatedNumber value={summary.averageScore} />
            </p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 font-medium">+5 pts</span>
              <span className="text-sm text-gray-400 ml-1">vs last week</span>
            </div>
          </div>
        )}

        {/* Email Performance Cards */}
        {trackingStats && (
          <>
            <div className="stat-card group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Open Rate</span>
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
                  <Eye className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedNumber value={trackingStats.openRate} suffix="%" />
              </p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(trackingStats.openRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="stat-card group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Click Rate</span>
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/25">
                  <MousePointerClick className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedNumber value={trackingStats.clickRate} suffix="%" />
              </p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(trackingStats.clickRate * 5, 100)}%` }}
                />
              </div>
            </div>

            <div className="stat-card group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Reply Rate</span>
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 shadow-lg shadow-violet-500/25">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                <AnimatedNumber value={trackingStats.replyRate} suffix="%" />
              </p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(trackingStats.replyRate * 10, 100)}%` }}
                />
              </div>
            </div>

            <div className="stat-card group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Bounce Rate</span>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${trackingStats.bounceRate > 5 ? "from-red-400 to-red-600" : "from-gray-400 to-gray-600"} shadow-lg`}>
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className={`text-3xl font-bold ${trackingStats.bounceRate > 5 ? "text-red-600" : "text-gray-900"}`}>
                <AnimatedNumber value={trackingStats.bounceRate} suffix="%" />
              </p>
              <div className="flex items-center gap-1 mt-2">
                {trackingStats.bounceRate <= 2 ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">Healthy</span>
                  </>
                ) : trackingStats.bounceRate <= 5 ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Monitor</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">High</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Email Activity Chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Email Activity</h3>
              <p className="text-sm text-gray-500">Last 7 days performance</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-500" />
                <span className="text-gray-600">Sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-gray-600">Opened</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-gray-600">Bounced</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={emailActivityData}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorSent)"
                />
                <Area
                  type="monotone"
                  dataKey="opened"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorOpened)"
                />
                <Area
                  type="monotone"
                  dataKey="bounced"
                  stroke="#f87171"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Distribution Pie Chart */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900">Domain Health</h3>
            <p className="text-sm text-gray-500">{summary?.total || 0} domains</p>
          </div>
          {healthDistribution.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {healthDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {healthDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900 ml-auto">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <Globe className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No domains configured</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Domains List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Sending Domains</h2>
              <p className="text-sm text-gray-500 mt-1">
                {domains.length} domain{domains.length !== 1 ? "s" : ""} configured
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <Globe className="h-4 w-4" />
              Add Domain
            </Button>
          </div>
        </div>

        {domains.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <Globe className="h-8 w-8 text-violet-500" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No domains configured</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Add a sending domain to start monitoring deliverability and sending emails
            </p>
            <Button className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white">
              <Sparkles className="h-4 w-4 mr-2" />
              Add Your First Domain
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className={`p-5 hover:bg-gray-50/50 transition-all duration-200 ${
                  selectedDomain?.id === domain.id ? "bg-violet-50/50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Score Circle */}
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getScoreGradient(
                        domain.health.score
                      )} flex items-center justify-center shadow-lg`}
                    >
                      <span className="text-lg font-bold text-white">
                        {domain.health.score ?? "?"}
                      </span>
                    </div>

                    {/* Domain Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{domain.domain}</h3>
                        {domain.isPaused && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                            Paused
                          </span>
                        )}
                        {domain.health.isBlacklisted && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            Blacklisted
                          </span>
                        )}
                        {domain.health.status && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusBadge(domain.health.status)}`}>
                            {domain.health.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {domain.fromName} &lt;{domain.fromEmail}&gt;
                      </p>
                    </div>
                  </div>

                  {/* Right side info */}
                  <div className="flex items-center gap-8">
                    {/* DNS Status */}
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1" title="SPF">
                        {getDNSIcon(domain.health.spf)}
                        <span className="text-[10px] text-gray-400 font-medium">SPF</span>
                      </div>
                      <div className="flex flex-col items-center gap-1" title="DKIM">
                        {getDNSIcon(domain.health.dkim)}
                        <span className="text-[10px] text-gray-400 font-medium">DKIM</span>
                      </div>
                      <div className="flex flex-col items-center gap-1" title="DMARC">
                        {getDNSIcon(domain.health.dmarc)}
                        <span className="text-[10px] text-gray-400 font-medium">DMARC</span>
                      </div>
                    </div>

                    {/* Warmup Progress */}
                    <div className="text-right min-w-[100px]">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {domain.warmup.sentToday}
                        </span>
                        <span className="text-sm text-gray-400">/</span>
                        <span className="text-sm text-gray-500">
                          {domain.warmup.dailyLimit}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden w-20 ml-auto">
                        <div
                          className="h-full bg-gradient-to-r from-violet-400 to-indigo-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              (domain.warmup.sentToday / domain.warmup.dailyLimit) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">emails today</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkSingleDomain(domain.id)}
                        disabled={checkingDomain === domain.id}
                        className="h-9 w-9 p-0"
                      >
                        {checkingDomain === domain.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedDomain(
                            selectedDomain?.id === domain.id ? null : domain
                          )
                        }
                        className="h-9 w-9 p-0"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform duration-200 ${
                            selectedDomain?.id === domain.id ? "rotate-90" : ""
                          }`}
                        />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedDomain?.id === domain.id && (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-6">
                      {/* DNS Configuration */}
                      <div className="bg-gray-50/50 rounded-xl p-4">
                        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                          <Server className="h-4 w-4 text-violet-500" />
                          DNS Configuration
                        </h4>
                        <div className="space-y-3">
                          {["spf", "dkim", "dmarc", "mx"].map((record) => (
                            <div
                              key={record}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"
                            >
                              <span className="text-sm text-gray-600 uppercase font-medium">
                                {record}
                              </span>
                              <span
                                className={`text-sm font-medium capitalize ${
                                  (domain.health as any)[record] === "valid"
                                    ? "text-emerald-600"
                                    : (domain.health as any)[record] === "invalid"
                                    ? "text-red-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {(domain.health as any)[record] || "Not checked"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Warmup Status */}
                      <div className="bg-gray-50/50 rounded-xl p-4">
                        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Warmup Status
                        </h4>
                        <div className="space-y-3">
                          <div className="p-3 bg-white rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Schedule</p>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {domain.warmup.schedule || "Standard"}
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Daily Limit</p>
                            <p className="text-sm font-medium text-gray-900">
                              {domain.warmup.dailyLimit} emails/day
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Throttle Delay</p>
                            <p className="text-sm font-medium text-gray-900">
                              {(domain.throttling.currentDelayMs / 1000).toFixed(0)}s between sends
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div className="bg-gray-50/50 rounded-xl p-4">
                        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Recommendations
                        </h4>
                        {domain.health.recommendations.length > 0 ? (
                          <ul className="space-y-2">
                            {domain.health.recommendations.map((rec, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm text-gray-600 p-3 bg-amber-50 rounded-lg border border-amber-100"
                              >
                                <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="p-6 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm font-medium text-emerald-700">
                              All checks passed!
                            </p>
                            <p className="text-xs text-emerald-600 mt-1">
                              Your domain is configured correctly
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Last Checked */}
                    {domain.health.lastCheck && (
                      <p className="text-xs text-gray-400 mt-4 text-right">
                        Last checked: {new Date(domain.health.lastCheck).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 flex-shrink-0">
            <Info className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Understanding Your Deliverability Score
            </h3>
            <div className="grid grid-cols-4 gap-6 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <p className="font-medium text-gray-800">SPF (25 pts)</p>
                </div>
                <p className="text-gray-600">
                  Authorizes which servers can send email for your domain
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <p className="font-medium text-gray-800">DKIM (25 pts)</p>
                </div>
                <p className="text-gray-600">
                  Cryptographically signs emails to verify authenticity
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="font-medium text-gray-800">DMARC (25 pts)</p>
                </div>
                <p className="text-gray-600">
                  Tells receivers what to do with failed authentication
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <p className="font-medium text-gray-800">Blacklists (15 pts)</p>
                </div>
                <p className="text-gray-600">
                  Checks if your domain/IP is on spam blacklists
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
